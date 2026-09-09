import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Play, 
  Edit3, 
  Trash2, 
  Filter, 
  Target, 
  Flame, 
  Layers, 
  Sparkles,
  ExternalLink,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import { FundamentalDrill, DrillCategory, SkillLevel } from '../types';
import { VideoLoopDemonstrator } from './VideoLoopDemonstrator';
import { downloadDrillExcelTemplate, exportDrillsToExcel } from '../services/drillExcelService';

interface DrillLibraryViewProps {
  drills: FundamentalDrill[];
  isAdminOrCoach: boolean;
  onOpenAddModal: () => void;
  onOpenEditModal: (drill: FundamentalDrill) => void;
  onDeleteDrill: (drillId: string) => void;
  onResetDrills?: () => void;
  onOpenUploadExcelModal?: () => void;
}

export const DrillLibraryView: React.FC<DrillLibraryViewProps> = ({
  drills,
  isAdminOrCoach,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteDrill,
  onResetDrills,
  onOpenUploadExcelModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DrillCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<SkillLevel | 'all'>('all');
  const [activeLoopDrill, setActiveLoopDrill] = useState<FundamentalDrill | null>(null);

  const categories: { id: DrillCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Semua Kategori' },
    { id: 'ball_handling', label: 'Ball Handling' },
    { id: 'shooting', label: 'Shooting & Form' },
    { id: 'footwork', label: 'Footwork & Finishing' },
    { id: 'defense', label: 'Defense & Agility' },
    { id: 'passing', label: 'Passing & Vision' },
    { id: 'post_moves', label: 'Post Moves' },
  ];

  const filteredDrills = drills.filter((drill) => {
    const matchesSearch =
      drill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || drill.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || drill.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-white">
      {/* Header & Filter Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            KATALOG & SUSUNAN VIDEO DRILL
          </span>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
            DAFTAR GERAKAN FUNDAMENTAL ({filteredDrills.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Admin/Coach dapat menambah, mengedit, atau menghapus video drill di sini.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={downloadDrillExcelTemplate}
            className="px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer shrink-0"
            title="Download Format File Excel (.xlsx) dengan Contoh URL YouTube"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Format Excel (.xlsx)</span>
          </button>

          {isAdminOrCoach && onOpenUploadExcelModal && (
            <button
              onClick={onOpenUploadExcelModal}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Upload File Excel untuk Mengisi / Menambah Katalog Video Drill"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Katalog Excel</span>
            </button>
          )}

          {isAdminOrCoach && onResetDrills && (
            <button
              onClick={() => {
                if (confirm('Reset ulang daftar video drill ke data standar bawaan?')) {
                  onResetDrills();
                }
              }}
              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-200 dark:border-zinc-700 cursor-pointer shrink-0"
              title="Reset ke Drill Standar Bawaan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Tambah Video</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Category Pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari gerakan fundamental (contoh: Mikan Drill, Cone Dribble, Euro Step)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
          />
        </div>

        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drill Cards Vertical Stack Layout */}
      <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto">
        {filteredDrills.map((drill) => (
          <div
            key={drill.id}
            className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 transition-all duration-300 shadow-md dark:shadow-xl flex flex-col"
          >
            {/* Thumbnail Header with Large Play Button Overlay */}
            <div className="relative h-52 sm:h-64 overflow-hidden bg-black">
              <img
                src={drill.thumbnailUrl || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80'}
                alt={drill.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/30 to-black/20" />

              {/* Category & Difficulty Badges */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2 flex-wrap">
                <span className="bg-amber-500 text-zinc-950 text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg shadow-md">
                  {drill.category.replace('_', ' ')}
                </span>
                <span className="bg-zinc-950/90 text-zinc-200 border border-zinc-700 text-[10px] sm:text-xs font-bold uppercase px-2.5 py-1 rounded-lg backdrop-blur-md">
                  {drill.difficulty}
                </span>
              </div>

              {/* Admin Actions Overlay */}
              {isAdminOrCoach && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditModal(drill);
                    }}
                    className="p-2 bg-zinc-950/80 hover:bg-zinc-800 text-amber-400 rounded-xl backdrop-blur-md border border-zinc-700 transition-colors cursor-pointer"
                    title="Edit Drill"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Hapus drill "${drill.name}"?`)) onDeleteDrill(drill.id);
                    }}
                    className="p-2 bg-zinc-950/80 hover:bg-rose-950 text-rose-400 rounded-xl backdrop-blur-md border border-zinc-700 transition-colors cursor-pointer"
                    title="Hapus Drill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Centered Large Clear Play Button */}
              <button
                onClick={() => setActiveLoopDrill(drill)}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors cursor-pointer p-4 text-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-amber-500/40 border-2 border-amber-300">
                  <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-zinc-950 ml-1" />
                </div>
                <span className="mt-2 text-xs sm:text-sm font-black text-white uppercase tracking-wider bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-lg">
                  Putar Video Loop 🎬
                </span>
              </button>
            </div>

            {/* Drill Information Body */}
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <h3 
                  onClick={() => setActiveLoopDrill(drill)}
                  className="font-black text-lg sm:text-xl text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {drill.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed mt-1.5">
                  {drill.description}
                </p>
              </div>

              {/* Key Mechanics Section */}
              {drill.mechanics && drill.mechanics.length > 0 && (
                <div className="bg-slate-50 dark:bg-zinc-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800/80 space-y-2">
                  <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    ⚡ KUNCI MEKANIKA TEKNIK:
                  </span>
                  <ul className="space-y-1">
                    {drill.mechanics.map((mech, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-zinc-300 flex items-start gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{mech}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer Actions & Target Specifications */}
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Target Latihan:</span>
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-black px-3 py-1 rounded-lg">
                    {drill.recommendedSets} Sets × {drill.recommendedReps}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onOpenEditModal(drill)}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-zinc-700/60"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setActiveLoopDrill(drill)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-zinc-950" />
                    <span>Tonton Loop Video</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDrills.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-sm">
          <Target className="w-10 h-10 text-slate-400 dark:text-zinc-600 mx-auto" />
          <h3 className="font-black text-slate-900 dark:text-white text-base">Tidak Ada Gerakan Ditemukan</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Coba ubah kata kunci pencarian atau pilih kategori lain.
          </p>
        </div>
      )}

      {/* Video Loop Demonstrator Modal */}
      {activeLoopDrill && (
        <VideoLoopDemonstrator
          drill={activeLoopDrill}
          onClose={() => setActiveLoopDrill(null)}
        />
      )}
    </div>
  );
};
