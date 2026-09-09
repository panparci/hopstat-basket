import { statsService } from './statsService';
import { Match, GameState, GameEvent, Team, Player, ChildProfile, MatchRoster, MatchStint, EventLink } from '../types/stats';

export interface MatchExportData {
  version: string;
  type: 'match_export';
  match: Match;
  gameState?: GameState;
  events: GameEvent[];
  teams: Team[];
  players: Player[];
  profiles: ChildProfile[];
  matchRosters: MatchRoster[];
  matchStints: MatchStint[];
  eventLinks: EventLink[];
}

export const exportImportService = {
  exportMatch: async (matchId: string): Promise<string> => {
    const match = await statsService.getMatch(matchId);
    if (!match) throw new Error('Match not found');

    const gameState = await statsService.getGameState(matchId);
    const events = await statsService.getEvents(matchId);
    const matchRosters = await statsService.getMatchRosters(matchId);
    const matchStints = await statsService.getMatchStints(matchId);
    const eventLinks = await statsService.getEventLinks(matchId);
    
    const allTeams = await statsService.getTeams();
    const teams = allTeams.filter(t => t.id === match.teamId || t.id === match.opponentTeamId);

    const allPlayers = await statsService.getPlayers();
    const rosterIds = new Set([
      ...(matchRosters.map(r => r.profileId) || [])
    ]);
    const players = allPlayers.filter(p => rosterIds.has(p.id));

    const allProfiles = await statsService.getProfiles();
    const profiles = allProfiles.filter(p => rosterIds.has(p.id));

    const exportData: MatchExportData = {
      version: '1.1',
      type: 'match_export',
      match,
      gameState,
      events,
      teams,
      players,
      profiles,
      matchRosters,
      matchStints,
      eventLinks
    };

    return JSON.stringify(exportData, null, 2);
  },

  importMatch: async (jsonData: string): Promise<void> => {
    const data = JSON.parse(jsonData) as MatchExportData;
    
    if (data.type !== 'match_export') {
      throw new Error('Invalid file format');
    }

    const teamIdMap = new Map<string, string>();
    const playerIdMap = new Map<string, string>();
    const profileIdMap = new Map<string, string>();

    // Import Teams
    const existingTeams = await statsService.getTeams();
    for (const team of data.teams || []) {
      const existing = existingTeams.find(t => t.name.toLowerCase() === team.name.toLowerCase());
      if (existing) {
        teamIdMap.set(team.id, existing.id);
      } else {
        teamIdMap.set(team.id, team.id);
        await statsService.addTeam(team);
      }
    }

    // Import Profiles
    const existingProfiles = await statsService.getProfiles();
    for (const profile of data.profiles || []) {
      const existing = existingProfiles.find(p => 
        p.name.toLowerCase() === profile.name.toLowerCase() || 
        (p.voiceAliases && profile.voiceAliases && p.voiceAliases.some(alias => profile.voiceAliases!.some(importedAlias => importedAlias.toLowerCase() === alias.toLowerCase())))
      );
      if (existing) {
        profileIdMap.set(profile.id, existing.id);
        playerIdMap.set(profile.id, existing.id);
      } else {
        profileIdMap.set(profile.id, profile.id);
        playerIdMap.set(profile.id, profile.id);
        if (profile.mainTeamId && teamIdMap.has(profile.mainTeamId)) {
          profile.mainTeamId = teamIdMap.get(profile.mainTeamId);
        }
        await statsService.addProfile(profile);
      }
    }

    // Import Players
    const existingPlayers = await statsService.getPlayers();
    for (const player of data.players || []) {
      if (playerIdMap.has(player.id)) continue;

      const existing = existingPlayers.find(p => 
        p.name.toLowerCase() === player.name.toLowerCase() || 
        (p.voiceAliases && player.voiceAliases && p.voiceAliases.some(alias => player.voiceAliases!.some(importedAlias => importedAlias.toLowerCase() === alias.toLowerCase())))
      );
      if (existing) {
        playerIdMap.set(player.id, existing.id);
      } else {
        playerIdMap.set(player.id, player.id);
        await statsService.addPlayer(player);
      }
    }

    // Update Match with mapped IDs
    const match = data.match;
    if (match.teamId && teamIdMap.has(match.teamId)) match.teamId = teamIdMap.get(match.teamId)!;
    if (match.opponentTeamId && teamIdMap.has(match.opponentTeamId)) match.opponentTeamId = teamIdMap.get(match.opponentTeamId)!;
    
    // Import Match
    const existingMatch = await statsService.getMatch(match.id);
    if (!existingMatch) {
      await statsService.addMatch(match);
    } else {
      await statsService.updateMatch(match);
    }

    // Import GameState
    if (data.gameState) {
      await statsService.saveGameState(data.gameState);
    }

    // Import Events
    const existingEvents = await statsService.getEvents(match.id);
    for (const ev of existingEvents) {
      await statsService.removeEvent(match.id, ev.id);
    }
    for (const ev of data.events || []) {
      if (ev.playerId && playerIdMap.has(ev.playerId)) {
        ev.playerId = playerIdMap.get(ev.playerId)!;
      }
      await statsService.addEvent(ev);
    }

    // Import MatchRosters
    for (const r of data.matchRosters || []) {
      if (playerIdMap.has(r.profileId)) r.profileId = playerIdMap.get(r.profileId)!;
      if (teamIdMap.has(r.teamId)) r.teamId = teamIdMap.get(r.teamId)!;
      await statsService.addMatchRoster(r);
    }

    // Import MatchStints
    for (const s of data.matchStints || []) {
      if (teamIdMap.has(s.teamId)) s.teamId = teamIdMap.get(s.teamId)!;
      s.playerIds = s.playerIds.map(pid => playerIdMap.get(pid) || pid);
      await statsService.saveMatchStint(s);
    }

    // Import EventLinks
    for (const l of data.eventLinks || []) {
      await statsService.saveEventLink(l);
    }
  }
};
