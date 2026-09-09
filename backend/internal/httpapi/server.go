package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"hoopstat/internal/catalog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	pool          *pgxpool.Pool
	geminiKey     string
	sessionSecret string
	aiLimit       hitLimiter
	authLimit     hitLimiter
}

func New(pool *pgxpool.Pool, geminiKey, sessionSecret string) http.Handler {
	s := &Server{pool: pool, geminiKey: geminiKey, sessionSecret: sessionSecret}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/audit/roles", s.auditRoles)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.HandleFunc("GET /api/auth/me", s.me)
	mux.HandleFunc("POST /api/gemini/batch-ocr", s.requireAuth(s.rateLimitedOCR(s.batchOCR)))
	mux.HandleFunc("POST /api/gemini/generate", s.requireAuth(s.generate))
	mux.HandleFunc("POST /api/stores/batch", s.requireAuth(s.batch))
	mux.HandleFunc("POST /api/admin/wipe", s.requireAdmin(s.wipe))
	mux.HandleFunc("GET /api/stores/{store}", s.publicReadOrAuth(s.list))
	mux.HandleFunc("GET /api/stores/{store}/{id}", s.publicReadOrAuth(s.get))
	mux.HandleFunc("PUT /api/stores/{store}/{id}", s.requireAuth(s.put))
	mux.HandleFunc("POST /api/stores/{store}", s.publicCreateOrAuth(s.create))
	mux.HandleFunc("DELETE /api/stores/{store}/{id}", s.requireAuth(s.remove))
	mux.HandleFunc("DELETE /api/stores/{store}", s.requireAdmin(s.clear))
	return withSecurity(withMaxBody(mux))
}

func withSecurity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

func withMaxBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status":    "degraded",
			"db":        false,
			"error":     err.Error(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"db":        true,
		"backend":   "go",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) auditRoles(w http.ResponseWriter, r *http.Request) {
	item, err := s.getDoc(r.Context(), "role_audits", "latest")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if item == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":    "belum_ada",
			"healthPct": 0,
			"message":   "belum ada audit. jalankan backend/cmd/roleaudit",
		})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	store := r.PathValue("store")
	user := userFrom(r)
	if err := s.authorizeRead(r.Context(), user, store, ""); err != nil {
		writeForbidden(w)
		return
	}
	indexName := r.URL.Query().Get("index")
	eq := r.URL.Query().Get("eq")
	if indexName != "" && eq == "" {
		writeErr(w, http.StatusBadRequest, errors.New("index query requires eq"))
		return
	}
	items, err := s.listDocs(r.Context(), store, indexName, eq)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	items = s.filterList(r.Context(), user, store, items)
	if store == "claim_requests" {
		items = redactClaims(items)
	}
	for i := range items {
		items[i] = publicDoc(store, items[i])
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	store := r.PathValue("store")
	id := r.PathValue("id")
	user := userFrom(r)
	if err := s.authorizeRead(r.Context(), user, store, id); err != nil {
		writeForbidden(w)
		return
	}
	item, err := s.getDoc(r.Context(), store, id)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if item == nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	filtered := s.filterList(r.Context(), user, store, []map[string]any{item})
	if len(filtered) == 0 {
		writeForbidden(w)
		return
	}
	item = filtered[0]
	if store == "claim_requests" {
		if s.allowClaimBodies(r.Context(), user, item) {
			item = s.hydrateClaimDocs(r.Context(), item)
		} else {
			item = stripClaimBodies(item)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": publicDoc(store, item)})
}

func (s *Server) put(w http.ResponseWriter, r *http.Request) {
	store := r.PathValue("store")
	def, err := catalog.Assert(store)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body, err := readDoc(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if def.PK == "id" || body[def.PK] == nil || fmt.Sprint(body[def.PK]) == "" {
		if def.Serial {
			if body["id"] == nil {
				body[def.PK] = r.PathValue("id")
			}
		} else {
			body[def.PK] = r.PathValue("id")
		}
	}
	existing, _ := s.getDoc(r.Context(), store, r.PathValue("id"))
	user := userFrom(r)
	if err := s.authorizeWrite(r.Context(), user, store, existing, body); err != nil {
		writeForbidden(w)
		return
	}
	body, err = s.sanitizeWrite(r.Context(), user, store, existing, body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.putDoc(r.Context(), s.pool, store, body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": item})
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	store := r.PathValue("store")
	body, err := readDoc(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	user := userFrom(r)
	if err := s.authorizeWrite(r.Context(), user, store, nil, body); err != nil {
		writeForbidden(w)
		return
	}
	body, err = s.sanitizeWrite(r.Context(), user, store, nil, body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.putDoc(r.Context(), s.pool, store, body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}

func (s *Server) remove(w http.ResponseWriter, r *http.Request) {
	store := r.PathValue("store")
	if _, err := catalog.Assert(store); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	existing, _ := s.getDoc(r.Context(), store, r.PathValue("id"))
	if err := s.authorizeWrite(r.Context(), userFrom(r), store, existing, existing); err != nil {
		writeForbidden(w)
		return
	}
	if err := s.deleteDoc(r.Context(), s.pool, store, r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) clear(w http.ResponseWriter, r *http.Request) {
	if _, err := catalog.Assert(r.PathValue("store")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.clearStore(r.Context(), s.pool, r.PathValue("store")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type batchOp struct {
	Op    string         `json:"op"`
	Store string         `json:"store"`
	ID    any            `json:"id"`
	Doc   map[string]any `json:"doc"`
}

func (s *Server) batch(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Ops []batchOp `json:"ops"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(r.Context())

	var lastPut map[string]any
	user := userFrom(r)
	for _, op := range payload.Ops {
		if _, err := catalog.Assert(op.Store); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		switch op.Op {
		case "put":
			existing, _ := s.getDoc(r.Context(), op.Store, catalog.ExtractPK(op.Store, op.Doc))
			if err := s.authorizeWrite(r.Context(), user, op.Store, existing, op.Doc); err != nil {
				writeForbidden(w)
				return
			}
			op.Doc, err = s.sanitizeWrite(r.Context(), user, op.Store, existing, op.Doc)
			if err != nil {
				writeErr(w, http.StatusBadRequest, err)
				return
			}
			lastPut, err = s.putDoc(r.Context(), tx, op.Store, op.Doc)
		case "delete":
			existing, _ := s.getDoc(r.Context(), op.Store, fmt.Sprint(op.ID))
			if err := s.authorizeWrite(r.Context(), user, op.Store, existing, existing); err != nil {
				writeForbidden(w)
				return
			}
			err = s.deleteDoc(r.Context(), tx, op.Store, fmt.Sprint(op.ID))
		case "clear":
			writeForbidden(w)
			return
		default:
			err = fmt.Errorf("unknown batch op")
		}
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "lastPut": lastPut})
}

func (s *Server) wipe(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("HOOPSTAT_ENV") == "production" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "wipe disabled in production"})
		return
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(r.Context())
	for _, store := range catalog.Names() {
		if err := s.clearStore(r.Context(), tx, store); err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type dbx interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (s *Server) putDoc(ctx context.Context, q dbx, store string, incoming map[string]any) (map[string]any, error) {
	def, err := catalog.Assert(store)
	if err != nil {
		return nil, err
	}
	ident, err := catalog.Ident(store)
	if err != nil {
		return nil, err
	}
	doc := catalog.StripVideo(store, incoming)

	if def.Serial {
		if id := catalog.ExtractPK(store, doc); id != "" && id != "<nil>" {
			n, convErr := strconv.ParseInt(id, 10, 64)
			if convErr != nil {
				return nil, convErr
			}
			raw, _ := json.Marshal(doc)
			_, err = q.Exec(ctx, `INSERT INTO `+ident+` (id, doc, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`, n, raw)
			return doc, err
		}
		raw, _ := json.Marshal(doc)
		var newID int64
		if err := q.QueryRow(ctx, `INSERT INTO `+ident+` (doc, updated_at) VALUES ($1::jsonb, now()) RETURNING id`, raw).Scan(&newID); err != nil {
			return nil, err
		}
		doc["id"] = newID
		raw, _ = json.Marshal(doc)
		_, err = q.Exec(ctx, `UPDATE `+ident+` SET doc = $2::jsonb, updated_at = now() WHERE id = $1`, newID, raw)
		return doc, err
	}

	id := catalog.ExtractPK(store, doc)
	if id == "" || id == "<nil>" {
		return nil, fmt.Errorf("missing primary key '%s' for store %s", def.PK, store)
	}
	if def.PK != "id" {
		if _, ok := doc["id"]; !ok {
			doc["id"] = id
		}
	}
	if store == "user_accounts" {
		if err := mergeUserSecrets(ctx, q, ident, id, doc); err != nil {
			return nil, err
		}
	}
	if store == "claim_requests" {
		if err := persistClaimDocs(ctx, q, id, doc); err != nil {
			return nil, err
		}
	}
	raw, _ := json.Marshal(doc)
	_, err = q.Exec(ctx, `INSERT INTO `+ident+` (id, doc, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`, id, raw)
	return publicDoc(store, doc), err
}

func (s *Server) getDoc(ctx context.Context, store, id string) (map[string]any, error) {
	ident, err := catalog.Ident(store)
	if err != nil {
		return nil, err
	}
	var rowID any
	var raw []byte
	err = s.pool.QueryRow(ctx, `SELECT id, doc FROM `+ident+` WHERE id::text = $1`, id).Scan(&rowID, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return rowDoc(store, rowID, raw)
}

func (s *Server) listDocs(ctx context.Context, store, indexName, indexValue string) ([]map[string]any, error) {
	def, err := catalog.Assert(store)
	if err != nil {
		return nil, err
	}
	ident, err := catalog.Ident(store)
	if err != nil {
		return nil, err
	}
	var rows pgx.Rows
	if indexName == "" {
		rows, err = s.pool.Query(ctx, `SELECT id, doc FROM `+ident+` ORDER BY updated_at DESC`)
	} else {
		field, ok := def.Indexes[indexName]
		if !ok {
			return nil, fmt.Errorf("unknown index %s on %s", indexName, store)
		}
		rows, err = s.pool.Query(ctx, `SELECT id, doc FROM `+ident+` WHERE doc->>$1 = $2 ORDER BY updated_at DESC`, field, indexValue)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var rowID any
		var raw []byte
		if err := rows.Scan(&rowID, &raw); err != nil {
			return nil, err
		}
		doc, err := rowDoc(store, rowID, raw)
		if err != nil {
			return nil, err
		}
		items = append(items, doc)
	}
	return items, rows.Err()
}

func (s *Server) deleteDoc(ctx context.Context, q dbx, store, id string) error {
	ident, err := catalog.Ident(store)
	if err != nil {
		return err
	}
	if store == "claim_requests" {
		if _, err := q.Exec(ctx, `DELETE FROM claim_docs WHERE claim_id = $1`, id); err != nil {
			return err
		}
	}
	_, err = q.Exec(ctx, `DELETE FROM `+ident+` WHERE id::text = $1`, id)
	return err
}

func (s *Server) clearStore(ctx context.Context, q dbx, store string) error {
	ident, err := catalog.Ident(store)
	if err != nil {
		return err
	}
	if store == "claim_requests" {
		if _, err := q.Exec(ctx, `TRUNCATE TABLE claim_docs`); err != nil {
			return err
		}
	}
	_, err = q.Exec(ctx, `TRUNCATE TABLE `+ident+` RESTART IDENTITY`)
	return err
}

func rowDoc(store string, rowID any, raw []byte) (map[string]any, error) {
	doc := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil, err
		}
	}
	def, _ := catalog.Assert(store)
	if def.Serial {
		switch v := rowID.(type) {
		case int64:
			doc["id"] = v
		case int32:
			doc["id"] = int64(v)
		default:
			n, _ := strconv.ParseInt(fmt.Sprint(rowID), 10, 64)
			doc["id"] = n
		}
	} else if _, ok := doc[def.PK]; !ok {
		doc[def.PK] = fmt.Sprint(rowID)
	}
	return doc, nil
}

func readDoc(r *http.Request) (map[string]any, error) {
	body := map[string]any{}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	if body == nil {
		body = map[string]any{}
	}
	return body, nil
}
