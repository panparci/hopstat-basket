package catalog_test

import (
  "testing"
  "hoopstat/internal/catalog"
)

func TestMDMStoresRegistered(t *testing.T) {
  for _, name := range []string{
    "master_aliases", "master_proposals",
    "match_exclusion_requests", "coach_player_links",
  } {
    def, err := catalog.Assert(name)
    if err != nil {
      t.Fatalf("%s: %v", name, err)
    }
    if def.PK != "id" {
      t.Fatalf("%s pk=%s", name, def.PK)
    }
  }
  // indexes used by mdmService
  def, _ := catalog.Assert("master_aliases")
  if def.Indexes["by-canonical"] != "canonicalId" {
    t.Fatal("master_aliases missing by-canonical")
  }
  def, _ = catalog.Assert("master_proposals")
  if def.Indexes["by-status"] != "status" {
    t.Fatal("master_proposals missing by-status")
  }
}
