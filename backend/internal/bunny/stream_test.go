package bunny

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUpload(t *testing.T) {
	var putOK bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/videos"):
			if r.Header.Get("AccessKey") != "key" {
				w.WriteHeader(401)
				return
			}
			w.Write([]byte(`{"guid":"vid-1"}`))
		case r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/videos/vid-1"):
			io.Copy(io.Discard, r.Body)
			putOK = true
			w.Write([]byte(`{"success":true}`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()

	c, err := New("782155", "key", "vz-test.b-cdn.net")
	if err != nil {
		t.Fatal(err)
	}
	c.BaseURL = srv.URL
	c.HTTP = srv.Client()

	res, err := c.Upload(context.Background(), "Drill", strings.NewReader("mp4-bytes"))
	if err != nil || !putOK || res.VideoID != "vid-1" {
		t.Fatalf("upload: %+v %v put=%v", res, err, putOK)
	}
	if !strings.Contains(res.PlayURL, "vid-1/playlist.m3u8") || !strings.Contains(res.EmbedURL, "/782155/vid-1") {
		t.Fatalf("urls: %+v", res)
	}
}
