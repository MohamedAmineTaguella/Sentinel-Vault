import { useState, useEffect, useCallback } from 'react';
import AuthScreen from './components/AuthScreen';
import VaultDashboard from './components/VaultDashboard';
import { ModalProvider } from './components/Modal';
import { ToastProvider } from './components/Toast';
import { onAutoLock, clearVaultKey, getSettings } from './lib/api';
import type { ThemeAccent } from './types';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState<ThemeAccent>('indigo');

  const handleLock = useCallback(() => {
    clearVaultKey();
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    const cleanup = onAutoLock(() => { clearVaultKey(); setAuthenticated(false); });
    return () => { if (cleanup) cleanup(); };
  }, []);

  useEffect(() => {
    if (authenticated) {
      getSettings().then((res) => {
        const t = res?.data?.theme;
        if (t && ['indigo', 'violet', 'rose', 'emerald', 'amber', 'cyan', 'pink'].includes(t)) {
          setTheme(t as ThemeAccent);
        }
      }).catch(() => {});
    }
  }, [authenticated]);

  if (!authenticated) {
    return <AuthScreen onSuccess={() => setAuthenticated(true)} onUsernameChange={setUsername} />;
  }

  return (
    <ModalProvider theme={theme} setTheme={setTheme}>
      <ToastProvider>
        <VaultDashboard onLock={handleLock} username={username} />
      </ToastProvider>
    </ModalProvider>
  );
}
