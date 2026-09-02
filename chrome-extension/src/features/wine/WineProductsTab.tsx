import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import { useTableSortFilter, ColumnHeader } from '@/shared/components/ui/ColumnHeader';
import { WineProductFormDialog } from './WineProductFormDialog';
import { WineProductImportDialog } from './WineProductImportDialog';
import type { DataRecord } from '@/types';

export function WineProductsTab() {
  const { data } = useAppStore();
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [search, setSearch] = useState('');
  const { fontSize, fontClass, zoomIn, zoomOut } = useTableZoom();
  const { sort, filters, toggleSort, setFilter, applySort } = useTableSortFilter();

  // Alt+N shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setEditingRecord(null);
        setShowForm(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const products = useMemo(() => {
    if (!data) return [];
    let records = data.records.filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted);
    if (search) {
      const q = search.toLowerCase();
      records = records.filter((r) =>
        Object.values(r.values).some((v) => v !== null && String(v).toLowerCase().includes(q))
      );
    }
    return records.sort((a, b) => {
      const na = String(a.values['mod_ruou_products_product_name'] ?? '');
      const nb = String(b.values['mod_ruou_products_product_name'] ?? '');
      return na.localeCompare(nb, 'vi');
    });
  }, [data, search]);

  const getProductValue = (r: DataRecord, col: string): string => {
    const map: Record<string, string> = {
      sku: String(r.values['mod_ruou_products_sku'] ?? ''),
      name: String(r.values['mod_ruou_products_product_name'] ?? ''),
      shortName: String(r.values['mod_ruou_products_short_name'] ?? ''),
      volume: String(r.values['mod_ruou_products_volume_ml'] ?? ''),
      wineType: String(r.values['mod_ruou_products_wine_type'] ?? ''),
      bottleType: String(r.values['mod_ruou_products_bottle_type'] ?? ''),
      note: String(r.values['mod_ruou_products_note'] ?? ''),
    };
    return map[col] ?? '';
  };
  const sortedProducts = useMemo(() => applySort(products, getProductValue), [products, applySort]);

  const handleEdit = (record: DataRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Xóa sản phẩm này?')) deleteRecord(id);
  };

  const getOptionLabel = (fieldId: string, value: unknown) => {
    if (!data) return String(value ?? '');
    const mod = data.modules.find((m) => m.id === 'mod_ruou_products');
    const field = mod?.fields.find((f) => f.id === fieldId);
    const opt = field?.options?.find((o) => o.value === String(value));
    return opt?.label ?? String(value ?? '');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder="Tìm sản phẩm..."
            className="input-field pl-8 py-1.5 text-xs w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{sortedProducts.length} SP</span>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button onClick={() => setShowImport(true)} className="text-xs px-3 py-1.5 flex items-center gap-1 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)]" title="Import sản phẩm từ Excel">
          <Icon name="upload" size={13} />
          Import
        </button>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Thêm sản phẩm (Alt+N)">
          <Icon name="plus" size={13} />
          Thêm SP
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className={`w-full ${fontClass}`}>
          <thead className="sticky top-0 text-white" style={{ backgroundColor: '#a855f7' }}>
            <tr className="text-left [&>th]:border-r [&>th]:border-white/30 [&>th:last-child]:border-r-0">
              <ColumnHeader column="sku" label="SKU" className="px-3 py-2 w-[75px]" sort={sort} filterValue={filters['sku']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="name" label="Tên đầy đủ" className="px-3 py-2 w-[220px]" sort={sort} filterValue={filters['name']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="shortName" label="Tên ngắn" className="px-3 py-2 w-[100px]" sort={sort} filterValue={filters['shortName']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="volume" label="Dung tích" className="px-3 py-2 w-[65px]" sort={sort} filterValue={filters['volume']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="wineType" label="Loại rượu" className="px-3 py-2 w-[75px]" sort={sort} filterValue={filters['wineType']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="bottleType" label="Loại chai" className="px-3 py-2 w-[70px]" sort={sort} filterValue={filters['bottleType']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="note" label="Ghi chú" className="px-3 py-2 w-[120px]" sort={sort} filterValue={filters['note']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-3 py-2 w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                <td className="px-3 py-2 text-[var(--color-text-secondary)] font-mono">{String(r.values['mod_ruou_products_sku'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text)] font-medium">{String(r.values['mod_ruou_products_product_name'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{String(r.values['mod_ruou_products_short_name'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{r.values['mod_ruou_products_volume_ml'] ? `${r.values['mod_ruou_products_volume_ml']}ml` : ''}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{getOptionLabel('mod_ruou_products_wine_type', r.values['mod_ruou_products_wine_type'])}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{getOptionLabel('mod_ruou_products_bottle_type', r.values['mod_ruou_products_bottle_type'])}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_products_note'] ?? '')}>{String(r.values['mod_ruou_products_note'] ?? '')}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(r)} className="p-1 hover:bg-[var(--color-border)] rounded">
                      <Icon name="edit" size={12} />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500">
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">Chưa có sản phẩm nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <WineProductFormDialog record={editingRecord} onClose={() => { setShowForm(false); setEditingRecord(null); }} />
      )}

      {showImport && (
        <WineProductImportDialog onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
