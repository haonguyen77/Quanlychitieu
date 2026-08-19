import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { driveService } from '@/services/drive/driveService';
import { syncService } from '@/services/sync/syncService';

export function LoginScreen() {
  const { setAuth, setData, setError } = useAppStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const token = await driveService.getToken(true);
      if (!token) {
        setError('Không thể đăng nhập Google');
        setIsLoggingIn(false);
        return;
      }

      const profile = await driveService.getUserProfile();
      if (profile) {
        setAuth(profile.email, profile.avatar);
      }

      // Try to pull from Drive
      const syncResult = await syncService.pull();
      if (syncResult.data) {
        setData(syncResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOfflineMode = () => {
    setAuth('offline@local', undefined);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-8 p-8 max-w-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-lg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Quản lý chi tiêu
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            Nền tảng quản lý dữ liệu cá nhân
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="btn-primary flex items-center justify-center gap-2 w-full py-3 text-base"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
          </button>

          <button
            onClick={handleOfflineMode}
            className="btn-secondary w-full py-3 text-base"
          >
            Chế độ Offline
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)] text-center">
          Dữ liệu được đồng bộ qua Google Drive.<br />
          Không cần server, không cần Firebase.
        </p>
      </div>
    </div>
  );
}
