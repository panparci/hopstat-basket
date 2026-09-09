package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"hoopstat/internal/config"
	"hoopstat/internal/db"
	"hoopstat/internal/httpapi"
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

	h := httpapi.New(pool, cfg.GeminiAPIKey, cfg.SessionSecret)
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
