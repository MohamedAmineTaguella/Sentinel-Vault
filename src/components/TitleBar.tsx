import { useState, useEffect } from 'react';
import { onWindowState, minimizeWindow, maximizeWindow, closeWindow } from '../lib/api';

interface Props {
  title?: string;
  className?: string;
}

export default function TitleBar({ title = 'Sentinel Vault', className = '' }: Props) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const cleanup = onWindowState((state) => setMaximized(state === 'maximized'));
    return () => cleanup();
  }, []);

  return (
    <div className={`flex items-center justify-between h-9 bg-[#080812] border-b border-white/5 shrink-0 select-none ${className}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2 px-3 min-w-0">
        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <span className="text-[11px] text-white/40 font-medium truncate">{title}</span>
      </div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={minimizeWindow} className="w-11 h-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-colors group" title="Minimize">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
        </button>
        <button onClick={maximizeWindow} className="w-11 h-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-colors group" title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
            </svg>
          )}
        </button>
        <button onClick={closeWindow} className="w-11 h-full flex items-center justify-center text-white/30 hover:text-white hover:bg-rose-500/80 transition-colors group" title="Close">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
