import { useAppStore } from '@/core/store/appStore';
import { AppRail } from '@/shared/components/layout/AppRail';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { WineSidebar } from '@/shared/components/layout/WineSidebar';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ModuleView } from '@/features/module/ModuleView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ModuleManager } from '@/features/settings/ModuleManager';
import { TrashView } from '@/features/trash/TrashView';
import { WineApp } from '@/features/wine/WineApp';

/**
 * DesktopShell — Mirrors EXT AppShell exactly.
 * AppRail (workspace switcher) + Sidebar + Main Content.
 * Shown when viewport >= 1024px.
 */
export function DesktopShell() {
  const { activeView, activeWorkspace, data } = useAppStore();

  // Show loading if data hasn't initialized yet
  if (!data) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
            <span className="text-white text-lg font-bold">₫</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[var(--color-bg)]">
      <AppRail />
      {activeWorkspace === 'chitieu' ? (
        <>
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col">
            {activeView === 'dashboard' && <DashboardView />}
            {activeView === 'module' && <ModuleView />}
            {activeView === 'settings' && <SettingsView />}
            {activeView === 'report' && <ModuleManager />}
            {activeView === 'trash' && <TrashView moduleFilter={['mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro', 'mod_creditcard']} />}
          </main>
        </>
      ) : (
        <>
          <WineSidebar />
          <WineApp />
        </>
      )}
    </div>
  );
}
