import { useState, useMemo } from 'react';
import type { FieldDefinition, DataRecord, TableConfig } from '@/types';
import { Icon } from '@/shared/components/ui/Icon';
import { formatCellValue } from './cellFormatters';

interface DynamicTableProps {
  records: DataRecord[];
  fields: FieldDefinition[];
  tableConfig?: TableConfig;
  onRowClick?: (record: DataRecord) => void;
  onEdit?: (record: DataRecord) => void;
  onDelete?: (record: DataRecord) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

/**
 * Dynamic Table Engine
 * 
 * Renders a data table based on metadata (field definitions + table config).
 * Supports:
 * - Dynamic columns from metadata
 * - Sort by any column
 * - Search/filter
 * - Pagination
 * - Column visibility toggle
 * - Actions (edit, delete)
 */
export function DynamicTable({
  records,
  fields,
  tableConfig,
  onRowClick,
  onEdit,
  onDelete,
  searchQuery = '',
  onSearchChange,
}: DynamicTableProps) {
  const [sortField, setSortField] = useState<string | null>(
    tableConfig?.defaultSort?.fieldId || null
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    tableConfig?.defaultSort?.direction || 'desc'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = tableConfig?.pageSize || 50;

  // Determine visible columns from config or defaults
  const visibleFields = useMemo(() => {
    if (tableConfig?.columns) {
      return tableConfig.columns
        .filter((col) => col.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((col) => fields.find((f) => f.id === col.fieldId))
        .filter((f): f is FieldDefinition => f !== undefined);
    }
    return fields.filter((f) => f.isTableVisible).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [fields, tableConfig]);

  // Sort records
  const sortedRecords = useMemo(() => {
    if (!sortField) return records;

    return [...records].sort((a, b) => {
      const aVal = a.values[sortField];
      const bVal = b.values[sortField];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'vi', { numeric: true });
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [records, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / pageSize);
  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(fieldId);
      setSortDir('desc');
    }
  };

  const getColumnWidth = (fieldId: string): string | undefined => {
    const colConfig = tableConfig?.columns?.find((c) => c.fieldId === fieldId);
    return colConfig?.width ? `${colConfig.width}px` : undefined;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
        {onSearchChange && (
          <div className="relative flex-1 max-w-xs">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              className="input-field pl-8 py-1.5 text-xs"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        <div className="flex-1" />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {sortedRecords.length} bản ghi
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-surface)]">
              {visibleFields.map((field) => (
                <th
                  key={field.id}
                  className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-border)] hover:bg-opacity-30 select-none"
                  style={{ width: getColumnWidth(field.id) }}
                  onClick={() => handleSort(field.id)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{field.fieldLabel}</span>
                    {sortField === field.id && (
                      <Icon name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-3 py-2 w-20 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleFields.length + (onEdit || onDelete ? 1 : 0)}
                  className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                >
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-[var(--color-surface)] transition-colors cursor-pointer border-b border-[var(--color-border)] border-opacity-50"
                  onClick={() => onRowClick?.(record)}
                >
                  {visibleFields.map((field) => (
                    <td
                      key={field.id}
                      className="px-3 py-2 text-sm text-[var(--color-text)] truncate max-w-[200px]"
                      style={{ width: getColumnWidth(field.id) }}
                    >
                      {formatCellValue(record.values[field.id], field)}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {onEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(record);
                            }}
                            className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                            title="Sửa"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(record);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-[var(--color-text-secondary)] hover:text-red-500"
                            title="Xóa"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Trang {currentPage} / {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-[var(--color-border)] disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs rounded border border-[var(--color-border)] disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
