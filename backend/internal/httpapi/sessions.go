package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	hhmm    = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
	svgPath = regexp.MustCompile(`^[MLml0-9 .,\-]+$`)
)

const maxSignature = 20000

func numOf(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	}
	return 0, false
}

func listOf(v any) []any {
	l, _ := v.([]any)
	return l
}

// stringList trims, dedupes and caps a JSON string array.
func stringList(v any, max, maxLen int) []any {
	out := []any{}
	seen := map[string]bool{}
	for _, raw := range listOf(v) {
		s := strings.TrimSpace(asString(raw))
		if s == "" || seen[s] || utf8.RuneCountInString(s) > maxLen {
			continue
		}
		seen[s] = true
		out = append(out, s)
		if len(out) == max {
			break
		}
	}
	return out
}

func tooLong(s string, n int) bool { return utf8.RuneCountInString(s) > n }

// isMinorBirth: under 18 on `now`, by exact birthday. Unknown birth dates are not minors.
func isMinorBirth(birth string, now time.Time) bool {
	if len(birth) < 10 {
		return false
	}
	b, err := time.Parse("2006-01-02", birth[:10])
	if err != nil {
		return false
	}
	return now.Before(b.AddDate(18, 0, 0))
}

func cleanVenue(doc map[string]any) error {
	name := strings.TrimSpace(asString(doc["name"]))
	if name == "" || tooLong(name, 120) {
		return fmt.Errorf("nama venue wajib (maks 120 karakter)")
	}
	doc["name"] = name
	lat, okLat := numOf(doc["lat"])
	lng, okLng := numOf(doc["lng"])
	if okLat != okLng || (okLat && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
		return fmt.Errorf("koordinat venue tidak valid")
	}
	if !okLat {
		delete(doc, "lat")
		delete(doc, "lng")
	}
	return nil
}

// cleanSession validates a coach's training session and pins the server-owned fields.
func cleanSession(existing, doc, u map[string]any, now time.Time) error {
	delete(doc, "registeredCount")
	if existing != nil {
		keep(existing, doc, "coachId", "coachName", "createdAt")
	} else {
		doc["coachId"] = uidOf(u)
		doc["coachName"] = asString(u["name"])
		doc["createdAt"] = now.UnixMilli()
	}
	title := strings.TrimSpace(asString(doc["title"]))
	if title == "" || tooLong(title, 120) {
		return fmt.Errorf("judul sesi wajib (maks 120 karakter)")
	}
	doc["title"] = title
	if _, err := time.Parse("2006-01-02", asString(doc["date"])); err != nil {
		return fmt.Errorf("tanggal harus YYYY-MM-DD")
	}
	st, et := asString(doc["startTime"]), asString(doc["endTime"])
	if (st != "" && !hhmm.MatchString(st)) || (et != "" && !hhmm.MatchString(et)) {
		return fmt.Errorf("jam harus HH:MM")
	}
	if st != "" && et != "" && et <= st {
		return fmt.Errorf("jam selesai harus setelah jam mulai")
	}
	location := strings.TrimSpace(asString(doc["location"]))
	if tooLong(location, 160) {
		return fmt.Errorf("lokasi maks 160 karakter")
	}
	doc["location"] = location
	quota, ok := numOf(doc["quota"])
	if !ok || quota != math.Trunc(quota) || quota < 1 || quota > 200 {
		return fmt.Errorf("kuota 1–200 atlet")
	}
	price := 0.0
	if doc["price"] != nil {
		if price, ok = numOf(doc["price"]); !ok || price != math.Trunc(price) || price < 0 || price > 100_000_000 {
			return fmt.Errorf("harga tidak valid")
		}
	}
	doc["quota"], doc["price"] = int(quota), int(price)
	doc["skills"] = stringList(doc["skills"], 10, 40)
	doc["invitedProfileIds"] = stringList(doc["invitedProfileIds"], 200, 80)
	private, _ := doc["isPrivate"].(bool)
	doc["isPrivate"] = private
	if private && len(listOf(doc["invitedProfileIds"])) == 0 {
		return fmt.Errorf("sesi privat butuh minimal 1 atlet diundang")
	}
	if asString(doc["status"]) != "cancelled" {
		doc["status"] = "published"
	}
	terms := strings.TrimSpace(asString(doc["terms"]))
	if tooLong(terms, 4000) {
		return fmt.Errorf("ketentuan maks 4000 karakter")
	}
	doc["terms"] = terms
	version := 1.0
	if existing != nil {
		if v, ok := numOf(existing["termsVersion"]); ok {
			version = v
			if asString(existing["terms"]) != terms {
				version++
			}
		}
	}
	doc["termsVersion"] = int(version)

	var old map[string]any
	if existing != nil {
		old, _ = existing["report"].(map[string]any)
	}
	rep, ok := doc["report"].(map[string]any)
	if !ok {
		if old != nil {
			doc["report"] = old
		} else {
			delete(doc, "report")
		}
		return nil
	}
	return cleanReport(old, rep, now)
}

// cleanReport: per-athlete stars 1–5; publishedAt is stamped by the server once and never moves.
func cleanReport(old, rep map[string]any, now time.Time) error {
	rep["attendance"] = stringList(rep["attendance"], 200, 80)
	ratings := []any{}
	for _, raw := range listOf(rep["ratings"]) {
		m, _ := raw.(map[string]any)
		pid := strings.TrimSpace(asString(m["profileId"]))
		stars, ok := numOf(m["stars"])
		note := strings.TrimSpace(asString(m["note"]))
		if pid == "" || !ok || stars < 1 || stars > 5 || tooLong(note, 200) {
			return fmt.Errorf("penilaian atlet: bintang 1–5, catatan maks 200 karakter")
		}
		ratings = append(ratings, map[string]any{"profileId": pid, "name": asString(m["name"]), "stars": int(math.Round(stars)), "note": note})
	}
	rep["ratings"] = ratings
	summary := strings.TrimSpace(asString(rep["summary"]))
	if tooLong(summary, 2000) {
		return fmt.Errorf("ringkasan maks 2000 karakter")
	}
	rep["summary"] = summary
	delete(rep, "attendedCount")
	if old != nil && asString(old["publishedAt"]) != "" {
		rep["publishedAt"] = old["publishedAt"]
	} else if asString(rep["publishedAt"]) != "" {
		rep["publishedAt"] = now.UTC().Format(time.RFC3339)
	}
	return nil
}

// sessionView is what one account may see of a session, nil when hidden. The coach (and admin) see everything;
// families see a private session only when invited or registered, and only their own athletes in the report.
func sessionView(sess map[string]any, full bool, guarded map[string]bool, registered bool, count int) map[string]any {
	cp := cloneDoc(sess)
	cp["registeredCount"] = count
	if full {
		return cp
	}
	mine := []any{}
	for _, p := range listOf(cp["invitedProfileIds"]) {
		if guarded[asString(p)] {
			mine = append(mine, p)
		}
	}
	if private, _ := cp["isPrivate"].(bool); private && !registered && len(mine) == 0 {
		return nil
	}
	cp["invitedProfileIds"] = mine
	rep, _ := cp["report"].(map[string]any)
	if rep == nil || asString(rep["publishedAt"]) == "" || !registered {
		delete(cp, "report")
		return cp
	}
	att := listOf(rep["attendance"])
	rep["attendedCount"] = len(att)
	own := []any{}
	for _, p := range att {
		if guarded[asString(p)] {
			own = append(own, p)
		}
	}
	rep["attendance"] = own
	ratings := []any{}
	for _, raw := range listOf(rep["ratings"]) {
		if m, _ := raw.(map[string]any); guarded[asString(m["profileId"])] {
			ratings = append(ratings, raw)
		}
	}
	rep["ratings"] = ratings
	return cp
}

// ponytail: scans every registration per call; index by session + count query if sessions grow past a few thousand.
func (s *Server) visibleSessions(ctx context.Context, u map[string]any, items []map[string]any) []map[string]any {
	uid := uidOf(u)
	regs, _ := s.listDocs(ctx, "session_registrations", "", "")
	count := map[string]int{}
	mine := map[string]bool{}
	for _, g := range regs {
		if asString(g["status"]) == "cancelled" {
			continue
		}
		sid := asString(g["sessionId"])
		count[sid]++
		if asString(g["accountId"]) == uid {
			mine[sid] = true
		}
	}
	var guarded map[string]bool
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		sid := asString(it["id"])
		full := isAdmin(u) || asString(it["coachId"]) == uid
		if !full && guarded == nil {
			guarded = s.guardedProfileIDs(ctx, uid)
		}
		if v := sessionView(it, full, guarded, mine[sid], count[sid]); v != nil {
			out = append(out, v)
		}
	}
	return out
}

// A registration is visible to the family that made it and to the session's coach, with its payment status.
func (s *Server) visibleRegistrations(ctx context.Context, u map[string]any, items []map[string]any) []map[string]any {
	uid := uidOf(u)
	coachOf := map[string]string{}
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		sid := asString(it["sessionId"])
		if _, ok := coachOf[sid]; !ok {
			sess, _ := s.getDoc(ctx, "training_sessions", sid)
			coachOf[sid] = asString(sess["coachId"])
		}
		if !isAdmin(u) && asString(it["accountId"]) != uid && coachOf[sid] != uid {
			continue
		}
		cp := cloneDoc(it)
		if pid := asString(cp["paymentId"]); pid != "" {
			if p, _ := s.getDoc(ctx, "payments", pid); p != nil {
				cp["paymentStatus"] = p["status"]
			}
		}
		out = append(out, cp)
	}
	return out
}

// deleteBlocked keeps sessions with registrations (and their consent + payments) from vanishing; cancel instead.
func (s *Server) deleteBlocked(ctx context.Context, store, id string) error {
	if store != "training_sessions" {
		return nil
	}
	regs, _ := s.listDocs(ctx, "session_registrations", "by-session", id)
	if len(regs) > 0 {
		return errors.New("sesi sudah punya pendaftar; ubah status ke dibatalkan")
	}
	return nil
}

type sessionRegisterBody struct {
	ProfileID  string `json:"profileId"`
	SignerName string `json:"signerName"`
	Signature  string `json:"signature"`
	Agree      bool   `json:"agree"`
}

func (s *Server) registerSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u := userFrom(r)
	uid := uidOf(u)
	if !s.can(ctx, u, "view_home") {
		writeForbidden(w)
		return
	}
	var body sessionRegisterBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body.SignerName = strings.TrimSpace(body.SignerName)
	body.Signature = strings.TrimSpace(body.Signature)
	switch {
	case !body.Agree:
		writeErr(w, http.StatusBadRequest, errors.New("setujui ketentuan sesi dulu"))
		return
	case body.SignerName == "" || tooLong(body.SignerName, 120):
		writeErr(w, http.StatusBadRequest, errors.New("nama penanda tangan wajib"))
		return
	case body.Signature == "" || len(body.Signature) > maxSignature || !svgPath.MatchString(body.Signature):
		writeErr(w, http.StatusBadRequest, errors.New("tanda tangan wajib"))
		return
	}
	sid := r.PathValue("id")
	sess, err := s.getDoc(ctx, "training_sessions", sid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if sess == nil {
		writeErr(w, http.StatusNotFound, errors.New("sesi tidak ditemukan"))
		return
	}
	now := time.Now()
	if asString(sess["status"]) == "cancelled" {
		writeErr(w, http.StatusConflict, errors.New("sesi dibatalkan"))
		return
	}
	if asString(sess["date"]) < now.Format("2006-01-02") {
		writeErr(w, http.StatusConflict, errors.New("sesi sudah lewat"))
		return
	}
	profile, err := s.getDoc(ctx, "profiles", body.ProfileID)
	if err != nil || profile == nil {
		writeErr(w, http.StatusBadRequest, errors.New("atlet tidak ditemukan"))
		return
	}
	if !guardianOf(profile, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya wali terverifikasi atlet ini yang bisa mendaftar"})
		return
	}
	if private, _ := sess["isPrivate"].(bool); private {
		invited := false
		for _, p := range listOf(sess["invitedProfileIds"]) {
			invited = invited || asString(p) == body.ProfileID
		}
		if !invited {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "atlet ini tidak diundang ke sesi privat"})
			return
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('session:' || $1))`, sid); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	var taken, dup int
	if err := tx.QueryRow(ctx, `SELECT count(*), count(*) FILTER (WHERE doc->>'profileId' = $2) FROM session_registrations
		WHERE doc->>'sessionId' = $1 AND coalesce(doc->>'status', '') <> 'cancelled'`, sid, body.ProfileID).Scan(&taken, &dup); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if dup > 0 {
		writeErr(w, http.StatusConflict, errors.New("atlet sudah terdaftar di sesi ini"))
		return
	}
	if quota, _ := numOf(sess["quota"]); float64(taken) >= quota {
		writeErr(w, http.StatusConflict, errors.New("kuota sesi penuh"))
		return
	}
	reg := map[string]any{
		"id":          newDocID("reg"),
		"sessionId":   sid,
		"profileId":   body.ProfileID,
		"profileName": asString(profile["name"]),
		"accountId":   uid,
		"status":      "registered",
		"createdAt":   now.UnixMilli(),
		"consent": map[string]any{
			"signerName":      body.SignerName,
			"signerAccountId": uid,
			"signature":       body.Signature,
			"signedAt":        now.UTC().Format(time.RFC3339),
			"termsVersion":    sess["termsVersion"],
			"isMinor":         isMinorBirth(asString(profile["birthDate"]), now),
		},
	}
	var payment map[string]any
	if price, _ := numOf(sess["price"]); price > 0 {
		payment = map[string]any{
			"id": newDocID("pay"), "requestId": reg["id"], "amount": int(price), "status": "pending",
			"method": "transfer", "kind": "training_session", "createdAt": now.UnixMilli(),
		}
		if _, err := s.putDoc(ctx, tx, "payments", payment); err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		reg["paymentId"] = payment["id"]
	}
	if _, err := s.putDoc(ctx, tx, "session_registrations", reg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if payment != nil {
		reg["paymentStatus"] = payment["status"]
	}
	s.notify(ctx, uid, []string{asString(sess["coachId"])}, "Pendaftar baru", asString(profile["name"])+" · "+asString(sess["title"]), "/session/"+sid)
	writeJSON(w, http.StatusCreated, map[string]any{"item": reg, "payment": payment})
}
