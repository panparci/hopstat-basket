package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"hoopstat/internal/gdrive"
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
		out = append(out, publicDoc("drill_submissions", it))
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
	writeJSON(w, http.StatusOK, map[string]any{"item": publicDoc("drill_submissions", item)})
}

type drillSubmitBody struct {
	AthleteID    string `json:"athleteId"`
	AthleteName  string `json:"athleteName"`
	DrillID      string `json:"drillId"`
	DrillName    string `json:"drillName"`
	VideoURL     string `json:"videoUrl"`
	AthleteNotes string `json:"athleteNotes"`
}

func (s *Server) createDrillSubmissionLink(w http.ResponseWriter, r *http.Request) {
	var body drillSubmitBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	body.VideoURL = strings.TrimSpace(body.VideoURL)
	if body.VideoURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "videoUrl wajib (link YouTube/Drive)"})
		return
	}
	if !isExternalVideoURL(body.VideoURL) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "videoUrl harus http(s) YouTube/Drive/Loom atau link video publik"})
		return
	}
	user := userFrom(r)
	item, err := s.saveDrillSubmission(r, user, body, body.VideoURL, "", "link", "link", "")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
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
		AthleteID:    strings.TrimSpace(r.FormValue("athleteId")),
		AthleteName:  strings.TrimSpace(r.FormValue("athleteName")),
		DrillID:      strings.TrimSpace(r.FormValue("drillId")),
		DrillName:    strings.TrimSpace(r.FormValue("drillName")),
		AthleteNotes: strings.TrimSpace(r.FormValue("athleteNotes")),
	}
	user := userFrom(r)

	var (
		publicPath string
		mediaFile  string
		driveID    string
		source     = "upload"
	)

	if s.drive != nil && s.drive.Ready() {
		res, err := s.drive.Upload(r.Context(), gdrive.SafeFileName(hdr.Filename), ct, file)
		if err == nil {
			publicPath = res.ViewURL
			driveID = res.FileID
			source = "drive"
		} else if _, seekErr := file.Seek(0, io.SeekStart); seekErr != nil || s.media == nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload Drive gagal: " + err.Error()})
			return
		} else {
			log.Printf("drive upload failed, saved locally instead (re-link via /api/drive/auth): %v", err)
		}
	}
	if source != "drive" {
		if s.media == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "Drive belum di-link. Admin buka /api/drive/auth (login dulu), atau set UPLOAD_DIR untuk fallback lokal.",
			})
			return
		}
		fileName, path, err := s.media.Save(hdr.Filename, ct, file)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		mediaFile = fileName
		publicPath = path
	}

	item, err := s.saveDrillSubmission(r, user, body, publicPath, mediaFile, source, kind, driveID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}

func (s *Server) saveDrillSubmission(r *http.Request, user map[string]any, body drillSubmitBody, videoURL, mediaFile, source, mediaType, driveFileID string) (map[string]any, error) {
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
	if driveFileID != "" {
		doc["driveFileId"] = driveFileID
	}
	return s.putDoc(r.Context(), s.pool, "drill_submissions", doc)
}

type drillReviewBody struct {
	Rating         float64             `json:"rating"`
	Comments       string              `json:"comments"`
	Status         string              `json:"status"`
	TimestampNotes []map[string]string `json:"timestampNotes"`
}

func (s *Server) reviewDrillSubmission(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r)
	role := fmt.Sprint(user["role"])
	if role != "admin" && role != "coach" && role != "scout" {
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
	writeJSON(w, http.StatusOK, map[string]any{"item": item})
}

func (s *Server) serveMedia(w http.ResponseWriter, r *http.Request) {
	if s.media == nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	f, ct, err := s.media.Open(r.PathValue("file"))
	if err != nil {
		writeErr(w, http.StatusNotFound, errors.New("not found"))
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, r.PathValue("file"), time.Time{}, f)
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
