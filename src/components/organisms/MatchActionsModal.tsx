import React, { useState, useMemo } from 'react';
import { Match, Series } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { exportImportService } from '../../core/services/exportImportService';
import { Trash2, EyeOff, Edit3, FolderInput, Eye, PlayCircle, Download, ChevronLeft, Save, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BaseModal } from '../atoms/BaseModal';
import { useToast } from '../../core/contexts/ToastContext';

interface MatchActionsModalProps {
  match: Match | null;
  seriesList: Series[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MatchActionsModal: React.FC<MatchActionsModalProps> = ({ match, seriesList, isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [view, setView] = useState<'main' | 'rename' | 'move' | 'delete_confirm' | 'abort_confirm'>('main');
  const [newName, setNewName] = useState('');
  const [newOpponent, setNewOpponent] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!match) return;
    await statsService.deleteMatch(match.id);
    onSuccess();
    onClose();
  };

  const handleAbort = async () => {
    if (!match) return;
    await statsService.updateMatch({ ...match, status: 'aborted' });
    onSuccess();
    onClose();
  };

  const handleResumeTracking = async () => {
    if (!match) return;
    await statsService.updateMatch({ ...match, status: 'ongoing' });
    onSuccess();
    onClose();
    navigate(`/track/${match.id}`);
  };

  const handleToggleExclude = async () => {
    if (!match) return;
    await statsService.updateMatch({ ...match, excludeFromStats: !match.excludeFromStats });
    onSuccess();
    onClose();
  };

  const handleExport = async () => {
    if (!match) return;
    try {
      setIsExporting(true);
      const jsonStr = await exportImportService.exportMatch(match.id);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${match.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.stat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Pertandingan berhasil diekspor!', 'success');
    } catch (error) {
      console.error('Failed to export match', error);
      showToast('Gagal mengekspor pertandingan.', 'error');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    await statsService.updateMatch({ 
      ...match, 
      name: newName || match.name,
      theirTeamName: newOpponent || match.theirTeamName
    });
    setView('main');
    onSuccess();
    onClose();
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    await statsService.updateMatch({ 
      ...match, 
      seriesId: selectedSeries === 'adhoc' ? undefined : selectedSeries,
      type: selectedSeries === 'adhoc' ? 'single' : 'series'
    });
    setView('main');
    onSuccess();
    onClose();
  };

  const openRename = () => {
    if (!match) return;
    setNewName(match.name);
    setNewOpponent(match.theirTeamName || '');
    setView('rename');
  };

  const openMove = () => {
    if (!match) return;
    setSelectedSeries(match.seriesId || 'adhoc');
    setView('move');
  };

  const modalTitle = useMemo(() => {
    if (view === 'rename') return "Rename Match";
    if (view === 'move') return "Move Match";
    if (view === 'delete_confirm') return "Delete Permanently";
    if (view === 'abort_confirm') return "Abort Match";
    return match?.name || "Match Actions";
  }, [view, match]);

  const modalIcon = useMemo(() => {
    if (view === 'rename') return <Edit3 size={20} className="text-blue-600 dark:text-blue-400" />;
    if (view === 'move') return <FolderInput size={20} className="text-purple-600 dark:text-purple-400" />;
    if (view === 'delete_confirm' || view === 'abort_confirm') return <Trash2 size={20} className="text-red-600 dark:text-red-400" />;
    return <Settings size={20} className="text-zinc-600 dark:text-zinc-400" />;
  }, [view]);

  const headerActions = useMemo(() => {
    if (view !== 'main') {
      return (
        <button 
          onClick={() => setView('main')}
          className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <ChevronLeft size={16} /> Back
        </button>
      );
    }
    return null;
  }, [view]);

  if (!match) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {
        setView('main');
        onClose();
      }}
      title={modalTitle}
      icon={modalIcon}
      headerActions={headerActions}
      maxWidth="max-w-sm"
      sidePanel={true}
    >
      <div className="flex flex-col">
        {view === 'main' && (
          <div className="p-2 flex flex-col gap-1">
            {match.status === 'completed' && (
              <button onClick={handleResumeTracking} className="flex items-center gap-3 p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-colors text-left group">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <PlayCircle size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Resume Tracking</div>
                  <div className="text-xs text-emerald-500/70 dark:text-emerald-400/70">Lanjutkan merekam statistik</div>
                </div>
              </button>
            )}

            <button onClick={openRename} className="flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Edit3 size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">Rename</div>
                <div className="text-xs text-zinc-500">Ganti nama pertandingan atau lawan</div>
              </div>
            </button>
            
            <button onClick={openMove} className="flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <FolderInput size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">Move to Series</div>
                <div className="text-xs text-zinc-500">Pindahkan ke adhoc atau series lain</div>
              </div>
            </button>
            
            <button onClick={handleToggleExclude} className="flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${match.excludeFromStats ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                {match.excludeFromStats ? <Eye size={18} /> : <EyeOff size={18} />}
              </div>
              <div>
                <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                  {match.excludeFromStats ? 'Include in Stats' : 'Exclude from Stats'}
                </div>
                <div className="text-xs text-zinc-500">
                  {match.excludeFromStats ? 'Masukkan kembali ke statistik' : 'Abaikan dari summary statistik'}
                </div>
              </div>
            </button>

            <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left disabled:opacity-50">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Download size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                  {isExporting ? 'Exporting...' : 'Export Match (.stat)'}
                </div>
                <div className="text-xs text-zinc-500">
                  Export data pertandingan untuk dibagikan
                </div>
              </div>
            </button>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2 mx-4"></div>

            <button onClick={() => setView('abort_confirm')} className="flex items-center gap-3 p-4 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors text-left group">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                <Trash2 size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-red-600 dark:text-red-400">Abort Match</div>
                <div className="text-xs text-red-500/70 dark:text-red-400/70">Hapus dan simpan ke archive</div>
              </div>
            </button>

            <button onClick={() => setView('delete_confirm')} className="flex items-center gap-3 p-4 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors text-left group">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                <Trash2 size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-red-600 dark:text-red-400">Delete Permanently</div>
                <div className="text-xs text-red-500/70 dark:text-red-400/70">Hapus selamanya dari database</div>
              </div>
            </button>
          </div>
        )}

        {view === 'rename' && (
          <form onSubmit={handleRenameSubmit} className="p-2 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Match Name</label>
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:border-brand-navy dark:focus:border-brand-orange outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Opponent Name</label>
              <input 
                type="text" 
                value={newOpponent} 
                onChange={e => setNewOpponent(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:border-brand-navy dark:focus:border-brand-orange outline-none transition-colors"
              />
            </div>
            <button type="submit" className="w-full py-4 mt-2 rounded-2xl font-bold tracking-wide text-white dark:text-brand-navy bg-brand-navy dark:bg-brand-orange shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Save size={18} /> SAVE CHANGES
            </button>
          </form>
        )}

        {view === 'delete_confirm' && (
          <div className="p-4 flex flex-col gap-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black italic uppercase text-red-600 dark:text-red-400 mb-2">Hapus Permanen?</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Apakah Anda yakin ingin menghapus pertandingan ini secara permanen? Semua data event, roster, dan statistik terkait akan dihapus selamanya.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleDelete}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black italic uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                YA, HAPUS PERMANEN
              </button>
              <button 
                onClick={() => setView('main')}
                className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                BATAL
              </button>
            </div>
          </div>
        )}

        {view === 'abort_confirm' && (
          <div className="p-4 flex flex-col gap-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black italic uppercase text-red-600 dark:text-red-400 mb-2">Abort Match?</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Hapus pertandingan ini dan simpan ke archive? Anda masih bisa melihatnya di daftar archive namun tidak masuk ke statistik utama.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleAbort}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black italic uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                YA, ABORT MATCH
              </button>
              <button 
                onClick={() => setView('main')}
                className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                BATAL
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
