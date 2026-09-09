import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  FileCheck, 
  RefreshCw, 
  Plus, 
  Info,
  ExternalLink,
  Video
} from 'lucide-react';
import { FundamentalDrill } from '../types';
import { 
  downloadDrillExcelTemplate, 
  parseDrillsFromExcel, 
  ParsedDrillResult 
} from '../services/drillExcelService';

interface DrillExcelUploadModalProps {
  onClose: () => void;
  onImport: (drills: FundamentalDrill[], mode: 'append' | 'replace') => Promise<void>;
}

export const DrillExcelUploadModal: React.FC<DrillExcelUploadModalProps> = ({
  onClose,
  onImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedDrillResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    setParsing(true);
    setErrorMessage(null);
    setParsedResult(null);

    try {
      const result = await parseDrillsFromExcel(file);
      setParsedResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file Excel.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedResult || parsedResult.drills.length === 0) return;
    setImporting(true);
    try {
      await onImport(parsedResult.drills, importMode);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan data import: ${err.message || 'Error tidak diketahui'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md font-sans text-slate-900 dark:text-white animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                IMPORT EXCEL KATALOG VIDEO DRILL
              </span>
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white">
                Upload Katalog Latihan & Drill (.xlsx)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Download Format Excel Template Section */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h4 className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-300">
                Format File Excel Siap Pakai
              </h4>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
              Unduh template Excel resmi HoopStats dengan contoh 8 drill fundamental & kolom URL Video YouTube.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadDrillExcelTemplate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Format Excel (.xlsx)</span>
          </button>
        </div>

        {/* Upload Box Dropzone */}
        {!parsedResult && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-zinc-900/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 p-8 sm:p-10 rounded-2xl text-center cursor-pointer transition-all space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Klik atau Tarik File Excel (.xlsx / .csv) Ke Sini
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                Mendukung format file Microsoft Excel (.xlsx, .xls) dan CSV
              </p>
            </div>
          </div>
        )}

        {/* Loading Spinner during Excel Parsing */}
        {parsing && (
          <div className="p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">
              Membaca & memvalidasi lembar kerja Excel...
            </p>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Parsed Result Preview & Confirmation */}
        {parsedResult && (
          <div className="space-y-4">
            {/* Header Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100 dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-500" />
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    Terbaca: {parsedResult.drills.length} Gerakan Video Drill
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    File: <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedFile?.name}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setParsedResult(null);
                  setSelectedFile(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                Ganti File Excel
              </button>
            </div>

            {/* Warnings list if any */}
            {parsedResult.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl space-y-1">
                <span className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Catatan Hasil Validasi ({parsedResult.warnings.length}):
                </span>
                <ul className="text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5 max-h-24 overflow-y-auto pl-4 list-disc">
                  {parsedResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 block">
                Preview Data Drill dari Excel:
              </span>
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 font-black uppercase text-[10px] sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Nama Drill</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Link YouTube Video</th>
                      <th className="p-3">Loop (s)</th>
                      <th className="p-3">Mekanika</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                    {parsedResult.drills.map((drill, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[180px] truncate">
                          {drill.name}
                        </td>
                        <td className="p-3">
                          <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                            {drill.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 uppercase text-[10px] font-bold text-slate-500">
                          {drill.difficulty}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 max-w-[200px] truncate">
                            <Video className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{drill.youtubeUrl}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                          {drill.loopStartTimeSec}s - {drill.loopEndTimeSec ? `${drill.loopEndTimeSec}s` : 'end'}
                        </td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {drill.mechanics?.length || 0} Poin
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mode Selection Options */}
            <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 block">
                Opsi Mode Simpan Impor:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  importMode === 'append'
                    ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-black block">Tambahkan ke Katalog Saja (Append)</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Menambahkan {parsedResult.drills.length} item dari Excel tanpa menghapus data drill yang ada.
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  importMode === 'replace'
                    ? 'bg-rose-500/10 border-rose-500 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 accent-rose-500"
                  />
                  <div>
                    <span className="text-xs font-black block text-rose-600 dark:text-rose-400">Gantikan Seluruh Katalog (Replace)</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Menghapus catalog lama dan memperbarui total dengan data Excel baru ini.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Impor...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Impor ({parsedResult.drills.length} Drill)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
