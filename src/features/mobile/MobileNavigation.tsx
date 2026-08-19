import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MobileScreen {
  id: string;
  component: ReactNode;
  title?: string;
}

interface MobileNavContextType {
  screens: MobileScreen[];
  push: (screen: MobileScreen) => void;
  pop: () => void;
  reset: () => void;
  canGoBack: boolean;
}

const MobileNavContext = createContext<MobileNavContextType>({
  screens: [],
  push: () => {},
  pop: () => {},
  reset: () => {},
  canGoBack: false,
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}

/**
 * Mobile Navigation Provider — manages a screen stack for sub-navigation.
 * Supports: push (go deeper), pop (back), reset (back to root).
 * Bottom tabs live outside this — they reset the stack when switching.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [screens, setScreens] = useState<MobileScreen[]>([]);

  const push = useCallback((screen: MobileScreen) => {
    setScreens(prev => [...prev, screen]);
  }, []);

  const pop = useCallback(() => {
    setScreens(prev => prev.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setScreens([]);
  }, []);

  const canGoBack = screens.length > 0;

  return (
    <MobileNavContext.Provider value={{ screens, push, pop, reset, canGoBack }}>
      {children}
      {/* Render stacked screens as overlays */}
      {screens.map((screen, i) => (
        <div key={screen.id + i} className="fixed inset-0 z-50 bg-[var(--color-bg)]" style={{ zIndex: 50 + i }}>
          {screen.component}
        </div>
      ))}
    </MobileNavContext.Provider>
  );
}
