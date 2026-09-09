package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Addr          string
	DatabaseURL   string
	GeminiAPIKey  string
	SessionSecret string
}

func Load() Config {
	loadDotEnv()
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	key := os.Getenv("GEMINI_API_KEY")
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" && os.Getenv("HOOPSTAT_ENV") != "production" {
		secret = os.Getenv("DATABASE_URL")
	}
	return Config{
		Addr:          addr,
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		GeminiAPIKey:  key,
		SessionSecret: secret,
	}
}

func loadDotEnv() {
	wd, _ := os.Getwd()
	candidates := []string{".env"}
	if wd != "" {
		dir := wd
		for i := 0; i < 4; i++ {
			candidates = append(candidates, filepath.Join(dir, ".env"))
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	seen := map[string]bool{}
	for _, path := range candidates {
		if seen[path] {
			continue
		}
		seen[path] = true
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
				continue
			}
			k, v, _ := strings.Cut(line, "=")
			k = strings.TrimSpace(k)
			v = strings.TrimSpace(v)
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
		_ = f.Close()
		return
	}
}
