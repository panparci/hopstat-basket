import React, { useState } from 'react';
import { Sparkles, X, Check, Loader2, Shield, Target, MapPin, Award } from 'lucide-react';
import { PlayingPosition, SkillLevel, FacilityAccess, AthleteProfile } from '../types';

interface AIScheduleGeneratorModalProps {
  onClose: () => void;
  onGenerate: (position: PlayingPosition, skillLevel: SkillLevel, facility: FacilityAccess, goalDays: number) => Promise<void>;
  currentProfile: AthleteProfile | null;
}

export const AIScheduleGeneratorModal: React.FC<AIScheduleGeneratorModalProps> = ({
  onClose,
  onGenerate,
  currentProfile,
}) => {
  const [position, setPosition] = useState<PlayingPosition>(currentProfile?.position || 'PG');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(currentProfile?.skillLevel || 'menengah');
  const [facility, setFacility] = useState<FacilityAccess>(currentProfile?.facilityAccess || 'half_court');
  const [goalDays, setGoalDays] = useState<number>(currentProfile?.weeklyGoalDays || 4);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await onGenerate(position, skillLevel, facility, goalDays);
      onClose();
    } catch (err) {
      console.error('Error generating AI schedule:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const positions: { id: PlayingPosition; label: string; desc: string }[] = [
    { id: 'PG', label: 'POINT GUARD', desc: 'Ball handling, Passing & Vision' },
    { id: 'SG', label: 'SHOOTING GUARD', desc: 'Perimeter Shooting & Catch & Shoot' },
    { id: 'SF', label: 'SMALL FORWARD', desc: 'Drive & Kick, Defense & Versatility' },
    { id: 'PF', label: 'POWER FORWARD', desc: 'Mid-range, Rebounding & Post Moves' },
    { id: 'C', label: 'CENTER', desc: 'Rim Protection & Post Dominance' },
  ];

  const skillLevels: { id: SkillLevel; label: string; bars: number }[] = [
    { id: 'pemula', label: 'PEMULA', bars: 1 },
    { id: 'menengah', label: 'MENENGAH', bars: 2 },
    { id: 'pro', label: 'PRO', bars: 3 },
  ];

  const facilities: { id: FacilityAccess; label: string; icon: string }[] = [
    { id: 'full_court', label: 'FULL COURT', icon: '🏟️' },
    { id: 'half_court', label: 'HALF COURT', icon: '🏀' },
    { id: 'tanpa_ring', label: 'TANPA RING', icon: '🚫' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans text-white animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <Sparkles className="w-6 h-6 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">
                AI SMART WORKOUT COACH
              </h2>
              <p className="text-xs text-zinc-400">
                Personalisasi jadwal program latihan fundamental dari AI berdasarkan posisi & fasilitas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Playing Position Selection (Matching Wireframe Image) */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] flex items-center justify-center font-black">
                01
              </span>
              PILIH POSISI BERMAIN
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {positions.map((pos) => (
                <button
                  type="button"
                  key={pos.id}
                  onClick={() => setPosition(pos.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    position === pos.id
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase text-white">{pos.label}</span>
                    {position === pos.id && <Check className="w-4 h-4 text-amber-400 stroke-[3]" />}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-2 line-clamp-1">{pos.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Skill Level Selection */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] flex items-center justify-center font-black">
                02
              </span>
              TINGKAT KEMAMPUAN
            </label>

            <div className="grid grid-cols-3 gap-3">
              {skillLevels.map((lvl) => (
                <button
                  type="button"
                  key={lvl.id}
                  onClick={() => setSkillLevel(lvl.id)}
                  className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    skillLevel === lvl.id
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xs font-black uppercase block">{lvl.label}</span>
                  <div className="flex justify-center gap-1 mt-2">
                    {[1, 2, 3].map((b) => (
                      <span
                        key={b}
                        className={`w-3 h-1.5 rounded-full ${
                          b <= lvl.bars ? 'bg-amber-500' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Facility Access */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] flex items-center justify-center font-black">
                03
              </span>
              AKSES FASILITAS
            </label>

            <div className="grid grid-cols-3 gap-3">
              {facilities.map((fac) => (
                <button
                  type="button"
                  key={fac.id}
                  onClick={() => setFacility(fac.id)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    facility === fac.id
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xl">{fac.icon}</span>
                  <span className="text-[11px] font-black uppercase">{fac.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Weekly Goal Days */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] flex items-center justify-center font-black">
                04
              </span>
              TARGET HARI LATIHAN PER MINGGU
            </label>

            <div className="flex items-center gap-2">
              {[3, 4, 5, 6].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setGoalDays(num)}
                  className={`flex-1 py-3 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                    goalDays === num
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {num} HARI / MINGGU
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Gemini AI Sedang Menyusun...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-zinc-950" />
                  <span>Generate AI Workout Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
