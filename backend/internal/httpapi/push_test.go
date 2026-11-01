package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPush(t *testing.T) {
	accounts := []map[string]any{
		{"id": "a", "pushTokens": []any{"ExponentPushToken[x]", "junk", "ExponentPushToken[y]"}},
		{"id": "b", "pushTokens": []any{"ExponentPushToken[x]"}},
		{"id": "c"},
	}
	msgs := pushMessages(accounts, "Hi", "Body", "/submissions")
	if len(msgs) != 2 || msgs[0].To != "ExponentPushToken[x]" || msgs[1].Data["href"] != "/submissions" {
		t.Fatalf("messages: %+v", msgs)
	}

	var got [][]pushMsg
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var batch []pushMsg
		json.NewDecoder(r.Body).Decode(&batch)
		got = append(got, batch)
	}))
	defer srv.Close()
	many := make([]pushMsg, 150)
	if err := sendPush(context.Background(), srv.URL, many); err != nil || len(got) != 2 || len(got[0]) != 100 || len(got[1]) != 50 {
		t.Fatalf("send: %v %d", err, len(got))
	}

	live := map[string]any{"id": "m1", "status": "ongoing", "ourTeamName": "Garuda", "theirTeamName": "Elang"}
	if title, _, ok := matchPush(map[string]any{"status": "scheduled"}, live); !ok || title != "LIVE: Garuda vs Elang" {
		t.Fatalf("live: %q %v", title, ok)
	}
	if _, _, ok := matchPush(live, live); ok {
		t.Fatal("score update without status change must not notify")
	}
	if title, _, ok := matchPush(live, map[string]any{"status": "completed", "name": "Final"}); !ok || title != "Hasil akhir: Final" {
		t.Fatalf("final: %q %v", title, ok)
	}
}
