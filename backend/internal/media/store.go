// Package media stores practice-video files on disk (not in Postgres).
// Drive/GCS need Shared Drive or billing; until then: UPLOAD_DIR + /api/media/*.
package media

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

type Store struct {
	Dir string
}

func New(dir string) (*Store, error) {
	if dir == "" {
		dir = "data/uploads"
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	return &Store{Dir: dir}, nil
}

func (s *Store) Save(origName, contentType string, r io.Reader) (fileName, publicPath string, err error) {
	ext := extFor(origName, contentType)
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return "", "", err
	}
	fileName = hex.EncodeToString(id) + ext
	path := filepath.Join(s.Dir, fileName)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o640)
	if err != nil {
		return "", "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		_ = os.Remove(path)
		return "", "", err
	}
	return fileName, "/api/media/" + fileName, nil
}

func (s *Store) Open(fileName string) (*os.File, string, error) {
	base := filepath.Base(fileName)
	if base != fileName || strings.Contains(base, "..") {
		return nil, "", fmt.Errorf("invalid media name")
	}
	path := filepath.Join(s.Dir, base)
	f, err := os.Open(path)
	if err != nil {
		return nil, "", err
	}
	ct := mime.TypeByExtension(filepath.Ext(base))
	if ct == "" {
		ct = "application/octet-stream"
	}
	return f, ct, nil
}

func extFor(name, contentType string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".mp4", ".mov", ".webm", ".m4v", ".jpg", ".jpeg", ".png", ".webp", ".gif":
		if ext == ".jpeg" {
			return ".jpg"
		}
		return ext
	}
	ct := strings.ToLower(contentType)
	switch {
	case ct == "video/mp4":
		return ".mp4"
	case ct == "video/quicktime":
		return ".mov"
	case ct == "video/webm":
		return ".webm"
	case ct == "image/jpeg":
		return ".jpg"
	case ct == "image/png":
		return ".png"
	case ct == "image/webp":
		return ".webp"
	case ct == "image/gif":
		return ".gif"
	case strings.HasPrefix(ct, "image/"):
		return ".jpg"
	}
	return ".bin"
}
