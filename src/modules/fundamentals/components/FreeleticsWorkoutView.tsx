import React, { useState } from 'react';
import { 
  Play, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Sparkles, 
  Clock, 
  Zap
} from 'lucide-react';
import { FundamentalDrill, WorkoutScheduleDay, ScheduledDrillItem, AthleteProfile } from '../types';
import { VideoLoopDemonstrator, SessionDrillItem } from './VideoLoopDemonstrator';

interface FreeleticsWorkoutViewProps {
  schedule: WorkoutScheduleDay[];
  drillsLibrary: FundamentalDrill[];
  profile: AthleteProfile | null;
  onOpenAIScheduleModal: () => void;
  onToggleDrillCompletion: (dayId: string, drillId: string) => void;
}

export const FreeleticsWorkoutView: React.FC<FreeleticsWorkoutViewProps> = ({
  schedule,
  drillsLibrary,
  profile,
  onOpenAIScheduleModal,
  onToggleDrillCompletion,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [activeLoopDrill, setActiveLoopDrill] = useState<FundamentalDrill | null>(null);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0);

  const currentDaySchedule = schedule.find(s => s.dayIndex === selectedDayIndex) || schedule[0];

  // Calculate overall progress across schedule
  const totalDrillsInWeek = schedule.reduce((sum, day) => sum + (day.drills?.length || 0), 0);
  const completedDrillsInWeek = schedule.reduce(
    (sum, day) => sum + (day.drills?.filter(d => d.completed).length || 0),
    0
  );
  const progressPercent = totalDrillsInWeek > 0 ? Math.round((completedDrillsInWeek / totalDrillsInWeek) * 100) : 0;

  // Find drill details by ID
  const getDrillDetails = (drillId: string): FundamentalDrill | undefined => {
    return drillsLibrary.find(d => d.id === drillId);
  };

  // Build structured list of drills in the active day session
  const currentSessionDrills: SessionDrillItem[] = currentDaySchedule?.drills
    ? currentDaySchedule.drills
        .map((item): SessionDrillItem | null => {
          const detail = getDrillDetails(item.drillId);
          if (!detail) return null;
          return {
            drill: detail,
            scheduledItem: item,
            completed: !!item.completed,
          };
        })
        .filter((x): x is SessionDrillItem => x !== null)
    : [];

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-white">
      {/* Freeletics Header Banner - High-contrast Athletic Style */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-gradient-to-br dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 shadow-sm dark:shadow-2xl">
        {/* Background Decorative Accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-zinc-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                PROGRAM LATIHAN FUNDAMENTAL
              </span>
              {profile && (
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold border-l border-slate-200 dark:border-zinc-700 pl-2">
                  {profile.position} • {profile.skillLevel.toUpperCase()}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              SESI HARI INI: <span className="text-amber-600 dark:text-amber-400">APA FOKUSMU HARI INI?</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-xl leading-relaxed">
              Program latihan fundamental bola basket dengan video demonstrasi looping berkecepatan tinggi.
            </p>
          </div>

          {/* AI Schedule Generator CTA */}
          <button
            onClick={onOpenAIScheduleModal}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
            <span>{schedule.length > 0 ? 'Generasi Ulang AI Schedule' : 'Buat AI Schedule Latihan'}</span>
          </button>
        </div>

        {/* Status Progres Bar */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl font-black">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">STATUS PROGRES MINGGU INI</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">{progressPercent}%</div>
              <div className="w-24 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl font-black">
              <Flame className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">STATUS STREAK</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">5 Hari Streak 🔥</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">Konsistensi Terjaga</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-xl font-black">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">ESTIMASI DURASI SESI</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {currentDaySchedule?.estimatedMinutes || 45} MENIT
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">Intensitas Menengah</span>
            </div>
          </div>
        </div>
      </div>

      {/* Days of Week Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
          const dayData = schedule.find(s => s.dayIndex === dayNum);
          const isSelected = selectedDayIndex === dayNum;
          const isRest = dayData?.isRestDay;
          const isCompleted = dayData?.drills?.length ? dayData.drills.every(d => d.completed) : false;

          return (
            <button
              key={dayNum}
              onClick={() => setSelectedDayIndex(dayNum)}
              className={`px-4 py-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center shrink-0 min-w-[90px] cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md scale-105'
                  : isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                  : isRest
                  ? 'bg-slate-100 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-amber-400'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">HARI {dayNum}</span>
              <span className="text-sm mt-0.5">
                {isRest ? 'Rest' : isCompleted ? '✓ Done' : `Sesi ${dayNum}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Workout Menu Section */}
      {currentDaySchedule ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                FOKUS: {currentDaySchedule.focusArea}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {currentDaySchedule.dayTitle}
              </h2>
            </div>
            {currentDaySchedule.isRestDay ? (
              <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-full border border-slate-200 dark:border-zinc-700">
                🛌 Rest & Active Recovery Day
              </span>
            ) : (
              <button
                onClick={() => {
                  if (currentSessionDrills.length > 0) {
                    setActiveSessionIndex(0);
                    setActiveLoopDrill(currentSessionDrills[0].drill);
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-zinc-950" />
                <span>Mulai Latihan Sekarang</span>
              </button>
            )}
          </div>

          {/* Drill Exercise Cards */}
          {currentDaySchedule.isRestDay ? (
            <div className="p-8 text-center bg-white dark:bg-zinc-900/40 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-sm">
              <span className="text-4xl">🧘‍♂️</span>
              <h3 className="font-black text-slate-900 dark:text-white text-base">Hari Istirahat & Pemulihan Aktif</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
                Istirahat yang cukup sangat penting untuk pertumbuhan otot dan regenerasi sendi. Lakukan peregangan ringan (stretching) dan hindari latihan berat hari ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 px-1">
                MENU DRILLS HARIAN ANDA ({currentDaySchedule.drills?.length || 0} DRILLS)
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {currentDaySchedule.drills?.map((item, idx) => {
                  const detail = getDrillDetails(item.drillId);
                  if (!detail) return null;

                  return (
                    <div
                      key={idx}
                      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-sm ${
                        item.completed
                          ? 'bg-slate-100/80 dark:bg-zinc-950/60 border-emerald-500/30 opacity-80'
                          : 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Circular Exercise Image + Info */}
                        <div className="flex items-center gap-4">
                          {/* Circular Thumbnail */}
                          <div 
                            onClick={() => {
                              setActiveSessionIndex(idx);
                              setActiveLoopDrill(detail);
                            }}
                            className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/40 shrink-0 cursor-pointer group-hover:scale-105 transition-transform shadow-md"
                          >
                            <img
                              src={detail.thumbnailUrl || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80'}
                              alt={detail.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                            </div>
                          </div>

                          {/* Exercise Name & Details */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                {detail.category.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase">
                                {detail.difficulty}
                              </span>
                            </div>
                            <h4 
                              onClick={() => {
                                setActiveSessionIndex(idx);
                                setActiveLoopDrill(detail);
                              }}
                              className="font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors cursor-pointer"
                            >
                              {detail.name}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-1">
                              {item.notes || detail.description}
                            </p>
                          </div>
                        </div>

                        {/* Sets & Reps Count + Action Toggle */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-zinc-800">
                          <div className="text-right">
                            <div className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              {item.sets} SETS
                            </div>
                            <div className="text-xs text-slate-600 dark:text-zinc-400 font-mono">
                              {item.reps}
                            </div>
                          </div>

                          {/* Watch Loop Demo Button */}
                          <button
                            onClick={() => {
                              setActiveSessionIndex(idx);
                              setActiveLoopDrill(detail);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700"
                          >
                            <Play className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
                            <span className="hidden md:inline">Tonton Loop</span>
                          </button>

                          {/* Completion Checkbox Toggle */}
                          <button
                            onClick={() => onToggleDrillCompletion(currentDaySchedule.id, item.drillId)}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              item.completed
                                ? 'bg-emerald-500 text-zinc-950 font-black'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                            }`}
                            title={item.completed ? 'Batalkan Selesai' : 'Tandai Selesai'}
                          >
                            {item.completed ? (
                              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-3xl space-y-4 shadow-sm">
          <Sparkles className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-black text-slate-900 dark:text-white text-lg">Belum Ada Schedule Latihan</h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
            Klik tombol di bawah untuk meminta AI Coach membuatkan jadwal latihan mingguan yang disesuaikan dengan posisi dan target Anda.
          </p>
          <button
            onClick={onOpenAIScheduleModal}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
            <span>Buat AI Schedule Sekarang</span>
          </button>
        </div>
      )}

      {/* Video Looping Demonstrator Modal */}
      {activeLoopDrill && (
        <VideoLoopDemonstrator
          drill={activeLoopDrill}
          sessionDrills={currentSessionDrills.length > 0 ? currentSessionDrills : undefined}
          initialIndex={activeSessionIndex}
          onClose={() => setActiveLoopDrill(null)}
          isCompleted={currentDaySchedule?.drills?.find(d => d.drillId === activeLoopDrill.id)?.completed}
          onMarkComplete={(drillId) => {
            if (currentDaySchedule) {
              onToggleDrillCompletion(currentDaySchedule.id, drillId);
            }
          }}
        />
      )}
    </div>
  );
};
