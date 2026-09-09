import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';

const STYLES = {
  modal: "fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-6"
};

interface SimulationSummaryModalProps {
  simulationLogs: any[];
  setIsPreviewOpen: (open: boolean) => void;
  setIsSimulationFinished: (finished: boolean) => void;
}

export const SimulationSummaryModal: React.FC<SimulationSummaryModalProps> = ({
  simulationLogs,
  setIsPreviewOpen,
  setIsSimulationFinished
}) => (
  <div className={STYLES.modal}>
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[40px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl p-12 text-center space-y-8"
    >
      <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl shadow-emerald-500/20">
        <CheckCircle className="w-10 h-10" />
      </div>
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Flow Verified</h2>
        <p className="text-sm text-zinc-500 mt-2 font-medium">The following atomic events will be recorded:</p>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 max-h-[300px] overflow-y-auto text-left space-y-4">
        {simulationLogs.map((log, i) => (
          <div key={i} className="flex gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
             <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400">{i+1}</div>
             <div>
                <div className="text-xs font-black uppercase text-brand-orange">{log.type} {log.subType && `/ ${log.subType}`}</div>
                <div className="font-bold text-xs mt-1">
                  Actor ID: <span className="text-blue-500">{log.actorId}</span>
                </div>
                {log.isSecondary && <span className="inline-block mt-2 text-xs font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">Secondary Event</span>}
             </div>
          </div>
        ))}
      </div>

      <button 
        onClick={() => { setIsPreviewOpen(false); setIsSimulationFinished(false); }}
        className="w-full py-5 rounded-3xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all active:scale-95"
      >
        Close Simulation
      </button>
    </motion.div>
  </div>
);
