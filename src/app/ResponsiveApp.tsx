import { useLayoutMode } from '@/hooks/useLayoutMode';
import { DesktopShell } from '@/layouts/DesktopShell';
import { MobileShell } from '@/layouts/MobileShell';

/**
 * ResponsiveApp — renders DesktopShell or MobileShell based on viewport.
 * Breakpoint: 1024px
 * No tablet mode. No manual toggle in Phase 1.
 */
export function ResponsiveApp() {
  const isDesktop = useLayoutMode();

  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
