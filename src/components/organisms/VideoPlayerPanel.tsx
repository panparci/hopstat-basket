import React, {
  useState,
  useEffect,
  useMemo,
  memo,
  useCallback,
  useRef,
} from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import {
  Play,
  Pause,
  FastForward,
  Link as LinkIcon,
  Settings,
  X,
  Check,
  AlertCircle,
  Loader2,
  Layout,
} from "lucide-react";
import { useToast } from "../../core/contexts/ToastContext";

interface VideoPlayerPanelProps {
  onPlay: () => void;
  onPause: () => void;
  videoUrl?: string;
  onSaveVideoUrl?: (url: string) => void;
  initialStartTime?: number;
  overlayPosition?: string;
  onToggleOverlayPosition?: () => void;
  isClockRunning?: boolean;
  clockMode?: string;
  onPlayerReady?: (player: YouTubePlayer) => void;
}

function extractVideoId(url: string) {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([^&?\/#]+)/,
  );
  return match ? match[1] : null;
}

const VideoPlayerPanelComponent: React.FC<VideoPlayerPanelProps> = ({
  onPlay,
  onPause,
  videoUrl,
  onSaveVideoUrl,
  initialStartTime,
  overlayPosition,
  onToggleOverlayPosition,
  isClockRunning,
  clockMode,
  onPlayerReady,
}) => {
  const { showToast } = useToast();
  const [url, setUrl] = useState(videoUrl || "");
  const [tempUrl, setTempUrl] = useState(videoUrl || "");
  const [videoId, setVideoId] = useState<string | null>(
    videoUrl ? extractVideoId(videoUrl) : null,
  );

  // Sync prop changes when videoUrl changes asynchronously or on match load
  useEffect(() => {
    if (videoUrl !== undefined) {
      setUrl(videoUrl || "");
      setTempUrl(videoUrl || "");
      setVideoId(videoUrl ? extractVideoId(videoUrl) : null);
    }
  }, [videoUrl]);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [speed, setSpeed] = useState(1);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSeekedInitialRef = useRef(false);

  // Helper to safely check if the player instance is ready, mounted in the DOM, and has a valid iframe source
  const isPlayerAvailable = useCallback(
    (p: YouTubePlayer | null): p is YouTubePlayer => {
      if (!p) return false;
      try {
        if (typeof p.getIframe !== "function") return false;
        const iframe = p.getIframe();
        return !!(iframe && iframe.parentNode && iframe.src);
      } catch {
        return false;
      }
    },
    [],
  );

  // Reset seek state and clear stale player reference if videoId changes
  useEffect(() => {
    hasSeekedInitialRef.current = false;
    setPlayer(null);
  }, [videoId]);

  // Resilient seek-and-play when player is ready and initialStartTime is provided
  useEffect(() => {
    if (
      isPlayerAvailable(player) &&
      initialStartTime !== undefined &&
      !hasSeekedInitialRef.current
    ) {
      try {
        player.seekTo(initialStartTime, true);
        player.playVideo();
        hasSeekedInitialRef.current = true;
      } catch (e) {
        console.warn("Failed initial seek in useEffect:", e);
      }
    }
  }, [player, initialStartTime, isPlayerAvailable]);

  const handleLoad = () => {
    const id = extractVideoId(tempUrl);
    if (id) {
      setVideoId(id);
      setUrl(tempUrl);
      if (onSaveVideoUrl) {
        onSaveVideoUrl(tempUrl);
      }
      setIsModalOpen(false);
    } else {
      showToast("Link YouTube tidak valid", "error");
    }
  };

  const handleReady = (event: YouTubeEvent) => {
    const activePlayer = event.target;
    setPlayer(activePlayer);
    if (onPlayerReady) {
      onPlayerReady(activePlayer);
    }

    // Immediate seek in handleReady is highly resilient because the event target is guaranteed to be ready
    if (initialStartTime !== undefined && !hasSeekedInitialRef.current) {
      try {
        activePlayer.seekTo(initialStartTime, true);
        activePlayer.playVideo();
        hasSeekedInitialRef.current = true;
      } catch (e) {
        console.warn("Failed initial seek in handleReady:", e);
      }
    }

    try {
      const data = activePlayer.getVideoData();
      if (data && data.title) {
        setVideoTitle(data.title);
      }
    } catch (e) {
      console.warn("Failed to get video title:", e);
    }
  };

  const handleStateChange = (event: YouTubeEvent) => {
    // 1 = playing, 2 = paused, 3 = buffering
    if (event.data === 1) {
      onPlay();
      window.dispatchEvent(
        new CustomEvent("youtube-playing-state", { detail: { playing: true } })
      );
    } else if (event.data === 2) {
      onPause();
      window.dispatchEvent(
        new CustomEvent("youtube-playing-state", { detail: { playing: false } })
      );
    }
  };

  const changeSpeed = (newSpeed: number) => {
    if (isPlayerAvailable(player)) {
      try {
        player.setPlaybackRate(newSpeed);
        setSpeed(newSpeed);
      } catch (e) {
        console.warn("Failed to change speed:", e);
      }
    }
  };

  useEffect(() => {
    if (!isPlayerAvailable(player)) return;

    const handleTogglePlay = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        const state = player.getPlayerState();
        if (state === 1) {
          // playing
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      } catch (e) {
        console.warn("Failed to toggle play:", e);
      }
    };

    const handlePause = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        player.pauseVideo();
      } catch (e) {
        console.warn("Failed to pause:", e);
      }
    };

    const handlePlay = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        player.playVideo();
      } catch (e) {
        console.warn("Failed to play:", e);
      }
    };

    const handleMute = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        player.mute();
      } catch (e) {
        console.warn("Failed to mute:", e);
      }
    };

    const handleUnmute = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        player.unMute();
      } catch (e) {
        console.warn("Failed to unmute:", e);
      }
    };

    const handleSeek = (event: CustomEvent) => {
      if (!isPlayerAvailable(player)) return;
      if (typeof event.detail === "number") {
        try {
          player.seekTo(event.detail, true);
          player.playVideo();
        } catch (e) {
          console.warn("Failed to seek:", e);
        }
      }
    };

    const handleRelativeSeek = (event: CustomEvent) => {
      if (!isPlayerAvailable(player)) return;
      if (typeof event.detail === "number") {
        try {
          const currentTime = player.getCurrentTime();
          player.seekTo(currentTime + event.detail, true);
          player.pauseVideo();
        } catch (e) {
          console.warn("Failed to relative seek:", e);
        }
      }
    };

    const handleGetTime = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        const currentTime = player.getCurrentTime();
        window.dispatchEvent(
          new CustomEvent("youtube-time-report", { detail: currentTime }),
        );
      } catch (e) {
        console.warn("Failed to get time:", e);
      }
    };

    const handleGetPlayingState = () => {
      if (!isPlayerAvailable(player)) return;
      try {
        const state = player.getPlayerState();
        window.dispatchEvent(
          new CustomEvent("youtube-playing-state", { detail: { playing: state === 1 } })
        );
      } catch (e) {
        console.warn("Failed to get playing state:", e);
      }
    };

    let loopInterval: any = null;
    const handleStartLoop = (event: CustomEvent) => {
      if (!isPlayerAvailable(player)) return;
      if (event.detail) {
        const { start, end } = event.detail;
        try {
          player.seekTo(start, true);
          player.playVideo();
        } catch (e) {
          console.warn("Failed to start loop:", e);
        }

        if (loopInterval) clearInterval(loopInterval);
        loopInterval = setInterval(() => {
          if (!isPlayerAvailable(player)) {
            if (loopInterval) {
              clearInterval(loopInterval);
              loopInterval = null;
            }
            return;
          }
          try {
            if (player.getCurrentTime() >= end) {
              player.seekTo(start, true);
            }
          } catch (e) {
            console.warn("Failed during loop check:", e);
            if (loopInterval) {
              clearInterval(loopInterval);
              loopInterval = null;
            }
          }
        }, 500);
      }
    };

    const handleStopLoop = () => {
      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }
    };

    let peekTimeout: any = null;
    const handlePeekForward = (event: CustomEvent) => {
      if (!isPlayerAvailable(player)) return;

      const secondsToPeek = event.detail || 5;
      if (peekTimeout) {
        clearTimeout(peekTimeout);
      }

      try {
        const currentPos = player.getCurrentTime();
        player.playVideo();

        peekTimeout = setTimeout(() => {
          if (isPlayerAvailable(player)) {
            player.pauseVideo();
            player.seekTo(currentPos, true);
          }
          peekTimeout = null;
        }, secondsToPeek * 1000);
      } catch (e) {
        console.warn("Failed to peek forward:", e);
      }
    };

    const handlePlayDuration = (event: CustomEvent) => {
      if (!isPlayerAvailable(player)) return;

      const secondsToPlay = event.detail || 5;
      if (peekTimeout) {
        clearTimeout(peekTimeout);
      }

      try {
        player.playVideo();

        peekTimeout = setTimeout(() => {
          if (isPlayerAvailable(player)) {
            player.pauseVideo();
          }
          peekTimeout = null;
        }, secondsToPlay * 1000);
      } catch (e) {
        console.warn("Failed to play duration:", e);
      }
    };

    window.addEventListener("toggle-youtube-play", handleTogglePlay);
    window.addEventListener("pause-youtube", handlePause);
    window.addEventListener("play-youtube", handlePlay);
    window.addEventListener("mute-youtube", handleMute);
    window.addEventListener("unmute-youtube", handleUnmute);
    window.addEventListener("seek-youtube", handleSeek as EventListener);
    window.addEventListener(
      "seek-relative-youtube",
      handleRelativeSeek as EventListener,
    );
    window.addEventListener("get-youtube-time", handleGetTime);
    window.addEventListener("get-youtube-playing-state", handleGetPlayingState);
    window.addEventListener(
      "start-loop-youtube",
      handleStartLoop as EventListener,
    );
    window.addEventListener("stop-loop-youtube", handleStopLoop);
    window.addEventListener(
      "youtube-peek-forward",
      handlePeekForward as EventListener,
    );
    window.addEventListener(
      "youtube-play-duration",
      handlePlayDuration as EventListener,
    );

    return () => {
      window.removeEventListener("toggle-youtube-play", handleTogglePlay);
      window.removeEventListener("pause-youtube", handlePause);
      window.removeEventListener("play-youtube", handlePlay);
      window.removeEventListener("mute-youtube", handleMute);
      window.removeEventListener("unmute-youtube", handleUnmute);
      window.removeEventListener("seek-youtube", handleSeek as EventListener);
      window.removeEventListener(
        "seek-relative-youtube",
        handleRelativeSeek as EventListener,
      );
      window.removeEventListener("get-youtube-time", handleGetTime);
      window.removeEventListener("get-youtube-playing-state", handleGetPlayingState);
      window.removeEventListener(
        "start-loop-youtube",
        handleStartLoop as EventListener,
      );
      window.removeEventListener("stop-loop-youtube", handleStopLoop);
      window.removeEventListener(
        "youtube-peek-forward",
        handlePeekForward as EventListener,
      );
      window.removeEventListener(
        "youtube-play-duration",
        handlePlayDuration as EventListener,
      );
      if (loopInterval) clearInterval(loopInterval);
      if (peekTimeout) clearTimeout(peekTimeout);
    };
  }, [player, isPlayerAvailable]);

  const youtubeOpts = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
    }),
    [],
  );

  // Memoize the YouTube component to prevent re-renders unless videoId changes
  const youtubePlayer = useMemo(() => {
    if (!videoId) return null;
    return (
      <YouTube
        videoId={videoId}
        onReady={handleReady}
        onStateChange={handleStateChange}
        opts={youtubeOpts}
        className="absolute inset-0 w-full h-full"
      />
    );
  }, [videoId, youtubeOpts]); // Only re-render if videoId or opts change

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Header with Title and Settings */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">
            Video Analysis
          </h2>
          {videoTitle ? (
            <h3 className="text-sm font-display font-black italic uppercase tracking-tight text-brand-navy dark:text-brand-orange truncate">
              {videoTitle}
            </h3>
          ) : (
            <h3 className="text-sm font-medium text-zinc-400 italic">
              No video loaded
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleOverlayPosition && (
            <button
              onClick={onToggleOverlayPosition}
              className="p-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 border border-zinc-200 dark:border-zinc-800"
              title="Change Overlay Position"
            >
              <Layout size={16} />
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 border border-zinc-200 dark:border-zinc-800"
            title="Change YouTube Link"
          >
            <Settings size={16} />
            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">
              Set Link
            </span>
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div
        className="flex-1 bg-black relative overflow-hidden"
        ref={containerRef}
      >
        {videoId ? (
          <>
            {youtubePlayer}
            {clockMode === "stop" && isClockRunning === false && (
              <div className="absolute top-4 left-4 z-30 pointer-events-none select-none flex items-center gap-2">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/65 border border-red-500/40 text-red-400 font-mono text-[11px] font-black uppercase tracking-widest backdrop-blur-md shadow-2xl transition-all duration-300">
                  <div className="relative w-5 h-5 flex items-center justify-center bg-red-500/10 rounded-lg">
                    <svg className="w-3.5 h-3.5 animate-pulse text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] text-red-500 font-black tracking-widest">CLOCK STOPPED</span>
                    <span className="text-[8px] text-zinc-300 font-medium">Video is running, clock is stopped</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-600">
            <Play size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">
              Klik "Set Link" untuk memuat video
            </p>
          </div>
        )}
      </div>

      {/* Footer with Side-by-Side Controls */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          {/* Playback Speed */}
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Speed
            </span>
            <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-2 py-1 rounded-md text-xs font-black transition-all ${
                    speed === s
                      ? "bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm"
                      : "text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />

          {/* Shortcuts Guide */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Shortcuts
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 overflow-hidden">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  Space
                </kbd>{" "}
                Play/Pause Both
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  1
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  2
                </kbd>{" "}
                Both -5/-1s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  5
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  6
                </kbd>{" "}
                Both +1/+5s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  D
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  F
                </kbd>{" "}
                YT Stop/Play
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  E
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  R
                </kbd>{" "}
                Timer Stop/Play
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  3
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  4
                </kbd>{" "}
                Both Stop/Play
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  Q
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  W
                </kbd>{" "}
                Timer -3/-1s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  T
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  Y
                </kbd>{" "}
                Timer +1/+3s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  A
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  S
                </kbd>{" "}
                YT -3/-1s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  G
                </kbd>
                /
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  H
                </kbd>{" "}
                YT +1/+3s
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-xs">
                  Bksp
                </kbd>{" "}
                Hapus Digit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* YouTube Link Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <LinkIcon
                    className="text-red-600 dark:text-red-400"
                    size={20}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-display font-black italic uppercase tracking-tight text-[#1A1A1A] dark:text-white">
                    Set Video Link
                  </h2>
                  <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">
                    YouTube URL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-[#1A1A1A] dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <LinkIcon
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="Paste YouTube Link..."
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLoad}
                  className="flex-[2] py-3 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg text-sm"
                >
                  Load Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VideoPlayerPanel = memo(VideoPlayerPanelComponent);
