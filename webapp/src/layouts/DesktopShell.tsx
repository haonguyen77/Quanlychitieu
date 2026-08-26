import { useEffect } from 'react';
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

// Accent color per core module (matches the extension). User-created modules
// fall back to their own module.color.
const MODULE_PRIMARY: Record<string, string> = {
  mod_chitieu: '#2563eb', mod_shopee: '#f05423', mod_vang: '#d97706',
  mod_nhatro: '#16a34a', mod_creditcard: '#7c3aed',
};
const DEFAULT_PRIMARY = '#2563eb';
function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  const r = adj(parseInt(m[1], 16)), g = adj(parseInt(m[2], 16)), b = adj(parseInt(m[3], 16));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * DesktopShell — Mirrors EXT AppShell exactly.
 * AppRail (workspace switcher) + Sidebar + Main Content.
 * Shown when viewport >= 1024px.
 */
export function DesktopShell() {
  const { activeView, activeWorkspace, data } = useAppStore();
  const activeModuleId = useAppStore((s) => s.activeModuleId);

  // Set the app accent per active module (Chi tiêu blue, Shopee orange, ...).
  useEffect(() => {
    if (activeWorkspace !== 'chitieu') return; // wine workspace keeps its own theme
    const root = document.documentElement;
    let color = DEFAULT_PRIMARY;
    if (activeView === 'module' && activeModuleId) {
      const mod = data?.modules.find((m) => m.id === activeModuleId);
      color = MODULE_PRIMARY[activeModuleId] || mod?.color || DEFAULT_PRIMARY;
    }
    root.style.setProperty('--color-primary', color);
    root.style.setProperty('--color-primary-hover', shade(color, -0.15));
  }, [activeWorkspace, activeView, activeModuleId, data]);

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
