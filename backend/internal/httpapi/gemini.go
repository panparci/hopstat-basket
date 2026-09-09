package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

var geminiModels = map[string]bool{
	"gemini-2.5-flash": true,
	"gemini-3.5-flash": true,
	"gemini-3.6-flash": true,
}

func (s *Server) generate(w http.ResponseWriter, r *http.Request) {
	if !s.aiLimit.allow(uidOf(userFrom(r)), 20, time.Minute) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "AI rate limit"})
		return
	}
	if s.geminiKey == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "GEMINI_API_KEY is not configured."})
		return
	}
	var body struct {
		Model    string          `json:"model"`
		Contents json.RawMessage `json:"contents"`
		Config   struct {
			SystemInstruction string          `json:"systemInstruction"`
			Temperature       *float64        `json:"temperature"`
			ResponseMimeType  string          `json:"responseMimeType"`
			ResponseSchema    json.RawMessage `json:"responseSchema"`
		} `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	model := body.Model
	if model == "" {
		model = "gemini-3.5-flash"
	}
	if !geminiModels[model] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported model"})
		return
	}
	contents, err := normalizeContents(body.Contents)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	payload := map[string]any{"contents": contents}
	if body.Config.SystemInstruction != "" {
		payload["systemInstruction"] = map[string]any{
			"parts": []map[string]string{{"text": body.Config.SystemInstruction}},
		}
	}
	gen := map[string]any{}
	if body.Config.Temperature != nil {
		gen["temperature"] = *body.Config.Temperature
	}
	if body.Config.ResponseMimeType != "" {
		gen["responseMimeType"] = body.Config.ResponseMimeType
	}
	if len(body.Config.ResponseSchema) > 0 && string(body.Config.ResponseSchema) != "null" {
		var schema any
		if err := json.Unmarshal(body.Config.ResponseSchema, &schema); err == nil {
			gen["responseSchema"] = schema
		}
	}
	if len(gen) > 0 {
		payload["generationConfig"] = gen
	}
	raw, _ := json.Marshal(payload)
	url := "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + s.geminiKey
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{Timeout: 90 * time.Second}).Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("gemini %s: %s", res.Status, truncate(string(respBody), 400))})
		return
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
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	text := ""
	if len(parsed.Candidates) > 0 && len(parsed.Candidates[0].Content.Parts) > 0 {
		text = parsed.Candidates[0].Content.Parts[0].Text
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"text": text,
		"usage": map[string]int{
			"promptTokenCount":     parsed.Usage.PromptTokenCount,
			"candidatesTokenCount": parsed.Usage.CandidatesTokenCount,
			"totalTokenCount":      parsed.Usage.TotalTokenCount,
		},
	})
}

func normalizeContents(raw json.RawMessage) (any, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, fmt.Errorf("contents required")
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return []map[string]any{{"role": "user", "parts": []map[string]string{{"text": asString}}}}, nil
	}
	var asObj map[string]any
	if err := json.Unmarshal(raw, &asObj); err == nil {
		if _, ok := asObj["parts"]; ok {
			return []map[string]any{{"role": "user", "parts": asObj["parts"]}}, nil
		}
		return []map[string]any{asObj}, nil
	}
	var asArr []any
	if err := json.Unmarshal(raw, &asArr); err == nil {
		return asArr, nil
	}
	return nil, fmt.Errorf("invalid contents")
}

func (s *Server) rateLimitedOCR(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.aiLimit.allow("ocr:"+uidOf(userFrom(r)), 30, time.Minute) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "OCR rate limit"})
			return
		}
		next(w, r)
	}
}
