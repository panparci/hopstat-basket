package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
)

const googleStateCookie = "hs_g"

// safeNext keeps post-login redirects on this site (blocks //evil.com and absolute URLs).
func safeNext(next string) string {
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") || strings.HasPrefix(next, "/\\") {
		return "/"
	}
	return next
}

func (s *Server) googleLoginStart(w http.ResponseWriter, r *http.Request) {
	if s.googleLogin == nil {
		http.Redirect(w, r, "/login?error=google_off", http.StatusFound)
		return
	}
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)
	next := base64.RawURLEncoding.EncodeToString([]byte(safeNext(r.URL.Query().Get("next"))))
	http.SetCookie(w, &http.Cookie{
		Name:     googleStateCookie,
		Value:    state + "." + next,
		Path:     "/api/auth/google",
		HttpOnly: true,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, s.googleLogin.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "select_account")), http.StatusFound)
}

func (s *Server) googleLoginCallback(w http.ResponseWriter, r *http.Request) {
	fail := func(code string) { http.Redirect(w, r, "/login?error="+code, http.StatusFound) }
	if s.googleLogin == nil {
		fail("google_off")
		return
	}
	c, err := r.Cookie(googleStateCookie)
	http.SetCookie(w, &http.Cookie{Name: googleStateCookie, Path: "/api/auth/google", MaxAge: -1})
	if r.URL.Query().Get("error") != "" {
		fail("google_cancel")
		return
	}
	var state, nextB64 string
	if err == nil {
		state, nextB64, _ = strings.Cut(c.Value, ".")
	}
	if state == "" || r.URL.Query().Get("state") != state {
		fail("google_state")
		return
	}
	tok, err := s.googleLogin.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		fail("google")
		return
	}
	resp, err := s.googleLogin.Client(r.Context(), tok).Get("https://openidconnect.googleapis.com/v1/userinfo")
	if err != nil {
		fail("google")
		return
	}
	defer resp.Body.Close()
	var info struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&info) != nil {
		fail("google")
		return
	}
	email := strings.ToLower(strings.TrimSpace(info.Email))
	if email == "" || !info.EmailVerified {
		fail("google_email")
		return
	}

	user, err := s.userByEmail(r.Context(), email)
	if err != nil {
		fail("google")
		return
	}
	if user == nil {
		// Google-only account: random unusable password keeps password login closed until reset.
		pw := make([]byte, 32)
		_, _ = rand.Read(pw)
		hash, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(pw)), bcrypt.DefaultCost)
		if err != nil {
			fail("google")
			return
		}
		name := strings.TrimSpace(info.Name)
		if name == "" {
			name, _, _ = strings.Cut(email, "@")
		}
		user, err = s.putDoc(r.Context(), s.pool, "user_accounts", map[string]any{
			"id":           newUserID(),
			"name":         name,
			"email":        email,
			"role":         "customer",
			"status":       "active",
			"createdAt":    time.Now().UnixMilli(),
			"authProvider": "google",
			"googleSub":    info.Sub,
			"avatarUrl":    info.Picture,
			"passwordHash": string(hash),
		})
		if err != nil {
			fail("google")
			return
		}
	}
	if fmt.Sprint(user["status"]) == "suspended" {
		fail("suspended")
		return
	}
	s.setSession(w, r, fmt.Sprint(user["id"]))
	next := "/"
	if b, err := base64.RawURLEncoding.DecodeString(nextB64); err == nil {
		next = safeNext(string(b))
	}
	http.Redirect(w, r, next, http.StatusFound)
}
