package db

import (
	"context"
	"fmt"

	"hoopstat/internal/catalog"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	if url == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	if err := migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return pool, nil
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	for _, name := range catalog.Names() {
		ident, err := catalog.Ident(name)
		if err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS `+ident+` (
			id text PRIMARY KEY,
			doc jsonb NOT NULL,
			updated_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
			return fmt.Errorf("table %s: %w", name, err)
		}
	}
	for _, q := range extraSQL {
		if _, err := pool.Exec(ctx, q); err != nil {
			return err
		}
	}
	return nil
}

var extraSQL = []string{
	`CREATE TABLE IF NOT EXISTS claim_docs (
		id text PRIMARY KEY,
		claim_id text NOT NULL,
		kind text NOT NULL,
		file_name text NOT NULL,
		content_type text NOT NULL,
		body bytea NOT NULL,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS claim_docs_by_claim ON claim_docs (claim_id)`,
	`CREATE INDEX IF NOT EXISTS organizations_by_city ON organizations ((doc->>'city'))`,
	`CREATE INDEX IF NOT EXISTS organizations_by_type ON organizations ((doc->>'type'))`,
	`CREATE INDEX IF NOT EXISTS match_rosters_by_match ON match_rosters ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS match_rosters_by_team ON match_rosters ((doc->>'teamId'))`,
	`CREATE INDEX IF NOT EXISTS match_rosters_by_profile ON match_rosters ((doc->>'profileId'))`,
	`CREATE INDEX IF NOT EXISTS match_stints_by_match ON match_stints ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS match_stints_by_team ON match_stints ((doc->>'teamId'))`,
	`CREATE INDEX IF NOT EXISTS events_by_match ON events ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS possessions_by_match ON possessions ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS ai_insights_by_target ON ai_insights ((doc->>'targetId'))`,
	`CREATE INDEX IF NOT EXISTS event_links_by_match ON event_links ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS event_links_by_primary ON event_links ((doc->>'primaryEventId'))`,
	`CREATE INDEX IF NOT EXISTS event_links_by_secondary ON event_links ((doc->>'secondaryEventId'))`,
	`CREATE INDEX IF NOT EXISTS event_links_by_relation ON event_links ((doc->>'relationType'))`,
	`CREATE INDEX IF NOT EXISTS audit_issue_resolutions_by_match ON audit_issue_resolutions ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS stat_requests_by_customer ON stat_requests ((doc->>'customerId'))`,
	`CREATE INDEX IF NOT EXISTS stat_requests_by_status ON stat_requests ((doc->>'status'))`,
	`CREATE INDEX IF NOT EXISTS stat_requests_by_assignee ON stat_requests ((doc->>'assignedTo'))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_email_lower ON user_accounts (lower(doc->>'email'))`,
	`CREATE INDEX IF NOT EXISTS payments_by_request ON payments ((doc->>'requestId'))`,
	`CREATE INDEX IF NOT EXISTS leads_by_stage ON leads ((doc->>'stage'))`,
	`CREATE INDEX IF NOT EXISTS leads_by_created ON leads (((doc->>'createdAt')::bigint))`,
	`CREATE INDEX IF NOT EXISTS role_applications_by_status ON role_applications ((doc->>'status'))`,
	`CREATE INDEX IF NOT EXISTS role_applications_by_user ON role_applications ((doc->>'userId'))`,
	`CREATE INDEX IF NOT EXISTS claim_requests_by_status ON claim_requests ((doc->>'status'))`,
	`CREATE INDEX IF NOT EXISTS claim_requests_by_profile ON claim_requests ((doc->>'profileId'))`,
	`CREATE INDEX IF NOT EXISTS claim_requests_by_claimant ON claim_requests ((doc->>'claimantAccountId'))`,
	`CREATE INDEX IF NOT EXISTS merge_logs_by_primary ON merge_logs ((doc->>'primaryId'))`,
	`CREATE INDEX IF NOT EXISTS merge_logs_by_secondary ON merge_logs ((doc->>'secondaryId'))`,
	`CREATE INDEX IF NOT EXISTS coach_annotations_by_match ON coach_annotations ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS coach_annotations_by_target ON coach_annotations ((doc->>'targetId'))`,
	`CREATE INDEX IF NOT EXISTS timelines_by_match ON timelines ((doc->>'matchId'))`,
	`CREATE INDEX IF NOT EXISTS timelines_by_video ON timelines ((doc->>'videoId'))`,
	`CREATE INDEX IF NOT EXISTS knowledge_entries_by_category ON knowledge_entries ((doc->>'category'))`,
	`CREATE INDEX IF NOT EXISTS knowledge_entries_by_alias ON knowledge_entries ((doc->>'alias'))`,
	`CREATE INDEX IF NOT EXISTS token_logs_by_timestamp ON token_logs (((doc->>'timestamp')::bigint))`,
	`CREATE INDEX IF NOT EXISTS matches_by_team ON matches ((doc->>'teamId'))`,
	`CREATE INDEX IF NOT EXISTS matches_by_child ON matches ((doc->>'childId'))`,
	`CREATE INDEX IF NOT EXISTS matches_by_stage ON matches ((doc->>'productionStage'))`,
}
