package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
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

	// Prefer SumoPod (OpenAI-compatible) when configured — used for coach review tidy + drills AI.
	if key := strings.TrimSpace(os.Getenv("SUMOPOD_API_KEY")); key != "" {
		s.generateSumoPod(w, r, key, body.Model, body.Contents, body.Config.SystemInstruction, body.Config.Temperature, body.Config.ResponseMimeType)
		return
	}

	if s.geminiKey == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI tidak dikonfigurasi (SUMOPOD_API_KEY / GEMINI_API_KEY)."})
		return
	}
	model := strings.TrimSpace(body.Model)
	if model == "" {
		model = strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	}
	if model == "" || !geminiModels[model] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "GEMINI_MODEL tidak dikonfigurasi / tidak didukung"})
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

func (s *Server) generateSumoPod(w http.ResponseWriter, r *http.Request, key, reqModel string, contents json.RawMessage, system string, temperature *float64, mime string) {
	base := strings.TrimRight(os.Getenv("SUMOPOD_BASE_URL"), "/")
	if base == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "SUMOPOD_BASE_URL tidak dikonfigurasi."})
		return
	}
	// Model hanya dari env (atau body non-gemini). Jangan hardcode nama model di binary.
	model := strings.TrimSpace(os.Getenv("SUMOPOD_MODEL"))
	if reqModel != "" && !strings.HasPrefix(reqModel, "gemini-") {
		model = strings.TrimSpace(reqModel)
	}
	if model == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "SUMOPOD_MODEL tidak dikonfigurasi."})
		return
	}
	userText, err := contentsAsText(contents)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	msgs := []map[string]string{}
	if system != "" {
		msgs = append(msgs, map[string]string{"role": "system", "content": system})
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": userText})
	payload := map[string]any{
		"model":       model,
		"messages":    msgs,
		"max_tokens":  1200,
	}
	if temperature != nil {
		payload["temperature"] = *temperature
	}
	if strings.Contains(strings.ToLower(mime), "json") {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, base+"/chat/completions", bytes.NewReader(raw))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	res, err := (&http.Client{Timeout: 90 * time.Second}).Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("sumopod %s: %s", res.Status, truncate(string(respBody), 400))})
		return
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	text := ""
	if len(parsed.Choices) > 0 {
		text = parsed.Choices[0].Message.Content
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"text": text,
		"usage": map[string]int{
			"promptTokenCount":     parsed.Usage.PromptTokens,
			"candidatesTokenCount": parsed.Usage.CompletionTokens,
			"totalTokenCount":      parsed.Usage.TotalTokens,
		},
	})
}

func contentsAsText(raw json.RawMessage) (string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return "", fmt.Errorf("contents required")
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString, nil
	}
	// Gemini-shaped: [{parts:[{text}]}] or {parts:[{text}]}
	var dig any
	if err := json.Unmarshal(raw, &dig); err != nil {
		return "", fmt.Errorf("invalid contents")
	}
	var b strings.Builder
	var walk func(any)
	walk = func(v any) {
		switch t := v.(type) {
		case string:
			if t != "" {
				if b.Len() > 0 {
					b.WriteByte('\n')
				}
				b.WriteString(t)
			}
		case []any:
			for _, x := range t {
				walk(x)
			}
		case map[string]any:
			if text, ok := t["text"].(string); ok {
				walk(text)
			}
			if parts, ok := t["parts"]; ok {
				walk(parts)
			}
		}
	}
	walk(dig)
	if b.Len() == 0 {
		return "", fmt.Errorf("contents required")
	}
	return b.String(), nil
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
