import React, { useState, useEffect } from 'react';
import { BaseModal } from '../../../shared/ui/BaseModal';
import { Button } from '../../../shared/ui/Button';
import { mergeService } from '../model/mergeService';
import { ChildProfile, MergeLog } from '../../../core/types/stats';
import { useToast } from '../../../core/contexts/ToastContext';
import { 
  Users, 
  AlertTriangle, 
  RotateCcw, 
  Info, 
  ArrowRight, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface MergePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: ChildProfile[]; // Profiles the current user can manage
  isAdmin: boolean;
  onMergeSuccess?: () => void;
  initialPrimaryId?: string;
  initialSecondaryId?: string;
}

export const MergePlayerModal: React.FC<MergePlayerModalProps> = ({
  isOpen,
  onClose,
  profiles,
  isAdmin,
  onMergeSuccess,
  initialPrimaryId = '',
  initialSecondaryId = ''
}) => {
  const { showToast } = useToast();
  
  // Selection state
  const [primaryId, setPrimaryId] = useState<string>('');
  const [secondaryId, setSecondaryId] = useState<string>('');
  
  // Data state
  const [suggestions, setSuggestions] = useState<Array<{ primary: ChildProfile; secondary: ChildProfile; score: number }>>([]);
  const [mergeLogs, setMergeLogs] = useState<MergeLog[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState<string | null>(null);

  // Field selection state for final profile values
  const [selectedFields, setSelectedFields] = useState<{
    name: 'primary' | 'secondary';
    displayName: 'primary' | 'secondary';
    birthDate: 'primary' | 'secondary';
    jerseyNumber: 'primary' | 'secondary';
    avatar: 'primary' | 'secondary';
  }>({
    name: 'primary',
    displayName: 'primary',
    birthDate: 'primary',
    jerseyNumber: 'primary',
    avatar: 'primary'
  });

  // Load suggestions & logs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  // Load preview data when both selections change
  useEffect(() => {
    if (primaryId && secondaryId) {
      loadPreview();
    } else {
      setPreviewData(null);
    }
  }, [primaryId, secondaryId]);

  const loadInitialData = async () => {
    try {
      const sugs = await mergeService.getPotentialDuplicates();
      // Filter suggestions based on what current user can manage
      const filteredSugs = sugs.filter(s => {
        const canManagePrimary = profiles.some(p => p.id === s.primary.id);
        const canManageSecondary = profiles.some(p => p.id === s.secondary.id);
        return isAdmin || (canManagePrimary && canManageSecondary);
      });
      setSuggestions(filteredSugs);

      const logs = await mergeService.getMergeLogs();
      setMergeLogs(logs);
    } catch (err) {
      console.error('Failed to load merge page data:', err);
    }
  };

  const resetForm = () => {
    setPrimaryId(initialPrimaryId);
    setSecondaryId(initialSecondaryId);
    setPreviewData(null);
    setSelectedFields({
      name: 'primary',
      displayName: 'primary',
      birthDate: 'primary',
      jerseyNumber: 'primary',
      avatar: 'primary'
    });
  };

  const loadPreview = async () => {
    if (!primaryId || !secondaryId) return;
    setLoadingPreview(true);
    try {
      const prev = await mergeService.previewMerge(primaryId, secondaryId);
      setPreviewData(prev);
      
      // Auto pre-select values based on completeness
      const p = prev.primary;
      const s = prev.secondary;
      setSelectedFields({
        name: 'primary',
        displayName: p.displayName ? 'primary' : (s.displayName ? 'secondary' : 'primary'),
        birthDate: p.birthDate ? 'primary' : (s.birthDate ? 'secondary' : 'primary'),
        jerseyNumber: p.jerseyNumber ? 'primary' : (s.jerseyNumber ? 'secondary' : 'primary'),
        avatar: p.avatar ? 'primary' : (s.avatar ? 'secondary' : 'primary')
      });
    } catch (err) {
      console.error('Failed to load merge preview:', err);
      showToast('Gagal memuat preview penggabungan', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSelectSuggestion = (sug: { primary: ChildProfile; secondary: ChildProfile }) => {
    setPrimaryId(sug.primary.id);
    setSecondaryId(sug.secondary.id);
    showToast(`Memilih kandidat: ${sug.primary.name} & ${sug.secondary.name}`, 'info');
  };

  const handleExecuteMerge = async () => {
    if (!primaryId || !secondaryId || !previewData) return;
    
    if (primaryId === secondaryId) {
      showToast('Profil Utama dan Profil Kedua tidak boleh sama', 'error');
      return;
    }

    const { primary, secondary } = previewData;

    // Build the final fields object based on user selections
    const finalFields: Partial<ChildProfile> = {
      name: selectedFields.name === 'primary' ? primary.name : secondary.name,
      displayName: selectedFields.displayName === 'primary' ? primary.displayName : secondary.displayName,
      birthDate: selectedFields.birthDate === 'primary' ? primary.birthDate : secondary.birthDate,
      jerseyNumber: selectedFields.jerseyNumber === 'primary' ? primary.jerseyNumber : secondary.jerseyNumber,
      avatar: selectedFields.avatar === 'primary' ? primary.avatar : secondary.avatar,
    };

    setIsSubmitting(true);
    try {
      await mergeService.executeMerge(primaryId, secondaryId, finalFields);
      showToast('Profil berhasil digabungkan!', 'success');
      
      // Trigger success callback
      if (onMergeSuccess) {
        onMergeSuccess();
      }
      
      // Reload and reset
      await loadInitialData();
      resetForm();
    } catch (err: any) {
      console.error('Merge execution error:', err);
      showToast(err.message || 'Terjadi kesalahan saat menggabungkan profil', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoMerge = async (logId: string, label: string) => {
    if (window.confirm(`Apakah Anda yakin ingin membatalkan penggabungan untuk "${label}"? Semua referensi akan dikembalikan ke profil asal.`)) {
      setIsUndoing(logId);
      try {
        await mergeService.undoMerge(logId);
        showToast('Penggabungan berhasil dibatalkan!', 'success');
        
        if (onMergeSuccess) {
          onMergeSuccess();
        }
        await loadInitialData();
      } catch (err: any) {
        console.error('Undo merge error:', err);
        showToast(err.message || 'Gagal membatalkan penggabungan', 'error');
      } finally {
        setIsUndoing(null);
      }
    }
  };

  // Helper to render field selection rows
  const renderFieldSelectionRow = (
    label: string,
    fieldName: keyof typeof selectedFields,
    primaryVal: any,
    secondaryVal: any
  ) => {
    if (!previewData) return null;
    
    const isDifferent = String(primaryVal || '').trim() !== String(secondaryVal || '').trim();

    return (
      <div className={`p-3 rounded-xl border ${isDifferent ? 'border-amber-100 bg-amber-50/20 dark:border-amber-900/30' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20'} flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs`}>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</span>
          {isDifferent && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Sparkles size={10} /> Nilai Berbeda
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Option Primary */}
          <button
            onClick={() => setSelectedFields(prev => ({ ...prev, [fieldName]: 'primary' }))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left ${
              selectedFields[fieldName] === 'primary'
                ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-orange dark:text-brand-navy dark:border-brand-orange font-bold shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${selectedFields[fieldName] === 'primary' ? 'border-white dark:border-brand-navy bg-white dark:bg-brand-navy' : 'border-zinc-300 dark:border-zinc-600'}`}>
              {selectedFields[fieldName] === 'primary' && <div className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-orange" />}
            </div>
            <div className="truncate max-w-[150px]">
              <span className="block text-[9px] opacity-75">Profil Utama</span>
              <span className="font-semibold">{String(primaryVal || '-')}</span>
            </div>
          </button>

          {/* Option Secondary */}
          <button
            onClick={() => setSelectedFields(prev => ({ ...prev, [fieldName]: 'secondary' }))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left ${
              selectedFields[fieldName] === 'secondary'
                ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-orange dark:text-brand-navy dark:border-brand-orange font-bold shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${selectedFields[fieldName] === 'secondary' ? 'border-white dark:border-brand-navy bg-white dark:bg-brand-navy' : 'border-zinc-300 dark:border-zinc-600'}`}>
              {selectedFields[fieldName] === 'secondary' && <div className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-orange" />}
            </div>
            <div className="truncate max-w-[150px]">
              <span className="block text-[9px] opacity-75">Profil Kedua</span>
              <span className="font-semibold">{String(secondaryVal || '-')}</span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Gabungkan Profil"
      icon={<Users className="text-brand-navy dark:text-brand-orange" size={20} />}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 font-sans">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed -mt-3">
          Gunakan utilitas ini untuk menggabungkan dua profil atlet yang duplikat. Seluruh riwayat pertandingan, statistik, data roster, dan relasi akun wali akan dipindahkan ke Profil Utama secara aman. Profil Kedua akan diarsipkan sebagai alias.
        </p>

        {/* 1. DUPLICATE SUGGESTIONS */}
        {suggestions.length > 0 && (
          <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles size={14} className="animate-pulse" />
              Saran Kandidat Duplikat ({suggestions.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {suggestions.map((sug, idx) => (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{sug.primary.name}</span>
                      <span className="text-[10px] text-zinc-400">Lahir: {sug.primary.birthDate || '-'}</span>
                    </div>
                    <ArrowRight size={14} className="text-zinc-400" />
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{sug.secondary.name}</span>
                      <span className="text-[10px] text-zinc-400">Lahir: {sug.secondary.birthDate || '-'}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleSelectSuggestion(sug)}
                    className="self-end sm:self-center px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    PILIH PROFIL
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. SELECT PROFILES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Profile Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Profil Utama (Dipertahankan)
            </label>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy dark:focus:border-brand-orange outline-none transition-all text-[#1A1A1A] dark:text-white"
            >
              <option value="">-- Pilih Profil Utama --</option>
              {profiles
                .filter(p => p.id !== secondaryId)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.birthDate ? `(${p.birthDate})` : ''}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-zinc-400 leading-snug">
              Seluruh statistik dan alias dari profil kedua akan digabungkan ke profil ini.
            </p>
          </div>

          {/* Secondary Profile Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Profil Kedua (Yang Digabung)
            </label>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy dark:focus:border-brand-orange outline-none transition-all text-[#1A1A1A] dark:text-white"
            >
              <option value="">-- Pilih Profil Kedua --</option>
              {profiles
                .filter(p => p.id !== primaryId)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.birthDate ? `(${p.birthDate})` : ''}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-zinc-400 leading-snug">
              Profil ini akan diarsipkan secara aman dan tidak akan muncul di katalog utama.
            </p>
          </div>
        </div>

        {/* 3. PREVIEW SECTION */}
        {loadingPreview && (
          <div className="p-12 text-center text-zinc-450 dark:text-zinc-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-brand-navy dark:text-brand-orange" />
            <span className="text-xs font-semibold">Memuat data perbandingan statistik...</span>
          </div>
        )}

        {previewData && !loadingPreview && (
          <div className="space-y-5 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-450 dark:text-zinc-400 flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <Info size={14} />
              PREVIEW & PENYESUAIAN BIDANG
            </h3>

            {/* Stats aggregation preview */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Pertandingan Utama</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.primaryMatches}</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Pertandingan Kedua</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.secondaryMatches}</span>
              </div>
              <div className="bg-brand-navy/5 dark:bg-brand-orange/5 p-3 rounded-xl border border-brand-navy/10 dark:border-brand-orange/10 shadow-xs">
                <span className="block text-[10px] font-bold text-brand-navy dark:text-brand-orange uppercase tracking-wider mb-1">Total Hasil Gabungan</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.combinedMatches}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center -mt-2">
              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Event Statistik Utama</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.primaryEvents}</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Event Statistik Kedua</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.secondaryEvents}</span>
              </div>
              <div className="bg-brand-navy/5 dark:bg-brand-orange/5 p-3 rounded-xl border border-brand-navy/10 dark:border-brand-orange/10 shadow-xs">
                <span className="block text-[10px] font-bold text-brand-navy dark:text-brand-orange uppercase tracking-wider mb-1">Total Event Gabungan</span>
                <span className="text-base font-black text-brand-navy dark:text-brand-orange">{previewData.stats.combinedEvents}</span>
              </div>
            </div>

            {/* Field Resolution Picker */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pilih Data Utama yang Disimpan</h4>
              {renderFieldSelectionRow('Nama Lengkap', 'name', previewData.primary.name, previewData.secondary.name)}
              {renderFieldSelectionRow('Nama Punggung', 'displayName', previewData.primary.displayName, previewData.secondary.displayName)}
              {renderFieldSelectionRow('Tanggal Lahir', 'birthDate', previewData.primary.birthDate, previewData.secondary.birthDate)}
              {renderFieldSelectionRow('Nomor Jersey', 'jerseyNumber', previewData.primary.jerseyNumber, previewData.secondary.jerseyNumber)}
            </div>

            {/* Warning callout */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-amber-850 dark:text-amber-400 leading-snug">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold">Konfirmasi Penggabungan:</span> Tindakan ini akan mengarsipkan profil kedua ("{previewData.secondary.name}") secara permanen dan menunjuk nama tersebut sebagai alias dari "{previewData.primary.name}". Semua data roster pertandingan dan riwayat event akan dipindahkan.
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Reset
              </Button>
              <Button
                onClick={handleExecuteMerge}
                disabled={isSubmitting}
                className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-bold uppercase tracking-wide text-xs"
              >
                {isSubmitting ? 'Menggabungkan...' : 'Konfirmasi & Gabungkan'}
              </Button>
            </div>
          </div>
        )}

        {/* 4. MERGE HISTORY / UNDO LOGS */}
        <div className="border-t border-zinc-150 dark:border-zinc-800 pt-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400 flex items-center gap-1.5">
            <RotateCcw size={14} />
            Riwayat Penggabungan & Pembatalan (Undo)
          </h3>
          {mergeLogs.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
              Tidak ada log penggabungan profil saat ini.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {mergeLogs.map((log) => (
                <div 
                  key={log.id}
                  className="bg-zinc-50/50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{log.primaryName}</span>
                      <span className="text-zinc-400">menggabungkan</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{log.secondaryName}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                      <span>{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                      <span>•</span>
                      <span>Roster: {log.reassignedCounts.matchRosters}, Event: {log.reassignedCounts.events}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUndoMerge(log.id, `${log.primaryName} <- ${log.secondaryName}`)}
                    disabled={isUndoing !== null}
                    className="self-end sm:self-center px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-650 dark:text-red-400 border border-red-100 dark:border-red-900/30 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isUndoing === log.id ? (
                      'Mengembalikan...'
                    ) : (
                      <>
                        <RotateCcw size={11} />
                        BATALKAN MERGE
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
};
