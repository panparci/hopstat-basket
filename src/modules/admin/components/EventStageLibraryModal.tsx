import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { EVENT_CONTAINER_LIBRARY, LibraryContainerTemplate } from '../../../core/config/promptLibrary';

const STYLES = {
  modal: "fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-6"
};

interface EventStageLibraryModalProps {
  setIsLibraryOpen: (open: boolean) => void;
  handleLibrarySelect: (template: LibraryContainerTemplate) => void;
}

export const EventStageLibraryModal: React.FC<EventStageLibraryModalProps> = ({
  setIsLibraryOpen,
  handleLibrarySelect
}) => (
  <div className={STYLES.modal} onClick={() => setIsLibraryOpen(false)}>
    <motion.div 
       initial={{ opacity: 0, scale: 0.9, y: 20 }}
       animate={{ opacity: 1, scale: 1, y: 0 }}
       className="bg-zinc-50 dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
       onClick={e => e.stopPropagation()}
    >
       <div className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">Event Stage Library</h3>
          <button onClick={() => setIsLibraryOpen(false)}><X className="w-5 h-5 text-zinc-400" /></button>
       </div>
       <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
         {EVENT_CONTAINER_LIBRARY.map(item => (
           <button key={item.id} onClick={() => handleLibrarySelect(item)} className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left hover:border-brand-orange hover:shadow-lg transition-all">
              <h4 className="font-black italic text-sm uppercase mb-1">{item.name}</h4>
              <div className="text-xs font-black uppercase text-brand-orange">{item.primaryAction.eventType}</div>
           </button>
         ))}
       </div>
    </motion.div>
  </div>
);
