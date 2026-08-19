import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 1024;

/**
 * Returns true if viewport >= 1024px (Desktop), false otherwise (Mobile).
 * Uses CSS media query via matchMedia — NOT User-Agent.
 */
export function useLayoutMode(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    
    setIsDesktop(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
