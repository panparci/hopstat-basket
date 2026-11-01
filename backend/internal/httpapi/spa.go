package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func FindDist() string {
	if d := os.Getenv("STATIC_DIR"); d != "" {
		if _, err := os.Stat(filepath.Join(d, "index.html")); err == nil {
			return d
		}
	}
	wd, _ := os.Getwd()
	for _, rel := range []string{"dist", "../dist"} {
		p := rel
		if wd != "" {
			p = filepath.Join(wd, rel)
		}
		if _, err := os.Stat(filepath.Join(p, "index.html")); err == nil {
			return p
		}
	}
	return ""
}

func WithSPA(api http.Handler, dir string) http.Handler {
	root, _ := filepath.Abs(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			api.ServeHTTP(w, r)
			return
		}
		rel := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		fp := filepath.Join(root, rel)
		if rel != "" && strings.HasPrefix(fp, root+string(os.PathSeparator)) {
			if st, err := os.Stat(fp); err == nil && !st.IsDir() {
				if strings.HasPrefix(rel, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				http.ServeFile(w, r, fp)
				return
			}
		}
		// Missing hashed assets must 404 — never serve index.html as JS (MIME TypeError in WebView).
		if strings.HasPrefix(rel, "assets/") || looksLikeStatic(rel) {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(root, "index.html"))
	})
}

func looksLikeStatic(rel string) bool {
	ext := strings.ToLower(filepath.Ext(rel))
	switch ext {
	case ".js", ".mjs", ".css", ".map", ".woff", ".woff2", ".ttf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico":
		return true
	default:
		return false
	}
}
