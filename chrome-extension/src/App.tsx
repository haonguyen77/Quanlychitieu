import { useEffect } from 'react';
import { useAppStore } from './core/store/appStore';
import { AppShell } from './shared/components/layout/AppShell';
import { AuthGuard } from './features/auth/AuthGuard';
import { PinLock } from './features/auth/PinLock';
import { PinOnboarding } from './features/auth/PinOnboarding';

export function App() {
  const { theme, initializeApp } = useAppStore();
  const isLocked = useAppStore((s) => s.isLocked);

  useEffect(() => {
    // Apply theme class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  if (isLocked) return <PinLock />;

  return (
    <AuthGuard>
      <AppShell />
      <PinOnboarding />
    </AuthGuard>
  );
}
