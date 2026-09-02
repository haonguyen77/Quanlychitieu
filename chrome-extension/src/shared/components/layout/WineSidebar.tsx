import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';

type WineView = 'dashboard' | 'orders' | 'customers' | 'products' | 'inventory' | 'settings' | 'trash';

// Màu riêng cho từng icon khi không active — giống style Sidebar chính
const WINE_ICON_COLORS: Record<string, string> = {
  'layout-dashboard': '#6366f1',   // tím indigo
  'file-text':        '#f05423',   // cam đơn hàng
  'users':            '#0ea5e9',   // xanh dương khách hàng
  'wine':             '#a855f7',   // tím rượu
  'building':         '#22c55e',   // xanh lá kho
  'settings':         '#64748b',   // xám cài đặt
  'trash':            '#ef4444',   // đỏ thùng rác
};

const wineMenuItems: { id: WineView; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'orders', label: 'Đơn hàng', icon: 'file-text' },
  { id: 'customers', label: 'Khách hàng', icon: 'users' },
  { id: 'products', label: 'Sản phẩm', icon: 'wine' },
  { id: 'inventory', label: 'Kho', icon: 'building' },
];

export function WineSidebar() {
  const { activeWineView, setActiveWineView, sidebarCollapsed, theme, setTheme } = useAppStore();

  return (
    <aside
      className={`h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-all duration-200 ${
        sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon name="wine" size={14} color="#ffffff" />
          </div>
          <span className="text-sm font-semibold text-[var(--color-text)] truncate">
            Quản lý Rượu
          </span>
        </div>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {wineMenuItems.map((item) => {
          const isActive = activeWineView === item.id;
          const iconColor = isActive ? '#ffffff' : (WINE_ICON_COLORS[item.icon] ?? undefined);
          return (
          <button
            key={item.id}
            onClick={() => setActiveWineView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 ${
              isActive
                ? 'bg-purple-600 text-white font-medium shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text)]'
            }`}
            title={item.label}
          >
            <Icon name={item.icon} size={18} color={iconColor} />
            <span className="truncate text-sm">{item.label}</span>
          </button>
          );
        })}

        {/* Divider */}
        <div className="my-2 mx-2 border-t border-[var(--color-border)]" />

        {/* Settings */}
        <button
          onClick={() => setActiveWineView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 ${
            activeWineView === 'settings'
              ? 'bg-purple-600 text-white font-medium shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text)]'
          }`}
          title="Cài đặt"
        >
          <Icon name="settings" size={18} color={activeWineView === 'settings' ? '#ffffff' : WINE_ICON_COLORS['settings']} />
          <span className="truncate text-sm">Cài đặt</span>
        </button>

        {/* Trash */}
        <button
          onClick={() => setActiveWineView('trash')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 ${
            activeWineView === 'trash'
              ? 'bg-purple-600 text-white font-medium shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text)]'
          }`}
          title="Thùng rác"
        >
          <Icon name="trash" size={18} color={activeWineView === 'trash' ? '#ffffff' : WINE_ICON_COLORS['trash']} />
          <span className="truncate text-sm">Thùng rác</span>
        </button>
      </nav>

      {/* Footer: Theme toggle */}
      <div className="px-3 py-3 border-t border-[var(--color-border)]">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:bg-opacity-50 transition-colors"
          title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span className="text-sm">{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
        </button>
      </div>
    </aside>
  );
}
