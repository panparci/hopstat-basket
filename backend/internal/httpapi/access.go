package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

var errForbidden = errors.New("forbidden")

var defaultPerms = map[string][]string{
	"admin":        {"*"},
	"statistician": {"view_home", "view_matches", "track_match", "do_stat_tasks", "view_own_stats"},
	"customer":     {"view_home", "view_matches", "view_own_stats", "view_published_story", "request_stats", "manage_teams", "manage_profiles"},
	"scout":        {"view_home", "view_gallery", "view_published_story"},
	"coach":        {"view_home", "view_matches", "view_own_stats", "view_published_story", "do_coach_analysis"},
}

// Any of these permissions may write the store. Missing store = admin only.
var writeAny = map[string][]string{
	"players":                   {"manage_teams", "manage_profiles", "track_match", "do_stat_tasks"},
	"teams":                     {"manage_teams", "manage_profiles"},
	"clubs":                     {"manage_teams"},
	"organizations":             {"manage_teams"},
	"series":                    {"manage_teams", "track_match", "do_stat_tasks"},
	"matches":                   {"track_match", "do_stat_tasks", "do_qa_review", "do_coach_analysis"},
	"match_rosters":             {"track_match", "do_stat_tasks", "do_qa_review", "do_coach_analysis"},
	"match_stints":              {"track_match", "do_stat_tasks", "do_qa_review", "do_coach_analysis"},
	"events":                    {"track_match", "do_stat_tasks", "do_qa_review"},
	"possessions":               {"track_match", "do_stat_tasks", "do_qa_review"},
	"game_states":               {"track_match", "do_stat_tasks", "do_qa_review"},
	"event_links":               {"track_match", "do_stat_tasks", "do_qa_review"},
	"audit_issue_resolutions":   {"do_qa_review", "track_match", "do_stat_tasks"},
	"timelines":                 {"track_match", "do_stat_tasks"},
	"coach_annotations":         {"do_coach_analysis"},
	"ai_insights":               {"view_own_stats", "do_coach_analysis"},
	"profiles":                  {"manage_profiles", "manage_athletes"},
	"stat_requests":             {"request_stats", "assign_stat_tasks", "do_stat_tasks", "approve_applications"},
	"user_accounts":             {"manage_users"},
	"payments":                  {"request_stats", "approve_applications"},
	"leads":                     {"manage_crm"},
	"site_content":              {"manage_cms"},
	"role_permissions":          {"manage_roles_config"},
	"role_applications":         {"view_home", "approve_applications"},
	"claim_requests":            {"manage_profiles", "approve_applications"},
	"merge_logs":                {"manage_athletes", "manage_profiles"},
	"knowledge_entries":         {"track_match", "do_stat_tasks", "manage_cms"},
	"token_logs":                {"view_own_stats", "track_match", "do_stat_tasks", "do_coach_analysis"},
	"fundamental_drills":        {"view_home"},
	"fundamental_profiles":      {"view_home"},
	"workout_schedules":         {"view_home"},
	"drill_submissions":         {"view_home"},
	"classroom_qa":              {"view_home"},
}

var matchChildStores = map[string]bool{
	"matches": true, "match_rosters": true, "match_stints": true, "events": true,
	"possessions": true, "game_states": true, "event_links": true,
	"audit_issue_resolutions": true, "timelines": true, "coach_annotations": true,
}

func userFrom(r *http.Request) map[string]any {
	u, _ := r.Context().Value(ctxUser{}).(map[string]any)
	return u
}

func uidOf(u map[string]any) string {
	if u == nil {
		return ""
	}
	return asString(u["id"])
}

func roleOf(u map[string]any) string {
	if u == nil {
		return ""
	}
	return asString(u["role"])
}

func asString(v any) string {
	if v == nil {
		return ""
	}
	s := strings.TrimSpace(fmt.Sprint(v))
	if s == "<nil>" {
		return ""
	}
	return s
}

func isAdmin(u map[string]any) bool {
	return roleOf(u) == "admin"
}

func (s *Server) perms(ctx context.Context, u map[string]any) []string {
	if u == nil {
		return nil
	}
	if isAdmin(u) {
		return []string{"*"}
	}
	role := roleOf(u)
	items, err := s.listDocs(ctx, "role_permissions", "", "")
	if err == nil {
		for _, row := range items {
			if asString(row["role"]) == role {
				if raw, ok := row["permissions"].([]any); ok {
					out := make([]string, 0, len(raw))
					for _, p := range raw {
						out = append(out, asString(p))
					}
					if len(out) > 0 {
						return out
					}
				}
			}
		}
	}
	return append([]string{}, defaultPerms[role]...)
}

func hasPerm(perms []string, want string) bool {
	for _, p := range perms {
		if p == "*" || p == want {
			return true
		}
	}
	return false
}

func (s *Server) can(ctx context.Context, u map[string]any, perm string) bool {
	return hasPerm(s.perms(ctx, u), perm)
}

func (s *Server) authorizeRead(ctx context.Context, u map[string]any, store, id string) error {
	if store == "site_content" {
		return nil
	}
	if u == nil {
		return errForbidden
	}
	if isAdmin(u) {
		return nil
	}
	switch store {
	case "role_permissions", "knowledge_entries",
		"fundamental_drills", "fundamental_profiles", "workout_schedules", "drill_submissions", "classroom_qa":
		return nil
	case "user_accounts":
		if id != "" && id == uidOf(u) {
			return nil
		}
		if s.can(ctx, u, "manage_users") {
			return nil
		}
		if id == "" {
			return nil // list filtered to self
		}
		return errForbidden
	case "leads":
		if s.can(ctx, u, "manage_crm") {
			return nil
		}
		return errForbidden
	case "site_content":
		return nil
	case "token_logs":
		if s.can(ctx, u, "manage_users") || id != "" {
			return nil
		}
		return nil
	}
	return nil
}

func (s *Server) authorizeWrite(ctx context.Context, u map[string]any, store string, existing, incoming map[string]any) error {
	if u == nil {
		if store == "leads" {
			return nil
		}
		return errForbidden
	}
	if isAdmin(u) {
		return nil
	}
	id := uidOf(u)
	switch store {
	case "user_accounts":
		if existing != nil && asString(existing["id"]) == id {
			return nil
		}
		if s.can(ctx, u, "manage_users") {
			return nil
		}
		return errForbidden
	case "payments":
		if s.can(ctx, u, "approve_applications") || s.can(ctx, u, "request_stats") {
			return nil
		}
		return errForbidden
	case "claim_requests":
		if existing != nil && asString(existing["claimantAccountId"]) == id {
			return nil
		}
		if incoming != nil && asString(incoming["claimantAccountId"]) == id && existing == nil {
			return nil
		}
		if s.can(ctx, u, "approve_applications") {
			return nil
		}
		return errForbidden
	case "role_applications":
		if existing != nil && asString(existing["userId"]) == id {
			return nil
		}
		if incoming != nil && asString(incoming["userId"]) == id {
			return nil
		}
		if s.can(ctx, u, "approve_applications") {
			return nil
		}
		return errForbidden
	case "stat_requests":
		if existing != nil && asString(existing["customerId"]) == id {
			return nil
		}
		if incoming != nil && asString(incoming["customerId"]) == id && existing == nil {
			return nil
		}
		if s.can(ctx, u, "assign_stat_tasks") || s.can(ctx, u, "do_stat_tasks") || s.can(ctx, u, "approve_applications") {
			return nil
		}
		return errForbidden
	}
	allowed := writeAny[store]
	if len(allowed) == 0 {
		return errForbidden
	}
	for _, p := range allowed {
		if s.can(ctx, u, p) {
			return nil
		}
	}
	return errForbidden
}

func (s *Server) sanitizeWrite(ctx context.Context, u map[string]any, store string, existing, incoming map[string]any) (map[string]any, error) {
	if incoming == nil {
		incoming = map[string]any{}
	}
	admin := isAdmin(u)

	switch store {
	case "user_accounts":
		if existing == nil && !admin && !s.can(ctx, u, "manage_users") {
			return nil, fmt.Errorf("register via /api/auth/register")
		}
		if existing != nil && !admin && !s.can(ctx, u, "manage_users") {
			incoming["role"] = existing["role"]
			incoming["status"] = existing["status"]
			incoming["email"] = existing["email"]
			incoming["id"] = existing["id"]
		}
	case "payments":
		if !admin && !s.can(ctx, u, "approve_applications") {
			incoming["status"] = "pending"
			if existing != nil {
				incoming["status"] = existing["status"]
				incoming["amount"] = existing["amount"]
				incoming["requestId"] = existing["requestId"]
			}
		}
	case "claim_requests":
		if !admin && !s.can(ctx, u, "approve_applications") {
			incoming["status"] = "pending"
			if existing != nil {
				incoming["status"] = existing["status"]
				incoming["reviewedBy"] = existing["reviewedBy"]
				incoming["reviewNote"] = existing["reviewNote"]
				incoming["paymentStatus"] = existing["paymentStatus"]
			} else {
				delete(incoming, "paymentStatus")
			}
			incoming["claimantAccountId"] = uidOf(u)
		}
	case "stat_requests":
		if existing == nil && !admin {
			incoming["status"] = "pending"
			incoming["customerId"] = uidOf(u)
			delete(incoming, "assignedTo")
			delete(incoming, "paymentId")
		}
		if existing != nil && !admin && !s.can(ctx, u, "assign_stat_tasks") && !s.can(ctx, u, "approve_applications") {
			if s.can(ctx, u, "do_stat_tasks") && asString(existing["assignedTo"]) == uidOf(u) {
				// statistician may move assigned → in_progress → completed
				st := asString(incoming["status"])
				if st != "in_progress" && st != "completed" && st != asString(existing["status"]) {
					incoming["status"] = existing["status"]
				}
				incoming["assignedTo"] = existing["assignedTo"]
				incoming["customerId"] = existing["customerId"]
				incoming["price"] = existing["price"]
			} else if asString(existing["customerId"]) == uidOf(u) {
				incoming["status"] = existing["status"]
				incoming["assignedTo"] = existing["assignedTo"]
			} else {
				return nil, errForbidden
			}
		}
	case "role_applications":
		if existing == nil {
			incoming["userId"] = uidOf(u)
			incoming["status"] = "pending"
		} else if !admin && !s.can(ctx, u, "approve_applications") {
			incoming["status"] = existing["status"]
			incoming["userId"] = existing["userId"]
		}
	case "role_permissions":
		if asString(incoming["role"]) == "admin" && !admin {
			return nil, errForbidden
		}
	case "matches":
		from := "tracking"
		if existing != nil {
			if s := asString(existing["productionStage"]); s != "" {
				from = s
			}
		}
		to := from
		if s := asString(incoming["productionStage"]); s != "" {
			to = s
		}
		if to != from && !stageAllowed(from, to) && !admin {
			return nil, fmt.Errorf("invalid stage %s → %s", from, to)
		}
		if to == "published" && from != "published" {
			trust := asString(incoming["trustClassification"])
			if trust == "" && existing != nil {
				trust = asString(existing["trustClassification"])
			}
			if trust == "UNRELIABLE" {
				if !admin {
					return nil, fmt.Errorf("UNRELIABLE match cannot be published")
				}
				if !publishOverrideNoted(incoming) {
					return nil, fmt.Errorf("admin override note required to publish UNRELIABLE")
				}
			}
		}
	}
	return incoming, nil
}

func stageAllowed(from, to string) bool {
	switch from {
	case "tracking":
		return to == "qa_review"
	case "qa_review":
		return to == "coach_analysis" || to == "tracking"
	case "coach_analysis":
		return to == "published" || to == "qa_review"
	default:
		return false
	}
}

func publishOverrideNoted(incoming map[string]any) bool {
	hist, _ := incoming["stageHistory"].([]any)
	if len(hist) == 0 {
		return false
	}
	last, _ := hist[len(hist)-1].(map[string]any)
	return strings.TrimSpace(asString(last["note"])) != ""
}

func guardianOf(profile map[string]any, accountID string) bool {
	if profile == nil || accountID == "" {
		return false
	}
	links, _ := profile["links"].([]any)
	for _, raw := range links {
		m, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if asString(m["accountId"]) != accountID {
			continue
		}
		switch v := m["verified"].(type) {
		case bool:
			if v {
				return true
			}
		default:
			if asString(v) == "true" {
				return true
			}
		}
	}
	return false
}

func viewMatch(user, match map[string]any, athletes []map[string]any, payments []map[string]any) bool {
	if user == nil || match == nil {
		return false
	}
	switch roleOf(user) {
	case "admin", "statistician", "coach":
		return true
	case "customer":
		id := uidOf(user)
		for _, a := range athletes {
			if guardianOf(a, id) {
				return true
			}
		}
		mid := asString(match["id"])
		childID := asString(match["childId"])
		for _, p := range payments {
			if asString(p["status"]) != "success" {
				continue
			}
			rid := asString(p["requestId"])
			if rid == mid || (childID != "" && rid == childID) {
				return true
			}
			for _, a := range athletes {
				if rid == asString(a["id"]) {
					return true
				}
			}
		}
		return false
	case "scout":
		if asString(match["productionStage"]) != "published" {
			return false
		}
		for _, a := range athletes {
			if v, ok := a["isDiscoverable"].(bool); ok && v {
				return true
			}
		}
		return false
	default:
		return false
	}
}

// ponytail: loads profiles per match; indexed join if list latency matters.
func (s *Server) canViewMatchDoc(ctx context.Context, u, match map[string]any) bool {
	if match == nil {
		return false
	}
	if isAdmin(u) || roleOf(u) == "statistician" || roleOf(u) == "coach" {
		return true
	}
	mid := asString(match["id"])
	rosters, _ := s.listDocs(ctx, "match_rosters", "by-match", mid)
	profiles, _ := s.listDocs(ctx, "profiles", "", "")
	byID := map[string]map[string]any{}
	for _, p := range profiles {
		byID[asString(p["id"])] = p
	}
	var athletes []map[string]any
	if cid := asString(match["childId"]); cid != "" {
		if p := byID[cid]; p != nil {
			athletes = append(athletes, p)
		}
	}
	for _, r := range rosters {
		if p := byID[asString(r["profileId"])]; p != nil {
			athletes = append(athletes, p)
		}
	}
	pays, _ := s.listDocs(ctx, "payments", "", "")
	return viewMatch(u, match, athletes, pays)
}

func matchIDOf(store string, doc map[string]any) string {
	if store == "matches" {
		return asString(doc["id"])
	}
	if store == "game_states" {
		return asString(doc["matchId"])
	}
	return asString(doc["matchId"])
}

func (s *Server) filterList(ctx context.Context, u map[string]any, store string, items []map[string]any) []map[string]any {
	if u == nil {
		if store == "site_content" {
			return items
		}
		return nil
	}
	if isAdmin(u) {
		return items
	}
	id := uidOf(u)
	out := make([]map[string]any, 0, len(items))
	switch store {
	case "user_accounts":
		if s.can(ctx, u, "manage_users") {
			return items
		}
		for _, it := range items {
			if asString(it["id"]) == id {
				out = append(out, it)
			}
		}
		return out
	case "payments":
		if s.can(ctx, u, "approve_applications") {
			return items
		}
		reqs, _ := s.listDocs(ctx, "stat_requests", "by-customer", id)
		claims, _ := s.listDocs(ctx, "claim_requests", "by-claimant", id)
		own := map[string]bool{}
		for _, r := range reqs {
			own[asString(r["id"])] = true
		}
		for _, c := range claims {
			own[asString(c["id"])] = true
		}
		for _, it := range items {
			if own[asString(it["requestId"])] {
				out = append(out, it)
			}
		}
		return out
	case "claim_requests":
		if s.can(ctx, u, "approve_applications") {
			return items
		}
		for _, it := range items {
			if asString(it["claimantAccountId"]) == id {
				out = append(out, it)
			}
		}
		return out
	case "role_applications":
		if s.can(ctx, u, "approve_applications") {
			return items
		}
		for _, it := range items {
			if asString(it["userId"]) == id {
				out = append(out, it)
			}
		}
		return out
	case "stat_requests":
		if s.can(ctx, u, "assign_stat_tasks") || s.can(ctx, u, "approve_applications") {
			return items
		}
		for _, it := range items {
			if asString(it["customerId"]) == id || (s.can(ctx, u, "do_stat_tasks") && asString(it["assignedTo"]) == id) {
				out = append(out, it)
			}
		}
		return out
	case "leads":
		if s.can(ctx, u, "manage_crm") {
			return items
		}
		return nil
	case "token_logs":
		if s.can(ctx, u, "manage_users") {
			return items
		}
		return nil
	case "merge_logs":
		if s.can(ctx, u, "manage_athletes") || s.can(ctx, u, "manage_profiles") {
			return items
		}
		return nil
	case "profiles":
		if s.can(ctx, u, "manage_athletes") {
			return items
		}
		for _, it := range items {
			if guardianOf(it, id) {
				out = append(out, it)
				continue
			}
			if asString(it["claimStatus"]) == "unclaimed" {
				out = append(out, it)
				continue
			}
			if v, ok := it["isDiscoverable"].(bool); ok && v && s.can(ctx, u, "view_gallery") {
				out = append(out, it)
			}
		}
		return out
	case "role_permissions":
		return items
	}
	if matchChildStores[store] {
		ok := map[string]bool{}
		for _, it := range items {
			mid := matchIDOf(store, it)
			if mid == "" {
				continue
			}
			allowed, seen := ok[mid]
			if !seen {
				m := it
				if store != "matches" {
					m, _ = s.getDoc(ctx, "matches", mid)
				}
				allowed = s.canViewMatchDoc(ctx, u, m)
				ok[mid] = allowed
			}
			if allowed {
				out = append(out, it)
			}
		}
		return out
	}
	return items
}

func redactClaims(items []map[string]any) []map[string]any {
	out := make([]map[string]any, len(items))
	for i, it := range items {
		cp := cloneDoc(it)
		if docs, ok := cp["documents"].([]any); ok {
			clean := make([]any, 0, len(docs))
			for _, d := range docs {
				m, ok := d.(map[string]any)
				if !ok {
					clean = append(clean, d)
					continue
				}
				row := cloneDoc(m)
				delete(row, "dataUrl")
				clean = append(clean, row)
			}
			cp["documents"] = clean
		}
		out[i] = cp
	}
	return out
}

func cloneDoc(m map[string]any) map[string]any {
	raw, _ := json.Marshal(m)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

func stripClaimBodies(doc map[string]any) map[string]any {
	if doc == nil {
		return doc
	}
	cp := cloneDoc(doc)
	if docs, ok := cp["documents"].([]any); ok {
		for i, d := range docs {
			m, ok := d.(map[string]any)
			if !ok {
				continue
			}
			delete(m, "dataUrl")
			docs[i] = m
		}
		cp["documents"] = docs
	}
	return cp
}

func (s *Server) allowClaimBodies(ctx context.Context, u map[string]any, doc map[string]any) bool {
	if isAdmin(u) || s.can(ctx, u, "approve_applications") {
		return true
	}
	return asString(doc["claimantAccountId"]) == uidOf(u)
}

// ponytail: process-local rate limit; Redis if more than one API replica.
type hitLimiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func (l *hitLimiter) allow(key string, n int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.hits == nil {
		l.hits = map[string][]time.Time{}
	}
	now := time.Now()
	cut := now.Add(-window)
	q := l.hits[key]
	kept := q[:0]
	for _, t := range q {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= n {
		l.hits[key] = kept
		return false
	}
	l.hits[key] = append(kept, now)
	return true
}

func writeForbidden(w http.ResponseWriter) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
}
