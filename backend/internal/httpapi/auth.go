package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookie = "hs"
	sessionTTL    = 30 * 24 * time.Hour
)

type ctxUser struct{}

func publicDoc(store string, doc map[string]any) map[string]any {
	if store == "user_accounts" {
		delete(doc, "passwordHash")
		delete(doc, "passwordSalt")
	}
	return doc
}

func mergeUserSecrets(ctx context.Context, q dbx, ident, id string, doc map[string]any) error {
	inHash, _ := doc["passwordHash"].(string)
	delete(doc, "passwordHash")
	delete(doc, "passwordSalt")
	var raw []byte
	err := q.QueryRow(ctx, `SELECT doc FROM `+ident+` WHERE id::text = $1`, id).Scan(&raw)
	if err == nil {
		existing := map[string]any{}
		if json.Unmarshal(raw, &existing) == nil {
			if h, ok := existing["passwordHash"]; ok {
				doc["passwordHash"] = h
			}
			if h, ok := existing["passwordSalt"]; ok {
				doc["passwordSalt"] = h
			}
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if strings.HasPrefix(inHash, "$2") {
		doc["passwordHash"] = inHash
		return nil
	}
	return fmt.Errorf("register via /api/auth/register")
}

func signSession(secret, userID string, exp time.Time) string {
	expUnix := strconv.FormatInt(exp.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(userID + "|" + expUnix))
	return base64.RawURLEncoding.EncodeToString([]byte(userID)) + "." + expUnix + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func parseSession(secret, token string) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", false
	}
	uidB, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || len(uidB) == 0 {
		return "", false
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(string(uidB) + "|" + parts[1]))
	want := mac.Sum(nil)
	got, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || subtle.ConstantTimeCompare(want, got) != 1 {
		return "", false
	}
	return string(uidB), true
}

func newUserID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *Server) setSession(w http.ResponseWriter, r *http.Request, userID string) {
	exp := time.Now().Add(sessionTTL)
	secure := r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    signSession(s.sessionSecret, userID, exp),
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionTTL.Seconds()),
	})
}

func (s *Server) clearSession(w http.ResponseWriter, r *http.Request) {
	secure := r != nil && (r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"))
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		MaxAge:   -1,
	})
}

func (s *Server) sessionUser(r *http.Request) (map[string]any, error) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil, nil
	}
	uid, ok := parseSession(s.sessionSecret, c.Value)
	if !ok {
		return nil, nil
	}
	return s.getDoc(r.Context(), "user_accounts", uid)
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, err := s.sessionUser(r)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		if u == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		if fmt.Sprint(u["status"]) == "suspended" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun Anda ditangguhkan (suspended). Silakan hubungi admin."})
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxUser{}, u)))
	}
}

func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		u, _ := r.Context().Value(ctxUser{}).(map[string]any)
		if fmt.Sprint(u["role"]) != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		next(w, r)
	})
}

func publicRead(store string) bool  { return store == "site_content" }
func publicCreate(store string) bool { return store == "leads" }

func (s *Server) publicReadOrAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if publicRead(r.PathValue("store")) {
			next(w, r)
			return
		}
		s.requireAuth(next)(w, r)
	}
}

func (s *Server) publicCreateOrAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if publicCreate(r.PathValue("store")) {
			next(w, r)
			return
		}
		s.requireAuth(next)(w, r)
	}
}

func clientIP(r *http.Request) string {
	if x := r.Header.Get("X-Forwarded-For"); x != "" {
		return strings.TrimSpace(strings.Split(x, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	if !s.authLimit.allow("reg:"+clientIP(r), 8, 10*time.Minute) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak percobaan. Coba lagi nanti."})
		return
	}
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" || body.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama dan email wajib diisi"})
		return
	}
	if len(body.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password minimal harus 6 karakter"})
		return
	}
	existing, err := s.userByEmail(r.Context(), body.Email)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if existing != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email sudah terdaftar"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	role := "customer"
	var n int64
	if err := s.pool.QueryRow(r.Context(), `SELECT count(*) FROM user_accounts`).Scan(&n); err == nil && n == 0 {
		role = "admin"
	}
	doc := map[string]any{
		"id":           newUserID(),
		"name":         body.Name,
		"email":        body.Email,
		"role":         role,
		"status":       "active",
		"createdAt":    time.Now().UnixMilli(),
		"passwordHash": string(hash),
	}
	item, err := s.putDoc(r.Context(), s.pool, "user_accounts", doc)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	s.setSession(w, r, fmt.Sprint(item["id"]))
	writeJSON(w, http.StatusCreated, map[string]any{"user": item})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if !s.authLimit.allow("login:"+clientIP(r), 10, 10*time.Minute) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak percobaan. Coba lagi nanti."})
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password wajib diisi"})
		return
	}
	user, err := s.userByEmail(r.Context(), strings.ToLower(strings.TrimSpace(body.Email)))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Email atau password salah"})
		return
	}
	hash, _ := user["passwordHash"].(string)
	if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Email atau password salah"})
		return
	}
	if fmt.Sprint(user["status"]) == "suspended" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun Anda ditangguhkan (suspended). Silakan hubungi admin."})
		return
	}
	s.setSession(w, r, fmt.Sprint(user["id"]))
	writeJSON(w, http.StatusOK, map[string]any{"user": publicDoc("user_accounts", user)})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u, err := s.sessionUser(r)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": publicDoc("user_accounts", u)})
}

func (s *Server) userByEmail(ctx context.Context, email string) (map[string]any, error) {
	if email == "" {
		return nil, nil
	}
	var rowID any
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT id, doc FROM user_accounts WHERE lower(doc->>'email') = $1`, email).Scan(&rowID, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return rowDoc("user_accounts", rowID, raw)
}
