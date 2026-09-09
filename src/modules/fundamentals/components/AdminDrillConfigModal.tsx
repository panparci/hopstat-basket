import React, { useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  Video, 
  Play, 
  Sparkles, 
  Sliders, 
  Clock, 
  RotateCcw,
  Target,
  Dumbbell
} from 'lucide-react';
import { FundamentalDrill, DrillCategory, SkillLevel } from '../types';

interface AdminDrillConfigModalProps {
  drill?: FundamentalDrill | null;
  onClose: () => void;
  onSave: (drill: FundamentalDrill) => Promise<void>;
}

export const AdminDrillConfigModal: React.FC<AdminDrillConfigModalProps> = ({
  drill,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(drill?.name || '');
  const [category, setCategory] = useState<DrillCategory>(drill?.category || 'ball_handling');
  const [difficulty, setDifficulty] = useState<SkillLevel>(drill?.difficulty || 'pemula');
  const [description, setDescription] = useState(drill?.description || '');
  const [youtubeUrl, setYoutubeUrl] = useState(drill?.youtubeUrl || 'https://www.youtube.com/watch?v=0j3aY_z1Jro');
  const [loopStart, setLoopStart] = useState<number>(drill?.loopStartTimeSec || 0);
  const [loopEnd, setLoopEnd] = useState<number | undefined>(drill?.loopEndTimeSec || 45);
  const [sets, setSets] = useState<number>(drill?.recommendedSets || 4);
  const [reps, setReps] = useState(drill?.recommendedReps || '10 Reps per Set');
  const [thumbnailUrl, setThumbnailUrl] = useState(drill?.thumbnailUrl || '');
  const [mechanics, setMechanics] = useState<string[]>(drill?.mechanics || ['Posisi Kaki Tekuk Lutut', 'Pandangan Lurus ke Depan']);
  const [targetMuscles, setTargetMuscles] = useState<string[]>(drill?.targetMuscles || ['Quadriceps', 'Core']);
  const [equipment, setEquipment] = useState<string[]>(drill?.equipment || ['1 Basketball', '4 Cones']);
  
  // Test Video Preview State
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const getYouTubeId = (urlOrId: string) => {
    if (!urlOrId) return '0j3aY_z1Jro';
    if (urlOrId.length === 11) return urlOrId;
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : '0j3aY_z1Jro';
  };

  const videoId = getYouTubeId(youtubeUrl);

  // YouTube Test Player Options
  const testOpts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      loop: 1,
      playlist: videoId,
      start: Number(loopStart) || 0,
      end: loopEnd ? Number(loopEnd) : undefined,
    },
  };

  const handleAddMechanic = () => setMechanics([...mechanics, '']);
  const handleUpdateMechanic = (idx: number, val: string) => {
    const updated = [...mechanics];
    updated[idx] = val;
    setMechanics(updated);
  };
  const handleRemoveMechanic = (idx: number) => setMechanics(mechanics.filter((_, i) => i !== idx));

  // Quick Presets for Admin Convenience
  const applyPreset = (presetType: string) => {
    if (presetType === 'mikan') {
      setName('Mikan Drill Fundamental');
      setCategory('footwork');
      setDifficulty('pemula');
      setYoutubeUrl('https://www.youtube.com/watch?v=0j3aY_z1Jro');
      setLoopStart(10);
      setLoopEnd(50);
      setSets(5);
      setReps('10 Makes per Set');
      setDescription('Latihan dasar finishing di bawah ring untuk melatih sentuhan tangan kanan dan kiri secara berurutan.');
      setMechanics(['Lompat menggunakan 1 kaki yang berlawanan', 'Pelepasan bola menyentuh petak papan ring', 'Tangkap bola langsung tanpa jatuh ke lantai']);
      setEquipment(['1 Basketball', 'Ring Basket']);
      setTargetMuscles(['Grip', 'Wrist', 'Calves']);
    } else if (presetType === 'cone_dribble') {
      setName('Cone Crossover Dribbling');
      setCategory('ball_handling');
      setDifficulty('menengah');
      setYoutubeUrl('https://www.youtube.com/watch?v=4y-51l2i4Q8');
      setLoopStart(5);
      setLoopEnd(45);
      setSets(4);
      setReps('60 Detik per Set');
      setDescription('Drill kelincahan tangan dan kontrol bola melewati rintangan cone secara zig-zag.');
      setMechanics(['Rendahkan pinggul (low stance)', 'Dribble kuat di bawah lutut', 'Dada tegak dan mata menatap ke depan']);
      setEquipment(['1 Basketball', '4 Cones']);
      setTargetMuscles(['Forearms', 'Core', 'Quadriceps']);
    } else if (presetType === 'form_shooting') {
      setName('1-Hand Form Shooting');
      setCategory('shooting');
      setDifficulty('pemula');
      setYoutubeUrl('https://www.youtube.com/watch?v=0j3aY_z1Jro');
      setLoopStart(0);
      setLoopEnd(35);
      setSets(5);
      setReps('10 Swishes');
      setDescription('Memperbaiki mekanisme pelepasan tembakan dari jarak dekat di depan ring hanya menggunakan 1 tangan.');
      setMechanics(['Siku membentuk sudut 90 derajat (L-Shape)', 'Follow-through jari telunjuk dan tengah menunjuk ke ring', 'Tahan bentuk sampai bola masuk']);
      setEquipment(['1 Basketball', 'Ring Basket']);
      setTargetMuscles(['Triceps', 'Shoulders', 'Wrist']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !youtubeUrl.trim()) return;

    setIsSaving(true);
    try {
      const ytId = getYouTubeId(youtubeUrl);
      const newDrill: FundamentalDrill = {
        id: drill?.id || `drill-${Date.now()}`,
        name,
        category,
        difficulty,
        description,
        mechanics: mechanics.filter(m => m.trim().length > 0),
        youtubeUrl,
        youtubeVideoId: ytId,
        loopStartTimeSec: Number(loopStart),
        loopEndTimeSec: loopEnd ? Number(loopEnd) : undefined,
        recommendedSets: Number(sets),
        recommendedReps: reps,
        targetMuscles: targetMuscles.filter(m => m.trim().length > 0),
        equipment: equipment.filter(e => e.trim().length > 0),
        thumbnailUrl: thumbnailUrl || `https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80`,
      };

      await onSave(newDrill);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md font-sans text-slate-900 dark:text-white animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                ADMIN CONTENT MANAGER
              </span>
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white">
                {drill ? 'Edit Konfigurasi Drill' : 'Tambah Video Drill Fundamental Baru'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="mb-5 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Preset Cepat:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('mikan')}
            className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-amber-400 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 transition-all cursor-pointer"
          >
            🏀 Mikan Drill
          </button>
          <button
            type="button"
            onClick={() => applyPreset('cone_dribble')}
            className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-amber-400 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 transition-all cursor-pointer"
          >
            ⚡ Cone Crossover
          </button>
          <button
            type="button"
            onClick={() => applyPreset('form_shooting')}
            className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-amber-400 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 transition-all cursor-pointer"
          >
            🎯 Form Shooting
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Rows */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
              Nama Gerakan / Drill Fundamental *
            </label>
            <input
              type="text"
              placeholder="Contoh: 10 Menit Cone Dribbling"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Kategori Drill</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DrillCategory)}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ball_handling">Ball Handling</option>
                <option value="shooting">Shooting & Form</option>
                <option value="footwork">Footwork & Finishing</option>
                <option value="defense">Defense & Agility</option>
                <option value="passing">Passing & Vision</option>
                <option value="post_moves">Post Moves</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Tingkat Kesulitan</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as SkillLevel)}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="pemula">Pemula</option>
                <option value="menengah">Menengah</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>

          {/* YouTube Video URL & Live Test Preview Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                URL Video Demonstrasi YouTube *
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-amber-500" />
                {showPreview ? 'Sembunyikan Preview' : 'Tes Video Loop Live 🎬'}
              </button>
            </div>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=0j3aY_z1Jro"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              required
              className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Embedded Realtime Player Test */}
          {showPreview && youtubeUrl && (
            <div className="bg-black rounded-2xl overflow-hidden border border-amber-500/40 p-2 space-y-2 animate-fadeIn">
              <div className="h-56 relative rounded-xl overflow-hidden">
                <YouTube
                  videoId={videoId}
                  opts={testOpts}
                  className="w-full h-full"
                  iframeClassName="w-full h-full object-cover"
                />
              </div>
              <p className="text-[10px] text-amber-300 font-mono text-center">
                ▶ Player Uji Coba: Loop Dimulai Detik {loopStart}s s/d {loopEnd || 'Selesai'}s
              </p>
            </div>
          )}

          {/* Loop Start and End Timestamps (Sec) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Detik Mulai Loop (Sec)
              </label>
              <input
                type="number"
                value={loopStart}
                onChange={(e) => setLoopStart(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Detik Selesai Loop (Sec)
              </label>
              <input
                type="number"
                value={loopEnd || ''}
                onChange={(e) => setLoopEnd(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Opsional (misal: 45)"
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Sets & Reps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Rekomendasi Set</label>
              <input
                type="number"
                value={sets}
                onChange={(e) => setSets(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Rekomendasi Repetisi</label>
              <input
                type="text"
                placeholder="10 Reps per Sisi / 60 Detik"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Deskripsi & Instruksi Latihan</label>
            <textarea
              placeholder="Jelaskan cara melakukan gerakan ini secara terstruktur..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              rows={3}
            />
          </div>

          {/* Mechanics Callout Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Point Mekanika Utama (Muncul Saat Video Loop)
              </label>
              <button
                type="button"
                onClick={handleAddMechanic}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Tambah Point
              </button>
            </div>
            <div className="space-y-2">
              {mechanics.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Point Mekanika ${idx + 1}`}
                    value={m}
                    onChange={(e) => handleUpdateMechanic(idx, e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMechanic(idx)}
                    className="p-2 text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
