import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, Filter, BarChart3, UserPlus } from 'lucide-react';
import { statsService } from '../core/services/statsService';
import { Player, ChildProfile, Team, Match, GameEvent, MatchRoster } from '../core/types/stats';
import { isCountableMatch } from '../core/utils/matchFilters';
import { PlayerFormModal } from '../components/organisms/PlayerFormModal';
import { PlayerStatsModal } from '../components/organisms/PlayerStatsModal';
import { BaseModal } from '../components/atoms/BaseModal';
import { Button } from '../components/atoms/Button';
import { useTheme } from '../core/hooks/useTheme';
import { useNavigate } from 'react-router-dom';

interface UnifiedPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  type: 'anak' | 'rekan' | 'lawan' | 'lainnya';
  teamName: string;
  teamId: string;
  isActive: boolean;
  voiceAliases?: string[];
}

export const PlayersPage: React.FC = () => {
  const [players, setPlayers] = useState<UnifiedPlayer[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [allMatchRosters, setAllMatchRosters] = useState<MatchRoster[]>([]);
  const [filter, setFilter] = useState<'semua' | 'anak' | 'rekan' | 'lawan'>('semua');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<UnifiedPlayer | null>(null);
  
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<UnifiedPlayer | null>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; teamId: string } | null>(null);

  const { theme } = useTheme();
  const navigate = useNavigate();

  const [playerIdToName, setPlayerIdToName] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const p = await statsService.getPlayers();
    const t = await statsService.getTeams();
    const m = await statsService.getMatches();
    const profs = await statsService.getProfiles();
    const evts = await statsService.getAllEvents();
    const rosters = await statsService.getAllMatchRosters();
    setAllMatchRosters(rosters);

    const ourTeamIds = new Set<string>();
    const theirTeamIds = new Set<string>();

    // Filter out aborted and excluded matches using isCountableMatch
    const validMatches = m.filter(isCountableMatch);
    const validMatchIds = new Set(validMatches.map(match => match.id));
    const countableEvents = evts.filter(e => validMatchIds.has(e.matchId));

    validMatches.forEach(match => {
      if (match.teamId) ourTeamIds.add(match.teamId);
      if (match.opponentTeamId) theirTeamIds.add(match.opponentTeamId);
    });
    profs.forEach(prof => {
      if (prof.teamId) ourTeamIds.add(prof.teamId);
    });

    const childNames = new Set(profs.map(p => p.name.toLowerCase()));

    const unifiedPlayers: UnifiedPlayer[] = [];
    const idToNameMap: Record<string, string> = {};

    // Add profiles as 'anak'
    profs.forEach(prof => {
      idToNameMap[prof.id] = prof.name;
      unifiedPlayers.push({
        id: prof.id,
        name: prof.name,
        jersey: prof.jerseyNumber || '',
        position: 'Pemain',
        type: 'anak',
        teamName: 'Profil Atlet',
        teamId: prof.teamId || 'profile',
        isActive: false,
        voiceAliases: prof.voiceAliases
      });
    });

    // Add players from teams
    t.forEach(team => {
      team.roster.forEach(player => {
        idToNameMap[player.id] = player.name;
        let type: 'anak' | 'rekan' | 'lawan' | 'lainnya' = 'lainnya';
        if (childNames.has(player.name.toLowerCase())) {
          type = 'anak';
        } else if (ourTeamIds.has(team.id)) {
          type = 'rekan';
        } else if (theirTeamIds.has(team.id)) {
          type = 'lawan';
        }

        // Avoid adding duplicate 'anak' if they have the exact same name as a profile
        // But wait, they might have different stats?
        // Let's just add them if they are not 'anak' to avoid duplicates, 
        // OR add them but we'll aggregate stats for 'anak' anyway.
        if (type !== 'anak') {
          unifiedPlayers.push({
            id: player.id,
            name: player.name,
            jersey: player.jersey,
            position: player.position || '',
            type,
            teamName: team.name,
            teamId: team.id,
            isActive: player.isActive
          });
        }
      });
    });

    // Add players from global store if not already added
    p.forEach(player => {
      idToNameMap[player.id] = player.name;
      if (!unifiedPlayers.some(up => up.id === player.id)) {
        let type: 'anak' | 'rekan' | 'lawan' | 'lainnya' = 'lainnya';
        if (childNames.has(player.name.toLowerCase())) {
          type = 'anak';
        }
        if (type !== 'anak') {
          unifiedPlayers.push({
            id: player.id,
            name: player.name,
            jersey: player.jersey,
            position: player.position || '',
            type,
            teamName: 'Global',
            teamId: 'global',
            isActive: player.isActive
          });
        }
      }
    });

    setPlayers(unifiedPlayers);
    setEvents(countableEvents);
    setPlayerIdToName(idToNameMap);
  };

  const handleSavePlayer = async (player: Player) => {
    if (editingPlayer) {
      if (editingPlayer.teamId === 'profile') {
        // Cannot edit profile from here easily, or we could update the profile
        const profs = await statsService.getProfiles();
        const prof = profs.find(p => p.id === editingPlayer.id);
        if (prof) {
          prof.name = player.name;
          prof.jerseyNumber = player.jersey;
          await statsService.updateProfile(prof);
        }
      } else if (editingPlayer.teamId === 'global') {
        await statsService.updatePlayer(player);
      } else {
        const team = await statsService.getTeam(editingPlayer.teamId);
        if (team) {
          const index = team.roster.findIndex(p => p.id === player.id);
          if (index !== -1) {
            team.roster[index] = player;
            await statsService.updateTeam(team);
          }
        }
      }
    } else {
      await statsService.addPlayer(player);
    }
    await loadData();
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handleDeletePlayer = async (id: string, teamId: string) => {
    setPlayerToDelete({ id, teamId });
  };

  const confirmDeletePlayer = async () => {
    if (playerToDelete) {
      const { id, teamId } = playerToDelete;
      if (teamId === 'profile') {
        await statsService.deleteProfile(id);
      } else if (teamId === 'global') {
        await statsService.deletePlayer(id);
      } else {
        const team = await statsService.getTeam(teamId);
        if (team) {
          team.roster = team.roster.filter(p => p.id !== id);
          await statsService.updateTeam(team);
        }
      }
      setPlayerToDelete(null);
      await loadData();
    }
  };

  const openAddModal = () => {
    setEditingPlayer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (player: UnifiedPlayer) => {
    setEditingPlayer(player);
    setIsModalOpen(true);
  };

  const calculateStats = (player: UnifiedPlayer) => {
    let playerEvents = [];
    if (player.type === 'anak') {
      const matchingPlayerIds = new Set<string>();
      matchingPlayerIds.add(player.id);

      allMatchRosters.forEach(r => {
        if (r.id === player.id || r.profileId === player.id) {
          matchingPlayerIds.add(r.profileId);
        }
        const aliases = player.voiceAliases?.map(a => a.toLowerCase()) || [];
        if (r.profileId === player.id && aliases.includes(r.name.toLowerCase())) {
          matchingPlayerIds.add(r.profileId);
        }
      });

      playerEvents = events.filter(e => matchingPlayerIds.has(e.playerId));
    } else {
      playerEvents = events.filter(e => e.playerId === player.id);
    }

    let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, to = 0, fouls = 0;
    let fgm = 0, fga = 0, tpm = 0, tpa = 0, ftm = 0, fta = 0;

    playerEvents.forEach(e => {
      switch (e.type) {
        case '1pt_make': pts += 1; ftm += 1; fta += 1; break;
        case '1pt_miss': fta += 1; break;
        case '2pt_make': pts += 2; fgm += 1; fga += 1; break;
        case '2pt_miss': 
          if (!e.isShootingFoul) fga += 1; 
          break;
        case '3pt_make': pts += 3; fgm += 1; fga += 1; tpm += 1; tpa += 1; break;
        case '3pt_miss': 
          if (!e.isShootingFoul) { fga += 1; tpa += 1; }
          break;
        case 'oreb':
        case 'dreb': reb += 1; break;
        case 'ast': ast += 1; break;
        case 'stl': stl += 1; break;
        case 'blk': blk += 1; break;
        case 'to': to += 1; break;
        case 'foul': fouls += 1; break;
      }
    });

    return { pts, reb, ast, stl, blk, to, fouls, fgm, fga, tpm, tpa, ftm, fta };
  };

  const openStatsModal = (player: UnifiedPlayer) => {
    setSelectedPlayer(player);
    setPlayerStats(calculateStats(player));
    setIsStatsModalOpen(true);
  };

  const filteredPlayers = players.filter(p => {
    if (filter === 'semua') return true;
    return p.type === filter;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans">
      <header className="flex justify-between items-center p-4 bg-white dark:bg-zinc-950 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="text-brand-navy dark:text-brand-orange">
            <Users size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">Daftar Pemain</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/profiles')}
            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-brand-navy dark:text-brand-orange p-2 rounded-xl transition-colors flex items-center justify-center shadow-sm hover:opacity-90"
            title="Tambah Atlet"
          >
            <UserPlus size={20} strokeWidth={2.5} />
          </button>
          <button 
            onClick={openAddModal}
            className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy p-2 rounded-xl transition-colors flex items-center justify-center shadow-sm hover:opacity-90"
            title="Tambah Pemain"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="p-4 mt-2">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button 
            onClick={() => setFilter('semua')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${filter === 'semua' ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilter('anak')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${filter === 'anak' ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'}`}
          >
            Atlet Saya
          </button>
          <button 
            onClick={() => setFilter('rekan')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${filter === 'rekan' ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'}`}
          >
            Rekan Setim
          </button>
          <button 
            onClick={() => setFilter('lawan')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${filter === 'lawan' ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'}`}
          >
            Lawan
          </button>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
              <Users size={32} />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Pemain</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tambahkan pemain ke daftar tim Anda untuk mulai melacak statistik mereka.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button 
                onClick={openAddModal}
                className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 text-sm tracking-wide"
              >
                <Plus size={18} strokeWidth={2.5} />
                TAMBAH PEMAIN
              </button>
              <button 
                onClick={() => navigate('/profiles')}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-brand-navy dark:text-brand-orange px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 text-sm tracking-wide"
              >
                <UserPlus size={18} strokeWidth={2.5} />
                TAMBAH ANAK
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {filteredPlayers.map(player => (
              <div 
                key={player.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                onClick={() => openStatsModal(player)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-black text-xl italic ${player.type === 'anak' ? 'bg-emerald-500 text-white' : player.type === 'lawan' ? 'bg-red-500 text-white' : 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy'}`}>
                    {player.jersey}
                  </div>
                  <div>
                    <h3 className="font-display font-black italic text-[#1A1A1A] dark:text-white text-xl uppercase leading-none">{player.name}</h3>
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1">{player.position || 'Pemain'} • {player.teamName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); openStatsModal(player); }}
                    className="p-2 text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    <BarChart3 size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                    className="p-2 text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeletePlayer(player.id, player.teamId); }}
                    className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 bg-zinc-50 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <PlayerFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSavePlayer}
        initialData={editingPlayer}
      />
      
      <PlayerStatsModal 
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        player={selectedPlayer}
        stats={playerStats}
      />

      <BaseModal 
        isOpen={playerToDelete !== null} 
        onClose={() => setPlayerToDelete(null)}
        title="Hapus Pemain"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin menghapus pemain ini dari daftar? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setPlayerToDelete(null)}
              className="px-4 py-2"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDeletePlayer}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none"
            >
              Hapus
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
};

