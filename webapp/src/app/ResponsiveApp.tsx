import { useEffect, useState } from 'react';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useAppStore } from '@/core/store/appStore';
import { DesktopShell } from '@/layouts/DesktopShell';
import { MobileShell } from '@/layouts/MobileShell';
import { PasscodeLock } from '@/features/mobile/PasscodeLock';
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
  const [passcodeLocked, setPasscodeLocked] = useState(passcodeService.isLocked());
  const [keyLoaded, setKeyLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Try to load persisted encryption key at startup (transparent, no user interaction)
  useEffect(() => {
    cryptoService.loadPersistedKey().then(() => setKeyLoaded(true)).catch(() => setKeyLoaded(true));
  }, []);

  if (passcodeLocked) {
    return <PasscodeLock onUnlock={() => setPasscodeLocked(false)} />;
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
