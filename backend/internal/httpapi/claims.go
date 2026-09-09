package httpapi

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
)

const maxClaimDoc = 5 << 20

func persistClaimDocs(ctx context.Context, q dbx, claimID string, doc map[string]any) error {
	docs, ok := doc["documents"].([]any)
	if !ok {
		return nil
	}
	type file struct {
		kind, name, ctype string
		body              []byte
	}
	var files []file
	meta := make([]any, 0, len(docs))
	for _, raw := range docs {
		m, ok := raw.(map[string]any)
		if !ok {
			meta = append(meta, raw)
			continue
		}
		row := cloneDoc(m)
		dataURL := asString(row["dataUrl"])
		delete(row, "dataUrl")
		if strings.HasPrefix(dataURL, "data:") {
			ctype, body, err := parseDataURL(dataURL)
			if err != nil {
				return err
			}
			if len(body) > maxClaimDoc {
				return fmt.Errorf("claim document too large")
			}
			files = append(files, file{
				kind:  asString(row["type"]),
				name:  asString(row["fileName"]),
				ctype: ctype,
				body:  body,
			})
			row["stored"] = true
		}
		meta = append(meta, row)
	}
	doc["documents"] = meta
	if len(files) == 0 {
		return nil
	}
	if _, err := q.Exec(ctx, `DELETE FROM claim_docs WHERE claim_id = $1`, claimID); err != nil {
		return err
	}
	for i, f := range files {
		id := fmt.Sprintf("%s-%d", claimID, i)
		if _, err := q.Exec(ctx, `INSERT INTO claim_docs (id, claim_id, kind, file_name, content_type, body) VALUES ($1,$2,$3,$4,$5,$6)`,
			id, claimID, f.kind, f.name, f.ctype, f.body); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) hydrateClaimDocs(ctx context.Context, doc map[string]any) map[string]any {
	if doc == nil {
		return doc
	}
	id := asString(doc["id"])
	if id == "" {
		return doc
	}
	rows, err := s.pool.Query(ctx, `SELECT kind, file_name, content_type, body FROM claim_docs WHERE claim_id = $1 ORDER BY id`, id)
	if err != nil {
		return doc
	}
	defer rows.Close()
	var files []any
	for rows.Next() {
		var kind, name, ctype string
		var body []byte
		if err := rows.Scan(&kind, &name, &ctype, &body); err != nil {
			continue
		}
		if ctype == "" {
			ctype = "application/octet-stream"
		}
		files = append(files, map[string]any{
			"type":     kind,
			"fileName": name,
			"dataUrl":  "data:" + ctype + ";base64," + base64.StdEncoding.EncodeToString(body),
			"stored":   true,
		})
	}
	if len(files) > 0 {
		out := cloneDoc(doc)
		out["documents"] = files
		return out
	}
	return doc
}

func parseDataURL(s string) (contentType string, body []byte, err error) {
	rest, ok := strings.CutPrefix(s, "data:")
	if !ok {
		return "", nil, fmt.Errorf("not a data URL")
	}
	meta, payload, ok := strings.Cut(rest, ",")
	if !ok {
		return "", nil, fmt.Errorf("invalid data URL")
	}
	contentType, b64, _ := strings.Cut(meta, ";")
	if b64 != "base64" && !strings.Contains(meta, "base64") {
		return "", nil, fmt.Errorf("claim document must be base64")
	}
	if contentType == "" || contentType == "base64" {
		contentType = "application/octet-stream"
	}
	body, err = base64.StdEncoding.DecodeString(payload)
	return contentType, body, err
}
