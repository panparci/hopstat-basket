package catalog

import (
	"fmt"
	"strings"
)

type StoreDef struct {
	PK      string
	Serial  bool
	Indexes map[string]string
}

var Stores = map[string]StoreDef{
	"players":                 {PK: "id"},
	"teams":                   {PK: "id"},
	"clubs":                   {PK: "id"},
	"organizations":           {PK: "id", Indexes: map[string]string{"by-city": "city", "by-type": "type"}},
	"series":                  {PK: "id"},
	"matches":                 {PK: "id"},
	"match_rosters":           {PK: "id", Indexes: map[string]string{"by-match": "matchId", "by-team": "teamId", "by-profile": "profileId"}},
	"match_stints":            {PK: "id", Indexes: map[string]string{"by-match": "matchId", "by-team": "teamId"}},
	"events":                  {PK: "id", Indexes: map[string]string{"by-match": "matchId"}},
	"possessions":             {PK: "id", Indexes: map[string]string{"by-match": "matchId"}},
	"game_states":             {PK: "matchId"},
	"profiles":                {PK: "id"},
	"ai_insights":             {PK: "id", Indexes: map[string]string{"by-target": "targetId"}},
	"event_links":             {PK: "id", Indexes: map[string]string{"by-match": "matchId", "by-primary": "primaryEventId", "by-secondary": "secondaryEventId", "by-relation": "relationType"}},
	"audit_issue_resolutions": {PK: "id", Indexes: map[string]string{"by-match": "matchId"}},
	"stat_requests":           {PK: "id", Indexes: map[string]string{"by-customer": "customerId", "by-status": "status", "by-assignee": "assignedTo"}},
	"user_accounts":           {PK: "id"},
	"payments":                {PK: "id", Indexes: map[string]string{"by-request": "requestId"}},
	"leads":                   {PK: "id", Indexes: map[string]string{"by-stage": "stage", "by-created": "createdAt"}},
	"site_content":            {PK: "id"},
	"role_audits":             {PK: "id"},
	"role_permissions":        {PK: "role"},
	"role_applications":       {PK: "id", Indexes: map[string]string{"by-status": "status", "by-user": "userId"}},
	"claim_requests":          {PK: "id", Indexes: map[string]string{"by-status": "status", "by-profile": "profileId", "by-claimant": "claimantAccountId"}},
	"merge_logs":              {PK: "id", Indexes: map[string]string{"by-primary": "primaryId", "by-secondary": "secondaryId"}},
	"coach_annotations":       {PK: "id", Indexes: map[string]string{"by-match": "matchId", "by-target": "targetId"}},
	"timelines":               {PK: "id", Indexes: map[string]string{"by-match": "matchId", "by-video": "videoId"}},
	"knowledge_entries":       {PK: "id", Indexes: map[string]string{"by-category": "category", "by-alias": "alias"}},
	"token_logs":              {PK: "id", Indexes: map[string]string{"by-timestamp": "timestamp"}},
	"fundamental_drills":      {PK: "id"},
	"fundamental_profiles":    {PK: "id"},
	"workout_schedules":       {PK: "id"},
	"drill_submissions":       {PK: "id"},
	"classroom_qa":            {PK: "id"},
}

func Assert(name string) (StoreDef, error) {
	def, ok := Stores[name]
	if !ok {
		return StoreDef{}, fmt.Errorf("unknown store: %s", name)
	}
	if def.Indexes == nil {
		def.Indexes = map[string]string{}
	}
	return def, nil
}

func Ident(store string) (string, error) {
	if _, err := Assert(store); err != nil {
		return "", err
	}
	return `"` + strings.ReplaceAll(store, `"`, "") + `"`, nil
}

func Names() []string {
	out := make([]string, 0, len(Stores))
	for name := range Stores {
		out = append(out, name)
	}
	return out
}

var cropKeys = []string{
	"rawCropUrl", "processedCropUrl", "primaryCropUrl", "primaryProcessedUrl",
	"altCropUrl", "altProcessedUrl", "ytTimerCropUrl", "ytTimerProcessedUrl",
}

func isInlineMedia(v any) bool {
	s, ok := v.(string)
	return ok && (strings.HasPrefix(s, "data:video") || strings.HasPrefix(s, "blob:"))
}

func StripVideo(store string, doc map[string]any) map[string]any {
	if doc == nil {
		return map[string]any{}
	}
	next := make(map[string]any, len(doc))
	for k, v := range doc {
		next[k] = v
	}
	if isInlineMedia(next["videoUrl"]) {
		delete(next, "videoUrl")
	}
	if isInlineMedia(next["youtubeUrl"]) {
		delete(next, "youtubeUrl")
	}
	if store == "timelines" {
		if points, ok := next["rawScanPoints"].([]any); ok {
			cleaned := make([]any, len(points))
			for i, p := range points {
				m, ok := p.(map[string]any)
				if !ok {
					cleaned[i] = p
					continue
				}
				cp := make(map[string]any, len(m))
				for k, v := range m {
					cp[k] = v
				}
				for _, key := range cropKeys {
					delete(cp, key)
				}
				cleaned[i] = cp
			}
			next["rawScanPoints"] = cleaned
		}
	}
	return next
}

func ExtractPK(store string, doc map[string]any) string {
	def, err := Assert(store)
	if err != nil {
		return ""
	}
	raw, ok := doc[def.PK]
	if !ok || raw == nil {
		return ""
	}
	return fmt.Sprint(raw)
}
