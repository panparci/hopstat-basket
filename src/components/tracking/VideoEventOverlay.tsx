import React, { useMemo } from 'react';
import { GameEvent, MatchRoster } from '../../core/types/stats';
import { 
  Play, 
  Target, 
  XCircle, 
  RefreshCcw, 
  Share2, 
  ShieldAlert, 
  Flag,
  RotateCcw,
  Hand,
  Clock
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface VideoEventOverlayProps {
  events: GameEvent[];
  currentYoutubeTime: number;
  matchRosters: MatchRoster[];
  homeTeamId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  ourHomeAway?: 'home' | 'away';
  ourColor?: string;
  theirColor?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const getEventDisplay = (type: string) => {
  if (type.includes('make')) return { icon: Target, label: type.replace('_', ' ').toUpperCase(), iconColor: 'text-emerald-400' };
  if (type.includes('miss')) return { icon: XCircle, label: type.replace('_', ' ').toUpperCase(), iconColor: 'text-red-400' };
  if (type.includes('reb')) return { icon: RefreshCcw, label: 'REBOUND', iconColor: 'text-blue-400' };
  if (type === 'ast') return { icon: Share2, label: 'ASSIST', iconColor: 'text-yellow-400' };
  if (type === 'to') return { icon: RotateCcw, label: 'TURNOVER', iconColor: 'text-orange-400' };
  if (type === 'stl') return { icon: Hand, label: 'STEAL', iconColor: 'text-emerald-400' };
  if (type === 'blk') return { icon: ShieldAlert, label: 'BLOCK', iconColor: 'text-red-400' };
  if (type.includes('foul')) return { icon: Flag, label: type.replace('_', ' ').toUpperCase(), iconColor: 'text-yellow-500' };
  return { icon: Play, label: type.replace('_', ' ').toUpperCase(), iconColor: 'text-zinc-400' };
};

const formatTime = (seconds: number) => {
  if (seconds === undefined || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const VideoEventOverlay: React.FC<VideoEventOverlayProps> = ({ 
  events, 
  currentYoutubeTime,
  matchRosters,
  homeTeamId,
  homeTeamName = 'Tim Kita',
  awayTeamName = 'Tim Lawan',
  ourHomeAway = 'home',
  ourColor = 'var(--color-brand-navy)',
  theirColor = '#E11D48',
  position = 'bottom-left'
}) => {
  const ourTeamName = ourHomeAway === 'away' ? awayTeamName : homeTeamName;
  const opponentTeamName = ourHomeAway === 'away' ? homeTeamName : awayTeamName;

  // Show events that occurred within the last 5 seconds of video time
  const visibleEvents = useMemo(() => {
    if (currentYoutubeTime <= 0) return [];
    
    return events
      .filter(e => e.youtubeTimestamp !== undefined && e.youtubeTimestamp > 0)
      .filter(e => {
        const diff = currentYoutubeTime - e.youtubeTimestamp!;
        return diff >= 0 && diff <= 5;
      })
      .slice(-3); // at most 3 events
  }, [events, currentYoutubeTime]);

  // Position styles
  const positionClasses = {
    'top-left': 'top-4 left-4 items-start',
    'top-right': 'top-4 right-4 items-end',
    'bottom-left': 'bottom-16 left-4 items-start',
    'bottom-right': 'bottom-16 right-4 items-end'
  }[position];

  return (
    <div className={`absolute z-[60] flex flex-col gap-2 pointer-events-none w-[280px] sm:w-[320px] ${positionClasses}`}>
      <AnimatePresence mode="popLayout">
        {visibleEvents.map(event => {
          // Check if it belongs to our team (Kita)
          const isOurTeam = (() => {
            // Check player roster if playerId is specified
            const player = matchRosters.find(r => r.profileId === event.playerId);
            if (player) {
              return player.teamId === homeTeamId;
            }

            if (event.playerId === 'home_team' || event.playerId === homeTeamId) {
              return ourHomeAway !== 'away';
            }
            if (event.playerId === 'away_team') {
              return ourHomeAway === 'away';
            }

            if (event.team) {
              const ourRole = ourHomeAway === 'away' ? 'away' : 'home';
              return event.team === ourRole;
            }

            return true;
          })();
          
          const player = matchRosters.find(r => r.profileId === event.playerId);
          let playerName = '';
          if (player) {
            playerName = player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name;
          } else if (isOurTeam) {
            playerName = ourTeamName;
          } else {
            playerName = opponentTeamName;
          }
          
          const { icon: Icon, label, iconColor } = getEventDisplay(event.type);
          const teamColor = isOurTeam ? ourColor : theirColor;
          const borderStyleColor = teamColor.startsWith('#') ? `${teamColor}80` : teamColor;
          
          return (
            <motion.div 
              layout
              initial={{ opacity: 0, y: position.includes('bottom') ? 20 : -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              key={`${event.id}`} 
              className="w-full px-3 py-2 rounded-2xl backdrop-blur-md bg-black/80 border text-white shadow-xl flex items-center gap-3 relative overflow-hidden"
              style={{ borderColor: borderStyleColor }}
            >
              {/* Team color highlight ornament */}
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: teamColor }} />
              
              <div className="flex items-center gap-3 flex-1 min-w-0 pl-1">
                <div className={`p-2 rounded-full bg-white/10 ${iconColor} shrink-0`}>
                  <Icon size={16} />
                </div>
                
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider leading-none mb-0.5 truncate">
                    {playerName}
                  </span>
                  <span className="text-sm font-black truncate leading-tight flex items-center gap-1.5">
                    {label} {event.subType ? <span className="text-xs font-bold text-zinc-400 opacity-90">({event.subType})</span> : ''}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end shrink-0 gap-0.5">
                <div className="text-xs font-black text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  Q{event.quarter}
                </div>
                <div className="text-xs font-bold text-zinc-400 flex items-center gap-0.5 tracking-wider">
                  <Clock size={8} /> {formatTime(event.timestamp)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
