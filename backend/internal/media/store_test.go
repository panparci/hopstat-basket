package media_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"hoopstat/internal/media"
)

func TestSaveAndOpen(t *testing.T) {
	dir := t.TempDir()
	s, err := media.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	name, pub, err := s.Save("drill.mp4", "video/mp4", strings.NewReader("fake-video-bytes"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(pub, "/api/media/") {
		t.Fatalf("public path %q", pub)
	}
	if filepath.Ext(name) != ".mp4" {
		t.Fatalf("ext %q", name)
	}
	f, ct, err := s.Open(name)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if ct != "video/mp4" {
		t.Fatalf("ct %q", ct)
	}
	if _, _, err := s.Open("../etc/passwd"); err == nil {
		t.Fatal("expected path escape reject")
	}
	_ = os.Remove(filepath.Join(dir, name))
}
