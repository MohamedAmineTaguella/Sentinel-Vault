import { useState, useRef, useCallback, useEffect } from 'react';
import type { VaultEntry, EntryType, AttachmentMeta } from '../types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_FIELDS, ENTRY_TYPE_ICONS } from '../types';
import { getAttachment, touchEntry, unlockEntry as apiUnlockEntry, logUI, isEntryLocked as apiIsEntryLocked } from '../lib/api';
import { checkStrength, isBreached, strengthColor, estimateCrackTime } from '../lib/strength';
import { useModal } from './Modal';
import { generateTOTP } from '../lib/totp';

interface Props {
  entry: VaultEntry;
  onClose: () => void;
  onEdit: (entry: VaultEntry) => void;
  onCopy: (text: string, label: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (entry: VaultEntry) => void;
  onDuplicate: (entry: VaultEntry) => void;
  onAttach: (entryId: string, files?: FileList) => void;
  onDownload: (entryId: string, att: AttachmentMeta) => void;
  onDeleteAttachment: (entryId: string, attId: string) => void;
  onSetEntryLock: (entryId: string, password: string) => void;
  onRemoveEntryLock: (entryId: string) => void;
  onUnlock?: (entryId: string) => void;
}

const secretKeysByType: Record<EntryType, string[]> = {
  password: ['password'], card: ['cardNumber', 'cvv', 'pin'], note: [], api: ['apiKey'],
  identity: ['documentNumber'], license: ['productKey'], ssh: ['privateKey', 'passphrase'],
  wallet: ['seedPhrase', 'privateKey'], database: ['password'],
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const mimeIcon = (mime: string) => {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  if (mime.includes('document') || mime.includes('word')) return '📝';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '📦';
  return '📎';
};

export default function EntryDetailPanel({ entry, onClose, onEdit, onCopy, onToggleFavorite, onDelete, onDuplicate, onAttach, onDownload, onDeleteAttachment, onSetEntryLock, onRemoveEntryLock, onUnlock }: Props) {
  const { prompt, confirm } = useModal();
  const [entryLocked, setEntryLocked] = useState(!!entry.entryPasswordHash);
  const [entryUnlocked, setEntryUnlocked] = useState(!entry.entryPasswordHash);
  const [unlockPwd, setUnlockPwd] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const fields = ENTRY_TYPE_FIELDS[entry.type || 'password'];
  const secrets = secretKeysByType[entry.type || 'password'] || [];
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<AttachmentMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpRemaining, setTotpRemaining] = useState(30);
  const attachments = entry.attachments || [];
  const dragCounter = useRef(0);
  const totpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const thumbCache = useRef<Map<string, string>>(new Map());
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());
  const prevEntryId = useRef<string | null>(null);
  const onUnlockRef = useRef(onUnlock);

  useEffect(() => { onUnlockRef.current = onUnlock; });

  useEffect(() => {
    if (prevEntryId.current !== entry.id) {
      prevEntryId.current = entry.id;
      setEntryLocked(!!entry.entryPasswordHash);
      setEntryUnlocked(!entry.entryPasswordHash);
      if (entry.entryPasswordHash) {
        apiIsEntryLocked(entry.id).then((r) => {
          if (r.success && !r.data) {
            setEntryLocked(false);
            setEntryUnlocked(true);
            onUnlockRef.current?.(entry.id);
          }
        });
      }
    }
    setUnlockPwd('');
    setUnlockError('');
    touchEntry(entry.id);
  }, [entry.id, entry.entryPasswordHash]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (previewUrl) return;
    if (entry.twofa && entry.fields?.totpSecret && entryUnlocked) {
      const update = async () => {
        const r = await generateTOTP(entry.fields!.totpSecret!);
        setTotpCode(r.code); setTotpRemaining(r.remaining);
      };
      update(); totpTimer.current = setInterval(update, 1000);
    }
    return () => { if (totpTimer.current) clearInterval(totpTimer.current); };
  }, [entry.twofa, entry.fields?.totpSecret, previewUrl, entryUnlocked]);

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const displayValue = (key: string, value: string): string => {
    if (!value) return '—';
    if (secrets.includes(key) && !revealedFields.has(key)) {
      return value.length > 4 ? value.slice(0, 4) + '•'.repeat(Math.min(value.length - 4, 12)) : '•'.repeat(value.length);
    }
    return value;
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items?.length) setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (!dragCounter.current) setDragOver(false); };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); dragCounter.current = 0; if (e.dataTransfer.files?.length) onAttach(entry.id, e.dataTransfer.files); };

  const loadThumbnail = async (att: AttachmentMeta) => {
    if (thumbCache.current.has(att.id)) return;
    if (!att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/')) return;
    const result = await getAttachment(entry.id, att.id);
    if (result.success && result.data) {
      const blob = new Blob([new Uint8Array(result.data)], { type: att.mimeType });
      const url = URL.createObjectURL(blob);
      thumbCache.current.set(att.id, url);
      setThumbUrls(new Map(thumbCache.current));
    }
  };

  useEffect(() => {
    const mounted = { current: true };
    for (const att of attachments) {
      if (!thumbCache.current.has(att.id) && (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/'))) {
        getAttachment(entry.id, att.id).then((result) => {
          if (!mounted.current || !result.success || !result.data) return;
          const blob = new Blob([new Uint8Array(result.data)], { type: att.mimeType });
          thumbCache.current.set(att.id, URL.createObjectURL(blob));
          setThumbUrls(new Map(thumbCache.current));
        });
      }
    }
    return () => {
      mounted.current = false;
      thumbCache.current.forEach((url) => URL.revokeObjectURL(url));
      thumbCache.current.clear();
      setThumbUrls(new Map());
    };
  }, [entry.id]);

  const handlePreview = async (att: AttachmentMeta) => {
    if (!att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/')) return;
    setPreviewLoading(true); setPreviewAtt(att);
    const result = await getAttachment(entry.id, att.id);
    if (result.success && result.data) {
      const blob = new Blob([new Uint8Array(result.data)], { type: att.mimeType });
      setPreviewUrl(URL.createObjectURL(blob));
    }
    setPreviewLoading(false);
  };

  const closePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewAtt(null); };

  const handleUnlockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!unlockPwd) { setUnlockError('Enter the entry password'); return; }
    const r = await apiUnlockEntry(entry.id, unlockPwd);
    if (r.success) {
      setEntryUnlocked(true);
      setUnlockPwd('');
      onUnlock?.(entry.id);
      logUI('view', `Unlocked entry ${entry.name}`, entry.id);
    } else setUnlockError(r.error || 'Wrong password');
  };

  const handleCopy = (text: string, label: string) => {
    onCopy(text, label);
  };

  const renderField = (field: { key: string; label: string; type?: string; placeholder?: string }, idx: number) => {
    const value = entry.fields?.[field.key] || '';
    const isSecret = secrets.includes(field.key);
    return (
      <div key={field.key} className="group animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
        <div className="text-[10px] text-white/25 font-medium uppercase tracking-wider mb-1">{field.label}</div>
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5 group-hover:border-white/10 hover:bg-white/[0.04] transition-all min-h-[40px]">
          {field.key === 'url' || field.key === 'endpointUrl' ? (
            value.match(/^https?:\/\//i) ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-2 truncate flex items-center gap-1.5">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V12m-6-6h6m0 0v6m0-6L9 15" /></svg>
                {value}
              </a>
            ) : (
              <span className="text-sm text-white/60 break-all">{value || '—'}</span>
            )
          ) : (
            <span className={`text-sm break-all ${isSecret ? 'tracking-wider text-white/70 mono' : 'text-white/80'}`}>{displayValue(field.key, value)}</span>
          )}
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            {value && isSecret && (
              <button onClick={() => toggleReveal(field.key)} className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100 transition-opacity" title={revealedFields.has(field.key) ? 'Hide' : 'Reveal'}>
                {revealedFields.has(field.key) ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            )}
            {value && (
              <button onClick={() => handleCopy(value, field.label)} className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100 transition-opacity" title={`Copy ${field.label}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {value && secrets.includes(field.key) && isBreached(value) && revealedFields.has(field.key) && (
          <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            Found in known breaches — change it
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-96 border-l border-white/5 glass overflow-y-auto animate-slide-in-right" onDragEnter={handleDragEnter}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-sm truncate mr-2">{entry.name}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-white/5">
            {ENTRY_TYPE_ICONS[entry.type || 'password']}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium">{ENTRY_TYPE_LABELS[entry.type || 'password']}</div>
            <div className="text-white/30 text-xs">{entry.category}</div>
          </div>
          {entry.favorite && <span className="text-amber-400">★</span>}
        </div>

        {entryLocked && !entryUnlocked ? (
          <form onSubmit={handleUnlockEntry} className="space-y-3 mb-5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <div className="flex items-center gap-2 text-amber-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              <span className="text-xs font-semibold">Entry Locked</span>
            </div>
            <p className="text-[11px] text-white/40">This entry has its own password. Enter it to view contents.</p>
            <input type="password" autoFocus placeholder="Entry password" value={unlockPwd} onChange={(e) => setUnlockPwd(e.target.value)} className="input-glass w-full text-sm h-10" />
            {unlockError && <p className="text-[11px] text-rose-400">{unlockError}</p>}
            <button type="submit" className="btn-primary w-full h-9 text-xs font-semibold">Unlock Entry</button>
          </form>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              {fields.map(renderField)}
              {entry.twofa && entry.fields?.totpSecret && (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider">2FA Code</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
                      <span className="text-[9px] text-emerald-400 mono">LIVE</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-emerald-400 mono tracking-[0.2em]">{totpCode}</span>
                    <button onClick={() => handleCopy(totpCode, '2FA code')} className="btn-ghost p-1.5" title="Copy 2FA code">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400 transition-all duration-1000" style={{ width: `${(totpRemaining / 30) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-white/30 mono">{totpRemaining}s</span>
                  </div>
                </div>
              )}

              {entry.notes && (
                <div>
                  <div className="text-[10px] text-white/25 font-medium uppercase tracking-wider mb-1">Notes</div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-white/60 text-sm whitespace-pre-wrap">{entry.notes}</div>
                </div>
              )}

              {entry.tags && entry.tags.length > 0 && (
                <div>
                  <div className="text-[10px] text-white/25 font-medium uppercase tracking-wider mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <span key={t} className="tag-pill bg-indigo-500/15 text-indigo-200">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Attachments ({attachments.length})</div>
                  <button onClick={() => onAttach(entry.id)} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
                </div>
                {dragOver && (
                  <div className="drag-overlay">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-indigo-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      <p className="text-indigo-300 text-xs font-medium">Drop files to attach</p>
                    </div>
                  </div>
                )}
                {attachments.length === 0 ? (
                  <div className="text-xs text-white/20 italic py-3 px-3 border border-dashed border-white/5 rounded-lg text-center">Drop files here or click + Add</div>
                ) : (
                  <div className="space-y-1">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 group hover:border-white/10 hover:bg-white/[0.04] transition-all">
                        {thumbUrls.has(att.id) ? (
                          <button onClick={() => handlePreview(att)} className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5 hover:border-white/20 transition-colors" title="Preview">
                            <img src={thumbUrls.get(att.id)} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/') ? (
                          <button onClick={() => handlePreview(att)} className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors" title="Preview">
                            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                        ) : <span className="text-sm shrink-0 w-10 h-10 rounded bg-white/5 flex items-center justify-center">{mimeIcon(att.mimeType)}</span>}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/70 truncate">{att.name}</div>
                          <div className="text-[10px] text-white/25">{formatSize(att.size)}</div>
                        </div>
                        <button onClick={() => onDownload(entry.id, att)} className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100 transition-opacity" title="Download">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        </button>
                        <button onClick={() => onDeleteAttachment(entry.id, att.id)} className="btn-ghost p-1.5 opacity-60 group-hover:opacity-100 transition-opacity hover:text-rose-400" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/20 pt-2 border-t border-white/5">
                <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
                {entry.lastUsedAt && <span>Used {new Date(entry.lastUsedAt).toLocaleDateString()}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
              <button onClick={() => onToggleFavorite(entry.id)} className={`btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2 ${entry.favorite ? 'text-amber-400' : ''}`}>
                <svg className="w-4 h-4" fill={entry.favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                {entry.favorite ? 'Remove Favorite' : 'Add to Favorites'}
              </button>
              <button onClick={() => { onEdit(entry); onClose(); }} className="btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                Edit Entry
              </button>
              {entry.entryPasswordHash ? (
                <button onClick={() => { onRemoveEntryLock(entry.id); }} className="btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2 text-amber-400 hover:text-amber-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Remove Entry Lock
                </button>
              ) : (
                <button onClick={async () => {
                  const pwd = await prompt({ title: 'Lock this entry', message: 'Set a password (min 4 chars) to require a password each time you view this entry.', placeholder: 'Entry password', password: true, validate: (v) => v.length < 4 ? 'Min 4 characters' : null });
                  if (pwd) onSetEntryLock(entry.id, pwd);
                }} className="btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2 text-amber-400 hover:text-amber-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Lock This Entry
                </button>
              )}
              <button onClick={() => { onDuplicate(entry); onClose(); }} className="btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                Duplicate
              </button>
              <button onClick={() => onDelete(entry)} className="btn-secondary w-full h-9 text-xs flex items-center justify-center gap-2 hover:text-rose-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.96 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {previewUrl && previewAtt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={closePreview}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={closePreview} className="absolute -top-10 right-0 btn-ghost p-1 text-white/50 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {previewAtt.mimeType.startsWith('image/') ? (
              <img src={previewUrl} alt={previewAtt.name} className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            ) : (
              <video src={previewUrl} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl" />
            )}
            <p className="text-white/60 text-xs text-center mt-2">{previewAtt.name}</p>
          </div>
        </div>
      )}
      {previewLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
