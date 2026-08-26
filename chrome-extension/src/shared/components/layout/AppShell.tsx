import { useEffect } from 'react';
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

// Primary accent color per core module. User-created modules fall back to their own color.
const MODULE_PRIMARY: Record<string, string> = {
  mod_chitieu: '#2563eb',    // xanh dương
  mod_shopee: '#f05423',     // cam
  mod_vang: '#d97706',       // vàng đậm
  mod_nhatro: '#16a34a',     // xanh lá
  mod_creditcard: '#7c3aed', // tím
};
const DEFAULT_PRIMARY = '#2563eb';

export function AppShell() {
  const { activeView, activeWorkspace, activeModuleId, data } = useAppStore();

  // Set the app accent (--color-primary) based on the active module so each
  // module shows its own color (header, buttons, table header, sidebar active).
  useEffect(() => {
    const root = document.documentElement;
    let color = DEFAULT_PRIMARY;
    if (activeWorkspace === 'chitieu' && activeView === 'module' && activeModuleId) {
      const mod = data?.modules.find((m) => m.id === activeModuleId);
      color = MODULE_PRIMARY[activeModuleId] || mod?.color || DEFAULT_PRIMARY;
    }
    root.style.setProperty('--color-primary', color);
    // Derive a slightly darker hover shade.
    root.style.setProperty('--color-primary-hover', shade(color, -0.15));
    return () => { root.style.removeProperty('--color-primary'); root.style.removeProperty('--color-primary-hover'); };
  }, [activeWorkspace, activeView, activeModuleId, data]);

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

/** Lighten (positive amt) or darken (negative amt) a #rrggbb color. */
function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  const r = adj(parseInt(m[1], 16));
  const g = adj(parseInt(m[2], 16));
  const b = adj(parseInt(m[3], 16));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
