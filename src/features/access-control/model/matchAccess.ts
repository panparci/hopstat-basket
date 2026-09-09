import { canManage } from '../../../entities/athlete/lib/athleteAccess';
import { Match, ChildProfile } from '../../../core/types/stats';
import { PaymentRecord, UserAccount } from '../../../core/types/serviceRequests';

/**
 * Checks if a user is allowed to view a specific match or its story.
 */
export function canViewMatch(
  user: UserAccount | null | undefined,
  match: Match | null | undefined,
  athletesInMatch: ChildProfile[],
  payments: PaymentRecord[]
): boolean {
  if (!user || !match) return false;

  const role = user.role;

  // 1. Role internal (admin, statistician, coach) → true.
  if (role === 'admin' || role === 'statistician' || role === 'coach') {
    return true;
  }

  // 2. customer → true HANYA jika ia guardian atas salah satu atlet di match itu,
  //    ATAU ada PaymentRecord miliknya untuk match/child itu (sudah membeli).
  if (role === 'customer') {
    // Check if guardian
    const isGuardian = athletesInMatch.some(athlete => canManage(athlete, user.id));
    if (isGuardian) return true;

    // Check if there is a payment record for the match or child
    const hasPayment = payments.some(p => {
      if (p.status !== 'success') return false;
      
      // Match ID directly
      if (p.requestId === match.id) return true;
      
      // Child ID directly (some payments might use the childId as requestId)
      if (match.childId && p.requestId === match.childId) return true;
      
      // Check other athletes in match
      if (athletesInMatch.some(a => p.requestId === a.id)) return true;

      return false;
    });

    if (hasPayment) return true;

    return false;
  }

  // 3. scout → true HANYA jika match.productionStage === 'published' DAN minimal satu atlet di match isDiscoverable === true.
  if (role === 'scout') {
    if (match.productionStage !== 'published') return false;
    return athletesInMatch.some(athlete => athlete.isDiscoverable === true);
  }

  return false;
}

export function filterViewableMatches(
  user: UserAccount | null | undefined,
  matches: Match[],
  profiles: ChildProfile[],
  rosters: { matchId?: string; profileId?: string }[],
  payments: PaymentRecord[]
): Match[] {
  return matches.filter((m) => {
    const athletes = profiles.filter(
      (p) => p.id === m.childId || rosters.some((r) => r.matchId === m.id && r.profileId === p.id)
    );
    return canViewMatch(user, m, athletes, payments);
  });
}
