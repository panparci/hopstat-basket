package httpapi

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Phone notifications through Expo Push. The mobile app keeps its tokens on the
// account doc (`pushTokens`); delivery is best effort and never fails the write
// that triggered it.
var expoPushURL = cmp.Or(os.Getenv("EXPO_PUSH_URL"), "https://exp.host/--/api/v2/push/send")

type pushMsg struct {
	To        string            `json:"to"`
	Title     string            `json:"title"`
	Body      string            `json:"body"`
	Data      map[string]string `json:"data"`
	Sound     string            `json:"sound"`
	ChannelID string            `json:"channelId"`
}

func pushMessages(accounts []map[string]any, title, body, href string) []pushMsg {
	var out []pushMsg
	seen := map[string]bool{}
	for _, a := range accounts {
		for _, t := range listOf(a["pushTokens"]) {
			tok := asString(t)
			if seen[tok] || !strings.HasPrefix(tok, "ExponentPushToken[") {
				continue
			}
			seen[tok] = true
			out = append(out, pushMsg{To: tok, Title: title, Body: body, Data: map[string]string{"href": href}, Sound: "default", ChannelID: "default"})
		}
	}
	return out
}

func sendPush(ctx context.Context, url string, msgs []pushMsg) error {
	// Expo accepts at most 100 messages per request.
	for len(msgs) > 0 {
		n := min(len(msgs), 100)
		raw, _ := json.Marshal(msgs[:n])
		msgs = msgs[n:]
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		res.Body.Close()
		if res.StatusCode >= 300 {
			return fmt.Errorf("expo push: HTTP %d", res.StatusCode)
		}
	}
	return nil
}

// notify pushes to the given accounts (minus the actor) in the background.
func (s *Server) notify(ctx context.Context, actor string, ids []string, title, body, href string) {
	var accounts []map[string]any
	done := map[string]bool{actor: true, "": true}
	for _, id := range ids {
		if done[id] {
			continue
		}
		done[id] = true
		if a, _ := s.getDoc(ctx, "user_accounts", id); a != nil {
			accounts = append(accounts, a)
		}
	}
	msgs := pushMessages(accounts, title, body, href)
	if len(msgs) == 0 {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := sendPush(ctx, expoPushURL, msgs); err != nil {
			log.Printf("push %q: %v", title, err)
		}
	}()
}

// accountsWith lists accounts holding a permission (e.g. every coach for a new video).
func (s *Server) accountsWith(ctx context.Context, perm string) []string {
	all, _ := s.listDocs(ctx, "user_accounts", "", "")
	var ids []string
	for _, a := range all {
		if s.can(ctx, a, perm) {
			ids = append(ids, asString(a["id"]))
		}
	}
	return ids
}

// matchPush is the follower notice for a match that just went live or finished.
func matchPush(old, doc map[string]any) (title, body string, ok bool) {
	status := asString(doc["status"])
	if old != nil && asString(old["status"]) == status {
		return "", "", false
	}
	name := asString(doc["name"])
	if a, b := asString(doc["ourTeamName"]), asString(doc["theirTeamName"]); a != "" && b != "" {
		name = a + " vs " + b
	}
	switch status {
	case "ongoing":
		return "LIVE: " + name, "Ikuti skor langsung di HoopStats", true
	case "completed":
		return "Hasil akhir: " + name, "Lihat skor & statistik pertandingan", true
	}
	return "", "", false
}

func (s *Server) notifyMatch(ctx context.Context, actor string, old, doc map[string]any) {
	title, body, ok := matchPush(old, doc)
	if !ok {
		return
	}
	teams := map[string]bool{asString(doc["teamId"]): true, asString(doc["opponentTeamId"]): true}
	delete(teams, "")
	// ponytail: scans every follow; add a by-team index when follows grow past a few thousand.
	follows, _ := s.listDocs(ctx, "follows", "", "")
	var ids []string
	for _, f := range follows {
		if teams[asString(f["teamId"])] {
			ids = append(ids, asString(f["userId"]))
		}
	}
	s.notify(ctx, actor, ids, title, body, "/match/"+asString(doc["id"]))
}
