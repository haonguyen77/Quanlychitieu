import { useEffect } from 'react';
import { useAppStore } from './core/store/appStore';
import { AppShell } from './shared/components/layout/AppShell';
import { AuthGuard } from './features/auth/AuthGuard';

export function App() {
  const { theme, initializeApp } = useAppStore();

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

  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}
