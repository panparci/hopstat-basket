package httpapi

import (
	"testing"
	"time"
)

func TestSessionRoundTrip(t *testing.T) {
	tok := signSession("secret", "user-1", time.Now().Add(time.Hour))
	uid, ok := parseSession("secret", tok)
	if !ok || uid != "user-1" {
		t.Fatalf("got %q %v", uid, ok)
	}
	if _, ok := parseSession("wrong", tok); ok {
		t.Fatal("bad secret accepted")
	}
	if _, ok := parseSession("secret", signSession("secret", "user-1", time.Now().Add(-time.Hour))); ok {
		t.Fatal("expired accepted")
	}
}

func TestPublicStoreGates(t *testing.T) {
	if !publicRead("site_content") || publicRead("user_accounts") {
		t.Fatal("read gate")
	}
	if !publicCreate("leads") || publicCreate("matches") {
		t.Fatal("create gate")
	}
}

func TestPublicDocStripsSecrets(t *testing.T) {
	doc := map[string]any{"id": "1", "email": "a@b.c", "passwordHash": "x", "passwordSalt": "y"}
	got := publicDoc("user_accounts", doc)
	if _, ok := got["passwordHash"]; ok {
		t.Fatal("hash leaked")
	}
	if got["email"] != "a@b.c" {
		t.Fatal("email dropped")
	}
}
