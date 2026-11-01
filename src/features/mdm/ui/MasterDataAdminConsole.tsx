import React, { useState, useEffect } from 'react';
import { 
  Database, Shield, Users, Trophy, UserCheck, GraduationCap, Award, Calendar,
  Search, RefreshCw, GitMerge, Star, Clock, AlertTriangle, Plus, Tag, History, CheckCircle2, ChevronRight, Filter
} from 'lucide-react';
import { MasterEntityType, MasterEntityItem, DuplicateCandidatePair, MergeActionPayload } from '../model/types';
import { mdmService, ENTITY_CONFIGS } from '../model/mdmService';
import { GoldenRecordBadge } from './GoldenRecordBadge';
import { DuplicateCard } from './DuplicateCard';
import { AliasesModal } from './AliasesModal';
import { MergeModal } from './MergeModal';
import { AuditHistoryModal } from './AuditHistoryModal';
import { useToast } from '../../../core/contexts/ToastContext';

type ActiveTab = 'duplicates' | 'canonical' | 'pending';

export const MasterDataAdminConsole: React.FC = () => {
  const { showToast } = useToast();

  // Selected Entity Type
  const [selectedType, setSelectedType] = useState<MasterEntityType>('club');
  const [activeTab, setActiveTab] = useState<ActiveTab>('duplicates');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [allEntities, setAllEntities] = useState<MasterEntityItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidatePair[]>([]);
  const [allAliasesCount, setAllAliasesCount] = useState(0);

  // Modals
  const [selectedEntityForAliases, setSelectedEntityForAliases] = useState<MasterEntityItem | null>(null);
  const [selectedPairForMerge, setSelectedPairForMerge] = useState<DuplicateCandidatePair | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Quick Inline Add Modal
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCity, setQuickAddCity] = useState('');
  const [quickAddAgeGroup, setQuickAddAgeGroup] = useState('');

  const currentConfig = ENTITY_CONFIGS[selectedType];

  useEffect(() => {
    loadData();
  }, [selectedType]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [entitiesList, dupsList, aliasesList] = await Promise.all([
        mdmService.listEntities(selectedType),
        mdmService.getDuplicateCandidates(selectedType),
        mdmService.getAliases()
      ]);

      setAllEntities(entitiesList);
      setDuplicates(dupsList);
      setAllAliasesCount(aliasesList.length);
    } catch (err) {
      console.error('Failed to load master data:', err);
      showToast('Gagal memuat master data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Metrics
  const canonicalCount = allEntities.filter(e => e.status === 'canonical').length;
  const pendingCount = allEntities.filter(e => e.status === 'pending').length;

  // Tab Filtering
  const displayedCanonicals = allEntities.filter(e => {
    if (e.status !== 'canonical') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || 
           (e.city && e.city.toLowerCase().includes(q)) ||
           e.aliases.some(a => a.toLowerCase().includes(q));
  });

  const displayedPending = allEntities.filter(e => {
    if (e.status !== 'pending') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || 
           (e.city && e.city.toLowerCase().includes(q));
  });

  // Actions
  const handleConfirmMerge = async (payload: MergeActionPayload) => {
    try {
      await mdmService.executeMerge(payload);
      showToast('Data berhasil digabungkan ke Golden Record!', 'success');
      await loadData();
    } catch (err: any) {
      console.error('Merge error:', err);
      showToast(err.message || 'Gagal menggabungkan data', 'error');
    }
  };

  const handlePromoteSeparate = async (pair: DuplicateCandidatePair) => {
    try {
      await mdmService.promoteToCanonical(selectedType, pair.sourceItem.id);
      showToast(`"${pair.sourceItem.name}" disahkan sebagai Golden Record terpisah!`, 'success');
      await loadData();
    } catch (err) {
      console.error('Promote error:', err);
      showToast('Gagal mengesahkan record', 'error');
    }
  };

  const handleEditAndPromote = async (pair: DuplicateCandidatePair, newName: string) => {
    try {
      await mdmService.promoteToCanonical(selectedType, pair.sourceItem.id, newName);
      showToast(`Nama diperbarui dan disahkan sebagai Golden Record!`, 'success');
      await loadData();
    } catch (err) {
      console.error('Edit & promote error:', err);
      showToast('Gagal memperbarui record', 'error');
    }
  };

  const handlePromotePending = async (id: string, name: string) => {
    try {
      await mdmService.promoteToCanonical(selectedType, id);
      showToast(`"${name}" telah disahkan sebagai Golden Record resmi!`, 'success');
      await loadData();
    } catch (err) {
      console.error('Promote error:', err);
      showToast('Gagal mengesahkan record', 'error');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) return;
    try {
      const created = await mdmService.proposeNewRecord(selectedType, quickAddName.trim(), {
        city: quickAddCity.trim() || undefined,
        ageGroup: quickAddAgeGroup.trim() || undefined
      });
      // Langsung promote ke canonical jika dibuat oleh admin
      await mdmService.promoteToCanonical(selectedType, created.id);
      showToast(`Golden Record "${quickAddName}" berhasil dibuat!`, 'success');
      setQuickAddName('');
      setQuickAddCity('');
      setQuickAddAgeGroup('');
      setIsQuickAddOpen(false);
      await loadData();
    } catch (err) {
      console.error('Quick add error:', err);
      showToast('Gagal membuat master data', 'error');
    }
  };

  const entityIcon = (type: MasterEntityType) => {
    switch (type) {
      case 'club': return <Shield className="w-4 h-4" />;
      case 'training_squad': return <Users className="w-4 h-4" />;
      case 'competition_team': return <Trophy className="w-4 h-4" />;
      case 'athlete': return <UserCheck className="w-4 h-4" />;
      case 'school': return <GraduationCap className="w-4 h-4" />;
      case 'academy': return <Award className="w-4 h-4" />;
      case 'tournament': return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Database className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
              Master Data Management (MDM)
            </span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">
            Konsol Resolusi & Golden Record
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Deduplikasi kolaboratif, penentuan canonical record, dan pengelolaan alias variasi ejaan resmi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            <span>Audit & Rollback Merge</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQuickAddOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Master Baru</span>
          </button>
        </div>
      </div>

      {/* 7 Entities Selector Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(Object.keys(ENTITY_CONFIGS) as MasterEntityType[]).map((type) => {
          const cfg = ENTITY_CONFIGS[type];
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setSelectedType(type);
                setSearchQuery('');
              }}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {entityIcon(type)}
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Golden Records
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
            {canonicalCount}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Master resmi {currentConfig.pluralLabel.toLowerCase()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
          <div className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            Duplikat Terdeteksi
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {duplicates.length}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Pasangan perlu resolusi
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40">
          <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            Usulan Pending
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {pendingCount}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Input pengguna belum divalidasi
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
          <div className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-500" />
            Total Alias Terdaftar
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {allAliasesCount}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Kamus sinonim & ejaan
          </div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('duplicates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'duplicates'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 text-amber-500" />
            <span>Kandidat Duplikat ({duplicates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('canonical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'canonical'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span>Direktori Master ({canonicalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>Usulan Pending ({pendingCount})</span>
          </button>
        </div>

        {/* Search Bar & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${currentConfig.label.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          Memuat data {currentConfig.pluralLabel}...
        </div>
      ) : activeTab === 'duplicates' ? (
        /* TAB 1: DUPLICATE RESOLUTION */
        duplicates.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Tidak Ada Duplikat Terdeteksi
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              Seluruh data {currentConfig.pluralLabel.toLowerCase()} saat ini dalam kondisi rapi dan tidak memiliki kandidat bentrok nama.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {duplicates.map((pair) => (
              <DuplicateCard
                key={pair.id}
                pair={pair}
                onMerge={(p) => setSelectedPairForMerge(p)}
                onPromoteSeparate={handlePromoteSeparate}
                onEditAndPromote={handleEditAndPromote}
              />
            ))}
          </div>
        )
      ) : activeTab === 'canonical' ? (
        /* TAB 2: CANONICAL GOLDEN RECORDS DIRECTORY */
        displayedCanonicals.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              Tidak ditemukan master resmi dengan kata kunci "{searchQuery}".
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-xs">
            {displayedCanonicals.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                      {item.name}
                    </h3>
                    <GoldenRecordBadge status="canonical" size="sm" />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-zinc-400">ID: {item.id}</span>
                    {item.city && <span>📍 {item.city}</span>}
                    {item.ageGroup && <span>🏀 {item.ageGroup}</span>}
                    <span>📊 {item.transactionCount} transaksi pertandingan</span>
                  </div>

                  {item.aliases.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Tag className="w-3 h-3 text-purple-500" />
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        Alias:
                      </span>
                      {item.aliases.map((al, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40"
                        >
                          {al}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEntityForAliases(item)}
                    className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Kelola Alias ({item.aliases.length})</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* TAB 3: PENDING PROPOSALS */
        displayedPending.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-zinc-400">
              Tidak ada usulan baru berstatus pending saat ini.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-xs">
            {displayedPending.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {item.name}
                    </h3>
                    <GoldenRecordBadge status="pending" size="sm" />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-zinc-400">ID: {item.id}</span>
                    {item.city && <span>📍 {item.city}</span>}
                    {item.ageGroup && <span>🏀 {item.ageGroup}</span>}
                    <span>📊 {item.transactionCount} transaksi</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePromotePending(item.id, item.name)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>Sahkan Sebagai Golden Record</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Aliases Modal */}
      <AliasesModal
        isOpen={!!selectedEntityForAliases}
        onClose={() => setSelectedEntityForAliases(null)}
        entity={selectedEntityForAliases}
        onAliasesUpdated={loadData}
      />

      {/* Merge Confirmation Modal */}
      <MergeModal
        isOpen={!!selectedPairForMerge}
        onClose={() => setSelectedPairForMerge(null)}
        pair={selectedPairForMerge}
        onConfirmMerge={handleConfirmMerge}
      />

      {/* Audit History Modal */}
      <AuditHistoryModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onRollbackComplete={loadData}
      />

      {/* Quick Add Master Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">
              Tambah {currentConfig.label} Resmi
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1">
                  Nama Resmi
                </label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder={`Masukkan nama ${currentConfig.label.toLowerCase()}...`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white"
                />
              </div>

              {currentConfig.hasCity && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 block mb-1">
                    Kota Domisili
                  </label>
                  <input
                    type="text"
                    value={quickAddCity}
                    onChange={(e) => setQuickAddCity(e.target.value)}
                    placeholder="cth: Semarang, Jakarta Pusat..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              )}

              {currentConfig.hasAgeGroup && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 block mb-1">
                    Kelompok Umur (KU)
                  </label>
                  <input
                    type="text"
                    value={quickAddAgeGroup}
                    onChange={(e) => setQuickAddAgeGroup(e.target.value)}
                    placeholder="cth: KU-10, KU-16..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!quickAddName.trim()}
                onClick={handleQuickAdd}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
              >
                Simpan Golden Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
