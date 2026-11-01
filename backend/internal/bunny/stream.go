// Package bunny uploads practice videos to Bunny Stream (replaces Google Drive).
package bunny

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	LibraryID int64
	APIKey    string
	CDNHost   string // e.g. vz-314c3b3a-41f.b-cdn.net
	BaseURL   string // default https://video.bunnycdn.com
	HTTP      *http.Client
}

type Result struct {
	VideoID  string
	PlayURL  string // HLS playlist on the pull zone
	EmbedURL string // Bunny iframe player
}

func New(libraryID, apiKey, cdnHost string) (*Client, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(libraryID), 10, 64)
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("BUNNY_STREAM_LIBRARY_ID invalid")
	}
	if strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("BUNNY_STREAM_API_KEY required")
	}
	cdnHost = strings.TrimPrefix(strings.TrimSpace(cdnHost), "https://")
	cdnHost = strings.TrimSuffix(cdnHost, "/")
	if cdnHost == "" {
		return nil, fmt.Errorf("BUNNY_STREAM_CDN_HOST required")
	}
	return &Client{
		LibraryID: id,
		APIKey:    strings.TrimSpace(apiKey),
		CDNHost:   cdnHost,
		BaseURL:   "https://video.bunnycdn.com",
		HTTP:      &http.Client{Timeout: 5 * time.Minute},
	}, nil
}

func (c *Client) Ready() bool {
	return c != nil && c.LibraryID > 0 && c.APIKey != "" && c.CDNHost != ""
}

func (c *Client) api(path string) string { return strings.TrimRight(c.BaseURL, "/") + path }

// Upload creates a Stream video then PUTs the file bytes.
func (c *Client) Upload(ctx context.Context, title string, r io.Reader) (*Result, error) {
	guid, err := c.create(ctx, title)
	if err != nil {
		return nil, err
	}
	if err := c.putFile(ctx, guid, r); err != nil {
		return nil, err
	}
	return &Result{
		VideoID:  guid,
		PlayURL:  fmt.Sprintf("https://%s/%s/playlist.m3u8", c.CDNHost, guid),
		EmbedURL: fmt.Sprintf("https://player.mediadelivery.net/embed/%d/%s", c.LibraryID, guid),
	}, nil
}

func (c *Client) create(ctx context.Context, title string) (string, error) {
	if title == "" {
		title = "HoopStat latihan"
	}
	body, _ := json.Marshal(map[string]string{"title": title})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.api(fmt.Sprintf("/library/%d/videos", c.LibraryID)), bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("bunny create: HTTP %d %s", res.StatusCode, truncate(raw))
	}
	var out struct {
		GUID string `json:"guid"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.GUID == "" {
		return "", fmt.Errorf("bunny create: bad response %s", truncate(raw))
	}
	return out.GUID, nil
}

func (c *Client) putFile(ctx context.Context, guid string, r io.Reader) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.api(fmt.Sprintf("/library/%d/videos/%s", c.LibraryID, guid)), r)
	if err != nil {
		return err
	}
	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/octet-stream")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return fmt.Errorf("bunny upload: HTTP %d %s", res.StatusCode, truncate(raw))
	}
	return nil
}

func truncate(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 200 {
		return s[:200]
	}
	return s
}
