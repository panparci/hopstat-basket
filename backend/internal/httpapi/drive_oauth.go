package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

var driveOAuthState sync.Map // state -> expiry unix

func (s *Server) driveStatus(w http.ResponseWriter, r *http.Request) {
	if s.drive == nil {
		writeJSON(w, http.StatusOK, map[string]any{"configured": false, "ready": false, "message": "GOOGLE_OAUTH_CLIENT unset"})
		return
	}
	ready := s.drive.Ready()
	msg := "linked — uploads go to configured Drive folder"
	if !ready {
		msg = "not linked — admin must open /api/drive/auth"
	}
	writeJSON(w, http.StatusOK, map[string]any{"configured": true, "ready": ready, "message": msg})
}

func (s *Server) driveAuthStart(w http.ResponseWriter, r *http.Request) {
	if s.drive == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Drive OAuth not configured"})
		return
	}
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)
	driveOAuthState.Store(state, time.Now().Add(10*time.Minute).Unix())
	http.Redirect(w, r, s.drive.AuthURL(state), http.StatusFound)
}

func (s *Server) driveAuthCallback(w http.ResponseWriter, r *http.Request) {
	if s.drive == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Drive OAuth not configured"})
		return
	}
	if errMsg := r.URL.Query().Get("error"); errMsg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": errMsg})
		return
	}
	state := r.URL.Query().Get("state")
	expRaw, ok := driveOAuthState.Load(state)
	driveOAuthState.Delete(state)
	if !ok || time.Now().Unix() > expRaw.(int64) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid or expired oauth state"})
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing code"})
		return
	}
	if err := s.drive.Exchange(r.Context(), code); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, `<!doctype html><meta charset="utf-8"><title>Drive linked</title>
<body style="font-family:sans-serif;padding:2rem">
<h1>Google Drive terhubung</h1>
<p>Upload latihan sekarang masuk folder Drive yang dikonfigurasi (folder <b>database</b>). Boleh tutup tab ini.</p>
</body>`)
}

func (s *Server) requireDriveAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, err := s.sessionUser(r)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		if u == nil {
			// Browser hit: send to app login, then come back.
			http.Redirect(w, r, "/login?next=/api/drive/auth", http.StatusFound)
			return
		}
		if fmt.Sprint(u["status"]) == "suspended" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun Anda ditangguhkan (suspended). Silakan hubungi admin."})
			return
		}
		role := strings.ToLower(fmt.Sprint(u["role"]))
		if role != "admin" && role != "coach" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya admin/coach yang bisa link Drive — login admin dulu di /login"})
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxUser{}, u)))
	}
}
