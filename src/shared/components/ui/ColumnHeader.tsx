import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ───
export type SortDirection = 'asc' | 'desc' | null;
export interface SortState { column: string | null; direction: SortDirection; }
export interface FilterState { [column: string]: string; }

export interface ColumnDef {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean; // default true
  filterable?: boolean; // default true
}

// ─── Hook: useTableSortFilter ───
export function useTableSortFilter() {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [filters, setFilters] = useState<FilterState>({});

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return { column: null, direction: null };
    });
  }, []);

  const setFilter = useCallback((column: string, value: string) => {
    setFilters((prev) => {
      if (!value) { const { [column]: _, ...rest } = prev; return rest; }
      return { ...prev, [column]: value };
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  /** Apply sort + filter to an array of items. getValue(item, column) returns the cell value as string. */
  const applySort = useCallback(<T,>(items: T[], getValue: (item: T, col: string) => string | number): T[] => {
    let result = items;

    // Apply filters
    const filterEntries = Object.entries(filters);
    if (filterEntries.length > 0) {
      result = result.filter((item) =>
        filterEntries.every(([col, q]) => {
          const val = String(getValue(item, col)).toLowerCase();
          return val.includes(q.toLowerCase());
        })
      );
    }

    // Apply sort
    if (sort.column && sort.direction) {
      const col = sort.column;
      const dir = sort.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const va = getValue(a, col);
        const vb = getValue(b, col);
        // Try numeric comparison first
        const na = typeof va === 'number' ? va : Number(va);
        const nb = typeof vb === 'number' ? vb : Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return String(va).localeCompare(String(vb), 'vi') * dir;
      });
    }

    return result;
  }, [sort, filters]);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return { sort, filters, toggleSort, setFilter, clearFilters, applySort, hasActiveFilters };
}

// ─── Component: ColumnHeader ───
interface ColumnHeaderProps {
  column: string;
  label: string;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  sort: SortState;
  filterValue?: string;
  onSort: (column: string) => void;
  onFilter: (column: string, value: string) => void;
}

export function ColumnHeader({ column, label, className = '', sortable = true, filterable = true, sort, filterValue = '', onSort, onFilter }: ColumnHeaderProps) {
  const [showFilter, setShowFilter] = useState(false);
  const [localFilter, setLocalFilter] = useState(filterValue);
  const filterRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  useEffect(() => { setLocalFilter(filterValue); }, [filterValue]);
  useEffect(() => { if (showFilter && inputRef.current) inputRef.current.focus(); }, [showFilter]);

  // Close filter popup on outside click
  useEffect(() => {
    if (!showFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  // Instant filter: apply on every keystroke
  useEffect(() => {
    if (!showFilter) return;
    onFilter(column, localFilter.trim());
  }, [localFilter]);

  const isSorted = sort.column === column;
  const hasFilter = !!filterValue;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 180) });
    }
    setShowFilter(!showFilter);
  };

  const handleClear = () => {
    setLocalFilter('');
    onFilter(column, '');
    setShowFilter(false);
  };

  return (
    <th className={`relative select-none group/th ${className}`}>
      <div className="flex items-center gap-1">
        {/* Label + sort click */}
        <span
          className={`cursor-pointer hover:text-[var(--color-text)] transition-colors ${sortable ? '' : 'cursor-default'}`}
          onClick={() => sortable && onSort(column)}
          title={sortable ? 'Nhấn để sắp xếp' : undefined}
        >
          {label}
        </span>
        {isSorted && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-purple-600 flex-shrink-0">
            {sort.direction === 'asc'
              ? <path d="M8 4l4 5H4l4-5z"/>
              : <path d="M8 12l4-5H4l4 5z"/>}
          </svg>
        )}

        {/* Filter icon — visible on hover or when active */}
        {filterable && (
          <button
            ref={btnRef}
            onClick={handleOpen}
            className={`p-0.5 rounded transition-colors ${hasFilter ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-text-secondary)] opacity-0 group-hover/th:opacity-100'}`}
            title="Lọc cột"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14l-5.5 6.5V14l-3-2V8.5L1 2z"/></svg>
          </button>
        )}
      </div>

      {/* Filter popup — fixed position like Chi tiêu */}
      {showFilter && (
        <div
          ref={filterRef}
          className="fixed bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-3 z-[200] min-w-[180px]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            className="input-field py-1.5 px-2 text-xs w-full"
            placeholder="Nhập để lọc..."
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowFilter(false); }}
            autoFocus
          />
          {hasFilter && (
            <button onClick={handleClear} className="w-full mt-2 pt-2 border-t border-[var(--color-border)] text-xs text-red-500 hover:text-red-700 text-center">
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}
    </th>
  );
}
