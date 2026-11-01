import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { exclusionService } from '../../features/match-exclusion/model/exclusionService';
import type { MatchExclusionRequest } from '../../features/match-exclusion/model/types';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { useToast } from '../../core/contexts/ToastContext';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';

export const MatchExclusionsPage: React.FC = () => {
  const { user } = usePermissions();
  const { showToast } = useToast();
  const [rows, setRows] = useState<MatchExclusionRequest[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(() => exclusionService.list().then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    load();
  }, [load]);

  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');

  const act = async (id: string, kind: 'approve' | 'reject') => {
    if (!user) return;
    setBusy(id);
    try {
      if (kind === 'approve') await exclusionService.approve(id, user.id, note[id]);
      else await exclusionService.reject(id, user.id, note[id] || '');
      showToast(kind === 'approve' ? 'Laga dipisahkan dari profil anak.' : 'Pengajuan ditolak.', kind === 'approve' ? 'success' : 'error');
      await load();
    } catch (e: any) {
      showToast(e.message || 'Gagal memproses', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tight">Pisahkan Laga dari Profil</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Orang tua mengajukan pengeluaran pertandingan yang ikut ter-merge karena nama + KU sama. Statistik tidak dihapus — dialihkan ke profil sementara, menunggu merge ulang yang benar.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Menunggu ({pending.length})</h2>
        {!pending.length && <p className="text-sm text-zinc-500">Tidak ada pengajuan.</p>}
        {pending.map((r) => (
          <Card key={r.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-white">{r.profileName}</p>
                <p className="text-sm text-zinc-500">{r.matchLabel}</p>
                <p className="text-xs text-zinc-400 mt-1">Diajukan {r.requestedByName} · {new Date(r.createdAt).toLocaleString('id-ID')}</p>
                <p className="text-sm mt-2 text-zinc-700 dark:text-zinc-300">{r.reason}</p>
              </div>
            </div>
            <textarea
              value={note[r.id] || ''}
              onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
              placeholder="Catatan admin (wajib jika menolak)"
              className="w-full text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3"
              rows={2}
            />
            <div className="flex gap-2">
              <Button disabled={busy === r.id} onClick={() => act(r.id, 'approve')} className="flex items-center gap-1">
                <Check size={14} /> Setujui pisah
              </Button>
              <Button variant="secondary" disabled={busy === r.id} onClick={() => act(r.id, 'reject')} className="flex items-center gap-1">
                <X size={14} /> Tolak
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {!!done.length && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Riwayat</h2>
          {done.slice(0, 30).map((r) => (
            <div key={r.id} className="text-sm flex justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 py-2">
              <span className="text-zinc-700 dark:text-zinc-300 truncate">{r.profileName} · {r.matchLabel}</span>
              <span className={r.status === 'approved' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{r.status}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
