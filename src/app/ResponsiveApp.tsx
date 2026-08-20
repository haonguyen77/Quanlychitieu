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

  if (isLocked) return <PinLock />;

  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
