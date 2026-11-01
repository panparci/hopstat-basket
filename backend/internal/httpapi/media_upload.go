package httpapi

import (
	"net/http"
	"strings"
)

// Public CDN hostname so the app can rewrite Bunny embed URLs → HLS (clean native player).
func (s *Server) mediaConfig(w http.ResponseWriter, r *http.Request) {
	host, lib := "", int64(0)
	if s.bunny != nil && s.bunny.Ready() {
		host = s.bunny.CDNHost
		lib = s.bunny.LibraryID
	}
	writeJSON(w, http.StatusOK, map[string]any{"bunnyCdnHost": host, "bunnyLibraryId": lib})
}

// Coach/admin catalog demo upload (no drill_submissions row). Returns HLS play URL for clean playback.
func (s *Server) uploadCatalogMedia(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r)
	if !s.can(r.Context(), user, "manage_cms") && !s.can(r.Context(), user, "do_coach_analysis") {
		writeForbidden(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file terlalu besar atau form tidak valid (max 100MB)"})
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "field file wajib"})
		return
	}
	defer file.Close()

	ct := hdr.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	if mediaKind(ct, hdr.Filename) != "video" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "hanya video (mp4/mov/webm)"})
		return
	}
	if s.bunny == nil || !s.bunny.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Bunny Stream belum dikonfigurasi (BUNNY_STREAM_*)."})
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		title = hdr.Filename
	}
	res, err := s.bunny.Upload(r.Context(), title, file)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload Bunny gagal: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"url":          res.PlayURL,
		"embedUrl":     res.EmbedURL,
		"bunnyVideoId": res.VideoID,
	})
}
