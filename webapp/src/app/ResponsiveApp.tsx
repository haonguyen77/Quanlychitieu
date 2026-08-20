import { useEffect } from 'react';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useAppStore } from '@/core/store/appStore';
import { DesktopShell } from '@/layouts/DesktopShell';
import { MobileShell } from '@/layouts/MobileShell';
import { PinLock } from '@/features/mobile/PinLock';

/**
 * ResponsiveApp — renders DesktopShell or MobileShell based on viewport.
 * Breakpoint: 1024px
 * Shows PinLock full-screen when data is encrypted and locked.
 */
export function ResponsiveApp() {
  const isDesktop = useLayoutMode();
  const isLocked = useAppStore((s) => s.isLocked);
  const theme = useAppStore((s) => s.theme);

  // Apply theme class to <html> so dark-mode CSS variables + Tailwind `dark:` kick in
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (isLocked) return <PinLock />;

  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
