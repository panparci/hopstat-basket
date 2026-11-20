import { initDB } from '../../../lib/db';
import { ClaimRequest } from '../../../core/types/claim';
import { statsService } from '../../../core/services/statsService';
import { PaymentRecord } from '../../../core/types/serviceRequests';
import { mergeService } from '../../../core/services/mergeService';

export const claimService = {
  async createClaim(
    claimData: Omit<ClaimRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'paymentId'>,
    paymentMethod: 'card' | 'transfer' | 'e-wallet',
    amount: number
  ): Promise<ClaimRequest> {
    const db = await initDB();
    const claimId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const now = Date.now();

    // DP-11 order: claim first (so paymentTargetOwned sees claimant), then payment, then link paymentId.
    const newClaim: ClaimRequest = {
      ...claimData,
      id: claimId,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    await db.put('claim_requests', newClaim);

    const payment: PaymentRecord = {
      id: paymentId,
      requestId: claimId,
      amount,
      status: 'pending',
      method: paymentMethod,
      createdAt: now
    };
    await db.put('payments', payment);

    newClaim.paymentId = paymentId;
    newClaim.updatedAt = Date.now();
    await db.put('claim_requests', newClaim);

    const profile = await db.get('profiles', claimData.profileId);
    if (profile) {
      profile.claimStatus = 'claim_pending';
      await statsService.updateProfile(profile);
    }

    // Snap if Midtrans configured; 503 → admin-confirm path unchanged.
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/charge`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const snap = (await res.json()) as { redirect_url?: string };
        if (snap.redirect_url) {
          window.location.assign(snap.redirect_url);
        }
      }
    } catch {
      // claim + pending payment already stored
    }

    return newClaim;
  },

  async getClaims(): Promise<ClaimRequest[]> {
    const db = await initDB();
    return db.getAll('claim_requests');
  },

  async getUserClaims(claimantAccountId: string): Promise<ClaimRequest[]> {
    const db = await initDB();
    return db.getAllFromIndex('claim_requests', 'by-claimant', claimantAccountId);
  },

  async getClaimByProfileId(profileId: string): Promise<ClaimRequest | undefined> {
    const db = await initDB();
    const claims = await db.getAllFromIndex('claim_requests', 'by-profile', profileId);
    return claims.length > 0 ? claims[0] : undefined;
  },

  async reviewClaim(
    claimId: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    note?: string,
    mergePlaceholderId?: string
  ): Promise<void> {
    const db = await initDB();
    const claim = await db.get('claim_requests', claimId);
    if (!claim) throw new Error('Claim request not found');

    claim.status = status;
    claim.reviewedBy = reviewerId;
    claim.reviewNote = note;
    claim.updatedAt = Date.now();

    if (status === 'rejected') {
      claim.paymentStatus = 'refund_pending';
    }

    await db.put('claim_requests', claim);

    // If approved, update profile to verified and link user
    const profile = await db.get('profiles', claim.profileId);
    if (profile) {
      if (status === 'approved') {
        profile.claimStatus = 'verified';
        if (!profile.links) {
          profile.links = [];
        }
        if (!profile.links.some(l => l.accountId === claim.claimantAccountId)) {
          profile.links.push({
            accountId: claim.claimantAccountId,
            relationship: 'guardian',
            verified: true,
            verifiedAt: Date.now()
          });
        }

        await statsService.updateProfile(profile);

        // Handle profile merge if specified
        if (mergePlaceholderId && mergePlaceholderId !== claim.profileId) {
          await mergeService.executeMerge(claim.profileId, mergePlaceholderId, {});
        }
      } else if (status === 'rejected') {
        // Multi-guardian safety: Only change back to 'unclaimed' if there are no other verified guardians!
        const otherVerifiedGuardians = profile.links?.some(l => l.accountId !== claim.claimantAccountId && l.verified);
        if (!otherVerifiedGuardians) {
          profile.claimStatus = 'unclaimed';
        }
        await statsService.updateProfile(profile);
      }
    }
  },

  async confirmPayment(claimId: string): Promise<void> {
    const db = await initDB();
    const claim = await db.get('claim_requests', claimId);
    if (!claim) throw new Error('Claim request not found');
    if (claim.paymentId) {
      const payment = await db.get('payments', claim.paymentId);
      if (payment) {
        payment.status = 'success';
        await db.put('payments', payment);
      }
    }
    claim.paymentStatus = 'paid';
    claim.updatedAt = Date.now();
    await db.put('claim_requests', claim);
  },

  async processRefund(
    claimId: string,
    refundStatus: 'refunded' | 'refund_rejected',
    note?: string
  ): Promise<void> {
    const db = await initDB();
    const claim = await db.get('claim_requests', claimId);
    if (!claim) throw new Error('Claim request not found');

    claim.paymentStatus = refundStatus;
    if (note) {
      claim.reviewNote = note;
    }
    claim.updatedAt = Date.now();
    await db.put('claim_requests', claim);

    if (claim.paymentId) {
      const payment = await db.get('payments', claim.paymentId);
      if (payment) {
        if (refundStatus === 'refunded') {
          payment.status = 'failed';
        }
        await db.put('payments', payment);
      }
    }
  }
};
