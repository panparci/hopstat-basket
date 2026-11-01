package httpapi

import (
	"testing"
	"time"
)

var coach = map[string]any{"id": "c1", "name": "Coach David", "role": "coach"}

func session() map[string]any {
	return map[string]any{
		"title": " Shooting Clinic ", "date": "2026-10-11", "startTime": "16:00", "endTime": "18:00",
		"quota": 8.0, "price": 150000.0, "skills": []any{"Shooting", "Shooting", " "}, "isPrivate": true,
		"invitedProfileIds": []any{"p1", "p2"}, "terms": "Hadir 10 menit sebelum mulai.", "coachId": "attacker",
	}
}

func TestCleanSession(t *testing.T) {
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, time.UTC)
	doc := session()
	if err := cleanSession(nil, doc, coach, now); err != nil {
		t.Fatal(err)
	}
	if doc["coachId"] != "c1" || doc["title"] != "Shooting Clinic" || doc["quota"] != 8 || doc["termsVersion"] != 1 || len(listOf(doc["skills"])) != 1 {
		t.Fatalf("create: %v", doc)
	}
	edit := session()
	edit["terms"] = "Ketentuan baru"
	if err := cleanSession(doc, edit, map[string]any{"id": "c1"}, now); err != nil || edit["termsVersion"] != 2 || edit["coachId"] != "c1" {
		t.Fatalf("terms bump: %v %v", err, edit)
	}
	for name, bad := range map[string]func(m map[string]any){
		"quota":   func(m map[string]any) { m["quota"] = 0.0 },
		"date":    func(m map[string]any) { m["date"] = "11 Okt" },
		"hours":   func(m map[string]any) { m["endTime"] = "15:00" },
		"invites": func(m map[string]any) { m["invitedProfileIds"] = []any{} },
		"price":   func(m map[string]any) { m["price"] = -1.0 },
	} {
		d := session()
		bad(d)
		if cleanSession(nil, d, coach, now) == nil {
			t.Fatalf("%s accepted", name)
		}
	}
}

func TestCleanReportStampsOnce(t *testing.T) {
	now := time.Date(2026, 10, 11, 18, 0, 0, 0, time.UTC)
	rep := map[string]any{"attendance": []any{"p1"}, "ratings": []any{map[string]any{"profileId": "p1", "stars": 4.0}}, "publishedAt": "x"}
	if err := cleanReport(nil, rep, now); err != nil || rep["publishedAt"] != "2026-10-11T18:00:00Z" {
		t.Fatalf("publish: %v %v", err, rep)
	}
	again := map[string]any{"ratings": []any{}, "publishedAt": "later"}
	_ = cleanReport(rep, again, now.Add(time.Hour))
	if again["publishedAt"] != "2026-10-11T18:00:00Z" {
		t.Fatal("publishedAt moved")
	}
	if cleanReport(nil, map[string]any{"ratings": []any{map[string]any{"profileId": "p1", "stars": 9.0}}}, now) == nil {
		t.Fatal("9 stars accepted")
	}
}

func TestSessionView(t *testing.T) {
	sess := map[string]any{
		"isPrivate": true, "invitedProfileIds": []any{"p1", "p2"},
		"report": map[string]any{"publishedAt": "t", "attendance": []any{"p1", "p2"}, "ratings": []any{
			map[string]any{"profileId": "p1", "stars": 4}, map[string]any{"profileId": "p2", "stars": 2},
		}},
	}
	if v := sessionView(sess, true, nil, false, 2); v["registeredCount"] != 2 || len(listOf(v["invitedProfileIds"])) != 2 {
		t.Fatalf("coach: %v", v)
	}
	if sessionView(sess, false, map[string]bool{"x": true}, false, 2) != nil {
		t.Fatal("stranger sees private session")
	}
	invited := sessionView(sess, false, map[string]bool{"p1": true}, false, 2)
	if invited == nil || len(listOf(invited["invitedProfileIds"])) != 1 || invited["report"] != nil {
		t.Fatalf("invited family: %v", invited)
	}
	reg := sessionView(sess, false, map[string]bool{"p1": true}, true, 2)
	rep := reg["report"].(map[string]any)
	if rep["attendedCount"] != 2 || len(listOf(rep["ratings"])) != 1 || len(listOf(rep["attendance"])) != 1 {
		t.Fatalf("registered family: %v", rep)
	}
	if len(listOf(sess["report"].(map[string]any)["ratings"])) != 2 {
		t.Fatal("view mutated the stored doc")
	}
}

func TestIsMinorBirthAndVenue(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	if !isMinorBirth("2008-10-10", now) || isMinorBirth("2008-10-09", now) || isMinorBirth("", now) {
		t.Fatal("minor")
	}
	if cleanVenue(map[string]any{"name": "GOR", "lat": 95.0, "lng": 1.0}) == nil || cleanVenue(map[string]any{"name": "GOR", "lat": 1.0}) == nil {
		t.Fatal("bad coords accepted")
	}
	v := map[string]any{"name": " GOR Soemantri ", "lat": -6.2, "lng": 106.8}
	if cleanVenue(v) != nil || v["name"] != "GOR Soemantri" {
		t.Fatalf("venue: %v", v)
	}
}
