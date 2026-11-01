package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func newDocID(prefix string) string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func (s *Server) listDrillSubmissions(w http.ResponseWriter, r *http.Request) {
	items, err := s.listDocs(r.Context(), "drill_submissions", "", "")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	items = s.filterList(r.Context(), userFrom(r), "drill_submissions", items)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	athleteID := strings.TrimSpace(r.URL.Query().Get("athleteId"))
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		if status != "" && fmt.Sprint(it["status"]) != status {
			continue
		}
		if athleteID != "" && fmt.Sprint(it["athleteId"]) != athleteID {
			continue
		}
		out = append(out, s.withSignedMedia(publicDoc("drill_submissions", it)))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (s *Server) getDrillSubmission(w http.ResponseWriter, r *http.Request) {
	item, err := s.getDoc(r.Context(), "drill_submissions", r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if item == nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	if len(s.filterList(r.Context(), userFrom(r), "drill_submissions", []map[string]any{item})) == 0 {
		writeForbidden(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": s.withSignedMedia(publicDoc("drill_submissions", item))})
}

type drillSubmitBody struct {
	AthleteID    string `json:"athleteId"`
	AthleteName  string `json:"athleteName"`
	DrillID      string `json:"drillId"`
	DrillName    string `json:"drillName"`
	VideoURL     string `json:"videoUrl"`
	AthleteNotes string `json:"athleteNotes"`
	// Clip window in seconds (0/0 = whole video); stored as metadata, the file is not re-encoded.
	TrimStart     float64 `json:"trimStart"`
	TrimEnd       float64 `json:"trimEnd"`
	ParentConsent bool    `json:"parentConsent"`
}

func (s *Server) createDrillSubmissionLink(w http.ResponseWriter, r *http.Request) {
	var body drillSubmitBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body.VideoURL = strings.TrimSpace(body.VideoURL)
	if body.VideoURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "videoUrl wajib (link YouTube/Loom)"})
		return
	}
	if !isExternalVideoURL(body.VideoURL) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "videoUrl harus http(s) YouTube/Loom atau link video publik"})
		return
	}
	user := userFrom(r)
	if err := s.checkSubmission(r, user, body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.saveDrillSubmission(r, user, body, body.VideoURL, "", "link", "link", "")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": s.withSignedMedia(item)})
}

func (s *Server) createDrillSubmissionUpload(w http.ResponseWriter, r *http.Request) {
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
	kind := mediaKind(ct, hdr.Filename)
	if kind == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "hanya video (mp4/mov/webm) atau gambar (jpg/png/webp)"})
		return
	}

	body := drillSubmitBody{
		AthleteID:     strings.TrimSpace(r.FormValue("athleteId")),
		AthleteName:   strings.TrimSpace(r.FormValue("athleteName")),
		DrillID:       strings.TrimSpace(r.FormValue("drillId")),
		DrillName:     strings.TrimSpace(r.FormValue("drillName")),
		AthleteNotes:  strings.TrimSpace(r.FormValue("athleteNotes")),
		ParentConsent: r.FormValue("parentConsent") == "true",
	}
	body.TrimStart, _ = strconv.ParseFloat(r.FormValue("trimStart"), 64)
	body.TrimEnd, _ = strconv.ParseFloat(r.FormValue("trimEnd"), 64)
	user := userFrom(r)
	if err := s.checkSubmission(r, user, body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	var (
		publicPath string
		mediaFile  string
		bunnyID    string
		source     string
	)

	switch kind {
	case "video":
		if s.bunny == nil || !s.bunny.Ready() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Bunny Stream belum dikonfigurasi (BUNNY_STREAM_*)."})
			return
		}
		title := body.DrillName
		if title == "" {
			title = hdr.Filename
		}
		res, err := s.bunny.Upload(r.Context(), title, file)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload Bunny gagal: " + err.Error()})
			return
		}
		// HLS → expo-video (no Bunny iframe chrome). Embed kept on bunnyVideoId path if needed.
		publicPath = res.PlayURL
		bunnyID = res.VideoID
		source = "bunny"
	case "image":
		if s.media == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "UPLOAD_DIR belum diset untuk foto latihan."})
			return
		}
		fileName, path, err := s.media.Save(hdr.Filename, ct, file)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		mediaFile = fileName
		publicPath = path
		source = "upload"
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "hanya video atau gambar"})
		return
	}

	item, err := s.saveDrillSubmission(r, user, body, publicPath, mediaFile, source, kind, bunnyID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": s.withSignedMedia(item)})
}

func (s *Server) saveDrillSubmission(r *http.Request, user map[string]any, body drillSubmitBody, videoURL, mediaFile, source, mediaType, bunnyVideoID string) (map[string]any, error) {
	if body.DrillID == "" {
		body.DrillID = "general"
	}
	if body.DrillName == "" {
		body.DrillName = "Latihan Fundamental"
	}
	if body.AthleteID == "" {
		body.AthleteID = fmt.Sprint(user["id"])
	}
	if body.AthleteName == "" {
		body.AthleteName = fmt.Sprint(user["name"])
		if body.AthleteName == "" {
			body.AthleteName = fmt.Sprint(user["email"])
		}
	}
	if mediaType == "" {
		mediaType = "video"
	}
	doc := map[string]any{
		"id":           newDocID("sub"),
		"athleteId":    body.AthleteID,
		"athleteName":  body.AthleteName,
		"drillId":      body.DrillID,
		"drillName":    body.DrillName,
		"videoUrl":     videoURL,
		"mediaFile":    mediaFile,
		"mediaType":    mediaType,
		"source":       source,
		"athleteNotes": body.AthleteNotes,
		"status":       "submitted",
		"submittedAt":  time.Now().UTC().Format(time.RFC3339),
		"submittedBy":  fmt.Sprint(user["id"]),
	}
	if bunnyVideoID != "" {
		doc["bunnyVideoId"] = bunnyVideoID
	}
	if body.TrimEnd > 0 {
		doc["trim"] = map[string]any{"start": body.TrimStart, "end": body.TrimEnd}
	}
	if body.ParentConsent {
		doc["parentConsent"] = map[string]any{"accountId": fmt.Sprint(user["id"]), "name": fmt.Sprint(user["name"]), "at": time.Now().UTC().Format(time.RFC3339)}
	}
	item, err := s.putDoc(r.Context(), s.pool, "drill_submissions", doc)
	if err == nil {
		s.notify(r.Context(), uidOf(user), s.accountsWith(r.Context(), "do_coach_analysis"), "Video baru untuk direview", body.AthleteName+" · "+body.DrillName, "/review/"+asString(doc["id"]))
	}
	return item, err
}

// checkSubmission rejects a bad clip window, and a minor's video without a guardian's consent.
func (s *Server) checkSubmission(r *http.Request, user map[string]any, body drillSubmitBody) error {
	if body.TrimEnd != 0 && (body.TrimStart < 0 || body.TrimEnd <= body.TrimStart || body.TrimEnd-body.TrimStart > 600) {
		return errors.New("potongan klip tidak valid (maks 10 menit)")
	}
	if body.AthleteID == "" || body.ParentConsent {
		return nil
	}
	p, _ := s.getDoc(r.Context(), "profiles", body.AthleteID)
	if p != nil && isMinorBirth(asString(p["birthDate"]), time.Now()) {
		return errors.New("atlet di bawah umur: persetujuan orang tua/wali wajib")
	}
	return nil
}

type drillReviewBody struct {
	Rating         float64             `json:"rating"`
	Comments       string              `json:"comments"`
	Status         string              `json:"status"`
	TimestampNotes []map[string]string `json:"timestampNotes"`
}

func (s *Server) reviewDrillSubmission(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r)
	if !s.can(r.Context(), user, "do_coach_analysis") {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya coach/admin yang bisa review"})
		return
	}
	id := r.PathValue("id")
	existing, err := s.getDoc(r.Context(), "drill_submissions", id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if existing == nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	var body drillReviewBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body.Comments = strings.TrimSpace(body.Comments)
	if body.Comments == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "comments wajib"})
		return
	}
	if body.Rating < 1 {
		body.Rating = 1
	}
	if body.Rating > 5 {
		body.Rating = 5
	}
	status := body.Status
	if status != "needs_revision" {
		status = "reviewed"
	}
	existing["status"] = status
	existing["coachFeedback"] = map[string]any{
		"coachName":      fmt.Sprint(user["name"]),
		"coachId":        fmt.Sprint(user["id"]),
		"rating":         body.Rating,
		"comments":       body.Comments,
		"timestampNotes": body.TimestampNotes,
		"reviewedAt":     time.Now().UTC().Format(time.RFC3339),
	}
	item, err := s.putDoc(r.Context(), s.pool, "drill_submissions", existing)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	title := "Video kamu sudah direview"
	if status == "needs_revision" {
		title = "Coach minta rekam ulang"
	}
	s.notify(r.Context(), uidOf(user), []string{asString(existing["submittedBy"])}, title, asString(existing["drillName"])+": "+body.Comments, "/submissions")
	writeJSON(w, http.StatusOK, map[string]any{"item": s.withSignedMedia(item)})
}

func (s *Server) serveMedia(w http.ResponseWriter, r *http.Request) {
	if s.media == nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	file := r.PathValue("file")
	if !s.allowMedia(r, file) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	f, ct, err := s.media.Open(file)
	if err != nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, file, time.Time{}, f)
}

func (s *Server) withSignedMedia(item map[string]any) map[string]any {
	if item == nil {
		return item
	}
	if v, ok := item["videoUrl"].(string); ok && strings.HasPrefix(v, "/api/media/") {
		item["videoUrl"] = s.signMediaURL(v)
	}
	return item
}

func isExternalVideoURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return false
	}
	return true
}

func looksLikeVideoName(name string) bool {
	n := strings.ToLower(name)
	return strings.HasSuffix(n, ".mp4") || strings.HasSuffix(n, ".mov") ||
		strings.HasSuffix(n, ".webm") || strings.HasSuffix(n, ".m4v")
}

func looksLikeImageName(name string) bool {
	n := strings.ToLower(name)
	return strings.HasSuffix(n, ".jpg") || strings.HasSuffix(n, ".jpeg") ||
		strings.HasSuffix(n, ".png") || strings.HasSuffix(n, ".webp") || strings.HasSuffix(n, ".gif")
}

func mediaKind(contentType, filename string) string {
	ct := strings.ToLower(contentType)
	if strings.HasPrefix(ct, "video/") || looksLikeVideoName(filename) {
		return "video"
	}
	if strings.HasPrefix(ct, "image/") || looksLikeImageName(filename) {
		return "image"
	}
	return ""
}
