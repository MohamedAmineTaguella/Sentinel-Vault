import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { THEME_PALETTES, type ThemeAccent } from '../types';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: 'trash' | 'lock' | 'warning' | 'info' | 'logout';
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  password?: boolean;
  multiline?: boolean;
  validate?: (v: string) => string | null;
  prefill?: string;
  danger?: boolean;
}

export interface ModalState {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  alert: (title: string, message: string, danger?: boolean) => Promise<void>;
}

const ModalContext = createContext<ModalState>({
  confirm: async () => false,
  prompt: async () => null,
  alert: async () => {},
});

export const useModal = () => useContext(ModalContext);

interface ThemeCtx { theme: ThemeAccent; setTheme: (t: ThemeAccent) => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: 'indigo', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

export function ModalProvider({ children, theme = 'indigo', setTheme = () => {} }: { children: ReactNode; theme?: ThemeAccent; setTheme?: (t: ThemeAccent) => void }) {
  const palette = THEME_PALETTES[theme];
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string; danger: boolean } | null>(null);
  const confirmRes = useRef<((v: boolean) => void) | null>(null);
  const promptRes = useRef<((v: string | null) => void) | null>(null);
  const alertRes = useRef<(() => void) | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const promptInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((res) => {
    confirmRes.current = res;
    setConfirmState(opts);
  }), []);

  const prompt = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.prefill || '');
    setPromptError('');
    return new Promise<string | null>((res) => {
      promptRes.current = res;
      setPromptState(opts);
    });
  }, []);

  const alert = useCallback((title: string, message: string, danger = false) => new Promise<void>((res) => {
    alertRes.current = res;
    setAlertState({ title, message, danger });
  }), []);

  const closeConfirm = (v: boolean) => { confirmRes.current?.(v); confirmRes.current = null; setConfirmState(null); };
  const closePrompt = (v: string | null) => { promptRes.current?.(v); promptRes.current = null; setPromptState(null); setPromptValue(''); setPromptError(''); };
  const closeAlert = () => { alertRes.current?.(); alertRes.current = null; setAlertState(null); };

  const [promptError, setPromptError] = useState('');

  const handlePromptSubmit = () => {
    if (promptState?.validate) {
      const err = promptState.validate(promptValue);
      if (err) { setPromptError(err); return; }
    }
    setPromptError('');
    closePrompt(promptValue);
  };

  const iconFor = (kind?: string) => {
    switch (kind) {
      case 'trash':
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
      case 'lock':
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;
      case 'logout':
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>;
      case 'warning':
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
      default:
        return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ModalContext.Provider value={{ confirm, prompt, alert }}>
        {children}

        {confirmState && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => closeConfirm(false)}>
            <div className="w-[400px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirmState.danger ? 'bg-rose-500/15 text-rose-400' : palette.bgAccent + '/15 ' + palette.text}`}>
                  {iconFor(confirmState.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{confirmState.title}</h3>
                  <p className="text-xs text-white/50 mt-1 leading-relaxed">{confirmState.message}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => closeConfirm(false)} className="btn-secondary h-9 px-4 text-xs">{confirmState.cancelText || 'Cancel'}</button>
                <button onClick={() => closeConfirm(true)} className={`h-9 px-4 text-xs font-semibold rounded-lg transition-all ${confirmState.danger ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'btn-primary'}`}>{confirmState.confirmText || 'Confirm'}</button>
              </div>
            </div>
          </div>
        )}

        {promptState && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => closePrompt(null)}>
            <div className="w-[400px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-white mb-1">{promptState.title}</h3>
              {promptState.message && <p className="text-xs text-white/50 mb-4 leading-relaxed">{promptState.message}</p>}
              {promptState.multiline ? (
                <textarea
                  ref={(el) => { promptInputRef.current = el; }}
                  autoFocus
                  placeholder={promptState.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit(); } }}
                  className="input-glass w-full text-sm h-24 resize-none"
                />
              ) : (
                <input
                  ref={(el) => { promptInputRef.current = el; }}
                  autoFocus
                  type={promptState.password ? 'password' : 'text'}
                  placeholder={promptState.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePromptSubmit(); } }}
                  className="input-glass w-full text-sm"
                />
              )}
              {promptError && <p className="text-[11px] text-rose-400 mt-1">{promptError}</p>}
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => closePrompt(null)} className="btn-secondary h-9 px-4 text-xs">{promptState.cancelText || 'Cancel'}</button>
                <button onClick={handlePromptSubmit} className={`h-9 px-4 text-xs font-semibold rounded-lg transition-all ${promptState.danger ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'btn-primary'}`}>
                  {promptState.confirmText || 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}

        {alertState && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={closeAlert}>
            <div className="w-[400px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alertState.danger ? 'bg-rose-500/15 text-rose-400' : palette.bgAccent + '/15 ' + palette.text}`}>
                  {iconFor(alertState.danger ? 'warning' : 'info')}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{alertState.title}</h3>
                  <p className="text-xs text-white/50 mt-1 leading-relaxed">{alertState.message}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={closeAlert} className="btn-primary h-9 px-5 text-xs">OK</button>
              </div>
            </div>
          </div>
        )}
      </ModalContext.Provider>
    </ThemeContext.Provider>
  );
}
