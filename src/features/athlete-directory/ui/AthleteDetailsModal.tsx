import React from 'react';
import { BaseModal } from '../../../shared/ui/BaseModal';
import { Button } from '../../../shared/ui/Button';
import { ChildProfile, Team, Club } from '../../../core/types/stats';
import { UserAccount } from '../../../core/types/serviceRequests';
import { getCurrentKU } from '../../../core/utils/ageCalculator';
import { Calendar, User, Shield, Briefcase, Award, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Avatar } from '../../../shared/ui/Avatar';

interface AthleteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: ChildProfile | null;
  teams: Team[];
  clubs: Club[];
  users: UserAccount[];
}

export const AthleteDetailsModal: React.FC<AthleteDetailsModalProps> = ({
  isOpen,
  onClose,
  athlete,
  teams,
  clubs,
  users
}) => {
  if (!athlete) return null;

  const currentKU = getCurrentKU(athlete.birthDate);
  const birthYear = athlete.birthDate ? new Date(athlete.birthDate).getFullYear() : '—';
  
  // Find associated club
  const activeClub = clubs.find(c => c.id === athlete.clubId);

  // Find teams
  const mainTeam = teams.find(t => t.id === athlete.mainTeamId || t.id === athlete.teamId);
  const schoolTeam = teams.find(t => t.id === athlete.schoolTeamId);
  const academyTeam = teams.find(t => t.id === athlete.academyTeamId);
  const loanTeam = teams.find(t => t.id === athlete.loanTeamId);

  // Find guardian names from links
  const verifiedGuardians = (athlete.links || [])
    .filter(link => link.relationship === 'guardian' && link.verified)
    .map(link => {
      const u = users.find(usr => usr.id === link.accountId);
      return u ? `${u.name} (${u.email})` : `Akun ID: ${link.accountId}`;
    });

  const pendingClaims = (athlete.links || [])
    .filter(link => !link.verified)
    .map(link => {
      const u = users.find(usr => usr.id === link.accountId);
      return u ? `${u.name} (${u.email}) [${link.relationship}]` : `Akun ID: ${link.accountId} [${link.relationship}]`;
    });

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Detail Profil Atlet">
      <div className="space-y-6 font-sans text-zinc-900 dark:text-zinc-100 max-h-[80vh] overflow-y-auto pr-2">
        {/* Header Profile */}
        <div className="flex items-center gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <Avatar name={athlete.name} photoUrl={athlete.photoUrl || athlete.avatar} size="lg" className="border border-zinc-200 dark:border-zinc-700" />
          <div>
            <h3 className="text-xl font-bold font-display tracking-tight text-brand-navy dark:text-white uppercase">
              {athlete.name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {athlete.displayName && (
                <span className="text-[10px] bg-brand-navy/5 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange px-2 py-0.5 rounded-full font-bold">
                  Jersey: {athlete.displayName}
                </span>
              )}
              {athlete.jerseyNumber && (
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full font-bold font-mono">
                  No: #{athlete.jerseyNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-1">Status Klaim</span>
            {athlete.claimStatus === 'verified' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={14} /> Sudah Diklaim
              </span>
            ) : athlete.claimStatus === 'claim_pending' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Clock size={14} /> Menunggu Review
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                <AlertCircle size={14} /> Belum Diklaim
              </span>
            )}
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-1">ID Internal</span>
            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
              {athlete.internalId || '—'}
            </span>
          </div>
        </div>

        {/* Informasi Utama */}
        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Informasi Utama</h4>
          
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <span className="text-xs text-zinc-400 block">Kategori Umur (KU)</span>
              <span className="font-bold">{currentKU ? `${currentKU} (Lahir ${birthYear})` : '—'}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Jenis Kelamin</span>
              <span className="font-bold">
                {athlete.gender === 'P' || athlete.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Klub Aktif</span>
              <span className="font-bold">{activeClub?.name || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Privasi Pencarian</span>
              <span className="font-bold">
                {athlete.isDiscoverable !== false ? 'Dapat Ditemukan' : 'Privat'}
              </span>
            </div>
            {athlete.aliases && athlete.aliases.length > 0 && (
              <div className="col-span-2">
                <span className="text-xs text-zinc-400 block">Alias Penggabungan (Merge)</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {athlete.aliases.map((alias, idx) => (
                    <span key={idx} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-md font-medium">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tim Afiliasi */}
        <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Tim & Afiliasi</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl">
              <span className="text-xs text-zinc-400 block">Tim Utama</span>
              <span className="font-bold">{mainTeam?.name || '—'}</span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl">
              <span className="text-xs text-zinc-400 block">Tim Sekolah</span>
              <span className="font-bold">{schoolTeam?.name || '—'}</span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl">
              <span className="text-xs text-zinc-400 block">Akademi</span>
              <span className="font-bold">{academyTeam?.name || '—'}</span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl">
              <span className="text-xs text-zinc-400 block">Tim Pinjaman</span>
              <span className="font-bold">{loanTeam?.name || '—'}</span>
            </div>
          </div>
        </div>

        {/* Wali / Guardian */}
        <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Wali / Guardian Terverifikasi</h4>
          {verifiedGuardians.length > 0 ? (
            <div className="space-y-1.5">
              {verifiedGuardians.map((g, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <Shield size={14} />
                  <span>{g}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic">Belum ada guardian yang tertaut resmi.</p>
          )}

          {pendingClaims.length > 0 && (
            <div className="mt-3">
              <h5 className="text-[10px] font-black uppercase text-amber-500 tracking-wider mb-1.5">Klaim Tertunda</h5>
              <div className="space-y-1.5">
                {pendingClaims.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40">
                    <Clock size={14} />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <Button variant="secondary" onClick={onClose} className="px-5">
            Tutup
          </Button>
        </div>
      </div>
    </BaseModal>
  );
};
