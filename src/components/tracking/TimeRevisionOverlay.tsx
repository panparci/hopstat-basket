import React from 'react';

interface TimeRevisionOverlayProps {
  isRevisingTime: boolean;
  timeRevisionBuffer: string;
  error?: string | null;
}

export const TimeRevisionOverlay: React.FC<TimeRevisionOverlayProps> = ({
  isRevisingTime,
  timeRevisionBuffer,
  error
}) => {
  if (!isRevisingTime) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-brand-navy text-white px-6 py-3 rounded-2xl shadow-2xl border-2 border-brand-orange animate-bounce flex flex-col items-center">
      <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Revisi Waktu</span>
      
      {error ? (
        <div className="text-red-400 font-bold text-sm py-2 animate-pulse">
          {error}
        </div>
      ) : (
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={`digit-${i}`} className={`w-8 h-10 rounded-lg flex items-center justify-center text-xl font-black ${timeRevisionBuffer[i] ? 'bg-brand-orange text-brand-navy' : 'bg-white/10 text-white/30'}`}>
              {timeRevisionBuffer[i] || '-'}
            </div>
          ))}
        </div>
      )}
      
      <span className="text-xs mt-2 opacity-50 italic text-center">
        {error ? 'Silakan ulangi' : (
          <>Ketik angka (cth: 0045 untuk 0:45)<br/>Tekan * lagi untuk BATAL</>
        )}
      </span>
    </div>
  );
};
