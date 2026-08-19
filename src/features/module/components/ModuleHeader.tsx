import { Icon } from '@/shared/components/ui/Icon';
import { useRecordStore } from '@/core/store/recordStore';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import type { ModuleDefinition } from '@/types';

interface ModuleHeaderProps {
  module: ModuleDefinition;
  onAdd: () => void;
}

export function ModuleHeader({ module, onAdd }: ModuleHeaderProps) {
  const { searchQuery, setSearchQuery } = useRecordStore();
  const { fontSize, zoomIn, zoomOut } = useTableZoom();

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-[var(--color-border)] bg-[var(--color-bg)] flex-shrink-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: module.color + '15' }}
        >
          <Icon name={module.icon} size={18} color={module.color} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text)] leading-tight">{module.name}</h1>
          {module.description && (
            <p className="text-xs text-[var(--color-text-secondary)]">{module.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            className="input-field pl-9 py-1.5 text-sm w-64"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* Zoom controls */}
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />

        {/* Add button */}
        <button
          onClick={onAdd}
          className="btn-primary flex items-center gap-2 py-2 px-4"
        >
          <Icon name="plus" size={16} />
          Thêm mới
        </button>
      </div>
    </header>
  );
}
