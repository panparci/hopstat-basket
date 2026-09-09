package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBatchOCRRequiresItems(t *testing.T) {
	s := &Server{}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/gemini/batch-ocr", strings.NewReader(`{}`))
	s.batchOCR(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestMapOCRResults(t *testing.T) {
	batch := []ocrItem{{ID: "a"}, {ID: "b"}, {ID: "c"}}
	parsed := []geminiClock{
		{ID: "a", GameClockText: "09:45", IsBlocked: false, ClockState: "RUNNING"},
		{ID: "b", GameClockText: "BLOCKED", IsBlocked: true},
	}
	got := mapOCRResults(batch, parsed)
	if len(got) != 3 {
		t.Fatalf("len %d", len(got))
	}
	if got[0].IsBlocked || got[0].GameClockText != "09:45" || got[0].Confidence != 95 {
		t.Fatalf("a: %+v", got[0])
	}
	if !got[1].IsBlocked || got[1].GameClockText != nil {
		t.Fatalf("b: %+v", got[1])
	}
	if !got[2].IsBlocked {
		t.Fatalf("missing id should be blocked: %+v", got[2])
	}
}
