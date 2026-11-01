// Claim search by name + club + KU (calendar year). DOB is confirmation later, not the search key.
import { ChildProfile } from '../../../entities/athlete/model/types';
import { Team, Club, Match, MatchRoster } from '../../../core/types/stats';
import {
  birthYearFromKu,
  checkKuEligibility,
  parseKUFromString,
  type KuEligibility,
} from '../../../core/utils/ageCalculator';
import { areNamesSimilar } from '../../merge-player/model/mergeService';

export interface ClaimCandidate {
  profile: ChildProfile;
  score: number;
  kuStatus: KuEligibility;
  athleteKU?: number;
  matchCount: number;
  teamName?: string;
}

function clubOrTeamHit(profile: ChildProfile, clubQ: string, teams: Team[], clubs: Club[]): boolean {
  const q = clubQ.trim().toLowerCase();
  if (!q) return true;
  const ids = [profile.teamId, profile.mainTeamId, profile.schoolTeamId, profile.academyTeamId, profile.loanTeamId].filter(Boolean) as string[];
  for (const id of ids) {
    const team = teams.find((t) => t.id === id);
    if (!team) continue;
    if (team.name.toLowerCase().includes(q)) return true;
    if (team.clubId) {
      const club = clubs.find((c) => c.id === team.clubId);
      if (club?.name.toLowerCase().includes(q)) return true;
    }
  }
  if (profile.clubId) {
    const club = clubs.find((c) => c.id === profile.clubId);
    if (club?.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

function nameHit(profile: ChildProfile, nameQ: string): boolean {
  const q = nameQ.trim().toLowerCase();
  if (!q) return false;
  if (profile.name.toLowerCase() === q) return true;
  if (areNamesSimilar(profile.name, nameQ)) return true;
  if ((profile.aliases || []).some((a) => a.toLowerCase() === q || areNamesSimilar(a, nameQ))) return true;
  if (profile.displayName && areNamesSimilar(profile.displayName, nameQ)) return true;
  return profile.name.toLowerCase().includes(q) || q.includes(profile.name.toLowerCase());
}

/** Match-history KU band for profiles without birthDate: any match ageGroup / KU that is not overage vs search KU. */
function kuFromMatches(
  profileId: string,
  searchKU: number,
  year: number,
  matches: Match[],
  rosters: MatchRoster[],
): KuEligibility {
  const matchIds = new Set(rosters.filter((r) => r.profileId === profileId).map((r) => r.matchId));
  const played = matches.filter((m) => matchIds.has(m.id) || m.childId === profileId);
  if (!played.length) return 'unknown';
  let best: KuEligibility = 'unknown';
  for (const m of played) {
    const mk = parseKUFromString(m.ageGroup) ?? parseKUFromString((m as any).ku) ?? searchKU;
    const y = m.date ? new Date(m.date).getFullYear() : year;
    // Without DOB: treat participation in that KU as eligible if search KU >= match KU (playing up into search band) or equal.
    if (mk === searchKU) return 'exact';
    if (mk < searchKU) best = 'playing_up';
    void y; // competition year reserved when DOB appears on match later
  }
  return best;
}

export function evaluateAthleteKuMatching(opts: {
  profiles: ChildProfile[];
  teams: Team[];
  clubs: Club[];
  matches: Match[];
  rosters: MatchRoster[];
  searchName: string;
  searchClub: string;
  searchKU: number;
  competitionYear?: number;
}): ClaimCandidate[] {
  const year = opts.competitionYear ?? new Date().getFullYear();
  const out: ClaimCandidate[] = [];

  for (const profile of opts.profiles) {
    if (profile.archived || profile.mergedIntoId) continue;
    if (!nameHit(profile, opts.searchName)) continue;
    if (!clubOrTeamHit(profile, opts.searchClub, opts.teams, opts.clubs)) continue;

    let kuStatus: KuEligibility = 'unknown';
    let athleteKU: number | undefined;
    if (profile.birthDate) {
      const el = checkKuEligibility(profile.birthDate, opts.searchKU, year);
      kuStatus = el.status;
      athleteKU = el.athleteKU;
    } else {
      kuStatus = kuFromMatches(profile.id, opts.searchKU, year, opts.matches, opts.rosters);
      // Infer athlete KU as search KU when only match history says exact
      if (kuStatus === 'exact') athleteKU = opts.searchKU;
      if (kuStatus === 'playing_up') athleteKU = birthYearFromKu(opts.searchKU + 1, year) ? opts.searchKU - 1 : undefined;
    }

    if (kuStatus === 'overage') continue;

    const matchCount = opts.rosters.filter((r) => r.profileId === profile.id).length
      + opts.matches.filter((m) => m.childId === profile.id).length;

    let score = 40; // name
    if (profile.name.trim().toLowerCase() === opts.searchName.trim().toLowerCase()) score += 20;
    if (opts.searchClub.trim()) score += 15;
    if (kuStatus === 'exact') score += 25;
    else if (kuStatus === 'playing_up') score += 15;
    else if (kuStatus === 'unknown') score += 5;
    if (profile.birthDate) score += 5;

    const team = opts.teams.find((t) => t.id === (profile.mainTeamId || profile.teamId));
    out.push({ profile, score: Math.min(100, score), kuStatus, athleteKU, matchCount, teamName: team?.name });
  }

  return out.sort((a, b) => b.score - a.score || b.matchCount - a.matchCount);
}
