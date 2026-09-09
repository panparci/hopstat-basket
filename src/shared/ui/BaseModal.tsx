import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  headerActions?: React.ReactNode;
  fullScreen?: boolean;
  sidePanel?: boolean;
}

export const BaseModal: React.FC<BaseModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title, 
  icon,
  maxWidth = 'max-w-md',
  headerActions,
  fullScreen = false,
  sidePanel = false
}) => {
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('pause-youtube'));
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`${sidePanel ? 'absolute inset-0 z-[60]' : 'fixed inset-0 z-[60] flex items-center justify-center font-sans'} ${fullScreen ? 'bg-black/80' : (sidePanel ? 'bg-transparent pointer-events-none' : 'bg-black/80')}`}>
          <motion.div
            initial={sidePanel ? { x: '100%', opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={sidePanel ? { x: 0, opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={sidePanel ? { x: '100%', opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 relative text-[#1A1A1A] dark:text-white transition-colors shadow-2xl max-h-full flex flex-col overflow-hidden pointer-events-auto ${
              sidePanel 
                ? 'absolute inset-0 h-full w-full rounded-none border-l border-zinc-200 dark:border-zinc-800' 
                : (fullScreen ? 'w-full h-full rounded-none' : 'rounded-3xl w-full ' + maxWidth)
            }`}
          >
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-[#1A1A1A] dark:hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>

            {(title || icon || headerActions) && (
              <div className="flex items-center justify-between gap-3 mb-6 shrink-0 pr-8">
                <div className="flex items-center gap-3">
                  {icon && <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">{icon}</div>}
                  {title && <h2 className="text-xl font-black italic uppercase tracking-tight">{title}</h2>}
                </div>
                {headerActions && <div>{headerActions}</div>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
