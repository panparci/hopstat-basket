package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"hoopstat/internal/bunny"
	"hoopstat/internal/config"
	"hoopstat/internal/db"
	"hoopstat/internal/httpapi"
	"hoopstat/internal/media"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func main() {
	cfg := config.Load()
	if cfg.SessionSecret == "" {
		log.Fatal("SESSION_SECRET is required (set HOOPSTAT_ENV=production in prod)")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()

	mediaStore, err := media.New(cfg.UploadDir)
	if err != nil {
		log.Fatalf("upload dir: %v", err)
	}

	var stream *bunny.Client
	if cfg.BunnyLibraryID != "" {
		stream, err = bunny.New(cfg.BunnyLibraryID, cfg.BunnyAPIKey, cfg.BunnyCDNHost)
		if err != nil {
			log.Printf("bunny stream disabled: %v", err)
			stream = nil
		} else {
			log.Printf("Bunny Stream ready (library %s → %s)", cfg.BunnyLibraryID, cfg.BunnyCDNHost)
		}
	} else {
		log.Printf("Bunny Stream not configured — video uploads will fail until BUNNY_STREAM_* is set")
	}

	var googleLogin *oauth2.Config
	if b, err := os.ReadFile(cfg.GoogleOAuthClient); err == nil {
		if googleLogin, err = google.ConfigFromJSON(b, "openid", "email", "profile"); err == nil {
			googleLogin.RedirectURL = cfg.GoogleLoginRedirect
			log.Printf("Google sign-in enabled (%s)", googleLogin.RedirectURL)
		} else {
			log.Printf("google sign-in disabled: %v", err)
		}
	}

	mid := httpapi.Midtrans(cfg.MidtransServerKey, cfg.MidtransClientKey, cfg.MidtransProduction)
	if mid.Enabled() {
		log.Printf("Midtrans enabled (production=%v)", cfg.MidtransProduction)
	} else {
		log.Printf("Midtrans not configured — payments stay admin-confirm (DP-11/12/16)")
	}
	h := httpapi.New(pool, cfg.GeminiAPIKey, cfg.SessionSecret, mediaStore, stream, googleLogin, mid)
	if dir := httpapi.FindDist(); dir != "" {
		h = httpapi.WithSPA(h, dir)
		log.Printf("serving UI from %s", dir)
	}
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       120 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("HoopStat API (go) listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}
