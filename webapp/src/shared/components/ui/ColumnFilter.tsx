import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './Icon';

export interface ColumnFilterValue {
  type: 'text' | 'select' | 'dateRange';
  value: string;
  valueTo?: string;
}

interface ColumnFilterProps {
  type: 'text' | 'select' | 'dateRange';
  options?: { value: string; label: string; color?: string }[];
  /** Ordered list of distinct values already in the table (newest-first). Used for text-column suggestions. */
  suggestions?: string[];
  value: ColumnFilterValue | null;
  onChange: (filter: ColumnFilterValue | null) => void;
}

export function ColumnFilter({ type, options, suggestions, value, onChange }: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value?.value || '');
  const [localValueTo, setLocalValueTo] = useState(value?.valueTo || '');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Instant filter: apply on every change for text and dateRange
  useEffect(() => {
    if (!open) return;
    if (type === 'text') {
      if (localValue === '') {
        onChange(null);
      } else {
        onChange({ type: 'text', value: localValue });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue]);

  useEffect(() => {
    if (!open || type !== 'dateRange') return;
    if (localValue === '' && localValueTo === '') {
      onChange(null);
    } else if (localValue || localValueTo) {
      onChange({ type: 'dateRange', value: localValue, valueTo: localValueTo || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, localValueTo]);

  const hasFilter = value !== null && value.value !== '';

  const handleClear = () => {
    setLocalValue('');
    setLocalValueTo('');
    onChange(null);
    setOpen(false);
  };

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
  }, []);

  // Filtered suggestions: match localValue substring (case-insensitive), max 30
  const filteredSuggestions =
    type === 'text' && suggestions && suggestions.length > 0
      ? suggestions
          .filter((s) => s && (!localValue || s.toLowerCase().includes(localValue.toLowerCase())))
          .slice(0, 30)
      : [];

  const hasSuggestions = filteredSuggestions.length > 0;

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); updatePosition(); setOpen(!open); }}
        className={`p-0.5 rounded transition-colors ${hasFilter ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-text-secondary)] opacity-0 group-hover/th:opacity-100'}`}
        title="Lọc cột"
      >
        <Icon name="filter" size={11} />
      </button>

      {open && (
        <div
          className="fixed bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl z-[200] min-w-[220px]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── TEXT FILTER with suggestions ── */}
          {type === 'text' && (
            <div>
              {/* Input */}
              <div className="p-2 border-b border-[var(--color-border)]">
                <input
                  ref={inputRef}
                  type="text"
                  className="input-field py-1.5 px-2 text-xs w-full"
                  placeholder="Nhập để lọc..."
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setOpen(false); }
                    if (e.key === 'Enter' && localValue) { setOpen(false); }
                  }}
                />
              </div>

              {/* Suggestion list */}
              {hasSuggestions && (
                <div className="max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => e.preventDefault()} // keep input focused
                      onClick={() => {
                        setLocalValue(s);
                        onChange({ type: 'text', value: s });
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        localValue === s
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'
                      }`}
                    >
                      {/* Highlight matching part */}
                      {localValue
                        ? (() => {
                            const idx = s.toLowerCase().indexOf(localValue.toLowerCase());
                            if (idx === -1) return s;
                            return (
                              <>
                                {s.slice(0, idx)}
                                <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm px-0">
                                  {s.slice(idx, idx + localValue.length)}
                                </mark>
                                {s.slice(idx + localValue.length)}
                              </>
                            );
                          })()
                        : s}
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state when typing but no match */}
              {type === 'text' && localValue && !hasSuggestions && suggestions && suggestions.length > 0 && (
                <div className="px-3 py-2 text-[10px] text-[var(--color-text-secondary)] italic">
                  Không có kết quả khớp
                </div>
              )}
            </div>
          )}

          {/* ── SELECT FILTER ── */}
          {type === 'select' && options && (
            <div className="p-2 max-h-48 overflow-y-auto space-y-0.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (localValue === opt.value) {
                      setLocalValue('');
                      onChange(null);
                    } else {
                      setLocalValue(opt.value);
                      onChange({ type: 'select', value: opt.value });
                    }
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${localValue === opt.value ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'}`}
                >
                  {opt.color && <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: opt.color }} />}
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* ── DATE RANGE FILTER ── */}
          {type === 'dateRange' && (
            <div className="p-3 space-y-2">
              <div>
                <label className="text-[10px] text-[var(--color-text-secondary)]">Từ</label>
                <input type="date" className="input-field py-1.5 px-2 text-xs w-full" value={localValue} onChange={(e) => setLocalValue(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-secondary)]">Đến</label>
                <input type="date" className="input-field py-1.5 px-2 text-xs w-full" value={localValueTo} onChange={(e) => setLocalValueTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Clear button */}
          {hasFilter && (
            <button onClick={handleClear} className="w-full px-3 py-2 border-t border-[var(--color-border)] text-xs text-red-500 hover:text-red-700 text-center">
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}
