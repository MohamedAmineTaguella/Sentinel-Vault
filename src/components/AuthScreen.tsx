import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api';
import { useModal, useTheme } from './Modal';
import { checkStrength } from '../lib/strength';
import { THEME_PALETTES } from '../types';
import TitleBar from './TitleBar';

interface Props {
  onSuccess: () => void;
  onUsernameChange: (u: string) => void;
}

export default function AuthScreen({ onSuccess, onUsernameChange }: Props) {
  const { theme } = useTheme();
  const palette = THEME_PALETTES[theme];
  const { confirm, alert, prompt } = useModal();

  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [mode, setMode] = useState<'userlist' | 'login' | 'register'>('userlist');
  const [step, setStep] = useState<'creds' | '2fa'>('creds');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const reg = await api.checkRegistered();
      if (!mounted) return;
      if (!reg.success) { setMode('register'); return; }
      const ul = await api.getUserList();
      if (!mounted) return;
      if (ul.success && ul.data.length > 0) {
        setUsers(ul.data);
        setMode('userlist');
      } else {
        setMode('register');
      }
      const pinStat = await api.hasPin();
      if (!mounted) return;
      if (pinStat.success) setHasPin(pinStat.data);
      const bioAvail = await api.isBiometricAvailable();
      if (!mounted) return;
      if (bioAvail.success) setBioAvailable(bioAvail.data);
      if (bioAvail.data) {
        const bioEn = await api.isBiometricEnabled();
        if (!mounted) return;
        if (bioEn.success) setBioEnabled(bioEn.data);
      }
      const rem = await api.getRememberMe();
      if (!mounted) return;
      if (rem.success && rem.data) {
        setRemember(true);
        const un = await api.getUsername();
        if (!mounted) return;
        if (un.success && un.data && ul.data.includes(un.data)) {
          setSelectedUser(un.data);
          setMode('login');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) { setError('Enter your master password'); triggerShake(); return; }
    setLoading(true);
    const result = await api.login(selectedUser, password);
    if (result.success) {
      await api.setUsername(selectedUser);
      if (remember) await api.setRememberMe(true); else await api.setRememberMe(false);
      onUsernameChange(selectedUser);
      onSuccess();
    } else if (result.requires2fa) {
      setStep('2fa');
      setLoading(false);
    } else {
      setError(result.error || 'Wrong master password');
      triggerShake();
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!totpCode || totpCode.length < 6) { setError('Enter the 6-digit code'); triggerShake(); return; }
    setLoading(true);
    const result = await api.login(selectedUser, password, totpCode);
    if (result.success) {
      if (remember) await api.setRememberMe(true); else await api.setRememberMe(false);
      onUsernameChange(selectedUser);
      onSuccess();
    } else {
      setError(result.error || 'Invalid authenticator code');
      setTotpCode('');
      triggerShake();
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Enter a username'); triggerShake(); return; }
    if (!password) { setError('Enter your master password'); triggerShake(); return; }
    if (password.length < 8) { setError('Password must be 8+ characters'); triggerShake(); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); triggerShake(); return; }
    const strength = checkStrength(password);
    if (strength.score < 40) {
      const proceed = await confirm({
        title: 'Weak master password',
        message: `Your master password is "${strength.label.toLowerCase()}". A weak master password is the weakest link in your vault's security. Use it anyway?`,
        confirmText: 'Use anyway',
        cancelText: 'Choose another',
        danger: true,
      });
      if (!proceed) return;
    }
    setLoading(true);
    const result = await api.register(username.trim(), password);
    if (result.success) {
      await api.setUsername(username.trim());
      if (remember) await api.setRememberMe(true);
      onUsernameChange(username.trim());
      onSuccess();
    } else {
      setError(result.error || 'Registration failed');
      triggerShake();
    }
    setLoading(false);
  };

  const handleDeleteUser = async (u: string) => {
    const pw = await prompt({
      title: `Delete "${u}"`,
      message: 'Enter your master password to confirm deletion. All vault data for this user will be permanently lost.',
      placeholder: 'Master password',
      password: true,
      confirmText: 'Delete',
    });
    if (!pw) return;
    const doDelete = async (totpCode?: string) => {
      setLoading(true);
      const result = await api.deleteUser(u, pw, totpCode);
      if (result.success) {
        const ul = await api.getUserList();
        if (ul.success) {
          setUsers(ul.data);
          if (ul.data.length === 0) { setMode('register'); setSelectedUser(''); }
        }
      } else if (result.requires2fa) {
        const code = await prompt({ title: 'Authenticator required', message: 'Enter the 6-digit code from your authenticator app', placeholder: '000 000', validate: (v: string) => v.length < 6 ? 'Enter 6 digits' : null });
        if (code) doDelete(code);
      } else {
        setError(result.error || 'Failed to delete user');
      }
      setLoading(false);
    };
    doDelete();
  };

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pin) { setError('Enter your PIN'); triggerShake(); return; }
    setLoading(true);
    const result = await api.unlockWithPin(pin);
    if (result.success) {
      const cun = await api.getCurrentUsername();
      onUsernameChange(cun.success && cun.data ? cun.data : 'User');
      onSuccess();
    } else {
      setError(result.error || 'Wrong PIN');
      triggerShake();
    }
    setLoading(false);
  };

  const handleBiometricUnlock = async () => {
    setBioLoading(true);
    setError('');
    const result = await api.unlockWithBiometric();
    if (result.success) {
      const cun = await api.getCurrentUsername();
      onUsernameChange(cun.success && cun.data ? cun.data : 'User');
      onSuccess();
    } else {
      setError(result.error || 'Biometric unlock failed');
      triggerShake();
    }
    setBioLoading(false);
  };

  const selectUser = async (u: string) => {
    setSelectedUser(u);
    setPassword('');
    setError('');
    setStep('creds');
    setMode('login');
  };

  const strength = password ? checkStrength(password) : null;
  const strengthBars = strength ? Math.max(1, Math.ceil(strength.score / 25)) : 0;

  if (pinMode && hasPin) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#050510]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-float-slow" style={{ background: palette.glow }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none animate-float-slow" style={{ background: 'rgba(139,92,246,0.06)', animationDelay: '-5s' }} />
        <form onSubmit={handlePinUnlock} className={`relative w-[380px] p-8 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border shadow-lg" style={{ background: `linear-gradient(135deg, ${palette.glow}, rgba(139,92,246,0.04))`, borderColor: palette.ring }}>
              <svg className="w-7 h-7" style={{ color: palette.primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Quick Unlock</h1>
            <p className="text-sm text-white/30 mt-1.5">Enter your PIN to unlock</p>
          </div>
          <div className="space-y-4">
            <input type="password" inputMode="numeric" placeholder="● ● ● ●" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} className="input-glass w-full text-center text-2xl tracking-[0.5em] h-14" maxLength={10} autoFocus />
            {error && <p className="text-[11px] text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-2 animate-fade-in">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full h-11 text-sm font-semibold">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Unlock'}
            </button>
            <button type="button" onClick={() => { setPinMode(false); setPin(''); setError(''); }} className="btn-ghost w-full text-xs text-white/20 hover:text-white/40 py-2">Use master password instead</button>
          </div>
        </form>
        </div>
      </div>
    );
  }

  if (step === '2fa') {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#050510]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <form onSubmit={handle2FASubmit} className={`relative w-[400px] p-8 rounded-2xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
              <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Authenticator Code</h1>
            <p className="text-sm text-white/30 mt-1.5">Enter the 6-digit code from your app</p>
          </div>
          <div className="space-y-4">
            <input type="text" inputMode="numeric" placeholder="000 000" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input-glass w-full text-center text-2xl tracking-[0.4em] h-14 mono" maxLength={6} autoFocus />
            {error && <p className="text-[11px] text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-2 animate-fade-in">{error}</p>}
            <button type="submit" disabled={loading || totpCode.length < 6} className="btn-primary w-full h-11 text-sm font-semibold">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify'}
            </button>
            <button type="button" onClick={() => { setStep('creds'); setTotpCode(''); setError(''); }} className="btn-ghost w-full text-xs text-white/20 hover:text-white/40 py-2">Back</button>
          </div>
        </form>
        </div>
      </div>
    );
  }

  /* User list screen */
  if (mode === 'userlist') {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#050510]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="absolute inset-0 bg-dots pointer-events-none opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-float-slow" style={{ background: palette.glow }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none animate-float-slow" style={{ background: 'rgba(139,92,246,0.06)', animationDelay: '-5s' }} />
        <div className="relative w-[420px] p-9 rounded-3xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg">
          <div className="text-center mb-8">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-3xl animate-pulse-glow" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, opacity: 0.3 }} />
              <div className="relative w-full h-full rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${palette.glow}, rgba(255,255,255,0.02))`, border: `1px solid ${palette.ring}` }}>
                <svg className="w-10 h-10" style={{ color: palette.primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sentinel Vault</h1>
            <p className="text-sm text-white/30 mt-1.5">Choose an account to unlock</p>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
            {users.map((u) => (
              <div key={u} className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer" onClick={() => selectUser(u)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${palette.glow}, rgba(255,255,255,0.02))`, border: `1px solid ${palette.ring}` }}>
                    <span className="text-sm font-semibold" style={{ color: palette.primary }}>{u.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-white/80 font-medium truncate">{u}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }} className="p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Delete user">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                  <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
            <button onClick={() => setMode('register')} className="btn-secondary w-full h-11 text-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Account
            </button>
            {hasPin && (
              <button type="button" onClick={() => { setPinMode(true); setError(''); }} className="btn-ghost w-full text-xs text-white/25 hover:text-white/50 py-2">Use PIN to unlock</button>
            )}
            {bioAvailable && bioEnabled && (
              <button type="button" onClick={handleBiometricUnlock} disabled={bioLoading} className="btn-ghost w-full text-xs text-white/25 hover:text-white/50 py-2 flex items-center justify-center gap-2">
                {bioLoading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                    </svg>
                    Windows Hello
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-center mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-white/15 tracking-wider">AES-256-GCM · PBKDF2-SHA512 · 600,000 iterations</p>
          </div>
        </div>
        </div>
      </div>
    );
  }

  /* Registration form */
  if (mode === 'register') {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#050510]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="absolute inset-0 bg-dots pointer-events-none opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-float-slow" style={{ background: palette.glow }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none animate-float-slow" style={{ background: 'rgba(139,92,246,0.06)', animationDelay: '-5s' }} />
        <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-[140px] pointer-events-none animate-float-slow" style={{ background: 'rgba(236,72,153,0.04)', animationDelay: '-8s' }} />
        <form onSubmit={handleRegister} className={`relative w-[420px] p-9 rounded-3xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-3xl animate-pulse-glow" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, opacity: 0.3 }} />
              <div className="relative w-full h-full rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${palette.glow}, rgba(255,255,255,0.02))`, border: `1px solid ${palette.ring}` }}>
                <svg className="w-10 h-10" style={{ color: palette.primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create Your Vault</h1>
            <p className="text-sm text-white/30 mt-1.5">Set up your first account</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
                <input type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} className="input-glass w-full pl-11 h-11" autoFocus />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Master Password</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input type={showPassword ? 'text' : 'password'} placeholder="Create master password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="input-glass w-full pl-11 pr-11 h-11" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors p-1">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1 animate-fade-in">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex-1 rounded-full transition-all duration-300" style={{
                        background: i <= strengthBars ? (strength!.score >= 80 ? '#22c55e' : strength!.score >= 60 ? '#84cc16' : strength!.score >= 40 ? '#eab308' : '#f97316') : 'rgba(255,255,255,0.06)',
                      }} />
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 text-right">{strength?.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Confirm Password</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <input type={showPassword ? 'text' : 'password'} placeholder="Confirm master password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-glass w-full pl-11 h-11" />
              </div>
            </div>
            {error && <p className="text-xs text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-2 animate-fade-in">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-sm font-semibold mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Create Vault</>
              )}
            </button>
            {users.length > 0 && (
              <button type="button" onClick={() => setMode('userlist')} className="btn-ghost w-full text-xs text-white/25 hover:text-white/50 py-2">Already have an account? Sign in</button>
            )}
          </div>
          <div className="text-center mt-6 pt-5 border-t border-white/5">
            <p className="text-[10px] text-white/15 tracking-wider">AES-256-GCM · PBKDF2-SHA512 · 600,000 iterations</p>
          </div>
        </form>
        </div>
      </div>
    );
  }

  /* Login form (with selected user) */
  return (
    <div className="h-screen w-screen flex flex-col bg-[#050510]">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-grid">
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="absolute inset-0 bg-dots pointer-events-none opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-float-slow" style={{ background: palette.glow }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none animate-float-slow" style={{ background: 'rgba(139,92,246,0.06)', animationDelay: '-5s' }} />
      <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-[140px] pointer-events-none animate-float-slow" style={{ background: 'rgba(236,72,153,0.04)', animationDelay: '-8s' }} />
      <form onSubmit={handleLogin} className={`relative w-[420px] p-9 rounded-3xl glass-premium border border-white/10 shadow-2xl animate-slide-up-lg ${shake ? 'animate-shake' : ''}`}>
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-3xl animate-pulse-glow" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, opacity: 0.3 }} />
            <div className="relative w-full h-full rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${palette.glow}, rgba(255,255,255,0.02))`, border: `1px solid ${palette.ring}` }}>
              <span className="text-2xl font-bold" style={{ color: palette.primary }}>{selectedUser.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-white/40 mt-1.5">{selectedUser}</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] text-white/30 font-medium uppercase tracking-wider mb-1.5">Master Password</label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <input type={showPassword ? 'text' : 'password'} placeholder="Enter master password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-glass w-full pl-11 pr-11 h-11" autoFocus />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors p-1">
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <div className="relative">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="sr-only peer" />
                <div className={`w-9 h-5 rounded-full transition-colors ${remember ? '' : 'bg-white/10'}`} style={remember ? { background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` } : {}}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${remember ? 'left-[18px]' : 'left-[2px]'}`} />
                </div>
              </div>
              <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">Remember me</span>
            </label>
          </div>
          {error && <p className="text-xs text-rose-400 text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-2 animate-fade-in">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-sm font-semibold mt-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>Unlock Vault</>
            )}
          </button>
          <button type="button" onClick={() => setMode('userlist')} className="btn-ghost w-full text-xs text-white/25 hover:text-white/50 py-2">Switch account</button>
        </div>
        <div className="text-center mt-6 pt-5 border-t border-white/5">
          <p className="text-[10px] text-white/15 tracking-wider">AES-256-GCM · PBKDF2-SHA512 · 600,000 iterations</p>
        </div>
      </form>
      </div>
    </div>
  );
}
