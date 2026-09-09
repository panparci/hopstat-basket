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
				http.ServeFile(w, r, fp)
				return
			}
		}
		http.ServeFile(w, r, filepath.Join(root, "index.html"))
	})
}
