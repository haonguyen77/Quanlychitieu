import type { DatePreset } from '@/core/store/recordStore';

interface TimeFilterProps {
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  onPresetChange: (preset: DatePreset) => void;
  onDateRangeChange: (from: string, to: string) => void;
  presets?: DatePreset[];
  compact?: boolean;
}

const presetLabels: Record<DatePreset, string> = {
  week: 'Tuần',
  month: 'Tháng',
  year: 'Năm',
  all: 'Tất cả',
  custom: 'Tùy chọn',
};

/** Format Date to YYYY-MM-DD using LOCAL timezone (not UTC) */
function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TimeFilter({
  datePreset,
  dateFrom,
  dateTo,
  onPresetChange,
  onDateRangeChange,
  presets = ['week', 'month', 'year', 'all'],
  compact = false,
}: TimeFilterProps) {

  const movePeriod = (direction: -1 | 1) => {
    if (datePreset === 'week') {
      // Parse current from-date, shift by 7 days, find Monday of that week
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      ref.setDate(ref.getDate() + direction * 7);
      // Find Monday of this week
      const dow = ref.getDay(); // 0=Sun, 1=Mon...
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      onDateRangeChange(toLocalDate(monday), toLocalDate(sunday));
    } else if (datePreset === 'month') {
      // Parse year/month from dateFrom, shift by 1 month
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const newYear = ref.getFullYear();
      const newMonth = ref.getMonth() + direction;
      const firstDay = new Date(newYear, newMonth, 1);
      const lastDay = new Date(newYear, newMonth + 1, 0); // day 0 of next month = last day
      onDateRangeChange(toLocalDate(firstDay), toLocalDate(lastDay));
    } else if (datePreset === 'year') {
      // Parse year from dateFrom, shift by 1
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const newYear = ref.getFullYear() + direction;
      onDateRangeChange(`${newYear}-01-01`, `${newYear}-12-31`);
    } else if (datePreset === 'custom') {
      // Shift by duration
      const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const to = dateTo ? new Date(dateTo + 'T00:00:00') : new Date();
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      from.setDate(from.getDate() + direction * days);
      to.setDate(to.getDate() + direction * days);
      onDateRangeChange(toLocalDate(from), toLocalDate(to));
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preset buttons */}
      <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPresetChange(preset)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              datePreset === preset
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:bg-opacity-50'
            }`}
          >
            {presetLabels[preset]}
          </button>
        ))}
      </div>

      {/* Prev/Next arrows */}
      {datePreset !== 'all' && (
        <div className="flex items-center gap-0.5">
          <button onClick={() => movePeriod(-1)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" title="Truoc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => movePeriod(1)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" title="Sau">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {/* Date inputs */}
      {!compact && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className="input-field py-1 px-2 text-xs w-[120px]"
            value={dateFrom}
            onChange={(e) => onDateRangeChange(e.target.value, dateTo)}
          />
          <span className="text-xs text-[var(--color-text-secondary)]">→</span>
          <input
            type="date"
            className="input-field py-1 px-2 text-xs w-[120px]"
            value={dateTo}
            onChange={(e) => onDateRangeChange(dateFrom, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
