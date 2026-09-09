import React from "react";
import { AlertOctagon, RotateCcw, Crop, CheckCircle2 } from "lucide-react";

interface FailFastAbortModalProps {
  isOpen: boolean;
  message: string;
  validRatioPercent?: number;
  onRecalibrate: () => void;
  onClose: () => void;
}

export const FailFastAbortModal: React.FC<FailFastAbortModalProps> = ({
  isOpen,
  message,
  validRatioPercent = 0,
  onRecalibrate,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/30 shrink-0">
            <AlertOctagon size={28} />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-red-400 uppercase bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
              Fail-Fast Region Check
            </span>
            <h3 className="text-base font-black text-white mt-1">
              Pemindaian Dihentikan (Akurasi &lt; 10%)
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/40 text-xs text-red-200 leading-relaxed">
          {message}
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-zinc-500 text-[10px] uppercase font-mono">Tingkat Keberhasilan</span>
            <span className="font-extrabold text-red-400 text-sm font-mono">{validRatioPercent}% Valid</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-zinc-500 text-[10px] uppercase font-mono">Ambang Batas Minimal</span>
            <span className="font-extrabold text-amber-400 text-sm font-mono">&gt;= 10% Valid</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={() => {
              onClose();
              onRecalibrate();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center gap-2 transition-all"
          >
            <Crop size={15} /> Atur Ulang Region Jam
          </button>
        </div>
      </div>
    </div>
  );
};
