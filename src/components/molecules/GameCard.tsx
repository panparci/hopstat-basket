import React from 'react';
import { Calendar, MapPin, MoreVertical, Map, ArrowLeftRight } from 'lucide-react';
import { Card } from '../atoms/Card';
import { Match } from '../../core/types/stats';

export const GameCard: React.FC<{ 
  match: Match; 
  onClick?: () => void;
  onActionClick?: () => void;
  compact?: boolean;
  homeScore?: number;
  awayScore?: number;
}> = ({ match, onClick, onActionClick, compact, homeScore, awayScore }) => {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col justify-between mb-3 group bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-[1.25rem] shadow-sm overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-shadow' : ''}`}
    >
      {/* Top Banner Row */}
      <div className="bg-[#0B1E36] px-4 py-2 flex justify-between items-center text-white">
         <div className="flex items-center gap-2">
            {(match.ageCategory !== undefined || match.matchKU !== undefined || match.ageGroup) && (
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {match.ageCategory ? `KU-${match.ageCategory}` : match.matchKU ? `KU-${match.matchKU}` : match.ageGroup}
              </span>
            )}
            
            {match.status === 'ongoing' ? (
              <span className="text-[10px] font-bold bg-brand-orange text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                ONGOING
              </span>
            ) : match.status === 'completed' ? (
              <span className="text-[10px] font-bold bg-[#4CAF50] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                SELESAI
              </span>
            ) : (
               <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                PLANNED
              </span>
            )}

            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 ml-1">
              {match.recordingType === 'single' ? 'SINGLE' : match.recordingType === 'team' ? 'TEAM' : 'PEREKAMAN'}
            </span>
         </div>
         
         {onActionClick && (
          <button 
            onClick={(e) => { e.stopPropagation(); onActionClick(); }}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
          >
            <MoreVertical size={14} className="text-white" />
          </button>
        )}
      </div>
      
      {/* Content Body */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-display font-black uppercase text-[#1A1A1A] dark:text-white leading-tight pr-4 text-[15px]">
            {match.name}
          </h3>
          {(match.matchLevel || match.isOfficiated) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {match.matchLevel && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-zinc-150 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                  {match.matchLevel}
                </span>
              )}
              {match.isOfficiated && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-brand-orange/15 text-brand-orange uppercase tracking-wider flex items-center gap-0.5">
                  ★ RESMI
                </span>
              )}
            </div>
          )}
        </div>
        
        {(match.status === 'completed' || match.status === 'ongoing') && homeScore !== undefined && awayScore !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-brand-orange tracking-wider">
              {match.status === 'completed' ? 'SKOR AKHIR' : 'LIVE SKOR'}
            </span>
            <span className="text-[15px] font-black text-[#1A1A1A] dark:text-white leading-none">
               {homeScore} - {awayScore}
            </span>
          </div>
        )}
      </div>

      <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800/80" />

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between text-[11px] font-bold text-[#1A1A1A] dark:text-zinc-400">
        <div className="flex flex-col gap-1">
           <div className="flex items-center gap-1.5">
             <Calendar size={14} className="text-zinc-400" />
             {new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
           </div>
           <div className="flex items-center gap-1.5">
             <MapPin size={14} className="text-zinc-400" />
             {match.venue || 'Kandang'}
           </div>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
           <Map size={16} />
           <ArrowLeftRight size={16} />
        </div>
      </div>
    </div>
  );
};
