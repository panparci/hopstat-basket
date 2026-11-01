package httpapi

import (
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestMediaSigRoundTrip(t *testing.T) {
	s := &Server{sessionSecret: "test-secret"}
	file := "abcd1234.mp4"
	exp := time.Now().Add(time.Hour).Unix()
	sig := s.mediaHMAC(file, exp)
	if !s.validMediaSig(file, strconv.FormatInt(exp, 10), sig) {
		t.Fatal("valid sig rejected")
	}
	if s.validMediaSig(file, strconv.FormatInt(exp, 10), "deadbeef") {
		t.Fatal("bad sig accepted")
	}
	if s.validMediaSig(file, strconv.FormatInt(time.Now().Add(-time.Hour).Unix(), 10), sig) {
		t.Fatal("expired accepted")
	}
}

func TestSignMediaURL(t *testing.T) {
	s := &Server{sessionSecret: "test-secret"}
	got := s.signMediaURL("/api/media/abcd1234.mp4")
	if !strings.HasPrefix(got, "/api/media/abcd1234.mp4?exp=") || !strings.Contains(got, "&sig=") {
		t.Fatalf("bad signed url: %s", got)
	}
	if s.signMediaURL("https://cdn.example/x.mp4") != "https://cdn.example/x.mp4" {
		t.Fatal("external url mutated")
	}
}
