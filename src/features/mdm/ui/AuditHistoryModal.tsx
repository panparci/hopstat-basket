import React, { useState, useEffect } from 'react';
import { History, RotateCcw, GitMerge, AlertCircle, Check } from 'lucide-react';
import { BaseModal } from '../../../components/atoms/BaseModal';
import { mdmService } from '../model/mdmService';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRollbackComplete: () => void;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  isOpen,
  onClose,
  onRollbackComplete
}) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadLogs();
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await mdmService.getMergeLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load merge logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (logId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan penggabungan data ini?')) return;
    setRollingBackId(logId);
    try {
      await mdmService.rollbackMerge(logId);
      await loadLogs();
      onRollbackComplete();
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Riwayat Penggabungan Master Data (Audit Log)"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 font-sans">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Setiap penggabungan data dicatat secara transparan. Jika terjadi kekeliruan penggabungan, Anda dapat melakukan <strong>Rollback</strong> untuk memulihkan record asal.
        </p>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-400">Memuat log histori...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            Belum ada riwayat penggabungan data yang tercatat.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      "{log.secondaryName}" ➔ "{log.primaryName}"
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-3">
                    <span>🕒 {new Date(log.timestamp).toLocaleString('id-ID')}</span>
                    {log.details?.entityType && (
                      <span className="capitalize font-semibold text-zinc-600 dark:text-zinc-300">
                        • Tipe: {log.details.entityType}
                      </span>
                    )}
                    {log.details?.retainedAlias && (
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        • Alias disimpan
                      </span>
                    )}
                  </div>
                  {log.details?.notes && (
                    <div className="text-[11px] text-zinc-400 italic mt-0.5">
                      Catatan: "{log.details.notes}"
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={rollingBackId === log.id}
                  onClick={() => handleRollback(log.id)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-zinc-600 dark:text-zinc-400 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{rollingBackId === log.id ? 'Memulihkan...' : 'Rollback'}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
