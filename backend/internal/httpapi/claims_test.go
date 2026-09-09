package httpapi

import (
	"encoding/base64"
	"testing"
)

func TestParseDataURL(t *testing.T) {
	raw := base64.StdEncoding.EncodeToString([]byte("kk-bytes"))
	ctype, body, err := parseDataURL("data:image/jpeg;base64," + raw)
	if err != nil || ctype != "image/jpeg" || string(body) != "kk-bytes" {
		t.Fatalf("%s %q %v", ctype, body, err)
	}
	if _, _, err := parseDataURL("https://evil"); err == nil {
		t.Fatal("accepted non-data URL")
	}
}
