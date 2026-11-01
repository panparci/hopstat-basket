import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Check, X, Unlink } from 'lucide-react';
import { authService } from '../services/authService';
import { statsService } from '../core/services/statsService';
import { relationshipService } from '../features/skills-coach/model/relationshipService';
import type { CoachPlayerLink } from '../features/skills-coach/model/types';
import { ChildProfile } from '../entities/athlete/model/types';
import { UserAccount } from '../core/types/serviceRequests';
import { useToast } from '../core/contexts/ToastContext';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { initDB } from '../lib/db';

const SKILLS = ['shooting', 'ball_handling', 'footwork', 'defense', 'passing', 'post_moves'];

export const SkillsCoachesPage: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [kids, setKids] = useState<ChildProfile[]>([]);
  const [coaches, setCoaches] = useState<UserAccount[]>([]);
  const [links, setLinks] = useState<CoachPlayerLink[]>([]);
  const [profileId, setProfileId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [specialties, setSpecialties] = useState<string[]>(['shooting']);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
    if (!u) return;
    const [profiles, accounts, allLinks] = await Promise.all([
      statsService.getProfiles(),
      initDB().then((db) => db.getAll('user_accounts') as Promise<UserAccount[]>).catch(() => [] as UserAccount[]),
      relationshipService.list(),
    ]);
    const mine = profiles.filter((p) => p.links?.some((l) => l.accountId === u.id && l.verified));
    setKids(mine);
    if (!profileId && mine[0]) setProfileId(mine[0].id);
    setCoaches(accounts.filter((a) => a.role === 'coach' || a.role === 'admin'));
    setLinks(allLinks.filter((l) => mine.some((k) => k.id === l.profileId) || l.coachAccountId === u.id));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const request = async () => {
    if (!user || !profileId || !coachId) return;
    const kid = kids.find((k) => k.id === profileId);
    const coach = coaches.find((c) => c.id === coachId);
    if (!kid || !coach) return;
    setBusy(true);
    try {
      const under18 = kid.birthDate ? new Date().getFullYear() - new Date(kid.birthDate).getFullYear() < 18 : true;
      await relationshipService.request({
        coachAccountId: coach.id,
        coachName: coach.name,
        profileId: kid.id,
        profileName: kid.name,
        specialties,
        requestedByAccountId: user.id,
        needsGuardianApproval: under18 && user.id !== coach.id,
      });
      showToast('Permintaan hubungan coach dikirim.', 'success');
      await load();
    } catch (e: any) {
      showToast(e.message || 'Gagal', 'error');
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, kind: 'approve' | 'end' | 'decline') => {
    try {
      if (kind === 'approve') await relationshipService.guardianApprove(id);
      else await relationshipService.declineOrEnd(id, kind === 'end' ? 'ended' : 'declined');
      showToast('Diperbarui.', 'success');
      await load();
    } catch (e: any) {
      showToast(e.message || 'Gagal', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase italic tracking-tight text-zinc-900 dark:text-white">Skills Coach</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Satu anak boleh punya beberapa coach (shooting, ball handling, …). Booking dan bayar belum ada di rilis ini.
          Video resmi, video coach, dan setoran latihan tetap terpisah — lihat{' '}
          <Link to="/fundamentals" className="text-brand-navy dark:text-brand-orange font-bold">Latihan Fundamental</Link>.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Hubungkan coach</h2>
        {!kids.length ? (
          <p className="text-sm text-zinc-500">Tambah atau klaim atlet dulu di menu Profil.</p>
        ) : (
          <>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-bold">
              {kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-bold">
              <option value="">Pilih coach</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => {
                const on = specialties.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialties((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer ${on ? 'bg-brand-navy dark:bg-brand-orange text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
            <Button disabled={busy || !coachId} onClick={request} className="w-full flex items-center justify-center gap-2">
              <UserPlus size={16} /> Ajukan hubungan
            </Button>
          </>
        )}
      </Card>

      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Hubungan</h2>
        {!links.length && <p className="text-sm text-zinc-500">Belum ada hubungan coach.</p>}
        {links.map((l) => (
          <Card key={l.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">{l.coachName} → {l.profileName}</p>
              <p className="text-xs text-zinc-500">{l.specialties.join(', ')} · {l.status}</p>
            </div>
            <div className="flex gap-2">
              {l.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => act(l.id, 'approve')}><Check size={14} /></Button>
                  <Button size="sm" variant="secondary" onClick={() => act(l.id, 'decline')}><X size={14} /></Button>
                </>
              )}
              {l.status === 'active' && (
                <Button size="sm" variant="danger" onClick={() => act(l.id, 'end')}><Unlink size={14} /></Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
