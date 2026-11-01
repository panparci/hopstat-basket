import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, AlertCircle, X, ChevronDown, Sparkles, Building2, Tag } from 'lucide-react';
import { MasterEntityType, MasterEntityItem, MasterAlias } from '../model/types';
import { mdmService } from '../model/mdmService';
import { GoldenRecordBadge } from './GoldenRecordBadge';

interface SelectOrCreateInputProps {
  entityType: MasterEntityType;
  label?: string;
  placeholder?: string;
  selectedId?: string;
  selectedName?: string;
  context?: Record<string, any>;
  allowPropose?: boolean;
  disabled?: boolean;
  onChange: (id: string, name: string, isCanonical: boolean) => void;
}

export const SelectOrCreateInput: React.FC<SelectOrCreateInputProps> = ({
  entityType,
  label,
  placeholder,
  selectedId,
  selectedName,
  context,
  allowPropose = true,
  disabled = false,
  onChange
}) => {
  const config = mdmService.getEntityConfig(entityType);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(selectedName || '');
  const [isLoading, setIsLoading] = useState(false);

  // Results
  const [canonicalMatches, setCanonicalMatches] = useState<MasterEntityItem[]>([]);
  const [aliasMatches, setAliasMatches] = useState<{ alias: MasterAlias; canonicalItem: MasterEntityItem }[]>([]);
  const [similarSuggestions, setSimilarSuggestions] = useState<{ item: MasterEntityItem; similarity: number; reason: string }[]>([]);
  const [canPropose, setCanPropose] = useState(false);

  // Propose Mini Drawer / Context Form
  const [isProposing, setIsProposing] = useState(false);
  const [proposeCity, setProposeCity] = useState(context?.city || '');
  const [proposeAgeGroup, setProposeAgeGroup] = useState(context?.ageGroup || '');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selectedName if controlled
  useEffect(() => {
    if (selectedName !== undefined) {
      setQuery(selectedName);
    }
  }, [selectedName]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsProposing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search debouncing
  useEffect(() => {
    if (!isOpen) return;

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await mdmService.searchSelectOrCreate(entityType, query, context);
        setCanonicalMatches(results.canonicalMatches);
        setAliasMatches(results.aliasMatches);
        setSimilarSuggestions(results.similarSuggestions);
        setCanPropose(results.canProposeNew);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen, entityType, context]);

  const handleSelectItem = (item: MasterEntityItem) => {
    onChange(item.id, item.name, item.status === 'canonical');
    setQuery(item.name);
    setIsOpen(false);
    setIsProposing(false);
  };

  const handleSelectAliasMatch = (match: { alias: MasterAlias; canonicalItem: MasterEntityItem }) => {
    onChange(match.canonicalItem.id, match.canonicalItem.name, true);
    setQuery(match.canonicalItem.name);
    setIsOpen(false);
    setIsProposing(false);
  };

  const handleProposeNew = async () => {
    if (!query.trim()) return;
    setIsSubmittingProposal(true);
    try {
      const proposalContext: Record<string, any> = {
        ...(context || {}),
        city: proposeCity.trim() || undefined,
        ageGroup: proposeAgeGroup.trim() || undefined
      };
      const created = await mdmService.proposeNewRecord(entityType, query.trim(), proposalContext);
      onChange(created.id, created.name, false);
      setQuery(created.name);
      setIsOpen(false);
      setIsProposing(false);
    } catch (err) {
      console.error('Error proposing new record:', err);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleClear = () => {
    onChange('', '', false);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
          {label}
        </label>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || config.placeholder}
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-xs"
        />

        {/* Leading Search Icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
          <Search className="w-4 h-4" />
        </div>

        {/* Trailing Actions */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* 1. Direct Alias Match Banner */}
          {aliasMatches.length > 0 && (
            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/30">
              <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Ditemukan via Alias Resmi (Synonym)
              </div>
              <div className="space-y-1">
                {aliasMatches.map((m, idx) => (
                  <button
                    key={`alias-${idx}`}
                    type="button"
                    onClick={() => handleSelectAliasMatch(m)}
                    className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-purple-100/50 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/40 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300">
                          {m.canonicalItem.name}
                        </span>
                        <GoldenRecordBadge status="canonical" size="sm" />
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                        Alias yang Anda ketik: <strong className="underline">{m.alias.aliasText}</strong>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Direct Canonical Golden Record Matches */}
          {canonicalMatches.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Master Resmi Terverifikasi ({canonicalMatches.length})
              </div>
              <div className="space-y-1">
                {canonicalMatches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className={`w-full text-left p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors flex items-center justify-between group ${
                      selectedId === item.id ? 'bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">
                          {item.name}
                        </span>
                        <GoldenRecordBadge status={item.status} size="sm" />
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                        {item.city && <span>📍 {item.city}</span>}
                        {item.ageGroup && <span>• {item.ageGroup}</span>}
                        {item.aliases.length > 0 && (
                          <span className="text-zinc-400">({item.aliases.length} alias)</span>
                        )}
                      </div>
                    </div>
                    {selectedId === item.id ? (
                      <Check className="w-4 h-4 text-amber-600" />
                    ) : (
                      <span className="text-xs text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">
                        Pilih
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Similar Suggestions (Potential Duplicate Warning) */}
          {similarSuggestions.length > 0 && (
            <div className="p-2 bg-amber-50/40 dark:bg-amber-950/10">
              <div className="px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                Data Serupa Terdeteksi (Cek sebelum membuat baru)
              </div>
              <div className="space-y-1 mt-1">
                {similarSuggestions.map(({ item, similarity, reason }) => (
                  <button
                    key={`sim-${item.id}`}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/40 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          {similarity}% Mirip
                        </span>
                      </div>
                      <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        {reason}
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 font-bold group-hover:underline">
                      Gunakan Ini
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Select or Propose New Option */}
          {allowPropose && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40">
              {!isProposing ? (
                <button
                  type="button"
                  onClick={() => setIsProposing(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-zinc-700 dark:text-zinc-300 transition-colors text-sm font-semibold"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span>
                      Ajukan sebagai <span className="font-bold text-amber-600 dark:text-amber-400">{config.label} Baru</span>: "{query || 'Baru'}"
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">Ajukan ↵</span>
                </button>
              ) : (
                <div className="space-y-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-800/60 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Detail Usulan Master Data
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsProposing(false)}
                      className="text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      Batal
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-500 font-semibold block mb-1">
                      Nama yang Diajukan
                    </label>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white"
                      placeholder="Nama lengkap resmi..."
                    />
                  </div>

                  {config.hasCity && (
                    <div>
                      <label className="text-[11px] text-zinc-500 font-semibold block mb-1">
                        Kota / Domisili
                      </label>
                      <input
                        type="text"
                        value={proposeCity}
                        onChange={(e) => setProposeCity(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                        placeholder="cth: Semarang, Jakarta Selatan..."
                      />
                    </div>
                  )}

                  {config.hasAgeGroup && (
                    <div>
                      <label className="text-[11px] text-zinc-500 font-semibold block mb-1">
                        Kategori Kelompok Umur (KU)
                      </label>
                      <input
                        type="text"
                        value={proposeAgeGroup}
                        onChange={(e) => setProposeAgeGroup(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                        placeholder="cth: KU-10, KU-14, SMA..."
                      />
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={!query.trim() || isSubmittingProposal}
                      onClick={handleProposeNew}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingProposal ? (
                        <span>Menyimpan Usulan...</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan & Gunakan Usulan Baru</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center mt-1.5">
                      Data tersimpan dengan status pending dan tetap dapat digunakan di pertandingan Anda.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no matches and query is typed */}
          {!isLoading && canonicalMatches.length === 0 && aliasMatches.length === 0 && similarSuggestions.length === 0 && query && (
            <div className="p-4 text-center text-xs text-zinc-500">
              Belum ada master resmi dengan kata kunci "{query}". Silakan ajukan baru di atas.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
