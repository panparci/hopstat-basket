// Package gdrive uploads practice media to the admin's Google Drive via OAuth.
// Service accounts have no quota; user OAuth (refresh token) is required.
package gdrive

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const (
	Scope     = drive.DriveFileScope
	folderName = "HoopStat Latihan"
)

type Client struct {
	mu         sync.Mutex
	oauth      *oauth2.Config
	tokenPath  string
	folderID   string // optional fixed folder; else auto "HoopStat Latihan"
	cachedFold string
}

type Result struct {
	FileID     string
	ViewURL    string
	PreviewURL string
}

func New(oauthJSONPath, tokenPath, folderID, redirectURL string) (*Client, error) {
	b, err := os.ReadFile(oauthJSONPath)
	if err != nil {
		return nil, err
	}
	cfg, err := google.ConfigFromJSON(b, Scope)
	if err != nil {
		return nil, err
	}
	if redirectURL != "" {
		cfg.RedirectURL = redirectURL
	}
	if cfg.RedirectURL == "" {
		cfg.RedirectURL = "https://hoopstats.kognifx.com/api/drive/callback"
	}
	if err := os.MkdirAll(filepath.Dir(tokenPath), 0o750); err != nil {
		return nil, err
	}
	return &Client{oauth: cfg, tokenPath: tokenPath, folderID: folderID}, nil
}

func (c *Client) AuthURL(state string) string {
	return c.oauth.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

func (c *Client) Ready() bool {
	tok, err := c.loadToken()
	return err == nil && tok != nil && tok.RefreshToken != ""
}

func (c *Client) Exchange(ctx context.Context, code string) error {
	tok, err := c.oauth.Exchange(ctx, code)
	if err != nil {
		return err
	}
	if tok.RefreshToken == "" {
		// merge with existing refresh if Google omitted it on re-consent
		if old, _ := c.loadToken(); old != nil && old.RefreshToken != "" {
			tok.RefreshToken = old.RefreshToken
		}
	}
	if tok.RefreshToken == "" {
		return fmt.Errorf("no refresh_token — revoke app access at myaccount.google.com/permissions then re-auth")
	}
	return c.saveToken(tok)
}

func (c *Client) Upload(ctx context.Context, name, contentType string, r io.Reader) (*Result, error) {
	srv, err := c.service(ctx)
	if err != nil {
		return nil, err
	}
	folderID, err := c.ensureFolder(ctx, srv)
	if err != nil {
		return nil, err
	}
	meta := &drive.File{
		Name:    name,
		Parents: []string{folderID},
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	created, err := srv.Files.Create(meta).Media(r).Fields("id,webViewLink").Do()
	if err != nil {
		return nil, err
	}
	// Anyone with link can view (coach opens without Google login).
	_, _ = srv.Permissions.Create(created.Id, &drive.Permission{
		Type: "anyone",
		Role: "reader",
	}).Do()
	view := created.WebViewLink
	if view == "" {
		view = "https://drive.google.com/file/d/" + created.Id + "/view"
	}
	return &Result{
		FileID:     created.Id,
		ViewURL:    view,
		PreviewURL: "https://drive.google.com/file/d/" + created.Id + "/preview",
	}, nil
}

func (c *Client) service(ctx context.Context) (*drive.Service, error) {
	tok, err := c.loadToken()
	if err != nil {
		return nil, fmt.Errorf("drive not linked: visit /api/drive/auth (%w)", err)
	}
	ts := c.oauth.TokenSource(ctx, tok)
	// persist refreshed access token
	if nt, err := ts.Token(); err == nil {
		if nt.RefreshToken == "" {
			nt.RefreshToken = tok.RefreshToken
		}
		_ = c.saveToken(nt)
		ts = c.oauth.TokenSource(ctx, nt)
	}
	return drive.NewService(ctx, option.WithTokenSource(ts))
}

func (c *Client) ensureFolder(ctx context.Context, srv *drive.Service) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.folderID != "" {
		return c.folderID, nil
	}
	if c.cachedFold != "" {
		return c.cachedFold, nil
	}
	q := fmt.Sprintf("mimeType='application/vnd.google-apps.folder' and name='%s' and trashed=false", folderName)
	list, err := srv.Files.List().Q(q).Spaces("drive").Fields("files(id,name)").PageSize(1).Do()
	if err != nil {
		return "", err
	}
	if len(list.Files) > 0 {
		c.cachedFold = list.Files[0].Id
		return c.cachedFold, nil
	}
	created, err := srv.Files.Create(&drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
	}).Fields("id").Do()
	if err != nil {
		return "", err
	}
	c.cachedFold = created.Id
	return c.cachedFold, nil
}

func (c *Client) loadToken() (*oauth2.Token, error) {
	b, err := os.ReadFile(c.tokenPath)
	if err != nil {
		return nil, err
	}
	var tok oauth2.Token
	if err := json.Unmarshal(b, &tok); err != nil {
		return nil, err
	}
	return &tok, nil
}

func (c *Client) saveToken(tok *oauth2.Token) error {
	b, err := json.MarshalIndent(tok, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.tokenPath, b, 0o600)
}

func SafeFileName(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", ".")
	if name == "" || name == "." {
		return "upload.bin"
	}
	return name
}
