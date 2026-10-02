package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
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

// appRedirect accepts only the mobile app's deep-link schemes (exp:// is Expo Go during development).
func appRedirect(u string) bool {
	return strings.HasPrefix(u, "hoopstat://") || strings.HasPrefix(u, "exp://")
}

// appTokenSecret binds a handoff token to the app's PKCE-style challenge, so it is useless without the verifier
// and can never pass as a session cookie.
func (s *Server) appTokenSecret(challenge string) string {
	return s.sessionSecret + "|app|" + challenge
}

func (s *Server) googleLoginStart(w http.ResponseWriter, r *http.Request) {
	if s.googleLogin == nil {
		http.Redirect(w, r, "/login?error=google_off", http.StatusFound)
		return
	}
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)
	q := r.URL.Query()
	value := state + "." + base64.RawURLEncoding.EncodeToString([]byte(safeNext(q.Get("next"))))
	if challenge, redirect := q.Get("app"), q.Get("redirect"); len(challenge) == 43 && appRedirect(redirect) {
		value += "." + challenge + "." + base64.RawURLEncoding.EncodeToString([]byte(redirect))
	}
	http.SetCookie(w, &http.Cookie{
		Name:     googleStateCookie,
		Value:    value,
		Path:     "/api/auth/google",
		HttpOnly: true,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, s.googleLogin.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "select_account")), http.StatusFound)
}

func (s *Server) googleLoginCallback(w http.ResponseWriter, r *http.Request) {
	var state, nextB64, challenge, appURL string
	if c, err := r.Cookie(googleStateCookie); err == nil {
		parts := strings.Split(c.Value, ".")
		state, nextB64 = parts[0], parts[len(parts)-1]
		if len(parts) == 4 {
			nextB64, challenge = parts[1], parts[2]
			if b, err := base64.RawURLEncoding.DecodeString(parts[3]); err == nil && appRedirect(string(b)) {
				appURL = string(b)
			}
		}
	}
	appBack := func(query string) {
		sep := "?"
		if strings.Contains(appURL, "?") {
			sep = "&"
		}
		http.Redirect(w, r, appURL+sep+query, http.StatusFound)
	}
	fail := func(code string) {
		if appURL != "" {
			appBack("error=" + code)
			return
		}
		http.Redirect(w, r, "/login?error="+code, http.StatusFound)
	}
	if s.googleLogin == nil {
		fail("google_off")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: googleStateCookie, Path: "/api/auth/google", MaxAge: -1})
	if r.URL.Query().Get("error") != "" {
		fail("google_cancel")
		return
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
	if appURL != "" {
		appBack("token=" + signSession(s.appTokenSecret(challenge), fmt.Sprint(user["id"]), time.Now().Add(2*time.Minute)))
		return
	}
	s.setSession(w, r, fmt.Sprint(user["id"]))
	next := "/"
	if b, err := base64.RawURLEncoding.DecodeString(nextB64); err == nil {
		next = safeNext(string(b))
	}
	http.Redirect(w, r, next, http.StatusFound)
}

// appLogin runs inside the app's WebView: trades the handoff token + verifier for a session cookie.
func (s *Server) appLogin(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	sum := sha256.Sum256([]byte(q.Get("verifier")))
	uid, ok := parseSession(s.appTokenSecret(base64.RawURLEncoding.EncodeToString(sum[:])), q.Get("token"))
	if q.Get("verifier") == "" || !ok {
		http.Redirect(w, r, "/login?error=google", http.StatusFound)
		return
	}
	s.setSession(w, r, uid)
	http.Redirect(w, r, "/", http.StatusFound)
}
