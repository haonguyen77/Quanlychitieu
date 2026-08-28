import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import { NotificationCenter } from '@/shared/components/notifications/NotificationCenter';
import type { MenuItem } from '@/types';

export function Sidebar() {
  const { data, activeModuleId, activeView, sidebarCollapsed, setActiveModule, setActiveView, theme, setTheme } = useAppStore();
  const isSyncing = useAppStore((s) => s.isSyncing);

  if (!data) return null;

  const menu = (() => {
    const items = data.menu
      .filter((m) => m.isVisible)
      .filter((m) => m.id !== 'menu_ruou') // Wine is in its own workspace
      .filter((m) => m.id !== 'menu_manager') // "Quản lý" is merged into Settings now
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // Ensure "Thùng rác" menu item exists for existing users
    if (!items.find((m) => m.id === 'menu_trash')) {
      const settingsIdx = items.findIndex((m) => m.type === 'settings');
      const trashItem: MenuItem = { id: 'menu_trash', label: 'Thùng rác', icon: 'trash-2', type: 'report', sortOrder: 100, isVisible: true };
      if (settingsIdx >= 0) {
        items.splice(settingsIdx, 0, trashItem);
      } else {
        items.push(trashItem);
      }
    }
    return items;
  })();

  const handleMenuClick = (item: MenuItem) => {
    if (item.id === 'menu_trash') {
      setActiveView('trash');
      return;
    }
    switch (item.type) {
      case 'module':
        if (item.targetId) setActiveModule(item.targetId);
        break;
      case 'dashboard':
        setActiveView('dashboard');
        break;
      case 'settings':
        setActiveView('settings');
        break;
      case 'report':
        setActiveView('report');
        break;
    }
  };

  const isActive = (item: MenuItem): boolean => {
    if (item.id === 'menu_trash') return activeView === 'trash';
    if (item.type === 'module' && activeView === 'module') {
      return item.targetId === activeModuleId;
    }
    if (item.type === 'dashboard') return activeView === 'dashboard';
    if (item.type === 'settings') return activeView === 'settings';
    if (item.type === 'report') return activeView === 'report';
    return false;
  };

  return (
    <aside
      className={`h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-all duration-200 ${
        sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <PiggyLogo />
          </div>
          <span className="text-sm font-semibold text-[var(--color-text)] truncate">
            Quản lý <span style={{ color: 'var(--color-primary)' }}>chi tiêu</span>
          </span>
        </div>
        <NotificationCenter />
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {menu.map((item) => {
          if (item.type === 'divider') {
            return <div key={item.id} className="my-2 mx-2 border-t border-[var(--color-border)]" />;
          }

          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 ${
                isActive(item)
                  ? 'text-white font-medium shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text)]'
              }`}
              style={isActive(item) ? { backgroundColor: 'var(--color-primary)' } : undefined}
              title={item.label}
            >
              <Icon name={item.icon} size={18} color={isActive(item) ? '#ffffff' : MENU_ICON_COLORS[item.icon] || undefined} />
              <span className="truncate text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: Theme toggle + Sync status */}
      <div className="px-3 py-3 border-t border-[var(--color-border)] space-y-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:bg-opacity-50 transition-colors"
          title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span className="text-sm">{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
        </button>

        {/* Sync status */}
        <div className="flex items-center gap-2 px-3 py-1">
          <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs text-[var(--color-text-secondary)]">{isSyncing ? 'Đang đồng bộ...' : 'Đã đồng bộ'}</span>
        </div>
      </div>
    </aside>
  );
}

// Per-menu icon colors (for inactive items) to match the colorful sidebar look.
const MENU_ICON_COLORS: Record<string, string> = {
  'layout-dashboard': '#6366f1',
  wallet: '#a855f7',
  'shopping-cart': '#f05423',
  'shopping-bag': '#f05423',
  'credit-card': '#8b5cf6',
  card: '#8b5cf6',
  gem: '#f59e0b',
  home: '#22c55e',
  database: '#0ea5e9',
  'trash-2': '#ef4444',
  trash: '#ef4444',
  settings: '#64748b',
};

/** Piggy-bank logo next to the app title. Uses the provided PNG when present,
 * falling back to an inline SVG if the image is missing. */
function PiggyLogo() {
  return (
    <>
      <img
        src="icons/piggy-logo.png"
        alt=""
        width={32}
        height={32}
        className="object-contain"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = 'none';
          const fb = el.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'block';
        }}
      />
      <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ display: 'none' }}>
        <ellipse cx="24" cy="27" rx="17" ry="13" fill="#f78da0" />
        <ellipse cx="34" cy="24" rx="6" ry="5" fill="#f9a8b8" />
        <circle cx="30" cy="21" r="1.5" fill="#3b2b2f" />
        <rect x="20" y="9" width="8" height="4" rx="2" fill="#f9c74f" />
      </svg>
    </>
  );
}

