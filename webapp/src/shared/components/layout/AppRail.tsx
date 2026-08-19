import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';

export function AppRail() {
  const { activeWorkspace, setActiveWorkspace, sidebarCollapsed, toggleSidebar } = useAppStore();

  // Module enabled state (persisted in localStorage)
  const chitieuEnabled = localStorage.getItem('pdp_ws_chitieu') !== '0';
  const ruouEnabled = localStorage.getItem('pdp_ws_ruou') !== '0';

  return (
    <div className="h-full w-12 flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center py-3 gap-1">
      {/* Workspace icons */}
      {chitieuEnabled && (
      <button
        onClick={() => setActiveWorkspace('chitieu')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative ${
          activeWorkspace === 'chitieu'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
        }`}
        title="Quản lý Chi tiêu"
      >
        <Icon name="wallet" size={18} color={activeWorkspace === 'chitieu' ? '#ffffff' : undefined} />
        {activeWorkspace === 'chitieu' && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r" />
        )}
      </button>
      )}

      {ruouEnabled && (
      <button
        onClick={() => setActiveWorkspace('ruou')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative ${
          activeWorkspace === 'ruou'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
        }`}
        title="Quản lý Rượu"
      >
        <Icon name="wine" size={18} color={activeWorkspace === 'ruou' ? '#ffffff' : undefined} />
        {activeWorkspace === 'ruou' && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-600 rounded-r" />
        )}
      </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
        title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
      >
        <Icon name={sidebarCollapsed ? 'panel-left-open' : 'panel-left-close'} size={16} />
      </button>
    </div>
  );
}
