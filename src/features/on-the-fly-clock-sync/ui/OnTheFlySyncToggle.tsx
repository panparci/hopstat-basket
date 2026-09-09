import React, { useState } from "react";
import { Zap, ShieldCheck, HelpCircle, CheckCircle2 } from "lucide-react";
import { NormalizedClockRegion } from "../../automatic-clock-mapping/types";

interface OnTheFlySyncToggleProps {
  isEnabled: boolean;
  onToggle: (enabled?: boolean) => void;
  clockRegion?: NormalizedClockRegion | null;
  className?: string;
}

export const OnTheFlySyncToggle: React.FC<OnTheFlySyncToggleProps> = ({
  isEnabled,
  onToggle,
  clockRegion,
  className = "",
}) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Primary Toggle Switch */}
      <button
        type="button"
        onClick={() => onToggle()}
        className={`relative inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-bold transition-all shadow-sm ${
          isEnabled
            ? "bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
            : "bg-zinc-800 border border-zinc-700/70 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        }`}
        title="Otomatis koreksi jam event & timer di latar belakang menggunakan OCR Lokal"
      >
        <span className="flex items-center gap-1.5">
          <Zap className={`w-3.5 h-3.5 ${isEnabled ? "text-amber-400 fill-amber-400 animate-pulse" : "text-zinc-500"}`} />
          <span className="whitespace-nowrap">On-The-Fly OCR</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
              isEnabled
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-700 text-zinc-400"
            }`}
          >
            {isEnabled ? "ON" : "OFF"}
          </span>
        </span>
      </button>

      {/* Info Icon Button */}
      <button
        type="button"
        onClick={() => setShowInfo(!showInfo)}
        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Info On-The-Fly Clock Sync"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-left">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  On-The-Fly Local OCR Clock Sync
                </h3>
                <p className="text-xs text-zinc-400">
                  Sinkronisasi Jam Otomatis 100% Lokal & Tanpa Delay
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Nol Waktu Tunggu (Parallel Execution):</strong> Input data statistik dicatat langsung secara instan tanpa hambatan UI.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">100% OCR Lokal (Tesseract Engine):</strong> Menggunakan algoritma pembersihan karakter & format sub-detik lokal tanpa pemrosesan eksternal.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Auto-Adjust Live Clock:</strong> Mengoreksi timestamp event dan menyesuaikan jam pertandingan yang sedang berjalan secara akurat.
                  </p>
                </div>
              </div>

              {!clockRegion && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>Tips:</strong> Pastikan Anda telah mengkalibrasi area crop jam di tombol Area OCR untuk akurasi maksimal.
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
