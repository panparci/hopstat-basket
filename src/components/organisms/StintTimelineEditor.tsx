import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Users, 
  Split, 
  Merge, 
  UserPlus, 
  UserMinus, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Play,
  ArrowRightLeft
} from 'lucide-react';
import { MatchStint, Player, Match } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { motion, AnimatePresence } from 'motion/react';
import { BaseModal } from '../atoms/BaseModal';

interface StintTimelineEditorProps {
  match: Match;
  stints: MatchStint[];
  allPlayers: Player[];
  onUpdate: () => void;
  onClose: () => void;
  initialQuarter?: number;
  initialClock?: number;
}

export const StintTimelineEditor: React.FC<StintTimelineEditorProps> = ({
  match,
  stints,
  allPlayers,
  onUpdate,
  onClose,
  initialQuarter = 1,
  initialClock
}) => {
  const [selectedQuarter, setSelectedQuarter] = useState(initialQuarter);
  const [selectedStintId, setSelectedStintId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subData, setSubData] = useState<{ playerOutId: string, playerInId: string, clock: number } | null>(null);

  const quarterDuration = (match.durationPerPeriod || 10) * 60;

  const filteredStints = useMemo(() => {
    return stints
      .filter(s => s.startQuarter === selectedQuarter && s.isValid !== false && !s.isGhostStint)
      .sort((a, b) => b.startClock - a.startClock);
  }, [stints, selectedQuarter]);

  const selectedStint = useMemo(() => {
    return stints.find(s => s.id === selectedStintId);
  }, [stints, selectedStintId]);

  const handleSplit = async (stintId: string) => {
    const stint = stints.find(s => s.id === stintId);
    if (!stint) return;

    const splitTime = Math.round((stint.startClock + (stint.endClock || 0)) / 2);
    setIsProcessing(true);
    try {
      await statsService.splitStint(match.id, stintId, splitTime);
      onUpdate();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMerge = async (firstId: string, secondId: string) => {
    setIsProcessing(true);
    try {
      await statsService.mergeStints(match.id, firstId, secondId);
      onUpdate();
      setSelectedStintId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubstitution = async () => {
    if (!subData || !selectedStint) return;
    setIsProcessing(true);
    try {
      await statsService.recordSubstitution(
        match.id, 
        selectedStint.teamId, 
        subData.playerOutId, 
        subData.playerInId, 
        selectedQuarter, 
        subData.clock
      );
      onUpdate();
      setShowSubModal(false);
      setSubData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title="Stint Timeline Editor"
      icon={<Clock className="text-brand-navy dark:text-brand-orange" size={20} />}
      maxWidth="max-w-5xl"
      fullScreen
    >
      <div className="flex flex-col h-full">
        {/* Quarter Selector */}
        <div className="px-6 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-zinc-100 dark:border-zinc-800 -mx-6 -mt-6 bg-zinc-50/50 dark:bg-zinc-800/50">
          {Array.from({ length: match.periodCount || 4 }).map((_, i) => {
            const quarter = i + 1;
            return (
              <button
                key={`quarter-${quarter}`}
                onClick={() => setSelectedQuarter(quarter)}
                className={`px-6 py-2 rounded-xl text-sm font-black transition-all whitespace-nowrap ${
                  selectedQuarter === quarter 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                Quarter {quarter}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 -mx-6">
          {/* Timeline Visualization */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Timeline View</h3>
            <div className="relative h-32 bg-zinc-100 dark:bg-zinc-800 rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
              {/* Time Markers */}
              <div className="absolute inset-0 flex justify-between px-4 pointer-events-none">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="h-full w-px bg-zinc-200 dark:bg-zinc-700 relative">
                    <span className="absolute top-2 left-1 text-xs font-mono text-zinc-400">
                      {formatTime(Math.round(quarterDuration * (1 - i/10)))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stint Blocks */}
              <div className="absolute inset-0 p-4 flex items-center">
                <div className="relative w-full h-16">
                  {filteredStints.map((stint, idx) => {
                    const startPos = ((quarterDuration - stint.startClock) / quarterDuration) * 100;
                    const endClock = stint.endClock !== undefined ? stint.endClock : 0;
                    const width = ((stint.startClock - endClock) / quarterDuration) * 100;

                    return (
                      <motion.div
                        key={stint.id}
                        layoutId={stint.id}
                        onClick={() => setSelectedStintId(stint.id)}
                        className={`absolute top-0 h-full rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center overflow-hidden ${
                          selectedStintId === stint.id
                            ? 'bg-blue-500 border-blue-600 z-10 shadow-xl scale-[1.02]'
                            : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600 hover:border-blue-400'
                        }`}
                        style={{ left: `${startPos}%`, width: `${width}%` }}
                      >
                        <div className="flex -space-x-2">
                          {stint.playerIds.slice(0, 3).map(pid => {
                            const p = allPlayers.find(pl => pl.id === pid);
                            return (
                              <div key={pid} className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-zinc-900 flex items-center justify-center text-xs font-bold">
                                {p?.jersey || '??'}
                              </div>
                            );
                          })}
                          {stint.playerIds.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-600 border border-white dark:border-zinc-900 flex items-center justify-center text-xs font-bold">
                              +{stint.playerIds.length - 3}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Stint Details & Actions */}
          <AnimatePresence mode="wait">
            {selectedStint ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Lineup Info */}
                <div className="md:col-span-2 bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Active Lineup
                    </h4>
                    <span className="text-xs font-mono text-zinc-500 bg-white dark:bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      {formatTime(selectedStint.startClock)} → {selectedStint.endClock !== undefined ? formatTime(selectedStint.endClock) : 'Active'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {selectedStint.playerIds.map(pid => {
                      const p = allPlayers.find(pl => pl.id === pid);
                      return (
                        <div key={pid} className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-black text-zinc-900 dark:text-white border-2 border-zinc-50 dark:border-zinc-800">
                            {p?.jersey || '??'}
                          </div>
                          <span className="text-xs font-bold text-zinc-500 text-center truncate w-full">
                            {p?.name.split(' ')[0] || 'Unknown'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Quick Actions</h4>
                  <button 
                    onClick={() => handleSplit(selectedStint.id)}
                    disabled={isProcessing}
                    className="w-full p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all group"
                  >
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                      <Split className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">Split Stint</div>
                      <div className="text-xs text-zinc-500">Divide at midpoint</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setShowSubModal(true)}
                    disabled={isProcessing}
                    className="w-full p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all group"
                  >
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">Record Substitution</div>
                      <div className="text-xs text-zinc-500">Player OUT → Player IN</div>
                    </div>
                  </button>

                  {filteredStints.length > 1 && (
                    <button 
                      onClick={() => {
                        const idx = filteredStints.findIndex(s => s.id === selectedStint.id);
                        if (idx < filteredStints.length - 1) {
                          handleMerge(selectedStint.id, filteredStints[idx+1].id);
                        }
                      }}
                      disabled={isProcessing}
                      className="w-full p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all group"
                    >
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 group-hover:scale-110 transition-transform">
                        <Merge className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">Merge with Next</div>
                        <div className="text-xs text-zinc-500">Combine adjacent stints</div>
                      </div>
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <Users className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold">Select a stint block to edit</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between -mx-6 -mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              5 Players Required
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              No Overlaps
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black hover:opacity-90 transition-all"
          >
            Done
          </button>
        </div>

        {/* Substitution Modal */}
        <AnimatePresence>
          {showSubModal && selectedStint && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800"
              >
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6">Record Substitution</h3>
                
                <div className="space-y-6">
                  {/* Player Out */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Player OUT</label>
                    <div className="grid grid-cols-5 gap-2">
                      {selectedStint.playerIds.map(pid => {
                        const p = allPlayers.find(pl => pl.id === pid);
                        const isSelected = subData?.playerOutId === pid;
                        return (
                          <button
                            key={pid}
                            onClick={() => setSubData(prev => ({ ...prev!, playerOutId: pid, clock: prev?.clock || selectedStint.startClock }))}
                            className={`p-2 rounded-xl border-2 transition-all ${
                              isSelected ? 'bg-red-50 border-red-500 text-red-600' : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-500'
                            }`}
                          >
                            <div className="text-xs font-black">#{p?.jersey}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Player In */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Player IN</label>
                    <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-1">
                      {allPlayers
                        .filter(p => !selectedStint.playerIds.includes(p.id))
                        .map(p => {
                          const isSelected = subData?.playerInId === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSubData(prev => ({ ...prev!, playerInId: p.id, clock: prev?.clock || selectedStint.startClock }))}
                              className={`p-2 rounded-xl border-2 transition-all ${
                                isSelected ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-500'
                              }`}
                            >
                              <div className="text-xs font-black">#{p.jersey}</div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Substitution Time</label>
                    <input 
                      type="range"
                      min={selectedStint.endClock || 0}
                      max={selectedStint.startClock}
                      value={subData?.clock || selectedStint.startClock}
                      onChange={(e) => setSubData(prev => ({ ...prev!, clock: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs font-mono text-zinc-400">
                      <span>{formatTime(selectedStint.endClock || 0)}</span>
                      <span className="text-blue-500 font-bold">{formatTime(subData?.clock || selectedStint.startClock)}</span>
                      <span>{formatTime(selectedStint.startClock)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => setShowSubModal(false)}
                    className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubstitution}
                    disabled={!subData?.playerOutId || !subData?.playerInId || isProcessing}
                    className="flex-[2] py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Confirm Substitution
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </BaseModal>
  );
};
