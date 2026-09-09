-- HoopStat domain schema
-- Absorbed from IndexedDB hoopstats-db v24 + knowledge + token logs + fundamentals.
-- Video files are NOT stored here. matches.doc.videoUrl is a URL/id only (YouTube now, Drive later).
-- Timeline OCR crop frames (data URLs from video) are stripped on write.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'players',
    'teams',
    'clubs',
    'organizations',
    'series',
    'matches',
    'match_rosters',
    'match_stints',
    'events',
    'possessions',
    'game_states',
    'profiles',
    'ai_insights',
    'event_links',
    'audit_issue_resolutions',
    'stat_requests',
    'user_accounts',
    'payments',
    'leads',
    'site_content',
    'role_permissions',
    'role_applications',
    'claim_requests',
    'merge_logs',
    'coach_annotations',
    'timelines',
    'knowledge_entries',
    'token_logs',
    'fundamental_drills',
    'fundamental_profiles',
    'workout_schedules',
    'drill_submissions',
    'classroom_qa'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
         id text PRIMARY KEY,
         doc jsonb NOT NULL,
         updated_at timestamptz NOT NULL DEFAULT now()
       )',
      t
    );
  END LOOP;
END $$;

COMMENT ON TABLE matches IS 'videoUrl in doc is metadata only; never store video bytes. Drive later.';
COMMENT ON TABLE timelines IS 'Clock mapping JSON. Video frame crops are stripped on write.';
COMMENT ON TABLE claim_requests IS 'Identity claim metadata. Binary KK/akta live in claim_docs, not JSONB.';
COMMENT ON TABLE drill_submissions IS 'videoUrl is a link (YouTube/Drive), not a blob.';

-- IDB index equivalents
CREATE INDEX IF NOT EXISTS organizations_by_city ON organizations ((doc->>'city'));
CREATE INDEX IF NOT EXISTS organizations_by_type ON organizations ((doc->>'type'));

CREATE INDEX IF NOT EXISTS match_rosters_by_match ON match_rosters ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS match_rosters_by_team ON match_rosters ((doc->>'teamId'));
CREATE INDEX IF NOT EXISTS match_rosters_by_profile ON match_rosters ((doc->>'profileId'));

CREATE INDEX IF NOT EXISTS match_stints_by_match ON match_stints ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS match_stints_by_team ON match_stints ((doc->>'teamId'));

CREATE INDEX IF NOT EXISTS events_by_match ON events ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS possessions_by_match ON possessions ((doc->>'matchId'));

CREATE INDEX IF NOT EXISTS ai_insights_by_target ON ai_insights ((doc->>'targetId'));

CREATE INDEX IF NOT EXISTS event_links_by_match ON event_links ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS event_links_by_primary ON event_links ((doc->>'primaryEventId'));
CREATE INDEX IF NOT EXISTS event_links_by_secondary ON event_links ((doc->>'secondaryEventId'));
CREATE INDEX IF NOT EXISTS event_links_by_relation ON event_links ((doc->>'relationType'));

CREATE INDEX IF NOT EXISTS audit_issue_resolutions_by_match ON audit_issue_resolutions ((doc->>'matchId'));

CREATE INDEX IF NOT EXISTS stat_requests_by_customer ON stat_requests ((doc->>'customerId'));
CREATE INDEX IF NOT EXISTS stat_requests_by_status ON stat_requests ((doc->>'status'));
CREATE INDEX IF NOT EXISTS stat_requests_by_assignee ON stat_requests ((doc->>'assignedTo'));

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_email_lower ON user_accounts (lower(doc->>'email'));

CREATE INDEX IF NOT EXISTS payments_by_request ON payments ((doc->>'requestId'));

CREATE INDEX IF NOT EXISTS leads_by_stage ON leads ((doc->>'stage'));
CREATE INDEX IF NOT EXISTS leads_by_created ON leads (((doc->>'createdAt')::bigint));

CREATE INDEX IF NOT EXISTS role_applications_by_status ON role_applications ((doc->>'status'));
CREATE INDEX IF NOT EXISTS role_applications_by_user ON role_applications ((doc->>'userId'));

CREATE INDEX IF NOT EXISTS claim_requests_by_status ON claim_requests ((doc->>'status'));
CREATE INDEX IF NOT EXISTS claim_requests_by_profile ON claim_requests ((doc->>'profileId'));
CREATE INDEX IF NOT EXISTS claim_requests_by_claimant ON claim_requests ((doc->>'claimantAccountId'));

CREATE INDEX IF NOT EXISTS merge_logs_by_primary ON merge_logs ((doc->>'primaryId'));
CREATE INDEX IF NOT EXISTS merge_logs_by_secondary ON merge_logs ((doc->>'secondaryId'));

CREATE INDEX IF NOT EXISTS coach_annotations_by_match ON coach_annotations ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS coach_annotations_by_target ON coach_annotations ((doc->>'targetId'));

CREATE INDEX IF NOT EXISTS timelines_by_match ON timelines ((doc->>'matchId'));
CREATE INDEX IF NOT EXISTS timelines_by_video ON timelines ((doc->>'videoId'));

CREATE INDEX IF NOT EXISTS knowledge_entries_by_category ON knowledge_entries ((doc->>'category'));
CREATE INDEX IF NOT EXISTS knowledge_entries_by_alias ON knowledge_entries ((doc->>'alias'));

CREATE INDEX IF NOT EXISTS token_logs_by_timestamp ON token_logs (((doc->>'timestamp')::bigint));

CREATE INDEX IF NOT EXISTS matches_by_team ON matches ((doc->>'teamId'));
CREATE INDEX IF NOT EXISTS matches_by_child ON matches ((doc->>'childId'));
CREATE INDEX IF NOT EXISTS matches_by_stage ON matches ((doc->>'productionStage'));

-- Identity docs (KK/akta). Never keep data URLs in claim_requests.doc.
CREATE TABLE IF NOT EXISTS claim_docs (
  id text PRIMARY KEY,
  claim_id text NOT NULL,
  kind text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  body bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_docs_by_claim ON claim_docs (claim_id);

COMMIT;
