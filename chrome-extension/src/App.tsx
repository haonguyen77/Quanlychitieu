import { useEffect, useState } from 'react';
import { useAppStore } from './core/store/appStore';
import { AppShell } from './shared/components/layout/AppShell';
import { AuthGuard } from './features/auth/AuthGuard';
import { PasscodeLock } from './features/auth/PasscodeLock';
import { PinLock } from './features/auth/PinLock';
import { passcodeService } from './services/passcode/passcodeService';
import { cryptoService } from './services/crypto/cryptoService';

export function App() {
  const { theme, initializeApp } = useAppStore();
  const needsPin = useAppStore((s) => s.needsPin);
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
      // Auto-pull from Drive on open so the user sees the latest data + the
      // "Đang đồng bộ..." status without having to press Đồng bộ manually.
      setTimeout(() => { useAppStore.getState().syncFromDrive(); }, 300);
    });
  }, [initializeApp]);

  // Auto-pull from Drive when the popup/tab becomes visible again. Debounced.
  useEffect(() => {
    let last = 0;
    const trigger = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      useAppStore.getState().syncFromDrive();
    };
    document.addEventListener('visibilitychange', trigger);
    window.addEventListener('focus', trigger);
    return () => {
      document.removeEventListener('visibilitychange', trigger);
      window.removeEventListener('focus', trigger);
    };
  }, []);

  if (passcodeLocked) {
    return <PasscodeLock onUnlock={() => setPasscodeLocked(false)} />;
  }

  if (!ready) return null;

  // Encrypted local data present but locked — ask for the PIN.
  if (needsPin) {
    return <PinLock />;
  }

  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}
