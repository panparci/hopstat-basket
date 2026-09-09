import React, { useState, useRef, useEffect } from 'react';
import { Undo, Redo, ChevronDown } from 'lucide-react';

export interface UndoRedoItem {
  id: string;
  description: string;
}

interface UndoRedoControlsProps {
  undoStack: UndoRedoItem[];
  redoStack: UndoRedoItem[];
  onUndo: (count: number) => void;
  onRedo: (count: number) => void;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  undoStack,
  redoStack,
  onUndo,
  onRedo,
}) => {
  const [showUndoDropdown, setShowUndoDropdown] = useState(false);
  const [showRedoDropdown, setShowRedoDropdown] = useState(false);
  
  const [hoveredUndoIndex, setHoveredUndoIndex] = useState<number | null>(null);
  const [hoveredRedoIndex, setHoveredRedoIndex] = useState<number | null>(null);

  const undoRef = useRef<HTMLDivElement>(null);
  const redoRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (undoRef.current && !undoRef.current.contains(event.target as Node)) {
        setShowUndoDropdown(false);
      }
      if (redoRef.current && !redoRef.current.contains(event.target as Node)) {
        setShowRedoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Most recent actions at the top of the list
  const undoList = [...undoStack].reverse();
  const redoList = [...redoStack].reverse();

  const handleUndoClick = () => {
    if (undoStack.length > 0) {
      onUndo(1);
    }
  };

  const handleRedoClick = () => {
    if (redoStack.length > 0) {
      onRedo(1);
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shrink-0 select-none">
      {/* UNDO GROUP */}
      <div className="relative flex items-center" ref={undoRef}>
        <button
          onClick={handleUndoClick}
          disabled={undoStack.length === 0}
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center gap-1 text-xs font-bold"
          title="Batalkan tindakan terakhir (Ctrl+Z)"
        >
          <Undo size={14} />
          <span className="hidden sm:inline">Undo</span>
        </button>
        <button
          onClick={() => {
            if (undoStack.length > 0) {
              setShowUndoDropdown(!showUndoDropdown);
              setShowRedoDropdown(false);
            }
          }}
          disabled={undoStack.length === 0}
          className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronDown size={12} />
        </button>

        {showUndoDropdown && undoList.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
              Daftar Tindakan Undo
            </div>
            <div className="max-h-60 overflow-y-auto">
              {undoList.map((item, index) => {
                const isSelected = hoveredUndoIndex !== null && index <= hoveredUndoIndex;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setHoveredUndoIndex(index)}
                    onMouseLeave={() => setHoveredUndoIndex(null)}
                    onClick={() => {
                      onUndo(index + 1);
                      setShowUndoDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span>{item.description || 'Tindakan Tanpa Keterangan'}</span>
                  </button>
                );
              })}
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 text-center">
              {hoveredUndoIndex !== null
                ? `Batalkan ${hoveredUndoIndex + 1} tindakan`
                : 'Pilih tindakan untuk di-undo'}
            </div>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

      {/* REDO GROUP */}
      <div className="relative flex items-center" ref={redoRef}>
        <button
          onClick={handleRedoClick}
          disabled={redoStack.length === 0}
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center gap-1 text-xs font-bold"
          title="Ulangi tindakan yang dibatalkan (Ctrl+Y)"
        >
          <Redo size={14} />
          <span className="hidden sm:inline">Redo</span>
        </button>
        <button
          onClick={() => {
            if (redoStack.length > 0) {
              setShowRedoDropdown(!showRedoDropdown);
              setShowUndoDropdown(false);
            }
          }}
          disabled={redoStack.length === 0}
          className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronDown size={12} />
        </button>

        {showRedoDropdown && redoList.length > 0 && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
              Daftar Tindakan Redo
            </div>
            <div className="max-h-60 overflow-y-auto">
              {redoList.map((item, index) => {
                const isSelected = hoveredRedoIndex !== null && index <= hoveredRedoIndex;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setHoveredRedoIndex(index)}
                    onMouseLeave={() => setHoveredRedoIndex(null)}
                    onClick={() => {
                      onRedo(index + 1);
                      setShowRedoDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span>{item.description || 'Tindakan Tanpa Keterangan'}</span>
                  </button>
                );
              })}
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 text-center">
              {hoveredRedoIndex !== null
                ? `Ulangi ${hoveredRedoIndex + 1} tindakan`
                : 'Pilih tindakan untuk di-redo'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
