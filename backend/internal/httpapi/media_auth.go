package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ponytail: query sig so <video>/expo-video work without Cookie jar; rotate via SESSION_SECRET.
const mediaSigTTL = 7 * 24 * time.Hour

func (s *Server) mediaHMAC(file string, exp int64) string {
	mac := hmac.New(sha256.New, []byte(s.sessionSecret))
	fmt.Fprintf(mac, "%s\n%d", file, exp)
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *Server) validMediaSig(file, expStr, sig string) bool {
	if file == "" || expStr == "" || sig == "" {
		return false
	}
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	want := s.mediaHMAC(file, exp)
	return hmac.Equal([]byte(want), []byte(sig))
}

/** Sign /api/media/… paths so players can load without session cookies. */
func (s *Server) signMediaURL(path string) string {
	if !strings.HasPrefix(path, "/api/media/") {
		return path
	}
	file := strings.TrimPrefix(path, "/api/media/")
	if i := strings.IndexByte(file, '?'); i >= 0 {
		file = file[:i]
	}
	if file == "" || strings.Contains(file, "/") || strings.Contains(file, "..") {
		return path
	}
	exp := time.Now().Add(mediaSigTTL).Unix()
	return fmt.Sprintf("/api/media/%s?exp=%d&sig=%s", file, exp, s.mediaHMAC(file, exp))
}

func (s *Server) allowMedia(r *http.Request, file string) bool {
	if u, err := s.sessionUser(r); err == nil && u != nil {
		return true
	}
	q := r.URL.Query()
	return s.validMediaSig(file, q.Get("exp"), q.Get("sig"))
}
