import { useAppStore } from '@/core/store/appStore';
import { AppRail } from './AppRail';
import { Sidebar } from './Sidebar';
import { WineSidebar } from './WineSidebar';
import { ModuleView } from '@/features/module/ModuleView';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ModuleManager } from '@/features/settings/ModuleManager';
import { TrashView } from '@/features/trash/TrashView';
import { WineApp } from '@/features/wine/WineApp';

export function AppShell() {
  const { activeView, activeWorkspace } = useAppStore();

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
