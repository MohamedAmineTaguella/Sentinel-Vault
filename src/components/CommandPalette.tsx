import { useState, useEffect, useRef, useMemo } from 'react';
import type { VaultEntry } from '../types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_ICONS } from '../types';

interface Props {
  entries: VaultEntry[];
  onSelect: (entry: VaultEntry) => void;
  onCopy: (text: string, label: string) => void;
  onClose: () => void;
}

export default function CommandPalette({ entries, onSelect, onCopy, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return entries.slice(0, 20);
    const q = query.toLowerCase();
    return entries.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      Object.values(e.fields || {}).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [entries, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((p) => Math.min(p + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((p) => Math.max(p - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); onSelect(results[selectedIdx]); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (results[selectedIdx]) {
        const pw = results[selectedIdx].fields?.password || results[selectedIdx].fields?.apiKey || '';
        if (pw) onCopy(pw, 'password');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[500px] max-h-[400px] rounded-2xl glass-premium border border-white/10 shadow-2xl overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input ref={inputRef} type="text" placeholder="Search entries... (Ctrl+C to copy selected password)" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }} onKeyDown={handleKeyDown} className="w-full bg-transparent border-0 border-b border-white/5 text-white/80 text-sm pl-14 pr-5 py-4 outline-none placeholder:text-white/15" />
        </div>
        <div ref={listRef} className="overflow-y-auto max-h-[320px] p-2">
          {results.length === 0 ? (
            <p className="text-center text-xs text-white/15 py-8">No results found</p>
          ) : (
            results.map((entry, idx) => (
              <div key={entry.id} onClick={() => onSelect(entry)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${idx === selectedIdx ? 'bg-indigo-500/15' : 'hover:bg-white/[0.03]'}`}>
                <span className="text-base">{ENTRY_TYPE_ICONS[entry.type || 'password']}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{entry.name}</div>
                  <div className="text-[10px] text-white/20">{ENTRY_TYPE_LABELS[entry.type || 'password']} · {entry.category || 'Other'}</div>
                </div>
                {entry.fields?.password && (
                  <button onClick={(e) => { e.stopPropagation(); onCopy(entry.fields!.password!, 'password'); }} className="btn-ghost p-1.5 text-white/20 hover:text-white/50" title="Copy password">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] text-white/15">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>^C Copy password</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
