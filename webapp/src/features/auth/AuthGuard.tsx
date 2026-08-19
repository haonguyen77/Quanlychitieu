import { type ReactNode } from 'react';
import { useAppStore } from '@/core/store/appStore';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
