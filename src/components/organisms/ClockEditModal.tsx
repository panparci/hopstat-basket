import React, { useState, useEffect } from 'react';
import { Plus, Minus, ChevronsUpDown } from 'lucide-react';
import { BaseModal } from '../atoms/BaseModal';

interface ClockEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  onSave: (newTime: number) => void;
  sidePanel?: boolean;
}

export const ClockEditModal: React.FC<ClockEditModalProps> = ({
  isOpen,
  onClose,
  currentTime,
  onSave,
  sidePanel = false
}) => {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [numBuffer, setNumBuffer] = useState('');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartTotal, setDragStartTotal] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setMinutes(Math.floor(currentTime / 60));
      setSeconds(currentTime % 60);
      setNumBuffer('');
    }
  }, [isOpen, currentTime]);

  const minutesRef = React.useRef(minutes);
  const secondsRef = React.useRef(seconds);
  useEffect(() => {
    minutesRef.current = minutes;
    secondsRef.current = seconds;
  }, [minutes, seconds]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing when typing inside inputs if any
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setNumBuffer(prev => {
          const next = (prev + e.key).slice(-4); // Keep last 4 digits
          const padded = next.padStart(4, '0');
          const m = parseInt(padded.substring(0, 2), 10);
          const s = parseInt(padded.substring(2, 4), 10);
          setMinutes(m);
          setSeconds(s);
          return next;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setNumBuffer(prev => {
          const next = prev.slice(0, -1);
          if (next === '') {
            setMinutes(Math.floor(currentTime / 60));
            setSeconds(currentTime % 60);
          } else {
            const padded = next.padStart(4, '0');
            const m = parseInt(padded.substring(0, 2), 10);
            const s = parseInt(padded.substring(2, 4), 10);
            setMinutes(m);
            setSeconds(s);
          }
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const totalSeconds = (minutesRef.current * 60) + secondsRef.current;
        onSave(totalSeconds);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentTime, onSave, onClose]);

  const handleSave = () => {
    const totalSeconds = (minutes * 60) + seconds;
    onSave(totalSeconds);
    onClose();
  };

  const adjustTime = (amount: number) => {
    let total = (minutes * 60) + seconds + amount;
    if (total < 0) total = 0;
    setMinutes(Math.floor(total / 60));
    setSeconds(total % 60);
    setNumBuffer(''); // Clear custom keyboard buffer when buttons are clicked
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartTotal((minutes * 60) + seconds);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    // Calculate delta Y. Moving up (negative delta) should increase time.
    const deltaY = dragStartY - e.clientY;
    
    // Adjust sensitivity: 10 pixels = 1 second
    const deltaSeconds = Math.floor(deltaY / 10);
    
    let newTotal = dragStartTotal + deltaSeconds;
    if (newTotal < 0) newTotal = 0;
    
    setMinutes(Math.floor(newTotal / 60));
    setSeconds(newTotal % 60);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Kalibrasi Waktu"
      maxWidth="max-w-sm"
    >
      <div className="flex flex-col items-center gap-6 -mt-4">
        <div className="text-xs text-zinc-500 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full shrink-0">
          <ChevronsUpDown size={14} />
          <span>Tahan & Geser angka untuk mengatur cepat</span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Minutes */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => adjustTime(60)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-brand-orange hover:text-white transition-colors">
              <Plus size={24} />
            </button>
            <div 
              className="w-20 h-20 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 cursor-ns-resize touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <span className="text-4xl font-mono font-bold pointer-events-none">{minutes.toString().padStart(2, '0')}</span>
            </div>
            <button onClick={() => adjustTime(-60)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-brand-orange hover:text-white transition-colors">
              <Minus size={24} />
            </button>
          </div>

          <span className="text-4xl font-mono font-bold pb-14">:</span>

          {/* Seconds */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => adjustTime(1)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-brand-orange hover:text-white transition-colors">
              <Plus size={24} />
            </button>
            <div 
              className="w-20 h-20 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 cursor-ns-resize touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <span className="text-4xl font-mono font-bold pointer-events-none">{seconds.toString().padStart(2, '0')}</span>
            </div>
            <button onClick={() => adjustTime(-1)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-brand-orange hover:text-white transition-colors">
              <Minus size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full shrink-0">
          <button onClick={() => adjustTime(10)} className="py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">+10s</button>
          <button onClick={() => adjustTime(-10)} className="py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">-10s</button>
          <button onClick={() => adjustTime(30)} className="py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">+30s</button>
          <button onClick={() => adjustTime(-30)} className="py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">-30s</button>
        </div>

        {numBuffer ? (
          <div className="w-full text-center py-2 px-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 font-mono font-bold text-xs tracking-widest animate-pulse shrink-0">
            Ketik Keyboard: {numBuffer.padStart(4, '_').replace(/(\w{2})(\w{2})/, '$1:$2')}
          </div>
        ) : (
          <div className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center shrink-0">
            Atau ketik angka langsung di keyboard (cth: "0852" untuk 08:52)
          </div>
        )}
      </div>

      <div className="mt-6 shrink-0">
        <button
          onClick={handleSave}
          className="w-full py-4 rounded-xl font-bold text-white bg-brand-navy dark:bg-brand-orange dark:text-brand-navy hover:opacity-90 transition-opacity shadow-lg"
        >
          SIMPAN WAKTU
        </button>
      </div>
    </BaseModal>
  );
};
