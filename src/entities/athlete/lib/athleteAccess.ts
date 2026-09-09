import { ChildProfile, AthleteLink } from '../model/types';

/**
 * Checks if a specific user account is authorized to manage an athlete profile.
 * An account can manage a profile if there is a verified link matching the account ID.
 */
export function canManage(profile: ChildProfile, accountId: string): boolean {
  if (!profile || !accountId) return false;
  
  // Check the new links structure
  if (profile.links && Array.isArray(profile.links)) {
    return profile.links.some(link => link.accountId === accountId && link.verified);
  }
  
  return false;
}

/**
 * Gets all guardian links for an athlete profile.
 */
export function getGuardians(profile: ChildProfile): AthleteLink[] {
  if (!profile || !profile.links || !Array.isArray(profile.links)) {
    return [];
  }
  return profile.links.filter(link => link.relationship === 'guardian');
}

/**
 * Checks if an athlete profile is unclaimed.
 */
export function isUnclaimed(profile: ChildProfile): boolean {
  return profile?.claimStatus === 'unclaimed';
}
