package httpapi

import "testing"

func TestStageAllowed(t *testing.T) {
	if !stageAllowed("tracking", "qa_review") || stageAllowed("tracking", "published") {
		t.Fatal("tracking")
	}
	if !stageAllowed("qa_review", "tracking") || !stageAllowed("qa_review", "coach_analysis") {
		t.Fatal("qa")
	}
	if !stageAllowed("coach_analysis", "published") || stageAllowed("published", "tracking") {
		t.Fatal("coach")
	}
}

func TestHasPerm(t *testing.T) {
	if !hasPerm([]string{"*"}, "track_match") || hasPerm([]string{"view_home"}, "track_match") {
		t.Fatal("perm")
	}
}

func TestViewMatch(t *testing.T) {
	match := map[string]any{"id": "m1", "productionStage": "published", "childId": "c1"}
	kid := map[string]any{"id": "c1", "isDiscoverable": true, "links": []any{
		map[string]any{"accountId": "u1", "verified": true},
	}}
	pay := map[string]any{"status": "success", "requestId": "m1"}
	if !viewMatch(map[string]any{"id": "a", "role": "admin"}, match, nil, nil) {
		t.Fatal("admin")
	}
	if !viewMatch(map[string]any{"id": "u1", "role": "customer"}, match, []map[string]any{kid}, nil) {
		t.Fatal("guardian")
	}
	if !viewMatch(map[string]any{"id": "u2", "role": "customer"}, match, nil, []map[string]any{pay}) {
		t.Fatal("paid")
	}
	if viewMatch(map[string]any{"id": "u3", "role": "customer"}, match, nil, nil) {
		t.Fatal("stranger")
	}
	if !viewMatch(map[string]any{"id": "s", "role": "scout"}, match, []map[string]any{kid}, nil) {
		t.Fatal("scout published")
	}
	draft := map[string]any{"id": "m1", "productionStage": "tracking"}
	if viewMatch(map[string]any{"id": "s", "role": "scout"}, draft, []map[string]any{kid}, nil) {
		t.Fatal("scout draft")
	}
}

func TestPublishOverrideNoted(t *testing.T) {
	if publishOverrideNoted(map[string]any{}) {
		t.Fatal("empty")
	}
	ok := map[string]any{"stageHistory": []any{map[string]any{"note": "override UNRELIABLE"}}}
	if !publishOverrideNoted(ok) {
		t.Fatal("note")
	}
}
