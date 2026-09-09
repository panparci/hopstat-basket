import React, { useState, useEffect } from 'react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  ChevronRight, 
  Flame, 
  Info, 
  Dumbbell, 
  Target, 
  Sparkles,
  Gauge,
  Clock,
  Video,
  Award
} from 'lucide-react';
import { FundamentalDrill, ScheduledDrillItem } from '../types';

export interface SessionDrillItem {
  drill: FundamentalDrill;
  scheduledItem?: ScheduledDrillItem;
  completed?: boolean;
}

interface VideoLoopDemonstratorProps {
  drill: FundamentalDrill;
  sessionDrills?: SessionDrillItem[];
  initialIndex?: number;
  onClose?: () => void;
  onMarkComplete?: (drillId: string) => void;
  onCompleteSession?: () => void;
  isCompleted?: boolean;
}

export const VideoLoopDemonstrator: React.FC<VideoLoopDemonstratorProps> = ({
  drill: initialDrill,
  sessionDrills,
  initialIndex = 0,
  onClose,
  onMarkComplete,
  onCompleteSession,
  isCompleted = false,
}) => {
  // Construct normalized list of drills for session
  const drillsList: SessionDrillItem[] = sessionDrills && sessionDrills.length > 0
    ? sessionDrills
    : [{ drill: initialDrill, completed: isCompleted }];

  const [currentIndex, setCurrentIndex] = useState<number>(
    initialIndex >= 0 && initialIndex < drillsList.length ? initialIndex : 0
  );

  const [currentSet, setCurrentSet] = useState<number>(1);
  const [completedDrillsMap, setCompletedDrillsMap] = useState<Record<string, boolean>>({});
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showInfoDrawer, setShowInfoDrawer] = useState<boolean>(false);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restTimer, setRestTimer] = useState<number>(60);
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);

  const activeSessionItem = drillsList[currentIndex] || drillsList[0];
  const activeDrill = activeSessionItem.drill;

  // Total segments in progress bar (combines all drills & sets or drills count)
  const totalDrills = drillsList.length;

  // Initialize completed map from props
  useEffect(() => {
    const map: Record<string, boolean> = {};
    drillsList.forEach((item) => {
      if (item.completed) map[item.drill.id] = true;
    });
    setCompletedDrillsMap(map);
  }, [sessionDrills]);

  // Extract YouTube ID safely
  const getYouTubeId = (urlOrId: string) => {
    if (!urlOrId) return '0j3aY_z1Jro';
    if (urlOrId.length === 11) return urlOrId;
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : '0j3aY_z1Jro';
  };

  const videoId = activeDrill.youtubeVideoId || getYouTubeId(activeDrill.youtubeUrl);

  // YouTube Player Config
  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      loop: 1,
      playlist: videoId,
      start: activeDrill.loopStartTimeSec || 0,
      end: activeDrill.loopEndTimeSec || undefined,
    },
  };

  const onReady: YouTubeProps['onReady'] = (event) => {
    setPlayer(event.target);
    event.target.playVideo();
    event.target.setPlaybackRate(playbackRate);
  };

  const handleStateChange: YouTubeProps['onStateChange'] = (event) => {
    // Loop video back when ended
    if (event.data === 0) {
      if (player) {
        player.seekTo(activeDrill.loopStartTimeSec || 0, true);
        player.playVideo();
      }
    }
  };

  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      player.playVideo();
      setIsPlaying(true);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (player) {
      player.setPlaybackRate(rate);
    }
  };

  const restartLoop = () => {
    if (player) {
      player.seekTo(activeDrill.loopStartTimeSec || 0, true);
      player.playVideo();
      setIsPlaying(true);
    }
  };

  // Rest Timer Countdown handling
  useEffect(() => {
    let interval: any = null;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => prev - 1);
      }, 1000);
    } else if (isResting && restTimer <= 0) {
      // Rest finished, move to next drill
      setIsResting(false);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  // Handle advancing to Next Drill or Next Set
  const handleNext = () => {
    // Mark current drill as completed in callback
    if (onMarkComplete) {
      onMarkComplete(activeDrill.id);
    }

    setCompletedDrillsMap((prev) => ({ ...prev, [activeDrill.id]: true }));

    const maxSets = activeSessionItem.scheduledItem?.sets || activeDrill.recommendedSets || 3;

    if (currentSet < maxSets) {
      // Advance to next set of current drill
      setCurrentSet((prev) => prev + 1);
      restartLoop();
    } else {
      // Drill tuntas, advance to next drill in session
      if (currentIndex < drillsList.length - 1) {
        // Trigger short rest before next drill
        setIsResting(true);
        setRestTimer(30); // 30s active rest
        setCurrentIndex((prev) => prev + 1);
        setCurrentSet(1);
      } else {
        // All session drills completed!
        setSessionFinished(true);
        if (onCompleteSession) onCompleteSession();
      }
    }
  };

  const handleSkipRest = () => {
    setIsResting(false);
  };

  // Target Reps text (e.g. "36x" or "15 Reps")
  const targetRepsDisplay = activeSessionItem.scheduledItem?.reps || activeDrill.recommendedReps || "15 Reps";
  const formattedReps = targetRepsDisplay.match(/\d+/)?.[0] ? `${targetRepsDisplay.match(/\d+/)?.[0]}x` : targetRepsDisplay;

  // Next Drill Title Preview
  const nextDrill = currentIndex < drillsList.length - 1 ? drillsList[currentIndex + 1].drill : null;
  const nextPreviewText = isResting
    ? `Selanjutnya: ${nextDrill?.name || 'Selesai'}`
    : currentSet < (activeSessionItem.scheduledItem?.sets || activeDrill.recommendedSets || 3)
    ? `Set Berikutnya (${currentSet + 1}/${activeSessionItem.scheduledItem?.sets || activeDrill.recommendedSets || 3})`
    : nextDrill
    ? `Berikutnya: ${nextDrill.name}`
    : 'Sesi Terakhir • Selesaikan!';

  return (
    <div className="fixed inset-0 z-50 bg-black text-white font-sans overflow-hidden select-none animate-fadeIn flex flex-col justify-between">
      {/* BACKGROUND VIDEO VIEWPORT */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
        <div className="w-full h-full relative">
          <YouTube
            key={`${activeDrill.id}-${currentIndex}`}
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            onStateChange={handleStateChange}
            className="w-full h-full absolute inset-0"
            iframeClassName="w-full h-full object-cover scale-105 pointer-events-none"
          />
        </div>

        {/* Video Dark Overlay Gradients for UI Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />
      </div>

      {/* TOP CONTROL OVERLAY */}
      <div className="relative z-20 flex items-center justify-between p-4 sm:p-6">
        {/* Top Left: Close (X) Button */}
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 shadow-xl cursor-pointer"
          title="Tutup Player Latihan"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Center: Looping Indicator Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-black/60 border border-amber-500/30 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
            VIDEO LOOP ACTIVE • {currentIndex + 1}/{totalDrills} DRILL
          </span>
        </div>

        {/* Top Right Controls (Info / Speed / Camera Mode) */}
        <div className="flex items-center gap-2">
          {/* Speed Toggle Pill */}
          <div className="flex items-center bg-black/50 border border-white/20 backdrop-blur-md rounded-full p-1 text-xs">
            {[0.75, 1.0, 1.25].map((rate) => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                className={`px-2.5 py-1 rounded-full font-mono font-bold text-[11px] transition-all cursor-pointer ${
                  playbackRate === rate
                    ? 'bg-amber-500 text-zinc-950 shadow-md'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Info / Mechanics Drawer Toggle Button */}
          <button
            onClick={() => setShowInfoDrawer(!showInfoDrawer)}
            className={`w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-90 shadow-xl cursor-pointer ${
              showInfoDrawer
                ? 'bg-amber-500 text-zinc-950 border-amber-400'
                : 'bg-black/50 hover:bg-black/80 text-white border-white/20'
            }`}
            title="Info Mekanika & Detail Drill"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* REST TIMER OVERLAY (When Resting Between Drills) */}
      {isResting && (
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="text-center space-y-4 max-w-sm">
            <span className="px-3.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-widest">
              ⏱️ ISTIRAHAT & PEMULIHAN
            </span>
            <div className="text-6xl sm:text-7xl font-black text-white font-mono tracking-tight drop-shadow-2xl">
              {restTimer}s
            </div>
            <p className="text-xs text-zinc-300 font-medium">
              Ambil nafas & minum air. <br />
              <strong className="text-amber-400">Berikutnya: {nextDrill?.name}</strong>
            </p>
            <button
              onClick={handleSkipRest}
              className="px-6 py-3 rounded-2xl bg-amber-500 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-xl hover:bg-amber-400 transition-all cursor-pointer"
            >
              Lewati Istirahat & Lanjut ➔
            </button>
          </div>
        </div>
      )}

      {/* SESSION COMPLETED CONGRATULATIONS OVERLAY */}
      {sessionFinished && (
        <div className="relative z-40 flex-1 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-lg animate-fadeIn text-center">
          <div className="bg-zinc-900 border border-amber-500/40 p-8 rounded-3xl max-w-md space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-amber-500 text-zinc-950 rounded-full flex items-center justify-center mx-auto shadow-xl">
              <Award className="w-10 h-10" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">EXCELLENT WORK!</span>
              <h2 className="text-2xl font-black text-white mt-1">SESI DRILL TUNTAS! 🎉</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Anda telah menyelesaikan seluruh {totalDrills} menu drill dalam sesi latihan ini.
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 grid grid-cols-2 gap-3 text-left">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">DRILLS COMPLETED</span>
                <span className="text-base font-black text-amber-400">{totalDrills} Menu</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">INTENSITY BONUS</span>
                <span className="text-base font-black text-emerald-400">+150 XP 🔥</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all cursor-pointer"
            >
              Selesai & Kembali ke Menu
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM OVERLAID INFORMATION & FREELETICS PROGRESS BAR (Exact match to uploaded image) */}
      {!sessionFinished && !isResting && (
        <div className="relative z-20 p-5 sm:p-8 space-y-3">
          {/* Main Info Row: Large Reps + Drill Title & Equipment */}
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              {/* Large Reps Counter Badge (e.g., 36x) */}
              <div className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none drop-shadow-xl font-mono">
                {formattedReps}
              </div>

              {/* Drill Name & Spec Details Line (e.g. Dumbbell Squats • 2x 2 kg or Mikan Drill • Set 1/3) */}
              <div className="text-base sm:text-2xl font-bold text-white tracking-tight drop-shadow-md flex items-center gap-2">
                <span>{activeDrill.name}</span>
                <span className="text-zinc-400 text-sm font-normal">
                  • {activeDrill.equipment[0] || '1 Basketball'} (Set {currentSet}/{activeSessionItem.scheduledItem?.sets || activeDrill.recommendedSets || 3})
                </span>
              </div>

              {/* Next Exercise Preview */}
              <div className="text-xs sm:text-sm text-zinc-300 font-medium drop-shadow flex items-center gap-1.5 pt-0.5">
                <span className="text-amber-400 font-bold">Lanjut:</span>
                <span>{nextPreviewText}</span>
              </div>
            </div>

            {/* Advance / Next Set Button */}
            <button
              onClick={handleNext}
              className="px-5 py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-2xl active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0 border border-amber-300"
            >
              <span>{currentIndex < drillsList.length - 1 || currentSet < (activeSessionItem.scheduledItem?.sets || activeDrill.recommendedSets || 3) ? 'Set Selesai' : 'Selesai Sesi'}</span>
              <ChevronRight className="w-4 h-4 text-zinc-950" />
            </button>
          </div>

          {/* SEGMENTED PROGRESS BAR AT THE VERY BOTTOM (Freeletics Style) */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 w-full">
              {drillsList.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                const isDone = idx < currentIndex || completedDrillsMap[item.drill.id];

                return (
                  <button
                    key={item.drill.id + idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setCurrentSet(1);
                      setIsResting(false);
                    }}
                    className={`h-2.5 sm:h-3 rounded-full transition-all duration-300 cursor-pointer flex-1 ${
                      isCurrent
                        ? 'bg-sky-400 dark:bg-amber-400 ring-2 ring-sky-300/50 dark:ring-amber-400/50 shadow-lg scale-y-110'
                        : isDone
                        ? 'bg-zinc-100 dark:bg-zinc-200 opacity-90'
                        : 'bg-white/20 dark:bg-white/15 hover:bg-white/40'
                    }`}
                    title={`${idx + 1}. ${item.drill.name}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MECHANICS & DRILL DETAILS DRAWER (Toggled by top Info button) */}
      {showInfoDrawer && (
        <div className="absolute inset-x-0 bottom-0 z-40 bg-zinc-950/95 border-t border-zinc-800 p-6 rounded-t-3xl backdrop-blur-xl space-y-4 max-h-[75vh] overflow-y-auto animate-slideUp">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">PANDUAN DRILL</span>
              <h3 className="text-base font-black text-white">{activeDrill.name}</h3>
            </div>
            <button
              onClick={() => setShowInfoDrawer(false)}
              className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Key Mechanics */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase text-amber-400 block">⚡ Kunci Mekanika Teknik:</span>
            <ul className="space-y-1.5">
              {activeDrill.mechanics.map((mech, idx) => (
                <li key={idx} className="text-xs text-zinc-200 flex items-start gap-2 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{mech}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Muscle Focus & Equipment */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 block uppercase">Fokus Otot</span>
              <span className="text-xs text-amber-300 font-bold">{activeDrill.targetMuscles.join(', ')}</span>
            </div>
            <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 block uppercase">Peralatan</span>
              <span className="text-xs text-zinc-200 font-medium">{activeDrill.equipment.join(', ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
