import { useEffect, useState } from 'react';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useAppStore } from '@/core/store/appStore';
import { DesktopShell } from '@/layouts/DesktopShell';
import { MobileShell } from '@/layouts/MobileShell';
import { PasscodeLock } from '@/features/mobile/PasscodeLock';
import { PinLock } from '@/features/mobile/PinLock';
import { passcodeService } from '@/services/passcode/passcodeService';
import { cryptoService } from '@/services/crypto/cryptoService';

/**
 * ResponsiveApp — entry point.
 *
 * Gate 1: Passcode lock (app access) — independent of encryption.
 * Gate 2: Encryption key loading (transparent, no PIN prompt unless key lost).
 *
 * Passcode ON → must enter passcode to access UI.
 * Passcode OFF → direct access.
 * Encryption key is loaded from IndexedDB at startup (no PIN needed if persisted).
 */
export function ResponsiveApp() {
  const isDesktop = useLayoutMode();
  const theme = useAppStore((s) => s.theme);
  const needsPin = useAppStore((s) => s.needsPin);
  const [passcodeLocked, setPasscodeLocked] = useState(passcodeService.isLocked());
  const [keyLoaded, setKeyLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Try to load persisted encryption key at startup (transparent, no user interaction)
  useEffect(() => {
    cryptoService.loadPersistedKey().then(() => setKeyLoaded(true)).catch(() => setKeyLoaded(true));
  }, []);

  // Auto-pull from Drive when the tab becomes visible again (see changes made
  // on other devices/app without a manual refresh). Debounced to avoid floods.
  useEffect(() => {
    let last = 0;
    const trigger = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < 5000) return; // debounce: at most once per 5s
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

  // Encrypted local data present but locked — ask for the PIN (desktop + mobile).
  if (needsPin) {
    return <PinLock />;
  }

  if (!keyLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 rounded-full bg-[#6C2BD9] flex items-center justify-center animate-pulse">
          <span className="text-white text-lg font-bold">₫</span>
        </div>
      </div>
    );
  }

  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
