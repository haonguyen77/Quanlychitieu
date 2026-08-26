import { useMemo } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { useRecordStore, type DatePreset } from '@/core/store/recordStore';
import { useTableZoom, ZoomControls, useCompactMode } from '@/shared/components/ui/TableZoom';
import type { ModuleDefinition, DataRecord } from '@/types';

interface ChiTieuHeaderProps {
  module: ModuleDefinition;
  records: DataRecord[];
  onAdd: () => void;
  isGroupMode: boolean;
  onToggleGroup: () => void;
}

const presetLabels: Record<DatePreset, string> = {
  week: 'Tuần',
  month: 'Tháng',
  year: 'Năm',
  all: 'Tất cả',
  custom: 'Tùy chọn',
};

export function ChiTieuHeader({ module, records, onAdd, isGroupMode, onToggleGroup }: ChiTieuHeaderProps) {
  const { searchQuery, setSearchQuery, datePreset, dateFrom, dateTo, setDatePresetForModule, setDateRange } = useRecordStore();
  const { fontSize, zoomIn, zoomOut } = useTableZoom();
  const { compact, toggle: toggleCompact } = useCompactMode(module.id);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const record of records) {
      // Get amount: find any key ending with _amount (but not _total_amount)
      let amount = 0;
      for (const [key, val] of Object.entries(record.values)) {
        if (key.endsWith('_amount') && !key.endsWith('_total_amount') && val != null) {
          amount = Math.abs(Number(val) || 0);
          break;
        }
      }

      // Get type: find any key ending with _type
      let isIncome = false;
      let isCardPayment = false;
      for (const [key, val] of Object.entries(record.values)) {
        if (key.endsWith('_type') && val != null) {
          const t = String(val);
          isIncome = (t === '1' || t === 'thu' || t === 'income' || t === 'Thu');
          isCardPayment = (t === '2');
          break;
        }
      }

      if (isIncome) {
        income += amount;
      } else if (!isCardPayment) {
        expense += amount;
      }
    }

    return { totalRecords: records.length, income, expense };
  }, [records]);

  const formatMoney = (amount: number) => Math.abs(amount).toLocaleString('vi-VN') + ' ₫';

  const handlePresetChange = (preset: DatePreset) => {
    setDatePresetForModule(preset, module.id);
  };

  const movePeriod = (direction: -1 | 1) => {
    const toLocalDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    if (datePreset === 'week') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      ref.setDate(ref.getDate() + direction * 7);
      const dow = ref.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDateRange(toLocalDate(monday), toLocalDate(sunday));
    } else if (datePreset === 'month') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const firstDay = new Date(ref.getFullYear(), ref.getMonth() + direction, 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + direction + 1, 0);
      setDateRange(toLocalDate(firstDay), toLocalDate(lastDay));
    } else if (datePreset === 'year') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const newYear = ref.getFullYear() + direction;
      setDateRange(`${newYear}-01-01`, `${newYear}-12-31`);
    } else if (datePreset === 'custom' && dateFrom && dateTo) {
      // Shift by the duration of the current range
      const from = new Date(dateFrom + 'T00:00:00');
      const to = new Date(dateTo + 'T00:00:00');
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      from.setDate(from.getDate() + direction * days);
      to.setDate(to.getDate() + direction * days);
      setDateRange(toLocalDate(from), toLocalDate(to));
    }
  };

  return (
    <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      {/* Row 1: Stats + Group toggle + Time filter + Date range */}
      <div className="px-5 py-2.5 flex items-center gap-4 flex-wrap">
        {/* Stats */}
        <div className="flex items-center gap-4">
          {stats.expense > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-[var(--color-text-secondary)]">-Chi:</span>
              <span className="text-sm font-bold text-red-600">{formatMoney(stats.expense)}</span>
            </span>
          )}
          {stats.income > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-[var(--color-text-secondary)]">+ Thu:</span>
              <span className="text-sm font-bold text-green-600">{formatMoney(stats.income)}</span>
            </span>
          )}
          <span className="text-xs text-[var(--color-text-secondary)]">
            {stats.totalRecords} bản ghi
          </span>
        </div>

        <div className="flex-1" />

        {/* Group toggle */}
        <button
          onClick={onToggleGroup}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isGroupMode
              ? 'text-white'
              : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)]'
          }`}
          style={isGroupMode ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : undefined}
        >
          <Icon name="layers" size={13} />
          Group
        </button>

        {/* Time filter presets */}
        <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
          {(['week', 'month', 'year', 'all'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                datePreset === preset
                  ? 'text-white'
                  : 'bg-white text-[var(--color-text-secondary)] hover:bg-gray-50'
              }`}
              style={datePreset === preset ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              {presetLabels[preset]}
            </button>
          ))}
        </div>

        {/* Period navigation + Date inputs */}
        {datePreset !== 'all' && (
          <div className="flex items-center gap-1">
            <button onClick={() => movePeriod(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <Icon name="chevron-left" size={14} />
            </button>
            <input
              type="date"
              className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white"
              value={dateFrom}
              onChange={(e) => setDateRange(e.target.value, dateTo)}
            />
            <span className="text-xs text-gray-400">→</span>
            <input
              type="date"
              className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white"
              value={dateTo}
              onChange={(e) => setDateRange(dateFrom, e.target.value)}
            />
            <button onClick={() => movePeriod(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Search + Zoom + Add button */}
      <div className="px-5 py-2 flex items-center gap-3 border-t border-[var(--color-border)] border-opacity-50">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-[var(--color-border)] rounded-md bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Expand / collapse columns */}
        <button
          onClick={toggleCompact}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors"
          title={compact ? 'Mở rộng cột' : 'Thu gọn cột'}
        >
          <Icon name={compact ? 'eye' : 'eye-off'} size={13} />
          {compact ? 'Mở rộng' : 'Thu gọn'}
        </button>

        {/* Zoom */}
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />

        {/* Add button */}
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Icon name="plus" size={15} />
          Thêm mới
        </button>
      </div>
    </div>
  );
}
