import React, { useEffect, useState } from "react";
import { X, Cpu, Coins, Trash2, RefreshCw, Sparkles, Receipt, Layers } from "lucide-react";
import { TokenLogger, AiTokenLogEntry, TokenUsageSummary } from "../services/ai/tokenLogger";

interface TokenMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TokenMeterModal: React.FC<TokenMeterModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AiTokenLogEntry[]>([]);
  const [summary, setSummary] = useState<TokenUsageSummary>({
    totalCalls: 0,
    totalPromptTokens: 0,
    totalCandidatesTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0,
    totalCostIDR: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const allLogs = await TokenLogger.getAllLogs();
      const sum = await TokenLogger.getSummary();
      setLogs(allLogs);
      setSummary(sum);
    } catch (err) {
      console.error("Failed to load token meter data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleClear = async () => {
    if (confirm("Hapus semua riwayat penggunaan token AI?")) {
      await TokenLogger.clearLogs();
      await loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 px-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Coins size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm md:text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
                  AI Token Meter & Cost Logger
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  1 USD = Rp 18.000
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Log penggunaan token Gemini Vision API & kalkulasi estimasi biaya dalam IDR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Total Biaya (IDR)
              </span>
              <div className="font-black text-lg md:text-xl text-amber-700 dark:text-amber-300 mt-0.5">
                Rp {summary.totalCostIDR.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 block mt-0.5">
                (${summary.totalCostUSD.toFixed(5)} USD)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Total Tokens Used
              </span>
              <div className="font-black text-lg md:text-xl text-zinc-900 dark:text-zinc-100 mt-0.5">
                {summary.totalTokens.toLocaleString("id-ID")}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                {summary.totalPromptTokens.toLocaleString("id-ID")} In / {summary.totalCandidatesTokens.toLocaleString("id-ID")} Out
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Total API Calls
              </span>
              <div className="font-black text-lg md:text-xl text-zinc-900 dark:text-zinc-100 mt-0.5">
                {summary.totalCalls} Calls
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                Model: Gemini 3.6 Flash
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Rata-rata per Call
              </span>
              <div className="font-black text-base md:text-lg text-zinc-900 dark:text-zinc-100 mt-0.5">
                Rp {summary.totalCalls > 0 ? (summary.totalCostIDR / summary.totalCalls).toFixed(2) : "0.00"}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                {summary.totalCalls > 0 ? Math.round(summary.totalTokens / summary.totalCalls) : 0} tokens/call
              </span>
            </div>
          </div>

          {/* Logs Table Header & Actions */}
          <div className="flex items-center justify-between gap-2 mt-2">
            <h4 className="font-extrabold text-xs md:text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Receipt size={15} className="text-amber-500" /> Riwayat Transaksi Call API ({logs.length})
            </h4>

            {logs.length > 0 && (
              <button
                onClick={handleClear}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Reset Logs
              </button>
            )}
          </div>

          {/* Logs List */}
          {logs.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 text-xs">
              <Sparkles size={24} className="mx-auto text-zinc-400 mb-2" />
              Belum ada log penggunaan token AI. Jalankan "Mode Scan AI Vision" untuk memproses gambar dengan Gemini.
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-extrabold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Waktu</th>
                      <th className="p-3">Aksi / Deskripsi</th>
                      <th className="p-3">Model</th>
                      <th className="p-3 text-right">Items</th>
                      <th className="p-3 text-right">Prompt</th>
                      <th className="p-3 text-right">Candidates</th>
                      <th className="p-3 text-right">Total Tokens</th>
                      <th className="p-3 text-right">Biaya (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3 text-zinc-400 text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="p-3 font-bold text-zinc-800 dark:text-zinc-200">
                          {log.action}
                        </td>
                        <td className="p-3 text-zinc-500 text-[11px] font-mono">
                          {log.model}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {log.itemCount}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {log.promptTokenCount.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {log.candidatesTokenCount.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {log.totalTokenCount.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          Rp {log.costIDR.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
