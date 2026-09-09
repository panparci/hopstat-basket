import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const bgColors = {
            success: 'bg-emerald-500 dark:bg-emerald-600',
            error: 'bg-red-500 dark:bg-red-600',
            info: 'bg-brand-navy dark:bg-brand-navy' // using standard brand color for info
          };
          const textColors = {
            success: 'text-white',
            error: 'text-white',
            info: 'text-white dark:text-brand-orange'
          };
          return (
            <div 
              key={toast.id}
              className={`flex items-center justify-center p-3 rounded-2xl shadow-xl pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${bgColors[toast.type]} ${textColors[toast.type]}`}
            >
              <span className="text-sm font-bold text-center">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
