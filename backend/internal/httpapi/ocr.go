package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type ocrItem struct {
	ID               string  `json:"id"`
	VideoTimeSeconds float64 `json:"videoTimeSeconds"`
	Base64Image      string  `json:"base64Image"`
}

type ocrResult struct {
	ID            string `json:"id"`
	GameClockText any    `json:"gameClockText"`
	IsBlocked     bool   `json:"isBlocked"`
	ClockState    string `json:"clockState,omitempty"`
	Confidence    int    `json:"confidence"`
}

type geminiClock struct {
	ID            string `json:"id"`
	GameClockText string `json:"gameClockText"`
	IsBlocked     bool   `json:"isBlocked"`
	ClockState    string `json:"clockState"`
}

func (s *Server) batchOCR(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []ocrItem `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if len(body.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Parameter 'items' array is required."})
		return
	}
	if s.geminiKey == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "GEMINI_API_KEY is not configured."})
		return
	}

	results := make([]ocrResult, 0, len(body.Items))
	usage := map[string]int{"promptTokenCount": 0, "candidatesTokenCount": 0, "totalTokenCount": 0}
	const batchSize = 10
	for i := 0; i < len(body.Items); i += batchSize {
		end := i + batchSize
		if end > len(body.Items) {
			end = len(body.Items)
		}
		batch := body.Items[i:end]
		parsed, u, err := s.callGeminiOCR(r.Context(), batch)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		usage["promptTokenCount"] += u.Prompt
		usage["candidatesTokenCount"] += u.Candidates
		usage["totalTokenCount"] += u.Total
		results = append(results, mapOCRResults(batch, parsed)...)
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "results": results, "usage": usage})
}

func mapOCRResults(batch []ocrItem, parsed []geminiClock) []ocrResult {
	byID := make(map[string]geminiClock, len(parsed))
	for _, p := range parsed {
		byID[p.ID] = p
	}
	out := make([]ocrResult, 0, len(batch))
	for _, item := range batch {
		match, ok := byID[item.ID]
		if ok && !match.IsBlocked && match.GameClockText != "BLOCKED" {
			state := match.ClockState
			if state == "" {
				state = "UNKNOWN"
			}
			out = append(out, ocrResult{
				ID:            item.ID,
				GameClockText: match.GameClockText,
				IsBlocked:     false,
				ClockState:    state,
				Confidence:    95,
			})
			continue
		}
		out = append(out, ocrResult{
			ID:            item.ID,
			GameClockText: nil,
			IsBlocked:     true,
			ClockState:    "UNKNOWN",
			Confidence:    0,
		})
	}
	return out
}

type geminiUsage struct {
	Prompt     int
	Candidates int
	Total      int
}

func (s *Server) callGeminiOCR(ctx context.Context, batch []ocrItem) ([]geminiClock, geminiUsage, error) {
	var ids []string
	var parts []map[string]any
	for i, item := range batch {
		b64 := item.Base64Image
		if _, rest, ok := strings.Cut(b64, ","); ok {
			b64 = rest
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]string{"mime_type": "image/png", "data": b64},
		})
		ids = append(ids, fmt.Sprintf("%d. ID: %q (waktu video: %gs)", i+1, item.ID, item.VideoTimeSeconds))
	}
	prompt := fmt.Sprintf(`Berikut adalah %d potongan gambar jam digital (game clock) dari pertandingan basket.
Gambar diberikan berurutan sesuai list ID berikut:
%s

Tugas Anda:
1. Untuk setiap gambar, ekstrak teks jam pertandingan (format MM:SS seperti 09:45, 01:23, atau 00:12.4).
2. Jika gambar buram total, terhalang grafik/pemain, atau jam tidak terlihat, set isBlocked=true dan gameClockText="BLOCKED".
3. Analisis apakah jam sedang berjalan ("RUNNING") atau berhenti ("STOPPED", misal free throw/foul/out of bounds) jika terlihat dari indikator/titik dua/format subdetik. Jika ragu, set "UNKNOWN".
Kembalikan array JSON berisi objek { id: string, gameClockText: string, isBlocked: boolean, clockState: string }.`, len(batch), strings.Join(ids, "\n"))
	parts = append(parts, map[string]any{"text": prompt})

	payload := map[string]any{
		"contents": []map[string]any{{"parts": parts}},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"responseSchema": map[string]any{
				"type": "ARRAY",
				"items": map[string]any{
					"type": "OBJECT",
					"properties": map[string]any{
						"id":            map[string]string{"type": "STRING"},
						"gameClockText": map[string]string{"type": "STRING"},
						"isBlocked":     map[string]string{"type": "BOOLEAN"},
						"clockState":    map[string]string{"type": "STRING"},
					},
					"required": []string{"id", "gameClockText", "isBlocked"},
				},
			},
		},
	}
	raw, _ := json.Marshal(payload)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + s.geminiKey
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return nil, geminiUsage{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 90 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, geminiUsage{}, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return nil, geminiUsage{}, fmt.Errorf("gemini %s: %s", res.Status, truncate(string(body), 400))
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Usage struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, geminiUsage{}, err
	}
	text := "[]"
	if len(parsed.Candidates) > 0 && len(parsed.Candidates[0].Content.Parts) > 0 && parsed.Candidates[0].Content.Parts[0].Text != "" {
		text = strings.TrimSpace(parsed.Candidates[0].Content.Parts[0].Text)
	}
	clocks, err := parseGeminiClocks(text)
	if err != nil {
		return nil, geminiUsage{}, err
	}
	return clocks, geminiUsage{
		Prompt:     parsed.Usage.PromptTokenCount,
		Candidates: parsed.Usage.CandidatesTokenCount,
		Total:      parsed.Usage.TotalTokenCount,
	}, nil
}

func parseGeminiClocks(text string) ([]geminiClock, error) {
	var clocks []geminiClock
	if err := json.Unmarshal([]byte(text), &clocks); err != nil {
		return nil, err
	}
	return clocks, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
