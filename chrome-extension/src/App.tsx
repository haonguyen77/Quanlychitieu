import { useEffect, useState } from 'react';
import { useAppStore } from './core/store/appStore';
import { AppShell } from './shared/components/layout/AppShell';
import { AuthGuard } from './features/auth/AuthGuard';
import { PasscodeLock } from './features/auth/PasscodeLock';
import { passcodeService } from './services/passcode/passcodeService';
import { cryptoService } from './services/crypto/cryptoService';

export function App() {
  const { theme, initializeApp } = useAppStore();
  const [passcodeLocked, setPasscodeLocked] = useState(passcodeService.isLocked());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    // Load persisted encryption key (no PIN prompt needed if key exists in IDB)
    cryptoService.loadPersistedKey().finally(() => {
      initializeApp();
      setReady(true);
    });
  }, [initializeApp]);

  if (passcodeLocked) {
    return <PasscodeLock onUnlock={() => setPasscodeLocked(false)} />;
  }

  if (!ready) return null;

  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}
