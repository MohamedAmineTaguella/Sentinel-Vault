import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ToastAction { label: string; onClick: () => void; }
interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info'; duration: number; action?: ToastAction; }
interface ToastContextValue { toast: (message: string, type?: 'success' | 'error' | 'info', duration?: number, action?: ToastAction) => void; }

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000, action?: ToastAction) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type, duration, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);
  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-rose-500/10 border-rose-500/20',
    info: 'bg-indigo-500/10 border-indigo-500/20',
  };
  const icons = {
    success: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    error: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
    info: <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />,
  };
  const iconColors = { success: 'text-emerald-400', error: 'text-rose-400', info: 'text-indigo-400' };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-up ${colors[t.type]}`} style={{ minWidth: 280 }}>
            <svg className={`w-5 h-5 shrink-0 ${iconColors[t.type]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {icons[t.type]}
            </svg>
            <span className="text-sm text-white/90 flex-1">{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action!.onClick(); dismiss(t.id); }} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">{t.action.label}</button>
            )}
            <button onClick={() => dismiss(t.id)} className="btn-ghost p-0.5 -mr-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
