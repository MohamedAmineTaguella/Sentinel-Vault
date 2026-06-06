import { useState, useMemo, useEffect } from 'react';
import type { VaultEntry, EntryType } from '../types';
import { ENTRY_TYPE_FIELDS, ENTRY_TEMPLATES, CATEGORIES, ENTRY_TYPE_GROUPS, ENTRY_TYPE_ICONS, ENTRY_COLORS, ENTRY_TYPE_LABELS } from '../types';
import { checkStrength, strengthColor, isBreached, estimateCrackTime } from '../lib/strength';

interface Props {
  entry?: VaultEntry;
  onClose: () => void;
  onSave: (data: Partial<VaultEntry>) => void;
}

const categories = CATEGORIES;
const TAG_COLORS = ['bg-rose-500/20 text-rose-300', 'bg-emerald-500/20 text-emerald-300', 'bg-amber-500/20 text-amber-300', 'bg-sky-500/20 text-sky-300', 'bg-violet-500/20 text-violet-300', 'bg-pink-500/20 text-pink-300', 'bg-cyan-500/20 text-cyan-300', 'bg-lime-500/20 text-lime-300'];
const tagColor = (tag: string) => TAG_COLORS[tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length];

const secretFieldKeys = new Set(['password', 'apiKey', 'productKey', 'privateKey', 'seedPhrase', 'passphrase', 'cvv', 'pin', 'documentNumber']);

export default function AddEntryModal({ entry, onClose, onSave }: Props) {
  const [type, setType] = useState<EntryType>(entry?.type || 'password');
  const [name, setName] = useState(entry?.name || '');
  const [category, setCategory] = useState(entry?.category || 'Other');
  const [fields, setFields] = useState<Record<string, string>>(entry?.fields ? { ...entry.fields } : {});
  const [notes, setNotes] = useState(entry?.notes || '');
  const [favorite, setFavorite] = useState(entry?.favorite || false);
  const [twofa, setTwofa] = useState(entry?.twofa || false);
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldVal, setCustomFieldVal] = useState('');
  const [color, setColor] = useState<string | null>(entry?.color || null);
  const sensitiveTypes = new Set(['card', 'wallet', 'identity', 'ssh']);
  const [entryPassword, setEntryPassword] = useState('');
  const [enableEntryLock, setEnableEntryLock] = useState(!!entry?.entryPasswordHash);
  const [revealFields, setRevealFields] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState('');

  const isEdit = !!entry;
  const fieldDefs = ENTRY_TYPE_FIELDS[type];

  useEffect(() => { if (!isEdit) setEnableEntryLock(sensitiveTypes.has(type)); }, [type, isEdit]);

  const handleTypeChange = (newType: EntryType) => {
    setType(newType);
    const oldKeys = ENTRY_TYPE_FIELDS[type];
    const newKeys = ENTRY_TYPE_FIELDS[newType];
    const toRemove = new Set(oldKeys.map((k) => k.key));
    newKeys.forEach((k) => toRemove.delete(k.key));
    setFields((prev) => {
      const next = { ...prev };
      toRemove.forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleTemplate = (templateName: string) => {
    const tpl = ENTRY_TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    setType(tpl.type);
    if (!name) setName(tpl.name);
    if (tpl.category) setCategory(tpl.category);
    setFields((prev) => {
      const next = { ...prev };
      tpl.fields.forEach((f) => { if (!next[f.key]) next[f.key] = f.value || ''; });
      return next;
    });
  };

  const customKeys = useMemo(() => Object.keys(fields).filter((k) => !fieldDefs.some((fd) => fd.key === k) && k !== 'totpSecret'), [fields, fieldDefs]);

  const addCustomField = () => {
    if (!customFieldKey.trim()) return;
    setFields((prev) => ({ ...prev, [customFieldKey.trim()]: customFieldVal }));
    setCustomFieldKey('');
    setCustomFieldVal('');
  };

  const removeCustomField = (key: string) => {
    setFields((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleGeneratePassword = (key: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const len = 24;
    const array = new Uint32Array(len);
    crypto.getRandomValues(array);
    let pw = '';
    for (let i = 0; i < len; i++) {
      const max = 0x100000000 - (0x100000000 % chars.length);
      let idx = array[i];
      while (idx >= max) idx = crypto.getRandomValues(new Uint32Array(1))[0];
      pw += chars[idx % chars.length];
    }
    setFields((prev) => ({ ...prev, [key]: pw }));
    setRevealFields((s) => new Set(s).add(key));
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (enableEntryLock && !entryPassword) { setSaveError('Enter an entry password or disable the lock'); return; }
    setSaveError('');
    const data: Partial<VaultEntry> = {
      name: name.trim(), type, category, fields, notes, favorite, twofa,
      tags, color: color || undefined,
    };
    /* Per-entry lock handling:
     *  - If toggle is ON and password is provided → set/change lock to this password
     *  - If toggle is OFF but the entry was previously locked → remove the lock
     *  - Otherwise (toggle is OFF and entry was unlocked) → no change
     */
    if (enableEntryLock && entryPassword) {
      data.entryLockPassword = entryPassword;
    } else if (!enableEntryLock && entry?.entryPasswordHash) {
      data.removeEntryLock = true;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[580px] max-h-[88vh] overflow-y-auto p-7 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold tracking-tight">{isEdit ? 'Edit Entry' : 'New Entry'}</h2>
            <p className="text-[11px] text-white/30 mt-0.5">{isEdit ? 'Update vault entry' : 'Add a new secure entry'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {!isEdit && (
          <div className="mb-5">
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2 block">Quick Templates</label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {ENTRY_TEMPLATES.map((tpl) => (
                <button key={tpl.name} onClick={() => handleTemplate(tpl.name)} className={`px-2.5 py-1 text-[10px] rounded-md border transition-all ${name === tpl.name ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200' : 'bg-white/[0.02] border-white/5 text-white/40 hover:border-white/15 hover:text-white/60'}`}>
                  <span className="mr-1">{ENTRY_TYPE_ICONS[tpl.type]}</span>{tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Name</label>
            <input type="text" placeholder="e.g. Gmail Account" value={name} onChange={(e) => setName(e.target.value)} className="input-glass w-full text-sm h-10" autoFocus />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Type</label>
              <select value={type} onChange={(e) => handleTypeChange(e.target.value as EntryType)} className="input-glass w-full text-xs h-10">
                {ENTRY_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((t) => <option key={t} value={t}>{ENTRY_TYPE_ICONS[t]} {ENTRY_TYPE_LABELS[t]}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-glass w-full text-xs h-10">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Color Tag</label>
            <div className="flex gap-1.5">
              <button onClick={() => setColor(null)} className={`w-6 h-6 rounded-md border transition-all ${!color ? 'border-white/40 scale-110' : 'border-white/10 opacity-50 hover:opacity-80'}`} style={{ background: 'rgba(255,255,255,0.05)' }} />
              {ENTRY_COLORS.map((c) => (
                <button key={c.value} onClick={() => setColor(c.value)} title={c.name} className={`w-6 h-6 rounded-md border-2 transition-all bg-gradient-to-br ${c.gradient} ${color === c.value ? 'border-white/40 scale-110' : 'border-white/5 hover:border-white/20'}`} />
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {fieldDefs.map((fd) => {
              const value = fields[fd.key] || '';
              const isSecret = secretFieldKeys.has(fd.key);
              const strengthInfo = value ? checkStrength(value) : null;
              const breached = value && isBreached(value);
              return (
                <div key={fd.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider">{fd.label}</label>
                    {isSecret && value && (
                      <span className="text-[9px] mono text-white/30">{estimateCrackTime(value)}</span>
                    )}
                  </div>
                  {fd.type === 'url' || fd.key === 'url' || fd.key === 'endpointUrl' ? (
                    <input type="url" placeholder={fd.placeholder || 'https://...'} value={value} onChange={(e) => setFields((p) => ({ ...p, [fd.key]: e.target.value }))} className="input-glass w-full text-sm h-10" />
                  ) : fd.type === 'date' || fd.key === 'dateOfBirth' || fd.key === 'expiry' || fd.key === 'purchaseDate' || fd.key === 'expiryDate' ? (
                    <input type="text" placeholder={fd.placeholder || fd.label} value={value} onChange={(e) => setFields((p) => ({ ...p, [fd.key]: e.target.value }))} className="input-glass w-full text-sm h-10" />
                  ) : fd.key === 'address' || fd.key === 'billingAddress' || fd.key === 'privateKey' || fd.key === 'seedPhrase' || fd.key === 'apiKey' ? (
                    <textarea placeholder={fd.label} value={value} onChange={(e) => setFields((p) => ({ ...p, [fd.key]: e.target.value }))} className="input-glass w-full text-sm resize-none h-20 mono" />
                  ) : (
                    <div className="relative">
                      <input type={isSecret && !revealFields.has(fd.key) ? 'password' : 'text'} placeholder={fd.label} value={value} onChange={(e) => setFields((p) => ({ ...p, [fd.key]: e.target.value }))} className="input-glass w-full text-sm h-10 pr-20" />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {isSecret && value && (
                          <button type="button" onClick={() => setRevealFields((s) => { const n = new Set(s); n.has(fd.key) ? n.delete(fd.key) : n.add(fd.key); return n; })} className="p-1.5 text-white/30 hover:text-white/60 transition-colors" title={revealFields.has(fd.key) ? 'Hide' : 'Reveal'}>
                            {revealFields.has(fd.key) ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            )}
                          </button>
                        )}
                        <button type="button" onClick={() => handleGeneratePassword(fd.key)} className="p-1.5 text-indigo-400/70 hover:text-indigo-300 transition-colors" title="Generate">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {isSecret && value && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full rounded-full ${strengthColor(strengthInfo!.score)} transition-all`} style={{ width: `${strengthInfo!.score}%` }} />
                        </div>
                        <span className="text-[9px] text-white/30 mono w-20 text-right">{strengthInfo!.label}</span>
                      </div>
                      {breached && (
                        <p className="text-[9px] text-rose-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                          Found in known breaches
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-3 mt-3 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`toggle ${twofa ? 'on' : ''}`} onClick={() => setTwofa(!twofa)} role="switch" aria-checked={twofa} />
              <div className="flex-1">
                <div className="text-xs text-white/60 group-hover:text-white/80">Enable TOTP 2FA</div>
                <div className="text-[10px] text-white/25">Auto-generate codes from secret</div>
              </div>
            </label>

            {twofa && (
              <div className="animate-slide-up">
                <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1 block">TOTP Secret (Base32)</label>
                <input type="text" placeholder="JBSWY3DPEHPK3PXP" value={fields.totpSecret || ''} onChange={(e) => setFields((p) => ({ ...p, totpSecret: e.target.value.toUpperCase() }))} className="input-glass w-full text-sm h-10 mono" />
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`toggle ${enableEntryLock ? 'on' : ''}`} onClick={() => setEnableEntryLock(!enableEntryLock)} role="switch" aria-checked={enableEntryLock} />
              <div className="flex-1">
                <div className="text-xs text-white/60 group-hover:text-white/80 flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Lock this entry with a password
                </div>
                <div className="text-[10px] text-white/25">Required to view this entry's contents</div>
              </div>
            </label>

            {enableEntryLock && (
              <div className="animate-slide-up">
                <input type="password" placeholder="Entry password (min 4 chars)" value={entryPassword} onChange={(e) => { setEntryPassword(e.target.value); setSaveError(''); }} className="input-glass w-full text-sm h-10" />
              </div>
            )}
            {saveError && <p className="text-[11px] text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-1.5 animate-fade-in">{saveError}</p>}

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`toggle ${favorite ? 'on' : ''}`} onClick={() => setFavorite(!favorite)} role="switch" aria-checked={favorite} style={favorite ? { background: 'linear-gradient(135deg, #f59e0b, #f97316)' } : {}} />
              <div className="flex-1">
                <div className="text-xs text-white/60 group-hover:text-white/80 flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-amber-400" fill={favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                  Add to favorites
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Custom Fields</label>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Field name" value={customFieldKey} onChange={(e) => setCustomFieldKey(e.target.value)} className="input-glass flex-1 text-xs h-9" />
              <input type="text" placeholder="Value" value={customFieldVal} onChange={(e) => setCustomFieldVal(e.target.value)} className="input-glass flex-1 text-xs h-9" />
              <button onClick={addCustomField} className="btn-primary px-3 text-xs h-9">+</button>
            </div>
            {customKeys.map((k) => (
              <div key={k} className="flex items-center gap-2 mb-1 group">
                <span className="text-[10px] text-white/30 w-20 truncate">{k}</span>
                <input type="text" value={fields[k] || ''} onChange={(e) => setFields((p) => ({ ...p, [k]: e.target.value }))} className="input-glass flex-1 text-xs h-9" />
                <button onClick={() => removeCustomField(k)} className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 text-rose-400">✕</button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className={`tag-pill ${tagColor(t)}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 hover:opacity-60">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Add tag (Enter)" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey} className="input-glass flex-1 text-xs h-9" />
              <button onClick={addTag} className="btn-primary px-3 text-xs h-9">+</button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5 block">Notes</label>
            <textarea placeholder="Secure notes (encrypted)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-glass w-full text-sm resize-none h-20" />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
          <button onClick={onClose} className="btn-secondary flex-1 h-10 text-xs">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 h-10 text-xs font-semibold">{isEdit ? 'Update Entry' : 'Add Entry'}</button>
        </div>
      </div>
    </div>
  );
}
