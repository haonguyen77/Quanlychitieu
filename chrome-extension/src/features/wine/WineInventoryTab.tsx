import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import { useTableSortFilter, ColumnHeader } from '@/shared/components/ui/ColumnHeader';
import { WineImportDialog } from './WineImportDialog';
import { getWineColorPalette } from './wineColors';

type StatusFilter = 'all' | 'instock' | 'low' | 'out';
interface InvItem { id: string; sku: string; name: string; wineType: string; volume: number; color: string; stock: number; bottleType: string; note: string; }

export function WineInventoryTab() {
  const { data } = useAppStore();
  const { addRecord, updateRecord, deleteRecord } = useRecordStore();
  const COLOR_CODES = useMemo(() => getWineColorPalette(data), [data]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterColor, setFilterColor] = useState('');
  const [filterWineType, setFilterWineType] = useState('');
  const [filterBottleType, setFilterBottleType] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState('');
  const { fontSize, fontClass, zoomIn, zoomOut } = useTableZoom();
  const { sort, filters: colFilters, toggleSort, setFilter: setColFilter, applySort } = useTableSortFilter();

  const lowThreshold = data?.settings?.wineSettings?.lowStockThreshold ?? 4;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); setShowImport(true); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const allItems = useMemo((): InvItem[] => {
    if (!data) return [];
    const items: InvItem[] = data.records.filter((r) => r.moduleId === 'mod_ruou_inventory' && !r.isDeleted)
      .map((r) => ({ id: r.id, sku: String(r.values['mod_ruou_inventory_sku'] ?? ''), name: String(r.values['mod_ruou_inventory_product_name'] ?? ''), wineType: String(r.values['mod_ruou_inventory_wine_type'] ?? ''), volume: 0, color: String(r.values['mod_ruou_inventory_color'] ?? ''), stock: Number(r.values['mod_ruou_inventory_stock'] ?? 0), bottleType: String(r.values['mod_ruou_inventory_bottle_type'] ?? ''), note: String(r.values['mod_ruou_inventory_note'] ?? '') }));
    const invSkus = new Set(items.map((i) => i.sku));
    const products = data.records.filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted);
    for (const p of products) {
      const sku = String(p.values['mod_ruou_products_sku'] ?? '');
      if (sku && !invSkus.has(sku)) items.push({ id: p.id, sku, name: String(p.values['mod_ruou_products_product_name'] ?? ''), wineType: String(p.values['mod_ruou_products_wine_type'] ?? ''), volume: Number(p.values['mod_ruou_products_volume_ml'] ?? 0), color: '', stock: 0, bottleType: String(p.values['mod_ruou_products_bottle_type'] ?? ''), note: '' });
    }
    const prodMap = new Map(products.map((p) => [String(p.values['mod_ruou_products_sku'] ?? ''), Number(p.values['mod_ruou_products_volume_ml'] ?? 0)]));
    for (const item of items) { if (!item.volume) { item.volume = prodMap.get(item.sku) || prodMap.get(item.sku.split('-')[0]) || 0; } }
    return items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [data]);

  const totalStock = allItems.reduce((s, i) => s + i.stock, 0);
  const inStockCount = allItems.filter((i) => i.stock > lowThreshold).length;
  const lowCount = allItems.filter((i) => i.stock > 0 && i.stock <= lowThreshold).length;
  const outCount = allItems.filter((i) => i.stock === 0).length;
  const maxStock = Math.max(...allItems.map((i) => i.stock), 1);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (statusFilter === 'instock') items = items.filter((i) => i.stock > lowThreshold);
    else if (statusFilter === 'low') items = items.filter((i) => i.stock > 0 && i.stock <= lowThreshold);
    else if (statusFilter === 'out') items = items.filter((i) => i.stock === 0);
    if (search) { const q = search.toLowerCase(); items = items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)); }
    if (filterColor) items = items.filter((i) => i.color.toLowerCase().includes(filterColor.toLowerCase()));
    if (filterWineType) items = items.filter((i) => i.wineType === filterWineType);
    if (filterBottleType) items = items.filter((i) => i.bottleType === filterBottleType);
    return items;
  }, [allItems, statusFilter, search, filterColor, filterWineType, filterBottleType, lowThreshold]);

  const getInvValue = (item: InvItem, col: string): string | number => {
    const map: Record<string, string | number> = { sku: item.sku, name: item.name, wineType: item.wineType, volume: item.volume, color: item.color, stock: item.stock, bottleType: item.bottleType, note: item.note };
    return map[col] ?? '';
  };
  const sortedItems = useMemo(() => applySort(filteredItems, getInvValue), [filteredItems, applySort]);

  const getWineLabel = (v: string) => ({ gao: 'Gạo', nep: 'Nếp', dauxanh: 'Đậu xanh', vangnep: 'Vang nếp', dtht: 'ĐTHT' }[v] ?? v);

  const importLogs = useMemo(() => {
    try {
      const raw = localStorage.getItem('wine_import_log');
      if (!raw) return [];
      return JSON.parse(raw) as { date: string; name: string; qty: number; color: string; note: string }[];
    } catch { return []; }
  }, [showLog]);

  const handleStockSave = (id: string) => {
    const newStock = Number(editingStockVal) || 0;
    // Check if this is an actual inventory record or auto-added from products
    const isInventoryRecord = data?.records.some((r) => r.id === id && r.moduleId === 'mod_ruou_inventory' && !r.isDeleted);
    if (isInventoryRecord) {
      updateRecord(id, { mod_ruou_inventory_stock: newStock });
    } else {
      // Auto-added product — create a new inventory record
      const item = allItems.find((i) => i.id === id);
      if (item) {
        addRecord('mod_ruou_inventory', {
          mod_ruou_inventory_sku: item.sku,
          mod_ruou_inventory_product_name: item.name,
          mod_ruou_inventory_color: item.color || '',
          mod_ruou_inventory_wine_type: item.wineType || '',
          mod_ruou_inventory_bottle_type: item.bottleType || '',
          mod_ruou_inventory_stock: newStock,
        });
      }
    }
    setEditingStockId(null);
  };
  const handleDelete = (id: string) => { if (confirm('Xóa mục này khỏi kho?')) deleteRecord(id); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Status Cards */}
      <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-3 flex-wrap">
        <button onClick={() => setStatusFilter('all')} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${statusFilter === 'all' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)]'}`}>
          <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Icon name="building" size={12} color="#2196F3" /></div>
          <div><div className="text-sm font-bold text-blue-600">{totalStock}</div><div className="text-[8px] text-[var(--color-text-secondary)]">Tổng tồn</div></div>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'instock' ? 'all' : 'instock')} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${statusFilter === 'instock' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)]'}`}>
          <div className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Icon name="check" size={12} color="#4CAF50" /></div>
          <div><div className="text-sm font-bold text-green-600">{inStockCount}</div><div className="text-[8px] text-[var(--color-text-secondary)]">Còn hàng</div></div>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${statusFilter === 'low' ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)]'}`}>
          <div className="w-6 h-6 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><Icon name="trending-down" size={12} color="#FF9800" /></div>
          <div><div className="text-sm font-bold text-orange-600">{lowCount}</div><div className="text-[8px] text-[var(--color-text-secondary)]">Sắp hết</div></div>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${statusFilter === 'out' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)]'}`}>
          <div className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><Icon name="x" size={12} color="#F44336" /></div>
          <div><div className="text-sm font-bold text-red-600">{outCount}</div><div className="text-[8px] text-[var(--color-text-secondary)]">Hết hàng</div></div>
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowLog(true)} className="text-xs px-2 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]" title="Lịch sử"><Icon name="file-text" size={13} /></button>
        <button onClick={() => setShowImport(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Nhập kho (Alt+N)"><Icon name="plus" size={13} /> Nhập kho</button>
      </div>

      {/* Search + Filters - ALL ON 1 ROW, Màu first */}
      <div className="px-6 py-2 border-b border-[var(--color-border)] flex items-center gap-2">
        <div className="relative" style={{ minWidth: 0, width: 160, flexShrink: 0 }}>
          <Icon name="search" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input type="text" placeholder="Tìm SP, SKU..." className="input-field pl-7 py-1 text-xs w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field py-1 px-2 text-xs" value={filterColor} onChange={(e) => setFilterColor(e.target.value)}>
          <option value="">Màu</option>
          {COLOR_CODES.map((c) => (<option key={c.code} value={c.label}>{c.label}</option>))}
        </select>
        <select className="input-field py-1 px-2 text-xs" value={filterWineType} onChange={(e) => setFilterWineType(e.target.value)}>
          <option value="">Loại rượu</option>
          <option value="gao">Gạo</option><option value="nep">Nếp</option><option value="dauxanh">Đậu xanh</option><option value="vangnep">Vang nếp</option><option value="dtht">ĐTHT</option>
        </select>
        <select className="input-field py-1 px-2 text-xs" value={filterBottleType} onChange={(e) => setFilterBottleType(e.target.value)}>
          <option value="">Loại chai</option>
          <option value="pet">PET</option><option value="su">Sứ</option><option value="thuytinh">Thuỷ tinh</option>
        </select>
        <span className="text-[10px] text-[var(--color-text-secondary)]">{sortedItems.length} SP</span>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className={`w-full ${fontClass}`}>
          <thead className="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
            <tr className="text-left text-[var(--color-text-secondary)]">
              <ColumnHeader column="sku" label="SKU" className="px-2 py-2 w-[70px]" sort={sort} filterValue={colFilters['sku']} onSort={toggleSort} onFilter={setColFilter} />
              <ColumnHeader column="name" label="Tên sản phẩm" className="px-2 py-2 w-[200px]" sort={sort} filterValue={colFilters['name']} onSort={toggleSort} onFilter={setColFilter} />
              <ColumnHeader column="wineType" label="Loại rượu" className="px-2 py-2 w-[65px]" sort={sort} filterValue={colFilters['wineType']} onSort={toggleSort} onFilter={setColFilter} />
              <ColumnHeader column="volume" label="Dung tích" className="px-2 py-2 w-[55px]" sort={sort} filterValue={colFilters['volume']} onSort={toggleSort} onFilter={setColFilter} />
              <ColumnHeader column="color" label="Màu" className="px-2 py-2 w-[60px]" sort={sort} filterValue={colFilters['color']} onSort={toggleSort} onFilter={setColFilter} />
              <ColumnHeader column="stock" label="Tồn" className="px-2 py-2 w-[40px] text-center" sort={sort} filterValue={colFilters['stock']} onSort={toggleSort} onFilter={setColFilter} />
              <th className="px-2 py-2 w-[30px]">ĐV</th>
              <th className="px-2 py-2 w-[55px]">Trạng thái</th>
              <th className="px-2 py-2 w-[70px]">Mức tồn</th>
              <ColumnHeader column="note" label="Ghi chú" className="px-2 py-2 w-[100px]" sort={sort} filterValue={colFilters['note']} onSort={toggleSort} onFilter={setColFilter} />
              <th className="px-2 py-2 w-[44px]"></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => {
              const isEmpty = item.stock === 0;
              const isLow = item.stock > 0 && item.stock <= lowThreshold;
              const pct = Math.min(100, (item.stock / maxStock) * 100);
              const barColor = isEmpty ? 'bg-red-400' : isLow ? 'bg-orange-400' : 'bg-green-400';
              const isEditing = editingStockId === item.id;
              return (
                <tr key={`${item.sku}-${item.id}`} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-2 py-1.5 font-mono text-[var(--color-text-secondary)]">{item.sku}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)] font-medium truncate" title={item.name}>{item.name}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{getWineLabel(item.wineType)}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{item.volume ? `${item.volume}ml` : ''}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">{item.color}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isEditing ? (
                      <input type="number" className="input-field py-0 px-1 text-xs w-12 text-center" autoFocus value={editingStockVal}
                        onChange={(e) => setEditingStockVal(e.target.value)}
                        onBlur={() => handleStockSave(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleStockSave(item.id); if (e.key === 'Escape') setEditingStockId(null); }}
                      />
                    ) : (
                      <span className={`font-bold cursor-pointer ${isEmpty ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-green-600'}`}
                        onClick={() => { setEditingStockId(item.id); setEditingStockVal(String(item.stock)); }}
                        title="Click để sửa"
                      >{item.stock}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">chai</td>
                  <td className="px-2 py-1.5">
                    {isEmpty ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Hết</span>
                    : isLow ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Sắp hết</span>
                    : <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Còn</span>}
                  </td>
                  <td className="px-2 py-1.5"><div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} /></div></td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={item.note}>{item.note}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-0.5">
                      <button onClick={() => { setEditingStockId(item.id); setEditingStockVal(String(item.stock)); }} className="p-0.5 hover:bg-[var(--color-border)] rounded"><Icon name="edit" size={10} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"><Icon name="trash" size={10} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedItems.length === 0 && (<tr><td colSpan={11} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">Không có sản phẩm</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* Import Dialog */}
      {showImport && <WineImportDialog data={data} addRecord={addRecord} updateRecord={updateRecord} onClose={() => setShowImport(false)} />}

      {/* Log Dialog */}
      {showLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLog(false)}>
          <div className="bg-[var(--color-bg)] rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Lịch sử nhập kho</h2>
              <button onClick={() => setShowLog(false)} className="p-1 hover:bg-[var(--color-surface)] rounded"><Icon name="x" size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {importLogs.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">Chưa có lịch sử</p>}
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[var(--color-text-secondary)] border-b border-[var(--color-border)]"><th className="py-2 pr-2">Ngày</th><th className="py-2 pr-2">Sản phẩm</th><th className="py-2 pr-2 text-center">SL</th><th className="py-2 pr-2">Màu</th><th className="py-2">Ghi chú</th></tr></thead>
                <tbody>
                  {importLogs.map((log, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="py-1.5 pr-2 text-[var(--color-text-secondary)] whitespace-nowrap">{log.date}</td>
                      <td className="py-1.5 pr-2 text-[var(--color-text)] font-medium">{log.name}</td>
                      <td className="py-1.5 pr-2 text-center text-[var(--color-text)] font-semibold">{log.qty}</td>
                      <td className="py-1.5 pr-2 text-[var(--color-text-secondary)]">{log.color}</td>
                      <td className="py-1.5 text-[var(--color-text-secondary)]">{log.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
