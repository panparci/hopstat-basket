import React, { useState, useCallback } from 'react';
import { generateId } from '../core/utils/idUtils';
import { Match, Player, MatchRoster } from '../core/types/stats';
import { statsService } from '../core/services/statsService';

export const usePlayerManagement = (
  match: Match | null,
  setMatch: React.Dispatch<React.SetStateAction<Match | null>>,
  matchRosters: MatchRoster[],
  setMatchRosters: React.Dispatch<React.SetStateAction<MatchRoster[]>>
) => {
  const [editingPlayer, setEditingPlayer] = useState<{ player: Player; team: 'home' | 'away' } | null>(null);

  const addPlaceholderPlayer = useCallback(async (team: 'home' | 'away') => {
    if (!match) return;

    const newPlayer: Player = {
      id: generateId('temp'),
      name: 'Pemain Baru',
      jersey: '00',
      position: 'U',
      isActive: false,
      isPlaceholder: true,
    };

    const updatedMatch = { ...match };
    let teamId: string | undefined;

    if (team === 'home') {
      teamId = match.teamId;
    } else {
      teamId = match.opponentTeamId;
    }

    // Create MatchRoster entry
    const newRosterEntry: MatchRoster = {
      id: `${match.id}_${newPlayer.id}`,
      matchId: match.id,
      teamId: teamId || (team === 'home' ? 'home_team' : 'away_team'),
      profileId: newPlayer.id,
      name: newPlayer.name,
      jerseyNumber: newPlayer.jersey,
      isStarter: false,
      isActive: false
    };
    
    setMatchRosters(prev => [...prev, newRosterEntry]);
    await statsService.addMatchRoster(newRosterEntry);

    // Also update the team roster in the database if teamId exists
    if (teamId) {
      const teamData = await statsService.getTeam(teamId);
      if (teamData) {
        const updatedTeam = {
          ...teamData,
          roster: [...(teamData.roster || []), newPlayer]
        };
        await statsService.updateTeam(updatedTeam);
      }
    }
    
    // Automatically open edit modal for the new placeholder
    setEditingPlayer({ player: newPlayer, team });
  }, [match, setMatch, setMatchRosters]);

  const updatePlayer = useCallback(async (team: 'home' | 'away', updatedPlayer: Player) => {
    if (!match) return;

    let teamId: string | undefined;

    if (team === 'home') {
      teamId = match.teamId;
    } else if (team === 'away') {
      teamId = match.opponentTeamId;
    }

    // Update MatchRoster entry
    const rosterId = `${match.id}_${updatedPlayer.id}`;
    const existingRoster = matchRosters.find(r => r.id === rosterId);
    if (existingRoster) {
      const updatedRoster = {
        ...existingRoster,
        name: updatedPlayer.name,
        jerseyNumber: updatedPlayer.jersey,
        isActive: updatedPlayer.isActive,
        isGuest: updatedPlayer.isGuest,
        guestForTeamId: updatedPlayer.guestForTeamId || teamId
      };
      setMatchRosters(prev => prev.map(r => r.id === rosterId ? updatedRoster : r));
      await statsService.updateMatchRoster(updatedRoster);
    }

    // Also update the team roster in the database if teamId exists
    if (teamId) {
      const teamData = await statsService.getTeam(teamId);
      if (teamData) {
        const updatedTeam = {
          ...teamData,
          roster: (teamData.roster || []).map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
        };
        
        // If the player wasn't in the team roster yet (e.g. added as temp but not saved to team), add them
        if (!updatedTeam.roster.some(p => p.id === updatedPlayer.id)) {
          updatedTeam.roster.push(updatedPlayer);
        }

        await statsService.updateTeam(updatedTeam);
      }
    }

    setEditingPlayer(null);
  }, [match, setMatch, matchRosters, setMatchRosters]);

  const openEditModal = useCallback((player: Player, team: 'home' | 'away') => {
    setEditingPlayer({ player, team });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingPlayer(null);
  }, []);

  return {
    editingPlayer,
    addPlaceholderPlayer,
    updatePlayer,
    openEditModal,
    closeEditModal
  };
};
