import { useState, useEffect, useCallback } from 'react';
import { checkStrength, estimateCrackTime, generatePassphrase } from '../lib/strength';

interface Props { onClose: () => void; }

export default function PasswordGenerator({ onClose }: Props) {
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [passphraseMode, setPassphraseMode] = useState(false);
  const [passphraseWords, setPassphraseWords] = useState(5);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    if (passphraseMode) {
      setPassword(generatePassphrase(passphraseWords));
      return;
    }
    let chars = '';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (excludeAmbiguous) chars = chars.replace(/[il1Lo0O]/g, '');
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      const max = 0x100000000 - (0x100000000 % chars.length);
      let idx = array[i];
      while (idx >= max) idx = crypto.getRandomValues(new Uint32Array(1))[0];
      result += chars[idx % chars.length];
    }
    setPassword(result);
  }, [length, uppercase, lowercase, numbers, symbols, excludeAmbiguous, passphraseMode, passphraseWords]);

  useEffect(() => { generate(); }, [generate]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const strengthInfo = checkStrength(password);
  const strengthColor = strengthInfo.score >= 80 ? 'bg-emerald-500' : strengthInfo.score >= 60 ? 'bg-lime-500' : strengthInfo.score >= 40 ? 'bg-amber-500' : strengthInfo.score >= 20 ? 'bg-orange-500' : 'bg-rose-500';
  const crackTime = estimateCrackTime(password);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[460px] p-6 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </span>
            Password Generator
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="relative mb-4 group">
          <div className="w-full p-4 pr-12 rounded-xl bg-white/[0.02] border border-white/10 text-white/90 text-sm mono break-all font-medium min-h-[60px] flex items-center transition-colors group-hover:border-white/20">
            {password || 'Generating...'}
          </div>
          <button onClick={handleCopy} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2 text-white/40 hover:text-white" title="Copy">
            {copied ? (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            )}
          </button>
        </div>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${strengthColor} transition-all duration-300`} style={{ width: `${strengthInfo.score}%` }} />
            </div>
            <span className="text-[10px] text-white/40 mono w-20 text-right">{strengthInfo.label}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>Crack time:</span>
            <span className="mono">{crackTime}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 p-1 rounded-lg bg-white/[0.03] border border-white/5">
          <button onClick={() => setPassphraseMode(false)} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${!passphraseMode ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/40 hover:text-white/60'}`}>Random</button>
          <button onClick={() => setPassphraseMode(true)} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${passphraseMode ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/40 hover:text-white/60'}`}>Passphrase</button>
        </div>

        {!passphraseMode ? (
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-white/40">Length</span>
                <span className="text-xs text-white/60 mono">{length}</span>
              </div>
              <input type="range" min={6} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Uppercase A-Z', value: uppercase, set: setUppercase },
                { label: 'Lowercase a-z', value: lowercase, set: setLowercase },
                { label: 'Numbers 0-9', value: numbers, set: setNumbers },
                { label: 'Symbols !@#', value: symbols, set: setSymbols },
              ].map((opt) => (
                <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className={`toggle ${opt.value ? 'on' : ''}`} onClick={() => opt.set(!opt.value)} role="switch" aria-checked={opt.value} />
                  <span className="text-[11px] text-white/50 group-hover:text-white/70 transition-colors">{opt.label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div className={`toggle ${excludeAmbiguous ? 'on' : ''}`} onClick={() => setExcludeAmbiguous(!excludeAmbiguous)} role="switch" aria-checked={excludeAmbiguous} />
              <span className="text-[11px] text-white/50 group-hover:text-white/70 transition-colors">Exclude ambiguous (il1Lo0O)</span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-white/40">Words</span>
                <span className="text-xs text-white/60 mono">{passphraseWords}</span>
              </div>
              <input type="range" min={3} max={10} value={passphraseWords} onChange={(e) => setPassphraseWords(Number(e.target.value))} className="w-full" />
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed">Combines {passphraseWords} random words with a number and symbol for memorability and security.</p>
          </div>
        )}

        <button onClick={generate} className="btn-secondary w-full h-10 text-xs mt-5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Regenerate
        </button>
      </div>
    </div>
  );
}
