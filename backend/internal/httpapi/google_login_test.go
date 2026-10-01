package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golang.org/x/oauth2"
)

func TestGoogleLoginGuards(t *testing.T) {
	for in, want := range map[string]string{"/games": "/games", "//evil.com": "/", "https://evil.com": "/", "/\\evil.com": "/", "": "/"} {
		if got := safeNext(in); got != want {
			t.Fatalf("safeNext(%q)=%q want %q", in, got, want)
		}
	}

	s := &Server{googleLogin: &oauth2.Config{ClientID: "x", Endpoint: oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/auth"}}}
	rec := httptest.NewRecorder()
	s.googleLoginStart(rec, httptest.NewRequest(http.MethodGet, "/api/auth/google?next=//evil.com", nil))
	if rec.Code != http.StatusFound || !strings.HasPrefix(rec.Header().Get("Location"), "https://accounts.google.com/") {
		t.Fatalf("start: %d %s", rec.Code, rec.Header().Get("Location"))
	}

	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=forged&code=c", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "real.Lw"})
	s.googleLoginCallback(rec, req)
	if loc := rec.Header().Get("Location"); loc != "/login?error=google_state" {
		t.Fatalf("forged state must be rejected, got %s", loc)
	}
}
