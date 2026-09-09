import React, { useState, useEffect } from "react";
import { X, Check, RefreshCw, AlertTriangle, Film, Clock } from "lucide-react";
import { ClockOCRResult, NormalizedClockRegion } from "../types";
import { normalizeClockString } from "../utils/imageUtils";

export interface SingleScanDetail {
  rawCropUrl: string;
  processedCropUrl: string;
  ocrResult: ClockOCRResult;
  region: NormalizedClockRegion;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryScan: SingleScanDetail | null;
  altScan: SingleScanDetail | null;
  defaultUsedAlt: boolean;
  currentAppClockStr: string;
  currentQuarter: number;
  currentYoutubeTimeSec: number;
  onConfirm: (
    finalMs: number, 
    finalStr: string, 
    source: "OCR_CONFIRMED" | "MANUAL_CORRECTION",
    customRegion?: NormalizedClockRegion | null,
    usedAltRegion?: boolean
  ) => void;
  onScanAgain: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  primaryScan,
  altScan,
  defaultUsedAlt,
  currentAppClockStr,
  currentQuarter,
  currentYoutubeTimeSec,
  onConfirm,
  onScanAgain,
}) => {
  const [selectedSource, setSelectedSource] = useState<"primary" | "alt">("primary");
  const [manualValue, setManualValue] = useState("");
  const [isEditingManually, setIsEditingManually] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize selectedSource based on auto-chosen winner
  useEffect(() => {
    if (isOpen) {
      if (defaultUsedAlt && altScan) {
        setSelectedSource("alt");
      } else if (primaryScan) {
        setSelectedSource("primary");
      } else if (altScan) {
        setSelectedSource("alt");
      } else {
        setSelectedSource("primary");
      }
    }
  }, [isOpen, defaultUsedAlt, primaryScan, altScan]);

  const activeScan = (selectedSource === "alt" && altScan) ? altScan : (primaryScan || altScan);

  // Initialize manual value when activeScan changes
  useEffect(() => {
    if (isOpen && activeScan) {
      const res = activeScan.ocrResult;
      if (res.isValid && res.normalizedText) {
        setManualValue(res.normalizedText);
        setIsEditingManually(res.confidence < 75);
        setValidationError(null);
      } else {
        setManualValue("");
        setIsEditingManually(true);
        setValidationError("OCR failed to detect a valid clock in this region. Please input manually or select another region.");
      }
    }
  }, [isOpen, selectedSource, activeScan]);

  if (!isOpen) return null;

  const handleValueChange = (val: string) => {
    setManualValue(val);
    const { normalized } = normalizeClockString(val);
    if (!normalized) {
      setValidationError("Format tidak valid. Contoh: 10:00, 8:42, 24.7");
    } else {
      setValidationError(null);
    }
  };

  const handleConfirmClick = () => {
    const { normalized, milliseconds } = normalizeClockString(manualValue);
    if (!normalized || milliseconds === null) {
      setValidationError("Format waktu tidak valid. Gunakan MM:SS atau SS.T");
      return;
    }

    const activeRes = activeScan?.ocrResult;
    const source = (activeRes && activeRes.isValid && normalized === activeRes.normalizedText)
      ? ("OCR_CONFIRMED" as const)
      : ("MANUAL_CORRECTION" as const);

    const isAlt = selectedSource === "alt" && Boolean(altScan);
    onConfirm(milliseconds, normalized, source, activeScan?.region || null, isAlt);
  };

  const formatYoutubeTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const lowConfidence = activeScan?.ocrResult ? activeScan.ocrResult.confidence < 75 : true;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-black italic uppercase leading-none">
              CONFIRM TIME SYNCHRONIZATION
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium mt-1">
              Verify detected clock crops from Primary & Alternative regions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* REGION COMPARISON SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Captured Regions & OCR Results
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Click a card to select its value
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PRIMARY REGION CARD */}
              <div
                onClick={() => primaryScan && setSelectedSource("primary")}
                className={`p-3 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  primaryScan ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                } ${
                  selectedSource === "primary"
                    ? "bg-amber-500/10 border-amber-500 dark:border-amber-400 shadow-md ring-1 ring-amber-500/50"
                    : primaryScan
                    ? "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700"
                    : "bg-zinc-100/50 dark:bg-zinc-900/40 border-dashed border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
                    📌 Primary Region
                  </span>
                  {selectedSource === "primary" && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black">
                      Active
                    </span>
                  )}
                </div>

                {primaryScan ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-400 uppercase font-extrabold mb-1">Captured</span>
                        <div className="h-12 w-full flex items-center justify-center bg-zinc-950 rounded-lg p-1 border border-zinc-700">
                          <img src={primaryScan.rawCropUrl} alt="Primary Raw" className="max-h-full object-contain" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-400 uppercase font-extrabold mb-1">Processed</span>
                        <div className="h-12 w-full flex items-center justify-center bg-white rounded-lg p-1 border border-zinc-300">
                          <img src={primaryScan.processedCropUrl} alt="Primary Processed" className="max-h-full object-contain" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 text-white p-2 rounded-xl text-center border border-zinc-800 mt-auto">
                      {primaryScan.ocrResult.isValid ? (
                        <div className="flex items-center justify-between px-1">
                          <span className="font-mono font-bold text-amber-400 text-sm">{primaryScan.ocrResult.normalizedText}</span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            primaryScan.ocrResult.confidence >= 75 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {Math.round(primaryScan.ocrResult.confidence)}%
                          </span>
                        </div>
                      ) : (
                        <div className="text-red-400 text-[10px] font-bold uppercase flex items-center justify-center gap-1 py-0.5">
                          <AlertTriangle size={12} />
                          <span>Unreadable</span>
                        </div>
                      )}
                      {primaryScan.ocrResult.rawText && (
                        <div className="text-[9px] font-mono text-zinc-400 truncate mt-0.5" title={primaryScan.ocrResult.rawText}>
                          Raw: "{primaryScan.ocrResult.rawText}"
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-xs text-zinc-400 italic">
                    Not Calibrated
                  </div>
                )}
              </div>

              {/* ALTERNATIVE REGION CARD */}
              <div
                onClick={() => altScan && setSelectedSource("alt")}
                className={`p-3 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  altScan ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                } ${
                  selectedSource === "alt"
                    ? "bg-amber-500/10 border-amber-500 dark:border-amber-400 shadow-md ring-1 ring-amber-500/50"
                    : altScan
                    ? "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700"
                    : "bg-zinc-100/50 dark:bg-zinc-900/40 border-dashed border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500 flex items-center gap-1">
                    ⚡ Alt Region
                  </span>
                  {selectedSource === "alt" && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black">
                      Active
                    </span>
                  )}
                </div>

                {altScan ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-400 uppercase font-extrabold mb-1">Captured</span>
                        <div className="h-12 w-full flex items-center justify-center bg-zinc-950 rounded-lg p-1 border border-zinc-700">
                          <img src={altScan.rawCropUrl} alt="Alt Raw" className="max-h-full object-contain" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-400 uppercase font-extrabold mb-1">Processed</span>
                        <div className="h-12 w-full flex items-center justify-center bg-white rounded-lg p-1 border border-zinc-300">
                          <img src={altScan.processedCropUrl} alt="Alt Processed" className="max-h-full object-contain" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 text-white p-2 rounded-xl text-center border border-zinc-800 mt-auto">
                      {altScan.ocrResult.isValid ? (
                        <div className="flex items-center justify-between px-1">
                          <span className="font-mono font-bold text-cyan-400 text-sm">{altScan.ocrResult.normalizedText}</span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            altScan.ocrResult.confidence >= 75 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {Math.round(altScan.ocrResult.confidence)}%
                          </span>
                        </div>
                      ) : (
                        <div className="text-red-400 text-[10px] font-bold uppercase flex items-center justify-center gap-1 py-0.5">
                          <AlertTriangle size={12} />
                          <span>Unreadable</span>
                        </div>
                      )}
                      {altScan.ocrResult.rawText && (
                        <div className="text-[9px] font-mono text-zinc-400 truncate mt-0.5" title={altScan.ocrResult.rawText}>
                          Raw: "{altScan.ocrResult.rawText}"
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-xs text-zinc-400 italic">
                    Not Calibrated
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE OCR DETECTED SUMMARY */}
          {activeScan?.ocrResult.isValid && lowConfidence && (
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 flex gap-3 text-xs">
              <AlertTriangle className="shrink-0 text-amber-500" size={16} />
              <div>
                <strong className="font-extrabold uppercase">Low Recognition Confidence ({Math.round(activeScan.ocrResult.confidence)}%)</strong>
                <p className="mt-0.5">Please check the detected value carefully and edit manually if needed.</p>
              </div>
            </div>
          )}

          {/* Sync Stats Info Row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 justify-center">
                <Clock size={10} />
                App Clock
              </div>
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-1">{currentAppClockStr}</div>
            </div>
            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 justify-center">
                <Film size={10} />
                Video Time
              </div>
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-1">{formatYoutubeTime(currentYoutubeTimeSec)}</div>
            </div>
            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 justify-center animate-pulse">
                Q{currentQuarter} Period
              </div>
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-1">Quarter {currentQuarter}</div>
            </div>
          </div>

          {/* Input Modification Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Final Sync Value</span>
              <button
                type="button"
                onClick={() => setIsEditingManually(!isEditingManually)}
                className="text-xs font-black uppercase tracking-widest text-amber-500 hover:text-amber-600 transition-colors"
              >
                {isEditingManually ? "Lock Value" : "Edit Manually"}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                disabled={!isEditingManually}
                value={manualValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="MM:SS (e.g. 10:00, 08:42) or SS.T (e.g. 24.7)"
                className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border font-mono text-center text-lg font-bold tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  validationError 
                    ? 'border-red-500/50 dark:border-red-500/30 text-red-500 focus:ring-red-500/30' 
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100'
                } disabled:opacity-80`}
              />
              {manualValue && !validationError && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" title="Valid Format">
                  <Check size={18} strokeWidth={3} />
                </div>
              )}
            </div>
            {validationError && (
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider text-center">{validationError}</p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <button
            onClick={onScanAgain}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            <RefreshCw size={12} />
            Scan Again
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClick}
              disabled={!!validationError || !manualValue}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
            >
              <Check size={14} />
              Confirm Sync
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

