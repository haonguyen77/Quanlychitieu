import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRecordStore } from '@/core/store/recordStore';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom } from '@/shared/components/ui/TableZoom';
import { formatCellValue } from '@/shared/components/table/cellFormatters';
import { ContextMenu } from '@/shared/components/ui/ContextMenu';
import { ColumnFilter, type ColumnFilterValue } from '@/shared/components/ui/ColumnFilter';
import type { ModuleDefinition, DataRecord, FieldDefinition } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: string): boolean {
  return UUID_RE.test(v.trim());
}

interface RecordTableProps {
  module: ModuleDefinition;
  records: DataRecord[];
  onEdit: (record: DataRecord) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  showDateGroups?: boolean;
}

// Virtual column for cross-module display
interface VirtualColumn {
  id: string;
  label: string;
  sourceFieldName: string;
  type: 'text' | 'money' | 'date' | 'computed';
  width?: number;
  computeFn?: (record: DataRecord, getVal: (r: DataRecord, fn: string) => unknown) => string;
}

export function RecordTable({ module, records, onEdit, selectedIds, onSelectionChange, showDateGroups = false }: RecordTableProps) {
  const { deleteRecord, addRecord } = useRecordStore();
  const { data } = useAppStore();

  // Compact mode: saved per module in localStorage (DEFAULT: compact/thu gọn)
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem(`pdp_compact_${module.id}`);
    if (saved === null) return true; // Default: compact (thu gọn)
    return saved === '1';
  });

  const toggleCompact = () => {
    const newVal = !compactMode;
    setCompactMode(newVal);
    localStorage.setItem(`pdp_compact_${module.id}`, newVal ? '1' : '0');
  };
  const { fontClass } = useTableZoom();

  const [sortField, setSortField] = useState<string | null>(() => {
    const configSort = module.tableConfig?.defaultSort?.fieldId;
    if (!configSort) return null;
    const field = module.fields.find((f) => f.id === configSort)
      || module.fields.find((f) => configSort.endsWith(f.fieldName) || f.fieldName === configSort);
    return field?.id || null;
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    module.tableConfig?.defaultSort?.direction || 'desc'
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: DataRecord } | null>(null);
  const lastClickedIdx = useRef<number>(-1);

  // Image preview state
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIdx] = useState(0);

  // Column filter state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});
  const activeFilterCount = Object.keys(columnFilters).length;

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const setColumnFilter = useCallback((key: string, filter: ColumnFilterValue | null) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter === null || filter.value === '') {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  }, []);

  // Helper to get value from record by fieldName (cross-module)
  const getRecordValue = (record: DataRecord, fieldName: string): unknown => {
    const key = Object.keys(record.values).find((k) => k.endsWith('_' + fieldName));
    if (key) return record.values[key];
    return undefined;
  };

  // Virtual columns for linked modules (Vàng, Nhà trọ)
  const virtualColumns = useMemo((): VirtualColumn[] | null => {
    if (module.id === 'mod_vang') {
      return [
        { id: 'vc_date', label: 'Ngày', sourceFieldName: 'date', type: 'date', width: 100 },
        { id: 'vc_type', label: 'Loại GD', sourceFieldName: 'type', type: 'computed',
          computeFn: (r, gv) => {
            const t = gv(r, 'type');
            return t === '0' ? 'Mua' : 'Bán';
          }
        },
        { id: 'vc_gold_type', label: 'Loại vàng', sourceFieldName: 'title', type: 'text' },
        { id: 'vc_quantity', label: 'Số lượng (chỉ)', sourceFieldName: 'quantity', type: 'text' },
        { id: 'vc_price', label: 'Giá/chỉ', sourceFieldName: 'price_per_unit', type: 'computed',
          computeFn: (r, gv) => {
            const amount = Number(gv(r, 'amount') ?? 0);
            const qty = Number(gv(r, 'quantity') ?? 0);
            if (qty > 0) return (amount / qty).toLocaleString('vi-VN') + ' ₫';
            return '—';
          }
        },
        { id: 'vc_total', label: 'Số tiền', sourceFieldName: 'amount', type: 'money' },
        { id: 'vc_beneficiary', label: 'Người nhận', sourceFieldName: 'beneficiary', type: 'computed',
          computeFn: (r, gv) => {
            const v = String(gv(r, 'beneficiary') ?? '');
            const labels: Record<string, string> = { ba: 'Ba', me: 'Mẹ', vo: 'Vợ', con: 'Con', anh: 'Anh', chi: 'Chị', chong: 'Chồng', banthan: 'Mình' };
            return labels[v] || v || '—';
          }
        },
        { id: 'vc_note', label: 'Ghi chú', sourceFieldName: 'note', type: 'text' },
      ];
    }
    if (module.id === 'mod_nhatro') {
      return [
        { id: 'vc_date', label: 'Ngày', sourceFieldName: 'date', type: 'date', width: 100 },
        { id: 'vc_month', label: 'Tháng', sourceFieldName: 'date', type: 'computed',
          computeFn: (r, gv) => {
            const d = gv(r, 'date');
            if (!d) return '—';
            try { const dt = new Date(String(d)); return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`; }
            catch { return '—'; }
          }
        },
        { id: 'vc_tenant', label: 'Người thuê', sourceFieldName: 'title', type: 'text' },
        { id: 'vc_total', label: 'Số tiền', sourceFieldName: 'amount', type: 'money' },
        { id: 'vc_note', label: 'Ghi chú', sourceFieldName: 'note', type: 'text' },
      ];
    }
    if (module.id === 'mod_shopee') {
      return [
        { id: 'vc_date', label: 'Ngày', sourceFieldName: 'date', type: 'date', width: 100 },
        { id: 'vc_title', label: 'Tên giao dịch', sourceFieldName: 'title', type: 'text' },
        { id: 'vc_amount', label: 'Số tiền', sourceFieldName: 'amount', type: 'money', width: 130 },
        { id: 'vc_type', label: 'Loại', sourceFieldName: 'type', type: 'computed',
          computeFn: (r, gv) => { const t = gv(r, 'type'); return t === '0' ? 'Chi' : 'Thu'; }
        },
        { id: 'vc_account', label: 'Tài khoản', sourceFieldName: 'account', type: 'computed',
          computeFn: (r, gv) => {
            const acc = String(gv(r, 'account') ?? '');
            if (acc === 'cash') return 'Tiền mặt';
            if (acc === 'bank') return 'Ngân hàng';
            if (acc === 'momo') return 'MoMo';
            if (acc.startsWith('credit_card_')) return '💳 Thẻ TD';
            return acc || '—';
          }
        },
        { id: 'vc_beneficiary', label: 'Người nhận', sourceFieldName: 'beneficiary', type: 'computed',
          computeFn: (r, gv) => {
            const v = String(gv(r, 'beneficiary') ?? '');
            const labels: Record<string, string> = { ba: 'Ba', me: 'Mẹ', vo: 'Vợ', con: 'Con', anh: 'Anh', chi: 'Chị', chong: 'Chồng', banthan: 'Mình' };
            return labels[v] || v || '—';
          }
        },
        { id: 'vc_warranty', label: 'Bảo hành', sourceFieldName: 'warranty_date', type: 'computed',
          computeFn: (r, gv) => {
            const v = gv(r, 'warranty_date');
            if (!v) return '—';
            const d = new Date(String(v));
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('vi-VN');
          }
        },
        { id: 'vc_note', label: 'Ghi chú', sourceFieldName: 'note', type: 'text' },
      ];
    }
    return null;
  }, [module.id]);

  // Standard columns
  const columns = useMemo((): FieldDefinition[] => {
    if (virtualColumns) return [];
    if (module.tableConfig?.columns) {
      // Fields visible if: in tableConfig with isVisible=true, OR not in tableConfig but field.isTableVisible=true
      const tableColMap = new Map(module.tableConfig.columns.map((col) => [col.fieldId, col]));
      const matched = module.fields
        .filter((f) => {
          const colConfig = tableColMap.get(f.id);
          if (colConfig) return colConfig.isVisible;
          // Field not in tableConfig: show if isTableVisible
          return f.isTableVisible;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (matched.length > 0) return matched;
    }
    return module.fields.filter((f) => f.isTableVisible).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [module, virtualColumns]);

  const hasCategories = (module.categories?.length ?? 0) > 0;
  const isChiTieu = module.id === 'mod_chitieu';

  // Insert virtual columns (Danh mục, Module) into columns list at their sortOrder position
  const allColumns = useMemo(() => {
    const cols = [...columns];
    if (hasCategories) {
      // Find position for category column based on tableConfig or append at end
      const catColConfig = module.tableConfig?.columns?.find((c) => c.fieldId === '__category');
      const catSortOrder = catColConfig?.sortOrder ?? 900;
      const catField = { id: '__category', moduleId: module.id, fieldName: '__category', fieldLabel: 'Danh muc', fieldType: 'virtual' as const, sortOrder: catSortOrder, isRequired: false, isVisible: true, isTableVisible: true, createdAt: '', updatedAt: '' } as unknown as FieldDefinition;
      cols.push(catField);
    }
    if (isChiTieu) {
      const modColConfig = module.tableConfig?.columns?.find((c) => c.fieldId === '__module');
      const modSortOrder = modColConfig?.sortOrder ?? 901;
      const modField = { id: '__module', moduleId: module.id, fieldName: '__module', fieldLabel: 'Module', fieldType: 'virtual' as const, sortOrder: modSortOrder, isRequired: false, isVisible: true, isTableVisible: true, createdAt: '', updatedAt: '' } as unknown as FieldDefinition;
      cols.push(modField);
    }
    return cols.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [columns, hasCategories, isChiTieu, module]);

  // Compact mode: only show key columns (Thu gọn)
  // Use tableConfig.columns[].isCompactVisible if available, otherwise fallback to hardcoded list
  const compactFieldNames = ['date', 'title', 'order_name', 'amount', 'total_amount', 'type', 'account', '__category', '__module'];
  let displayColumns = compactMode
    ? (() => {
        // Check if any column has isCompactVisible configured
        const compactConfig = module.tableConfig?.columns?.filter((c) => c.isCompactVisible);
        if (compactConfig && compactConfig.length > 0) {
          const compactIds = new Set(compactConfig.map((c) => c.fieldId));
          // Always include virtual columns (__category, __module) if they exist
          return allColumns.filter((f) => compactIds.has(f.id) || f.fieldName === '__category' || f.fieldName === '__module');
        }
        // Fallback: hardcoded list
        return allColumns.filter((f) => compactFieldNames.includes(f.fieldName));
      })()
    : allColumns;
  
  // In Group mode, hide date VALUES in rows (column header stays, but cells empty)
  // We do NOT remove date from displayColumns - instead we'll handle in cell render

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color?: string; icon?: string }>();
    module.categories?.forEach((c) => map.set(c.id, { name: c.name, color: c.color, icon: c.icon }));
    return map;
  }, [module.categories]);

  const moduleMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string }>();
    data?.modules.forEach((m) => map.set(m.id, { name: m.name, color: m.color, icon: m.icon }));
    return map;
  }, [data]);

  const getLinkedModule = (record: DataRecord): string | undefined => {
    if (record.linkedModuleId) return record.linkedModuleId;
    if (record.categoryId && record.categoryId.startsWith('mod_') && !categoryMap.has(record.categoryId)) return record.categoryId;
    return undefined;
  };

  const getCategory = (record: DataRecord): string | undefined => {
    if (record.categoryId && !record.categoryId.startsWith('mod_')) return record.categoryId;
    if (record.categoryId && categoryMap.has(record.categoryId)) return record.categoryId;
    return undefined;
  };

  // Sort
  const sortedRecords = useMemo(() => {
    if (!sortField) return records;
    const sortFieldDef = module.fields.find((f) => f.id === sortField);
    const sfn = sortFieldDef?.fieldName;
    return [...records].sort((a, b) => {
      let aVal = a.values[sortField];
      let bVal = b.values[sortField];
      if (aVal === undefined && sfn) { const k = Object.keys(a.values).find((x) => x.endsWith('_' + sfn)); if (k) aVal = a.values[k]; }
      if (bVal === undefined && sfn) { const k = Object.keys(b.values).find((x) => x.endsWith('_' + sfn)); if (k) bVal = b.values[k]; }
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal), 'vi', { numeric: true });
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      // Tie-break: most recently updated first (nhập/sửa sau lên trên) within same value
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [records, sortField, sortDir, module.fields]);

  // Apply column filters
  const filteredRecords = useMemo(() => {
    if (activeFilterCount === 0) return sortedRecords;
    return sortedRecords.filter((record) => {
      for (const [key, filter] of Object.entries(columnFilters)) {
        // Special filters: category, module
        if (key === '__category') {
          const catId = record.categoryId && !record.categoryId.startsWith('mod_') ? record.categoryId : undefined;
          if (filter.value && catId !== filter.value) return false;
          continue;
        }
        if (key === '__module') {
          const linked = record.linkedModuleId || (record.categoryId?.startsWith('mod_') ? record.categoryId : undefined);
          if (filter.value && linked !== filter.value) return false;
          continue;
        }
        // Field-based filters
        const field = module.fields.find((f) => f.id === key);
        if (!field) continue;
        const val = record.values[field.id] ?? (() => { const k = Object.keys(record.values).find((x) => x.endsWith('_' + field.fieldName)); return k ? record.values[k] : undefined; })();

        if (filter.type === 'text') {
          if (!String(val ?? '').toLowerCase().includes(filter.value.toLowerCase())) return false;
        } else if (filter.type === 'select') {
          if (String(val ?? '') !== filter.value) return false;
        } else if (filter.type === 'dateRange') {
          const d = String(val ?? '');
          if (filter.value && d < filter.value) return false;
          if (filter.valueTo && d > filter.valueTo) return false;
        }
      }
      return true;
    });
  }, [sortedRecords, columnFilters, activeFilterCount, module.fields]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filteredRecords.length]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  // Date grouping: compute which rows start a new date group and daily totals
  const dateGroups = useMemo(() => {
    if (!showDateGroups) return null; // Only show when Group mode is enabled
    if (virtualColumns) return null; // Skip for virtual column modules (they handle their own display)
    const dateField = module.fields.find((f) => f.fieldType === 'date' && (f.fieldName === 'date' || f.fieldName === 'order_date'));
    if (!dateField) return null;

    const groups = new Map<number, { date: string; expense: number; income: number }>();
    let lastDate = '';

    for (let i = 0; i < paginatedRecords.length; i++) {
      const record = paginatedRecords[i];
      let dateVal = record.values[dateField.id];
      if (dateVal === undefined) {
        const k = Object.keys(record.values).find((x) => x.endsWith('_' + dateField.fieldName));
        if (k) dateVal = record.values[k];
      }
      const dateStr = String(dateVal ?? '').slice(0, 10);

      if (dateStr !== lastDate) {
        // Calculate daily expense and income for this date
        let dailyExpense = 0;
        let dailyIncome = 0;
        for (let j = i; j < paginatedRecords.length; j++) {
          const r = paginatedRecords[j];
          let d = r.values[dateField.id];
          if (d === undefined) {
            const k = Object.keys(r.values).find((x) => x.endsWith('_' + dateField.fieldName));
            if (k) d = r.values[k];
          }
          if (String(d ?? '').slice(0, 10) !== dateStr) break;
          
          // Get amount: find key ending with _amount
          let amt = 0;
          for (const [key, val] of Object.entries(r.values)) {
            if (key.endsWith('_amount') && !key.endsWith('_total_amount') && val != null) {
              amt = Math.abs(Number(val) || 0);
              break;
            }
          }
          
          // Get type: find key ending with _type
          let isIncome = false;
          for (const [key, val] of Object.entries(r.values)) {
            if (key.endsWith('_type') && val != null) {
              const t = String(val);
              isIncome = (t === '1' || t === 'thu' || t === 'income' || t === 'Thu');
              break;
            }
          }
          
          if (isIncome) dailyIncome += amt;
          else dailyExpense += amt;
        }

        groups.set(i, { date: dateStr, expense: dailyExpense, income: dailyIncome });
        lastDate = dateStr;
      }
    }
    return groups;
  }, [paginatedRecords, module.fields, virtualColumns, showDateGroups]);

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(fieldId); setSortDir('desc'); }
  };

  const handleDelete = (record: DataRecord) => { if (confirm('Xóa bản ghi này?')) deleteRecord(record.id); };

  // Selection handlers
  const handleRowClick = useCallback((e: React.MouseEvent, record: DataRecord, idx: number) => {
    if (!onSelectionChange || !selectedIds) return;

    // Don't handle if clicking on action buttons or inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) return;

    const newSelection = new Set(selectedIds);

    if (e.shiftKey && lastClickedIdx.current >= 0) {
      // Shift+click: select range
      const start = Math.min(lastClickedIdx.current, idx);
      const end = Math.max(lastClickedIdx.current, idx);
      for (let i = start; i <= end; i++) {
        newSelection.add(paginatedRecords[i].id);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle individual without clearing others
      if (newSelection.has(record.id)) {
        newSelection.delete(record.id);
      } else {
        newSelection.add(record.id);
      }
    } else {
      // Regular click: toggle this row
      if (newSelection.has(record.id)) {
        newSelection.delete(record.id);
      } else {
        newSelection.clear();
        newSelection.add(record.id);
      }
    }

    lastClickedIdx.current = idx;
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange, paginatedRecords]);

  const handleCheckboxChange = useCallback((recordId: string, idx: number) => {
    if (!onSelectionChange || !selectedIds) return;
    const newSelection = new Set(selectedIds);
    if (newSelection.has(recordId)) {
      newSelection.delete(recordId);
    } else {
      newSelection.add(recordId);
    }
    lastClickedIdx.current = idx;
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (selectedIds && selectedIds.size === paginatedRecords.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(paginatedRecords.map((r) => r.id)));
    }
  }, [selectedIds, onSelectionChange, paginatedRecords]);

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, record: DataRecord) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, record });
  }, []);

  const handleClone = useCallback((record: DataRecord) => {
    // Clone: create a copy and open edit form
    const clonedValues = { ...record.values };
    addRecord(record.moduleId, clonedValues, record.categoryId, record.linkedModuleId || undefined);
    setContextMenu(null);
  }, [addRecord]);

  const handleCopy = useCallback((record: DataRecord) => {
    // Copy record data to clipboard as text
    const parts: string[] = [];
    for (const [key, val] of Object.entries(record.values)) {
      if (val !== null && val !== undefined && val !== '') {
        parts.push(`${key}: ${val}`);
      }
    }
    navigator.clipboard.writeText(parts.join('\n')).catch(() => {});
    setContextMenu(null);
  }, []);

  const hasSelection = !!selectedIds && !!onSelectionChange;
  const colCount = (virtualColumns ? virtualColumns.length : columns.length) + (hasCategories ? 1 : 0) + (isChiTieu ? 1 : 0) + 1 + (hasSelection ? 1 : 0);

  return (
    <div className="flex-1 overflow-auto">
      {/* Compact toggle */}
      <div className="flex items-center justify-end px-4 py-1 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <button onClick={toggleCompact} className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] transition-colors">
          <Icon name={compactMode ? 'eye' : 'eye-off'} size={11} />
          {compactMode ? 'Mo rong' : 'Thu gon'}
        </button>
      </div>
      {activeFilterCount > 0 && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <Icon name="filter" size={12} className="text-amber-600" />
          <span className="text-xs text-amber-700 dark:text-amber-300">{activeFilterCount} bộ lọc cột đang hoạt động</span>
          <button onClick={() => setColumnFilters({})} className="text-xs text-amber-600 hover:text-amber-800 underline ml-auto">Xóa tất cả</button>
        </div>
      )}
      <table className={`w-full ${fontClass}`} style={{ minWidth: `${displayColumns.length * 150 + 120}px` }}>
        <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
          <tr>
            {hasSelection && (
              <th className="px-2 py-3 w-10 border-b border-[var(--color-border)]">
                <input
                  type="checkbox"
                  className="rounded border-[var(--color-border)] cursor-pointer"
                  checked={paginatedRecords.length > 0 && selectedIds.size === paginatedRecords.length}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {virtualColumns ? virtualColumns.map((vc) => (
              <th key={vc.id} className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] group/th" style={{ width: vc.width ? `${vc.width}px` : undefined }}>
                <div className="flex items-center gap-1">
                  <span>{vc.label}</span>
                </div>
              </th>
            )) : displayColumns.map((field) => (
              <th key={field.id} className={`px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] cursor-pointer hover:text-[var(--color-text)] select-none group/th whitespace-nowrap`} style={field.fieldName === '__category' ? { width: '130px', minWidth: '130px' } : field.fieldType === 'date' ? { width: '90px', minWidth: '90px' } : undefined} onClick={() => field.fieldName !== '__category' && field.fieldName !== '__module' && handleSort(field.id)}>
                <div className="flex items-center gap-1">
                  <span>{field.fieldLabel}</span>
                  {sortField === field.id && <Icon name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />}
                  {field.fieldName === '__category' ? (
                    <ColumnFilter
                      type="select"
                      options={module.categories?.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name, color: c.color })) || []}
                      value={columnFilters['__category'] || null}
                      onChange={(f) => setColumnFilter('__category', f)}
                    />
                  ) : field.fieldName === '__module' ? (
                    <ColumnFilter
                      type="select"
                      options={data?.modules.filter((m) => m.isActive && m.id !== 'mod_chitieu').map((m) => ({ value: m.id, label: m.name, color: m.color })) || []}
                      value={columnFilters['__module'] || null}
                      onChange={(f) => setColumnFilter('__module', f)}
                    />
                  ) : (
                    <ColumnFilter
                      type={field.fieldType === 'date' ? 'dateRange' : (field.fieldType === 'dropdown' ? 'select' : 'text')}
                      options={field.options?.filter((o) => o.isActive).map((o) => ({ value: o.value, label: o.label, color: o.color }))}
                      value={columnFilters[field.id] || null}
                      onChange={(f) => setColumnFilter(field.id, f)}
                    />
                  )}
                </div>
              </th>
            ))}
            <th className="px-4 py-3 w-20 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)]">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] divide-opacity-50">
          {paginatedRecords.length === 0 ? (
            <tr><td colSpan={colCount} className="px-4 py-16 text-center">
              <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                <Icon name="file-text" size={32} className="opacity-30" />
                <p className="text-sm">Chưa có dữ liệu</p>
                <p className="text-xs">Nhấn "Thêm mới" (Ctrl+N) hoặc liên kết từ Chi tiêu</p>
              </div>
            </td></tr>
          ) : paginatedRecords.map((record, idx) => {
            const catId = getCategory(record);
            const linkedMod = getLinkedModule(record);
            const isSelected = selectedIds?.has(record.id) ?? false;

            // Date group header row — compute by comparing with previous record's date
            let dateHeaderRow: React.ReactNode = null;
            if (showDateGroups) {
              // Get current record's date
              const curDateKey = Object.keys(record.values).find((k) => k.endsWith('_date') || k.endsWith('_order_date'));
              const curDate = curDateKey ? String(record.values[curDateKey] ?? '').slice(0, 10) : '';
              
              // Get previous record's date
              let prevDate = '';
              if (idx > 0) {
                const prevRec = paginatedRecords[idx - 1];
                const prevDateKey = Object.keys(prevRec.values).find((k) => k.endsWith('_date') || k.endsWith('_order_date'));
                prevDate = prevDateKey ? String(prevRec.values[prevDateKey] ?? '').slice(0, 10) : '';
              }
              
              // If date changed (or first record), render group header
              if (curDate !== prevDate && curDate) {
                // Calculate totals for this date group
                let grpExpense = 0;
                let grpIncome = 0;
                let grpCount = 0;
                for (let j = idx; j < paginatedRecords.length; j++) {
                  const r = paginatedRecords[j];
                  const rDateKey = Object.keys(r.values).find((k) => k.endsWith('_date') || k.endsWith('_order_date'));
                  const rDate = rDateKey ? String(r.values[rDateKey] ?? '').slice(0, 10) : '';
                  if (rDate !== curDate) break;
                  grpCount++;
                  // Amount
                  const amtKey = Object.keys(r.values).find((k) => k.endsWith('_amount') && !k.endsWith('_total_amount'));
                  const amt = amtKey ? Math.abs(Number(r.values[amtKey]) || 0) : 0;
                  // Type
                  const typeKey = Object.keys(r.values).find((k) => k.endsWith('_type'));
                  const typeVal = typeKey ? String(r.values[typeKey] ?? '0') : '0';
                  const isInc = typeVal === '1' || typeVal === 'thu' || typeVal === 'Thu' || typeVal === 'income';
                  if (isInc) grpIncome += amt;
                  else grpExpense += amt;
                }
                
                // Format date display
                let displayDate = curDate;
                try {
                  const d = new Date(curDate + 'T00:00:00');
                  if (!isNaN(d.getTime())) {
                    displayDate = d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
                  }
                } catch { /* use raw */ }

                dateHeaderRow = (
                  <tr key={`grp-${curDate}`} className="bg-gray-50 dark:bg-gray-800/30 border-t-2 border-[var(--color-border)]">
                    <td colSpan={colCount} className="px-4 py-1.5">
                      <span className="text-xs font-semibold text-[var(--color-text)]">{displayDate}</span>
                      {' '}
                      <span className="text-[10px] text-[var(--color-text-secondary)]">({grpCount} giao dịch)</span>
                      {' '}
                      {grpExpense > 0 && <span className="text-xs font-semibold text-red-600 ml-4">-{grpExpense.toLocaleString('vi-VN')} ₫</span>}
                      {grpExpense > 0 && grpIncome > 0 && <span className="text-gray-400 mx-1">|</span>}
                      {grpIncome > 0 && <span className="text-xs font-semibold text-green-600">+{grpIncome.toLocaleString('vi-VN')} ₫</span>}
                    </td>
                  </tr>
                );
              }
            }
            const getValue = (field: FieldDefinition): unknown => {
              // Direct match
              if (record.values[field.id] !== undefined && record.values[field.id] !== null) return record.values[field.id];
              // Suffix match (cross-module linked records)
              const k = Object.keys(record.values).find((x) => x.endsWith('_' + field.fieldName));
              if (k && record.values[k] !== undefined && record.values[k] !== null) return record.values[k];

              // Computed fallbacks for linked records displayed in another module's table
              if (module.id === 'mod_vang' && record.moduleId !== 'mod_vang') {
                if (field.fieldName === 'quantity') {
                  // Quantity: look in any _quantity key, default to 1
                  const qtyKey = Object.keys(record.values).find((x) => x.endsWith('_quantity'));
                  const qty = qtyKey ? record.values[qtyKey] : null;
                  return (qty !== null && qty !== undefined && qty !== '') ? qty : 1;
                }
                if (field.fieldName === 'price_per_unit') {
                  // Compute: amount / quantity
                  const amountKey = Object.keys(record.values).find((x) => x.endsWith('_amount') && !x.endsWith('_total_amount'));
                  const totalKey = Object.keys(record.values).find((x) => x.endsWith('_total_amount'));
                  const amount = Number(totalKey ? record.values[totalKey] : (amountKey ? record.values[amountKey] : 0)) || 0;
                  const qtyKey = Object.keys(record.values).find((x) => x.endsWith('_quantity'));
                  const qty = Number(qtyKey ? record.values[qtyKey] : 1) || 1;
                  if (amount > 0) return Math.round(amount / qty);
                  return undefined;
                }
                if (field.fieldName === 'total_amount') {
                  // Fallback to any _amount key
                  const amountKey = Object.keys(record.values).find((x) => x.endsWith('_amount'));
                  if (amountKey && record.values[amountKey] != null) return record.values[amountKey];
                }
              }
              return undefined;
            };

            return (
              <>{dateHeaderRow}
              <tr
                key={record.id}
                className={`hover:bg-[var(--color-surface)] transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onClick={(e) => handleRowClick(e, record, idx)}
                onContextMenu={(e) => handleContextMenu(e, record)}
              >
                {hasSelection && (
                  <td className="px-2 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-[var(--color-border)] cursor-pointer"
                      checked={isSelected}
                      onChange={() => handleCheckboxChange(record.id, idx)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {virtualColumns ? virtualColumns.map((vc) => (
                  <td key={vc.id} className="px-4 py-3 text-[var(--color-text)]" style={{ width: vc.width ? `${vc.width}px` : undefined }}>
                    {vc.type === 'computed' && vc.computeFn
                      ? <VirtualCellComputed value={vc.computeFn(record, getRecordValue)} vcId={vc.id} />
                      : vc.type === 'money'
                      ? <span className="font-medium tabular-nums">{Number(getRecordValue(record, vc.sourceFieldName) ?? 0).toLocaleString('vi-VN')} ₫</span>
                      : vc.type === 'date'
                      ? <span className="text-xs text-[var(--color-text-secondary)]">{(() => { const v = getRecordValue(record, vc.sourceFieldName); if (!v || String(v) === 'undefined' || String(v) === 'null') return '—'; const d = new Date(String(v)); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN'); })()}</span>
                      : <span>{String(getRecordValue(record, vc.sourceFieldName) ?? '—')}</span>
                    }
                  </td>
                )) : displayColumns.map((field) => (
                  <td key={field.id} className={`px-4 py-3 text-[var(--color-text)]${field.fieldName === '__category' ? ' whitespace-nowrap' : ''}${field.fieldType === 'date' ? ' text-xs text-[var(--color-text-secondary)]' : ''}`} style={field.fieldName === '__category' ? { width: '130px', minWidth: '130px' } : field.fieldType === 'date' ? { width: '90px', minWidth: '90px' } : undefined}>
                    {field.fieldName === '__category' ? (
                      catId && categoryMap.has(catId) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ backgroundColor: (categoryMap.get(catId)!.color || '#64748b') + '15', color: categoryMap.get(catId)!.color || '#64748b' }}>
                          {categoryMap.get(catId)!.icon && <Icon name={categoryMap.get(catId)!.icon!} size={11} />}
                          {categoryMap.get(catId)!.name}
                        </span>
                      ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    ) : field.fieldName === '__module' ? (
                      linkedMod && moduleMap.has(linkedMod) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: moduleMap.get(linkedMod)!.color + '15', color: moduleMap.get(linkedMod)!.color }}>
                          <Icon name={moduleMap.get(linkedMod)!.icon} size={11} />
                          {moduleMap.get(linkedMod)!.name}
                        </span>
                      ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    ) : (
                      showDateGroups && (field.fieldName === 'date' || field.fieldName === 'order_date')
                        ? <span></span>
                        : <CellDisplay value={getValue(field)} field={field} />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(record); }} className="p-1.5 rounded-md hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]" title="Sửa"><Icon name="edit" size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(record); }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500" title="Xóa"><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
              </>
            );
          })}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Sửa', icon: 'edit', onClick: () => { onEdit(contextMenu.record); setContextMenu(null); } },
            { label: 'Nhân bản', icon: 'copy', onClick: () => handleClone(contextMenu.record) },
            { label: 'Copy dữ liệu', icon: 'clipboard', onClick: () => handleCopy(contextMenu.record) },
            { type: 'divider' },
            { label: 'Xóa', icon: 'trash', onClick: () => { handleDelete(contextMenu.record); setContextMenu(null); }, danger: true },
          ]}
        />
      )}

      {/* Pagination */}
      {filteredRecords.length > 0 && (
        <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Tổng: {filteredRecords.length} bản ghi
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-secondary)]">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-text)]"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border border-[var(--color-border)] text-xs disabled:opacity-40 hover:bg-[var(--color-border)] transition-colors"
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <span className="text-xs text-[var(--color-text)]">
              Trang {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border border-[var(--color-border)] text-xs disabled:opacity-40 hover:bg-[var(--color-border)] transition-colors"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImages.length > 0 && (
        <ImagePreviewModal
          imageIds={previewImages}
          initialIdx={previewIdx}
          onClose={() => setPreviewImages([])}
        />
      )}
    </div>
  );
}

// ─── Image Preview Modal (fetches from Drive with auth) ─────────────────────

function ImagePreviewModal({ imageIds, initialIdx, onClose }: { imageIds: string[]; initialIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIdx);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setImgSrc(null);

    const fetchImage = async () => {
      const fileId = imageIds[idx];
      if (!fileId) { setError('No file ID'); setLoading(false); return; }

      try {
        // Try to get token from driveService
        const { driveService } = await import('@/services/drive/driveService');
        const token = driveService.token;
        
        if (token) {
          // Fetch with auth
          const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const blob = await resp.blob();
            if (!cancelled) setImgSrc(URL.createObjectURL(blob));
          } else {
            if (!cancelled) setError(`Lỗi ${resp.status}: không tải được ảnh`);
          }
        } else {
          // No token - try public URL as fallback
          if (!cancelled) setImgSrc(`https://drive.google.com/uc?export=view&id=${fileId}`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải ảnh');
      }
      if (!cancelled) setLoading(false);
    };

    fetchImage();
    return () => { cancelled = true; };
  }, [idx, imageIds]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => { if (imgSrc?.startsWith('blob:')) URL.revokeObjectURL(imgSrc); };
  }, [imgSrc]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {loading && <div className="text-white text-sm">Đang tải ảnh...</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {imgSrc && <img src={imgSrc} alt={imageIds[idx]} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />}
        <div className="text-white text-xs">{idx + 1} / {imageIds.length}</div>
        {imageIds.length > 1 && (
          <>
            <button onClick={() => setIdx((i) => (i - 1 + imageIds.length) % imageIds.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">
              <Icon name="chevron-left" size={20} />
            </button>
            <button onClick={() => setIdx((i) => (i + 1) % imageIds.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">
              <Icon name="chevron-right" size={20} />
            </button>
          </>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}

function CellDisplay({ value, field }: { value: unknown; field: FieldDefinition }) {
  const { data } = useAppStore();
  const formatted = formatCellValue(value as never, field);
  if (field.fieldType === 'money' && value != null) return <span className="font-medium tabular-nums">{Number(value).toLocaleString('vi-VN')} ₫</span>;
  if ((field.fieldType === 'dropdown' || field.fieldType === 'radio') && field.options) {
    const strVal = String(value ?? '');
    if (field.fieldName === 'account' && strVal.startsWith('credit_card_')) {
      const cardId = strVal.replace('credit_card_', '');
      const ccRecord = data?.records.find((r) => r.moduleId === 'mod_creditcard' && r.id === cardId && !r.isDeleted);
      if (ccRecord) {
        const cardName = Object.values(ccRecord.values).find((v) => typeof v === 'string' && v.length > 0 && v.length < 30);
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A237E15', color: '#1A237E' }}>💳 {String(cardName || 'Thẻ TD')}</span>;
      }
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A237E15', color: '#1A237E' }}>💳 Thẻ TD</span>;
    }
    const opt = field.options.find((o) => o.value === value);
    if (opt) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (opt.color || '#64748b') + '15', color: opt.color || '#64748b' }}>{opt.label}</span>;
    // Fallback for account: the value may be an account id (e.g. a UUID from a
    // newly added payment method) not present in this field's options yet.
    // Resolve it against the shared accounts list so it shows the real name
    // (e.g. "Tpbank") instead of leaking the raw id.
    if (field.fieldName === 'account' && strVal) {
      const acc = data?.accounts?.find((a) => a.id === strVal || a.name === strVal);
      if (acc) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (acc.color || '#64748b') + '15', color: acc.color || '#64748b' }}>{acc.name}</span>;
      // Unknown account id → don't display a raw UUID.
      if (isUuidLike(strVal)) return <span className="text-[var(--color-text-secondary)]">—</span>;
    }
    // Fallback for beneficiary field with known values
    if (field.fieldName === 'beneficiary' && strVal) {
      const benLabels: Record<string, string> = { ba: 'Ba', me: 'Mẹ', vo: 'Vợ', con: 'Con', anh: 'Anh', chi: 'Chị', chong: 'Chồng', banthan: 'Mình' };
      if (benLabels[strVal]) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#60748b15', color: '#607D8B' }}>{benLabels[strVal]}</span>;
    }
  }
  if (field.fieldType === 'date' && value) {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) {
      // Warranty date highlighting
      if (field.fieldName === 'warranty_date') {
        const now = new Date();
        const alertDays = data?.settings?.warrantyAlertDays ?? 10;
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          return <span className="text-xs font-medium text-red-600 dark:text-red-400" title="Đã hết bảo hành">{d.toLocaleDateString('vi-VN')}</span>;
        } else if (daysLeft <= alertDays) {
          return <span className="text-xs font-medium text-orange-600 dark:text-orange-400" title={`Còn ${daysLeft} ngày bảo hành`}>{d.toLocaleDateString('vi-VN')}</span>;
        }
      }
      return <span className="text-xs text-[var(--color-text-secondary)]">{d.toLocaleDateString('vi-VN')}</span>;
    }
  }
  return <span className="truncate max-w-[200px] block">{formatted}</span>;
}

function VirtualCellComputed({ value, vcId }: { value: string; vcId: string }) {
  if (vcId === 'vc_type') {
    if (value === 'Chi' || value === 'Bán') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#F4433615', color: '#F44336' }}>{value}</span>;
    }
    if (value === 'Thu' || value === 'Mua') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#4CAF5015', color: '#4CAF50' }}>{value}</span>;
    }
  }
  if (vcId === 'vc_account') {
    return <span className="text-sm">{value}</span>;
  }
  return <span>{value}</span>;
}
