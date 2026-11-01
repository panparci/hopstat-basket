import React, { useState } from 'react';
import { GitMerge, Star, AlertTriangle, ArrowRight, Check, Edit2, ShieldAlert, Tag, Building2, Trophy, Users } from 'lucide-react';
import { DuplicateCandidatePair } from '../model/types';
import { GoldenRecordBadge } from './GoldenRecordBadge';

interface DuplicateCardProps {
  pair: DuplicateCandidatePair;
  onMerge: (pair: DuplicateCandidatePair) => void;
  onPromoteSeparate: (pair: DuplicateCandidatePair) => void;
  onEditAndPromote: (pair: DuplicateCandidatePair, newName: string) => void;
}

export const DuplicateCard: React.FC<DuplicateCardProps> = ({
  pair,
  onMerge,
  onPromoteSeparate,
  onEditAndPromote
}) => {
  const { sourceItem, canonicalTarget, similarityScore, matchReasons } = pair;
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(sourceItem.name);

  // Score badge coloring
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40';
    if (score >= 75) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40';
    return 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/40';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all p-5 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${getScoreColor(similarityScore)}`}>
            {similarityScore}% Kemiripan
          </span>
          <div className="flex flex-wrap gap-1.5">
            {matchReasons.map((reason, idx) => (
              <span 
                key={idx}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
        <span className="text-[11px] text-zinc-400 font-medium">
          ID: {sourceItem.id} ↔ {canonicalTarget.id}
        </span>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        
        {/* Left: Source Record (Duplikat / Usulan Baru) */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
              Data Usulan / Kandidat Duplikat
            </span>
            <GoldenRecordBadge status={sourceItem.status} size="sm" />
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-sm font-bold text-zinc-900 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onEditAndPromote(pair, editedName);
                    setIsEditing(false);
                  }}
                  className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold"
                >
                  Simpan & Sahkan
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                {sourceItem.name}
              </h4>
              <div className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {sourceItem.city && <div>📍 Kota: <strong>{sourceItem.city}</strong></div>}
                {sourceItem.ageGroup && <div>🏀 Kategori: <strong>{sourceItem.ageGroup}</strong></div>}
                <div>📊 Transaksi Terkait: <strong>{sourceItem.transactionCount} pertandingan</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Canonical Golden Record (Target) */}
        <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
              Master Resmi (Golden Record)
            </span>
            <GoldenRecordBadge status="canonical" size="sm" />
          </div>

          <div>
            <h4 className="text-base font-extrabold text-zinc-900 dark:text-white leading-tight">
              {canonicalTarget.name}
            </h4>
            <div className="mt-2 space-y-1 text-xs text-amber-900/80 dark:text-amber-300/80">
              {canonicalTarget.city && <div>📍 Kota: <strong>{canonicalTarget.city}</strong></div>}
              {canonicalTarget.ageGroup && <div>🏀 Kategori: <strong>{canonicalTarget.ageGroup}</strong></div>}
              <div>📊 Transaksi Terkait: <strong>{canonicalTarget.transactionCount} pertandingan</strong></div>
              {canonicalTarget.aliases.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-amber-200/50 dark:border-amber-800/30">
                  <Tag className="w-3 h-3 text-amber-600" />
                  <span className="text-[10px] font-bold">Alias Resmi:</span>
                  {canonicalTarget.aliases.map((al, aIdx) => (
                    <span key={aIdx} className="text-[10px] bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40">
                      {al}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="text-xs text-zinc-400">
          Tindakan ini akan mengarahkan semua transaksi data ke Golden Record dan menyimpan nama lama sebagai alias.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Nama</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onPromoteSeparate(pair)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5"
            title="Sahkan sebagai entitas terpisah jika keduanya memang objek yang berbeda"
          >
            <Star className="w-3.5 h-3.5 text-zinc-500" />
            <span>Sahkan Terpisah (Bukan Duplikat)</span>
          </button>

          <button
            type="button"
            onClick={() => onMerge(pair)}
            className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <GitMerge className="w-4 h-4" />
            <span>Gabungkan (Merge into Golden)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
