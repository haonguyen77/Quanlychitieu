import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore, type DatePreset } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import { useTableSortFilter, ColumnHeader } from '@/shared/components/ui/ColumnHeader';
import { WineOrderForm } from './WineOrderForm';
import type { DataRecord } from '@/types';

interface WineOrdersTabProps {
  customerFilter: string | null;
  productFilter: string | null;
  newOrderTrigger?: number;
}

export function WineOrdersTab({ customerFilter, productFilter, newOrderTrigger }: WineOrdersTabProps) {
  const { data } = useAppStore();
  const { datePreset, dateFrom, dateTo, setDatePresetForModule, setDateRange } = useRecordStore();
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(true);
  const { fontSize, fontClass, zoomIn, zoomOut } = useTableZoom();
  const { sort, filters, toggleSort, setFilter, applySort } = useTableSortFilter();

  const MODULE_ID = 'mod_ruou';
  const PRESET_LABELS: Record<DatePreset, string> = { week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả', custom: 'Tùy chọn' };

  // Default to 'year' when first shown.
  useEffect(() => {
    setDatePresetForModule('year', MODULE_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Period navigation — same logic as ChiTieuHeader.
  const movePeriod = (direction: -1 | 1) => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (datePreset === 'week') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      ref.setDate(ref.getDate() + direction * 7);
      const dow = ref.getDay(); const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(ref); mon.setDate(ref.getDate() + diffToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDateRange(fmt(mon), fmt(sun));
    } else if (datePreset === 'month') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      setDateRange(fmt(new Date(ref.getFullYear(), ref.getMonth() + direction, 1)), fmt(new Date(ref.getFullYear(), ref.getMonth() + direction + 1, 0)));
    } else if (datePreset === 'year') {
      const y = (dateFrom ? new Date(dateFrom + 'T00:00:00').getFullYear() : new Date().getFullYear()) + direction;
      setDateRange(`${y}-01-01`, `${y}-12-31`);
    } else if (datePreset === 'custom' && dateFrom && dateTo) {
      const from = new Date(dateFrom + 'T00:00:00'); const to = new Date(dateTo + 'T00:00:00');
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      from.setDate(from.getDate() + direction * days); to.setDate(to.getDate() + direction * days);
      setDateRange(fmt(from), fmt(to));
    }
  };

  // Alt+N keyboard shortcut (works directly in this component)
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

  // Also listen for external trigger from parent
  useEffect(() => {
    if (newOrderTrigger && newOrderTrigger > 0) {
      setEditingRecord(null);
      setShowForm(true);
    }
  }, [newOrderTrigger]);

  // Product name → short name map
  const productShortNames = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    data.records
      .filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted)
      .forEach((r) => {
        const name = String(r.values['mod_ruou_products_product_name'] ?? '');
        const short = String(r.values['mod_ruou_products_short_name'] ?? '');
        if (name) map.set(name, short || name);
      });
    return map;
  }, [data]);

  const orders = useMemo(() => {
    if (!data) return [];
    let records = data.records.filter((r) => r.moduleId === 'mod_ruou' && !r.isDeleted);
    // Date filter
    if (dateFrom) records = records.filter((r) => String(r.values['mod_ruou_order_date'] ?? '') >= dateFrom);
    if (dateTo)   records = records.filter((r) => String(r.values['mod_ruou_order_date'] ?? '') <= dateTo);
    if (customerFilter) {
      records = records.filter((r) => String(r.values['mod_ruou_customer_name'] ?? '').toLowerCase().includes(customerFilter.toLowerCase()));
    }
    if (productFilter) {
      records = records.filter((r) => String(r.values['mod_ruou_product_name'] ?? '').toLowerCase().includes(productFilter.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      records = records.filter((r) => Object.values(r.values).some((v) => v !== null && String(v).toLowerCase().includes(q)));
    }
    return records.sort((a, b) => {
      // Primary: order_date descending
      const dateA = String(a.values['mod_ruou_order_date'] ?? '');
      const dateB = String(b.values['mod_ruou_order_date'] ?? '');
      const dateCmp = dateB.localeCompare(dateA);
      if (dateCmp !== 0) return dateCmp;
      // Tiebreaker: createdAt/updatedAt descending (đơn mới tạo nằm trên)
      const timeA = String(a.updatedAt || a.createdAt || '');
      const timeB = String(b.updatedAt || b.createdAt || '');
      return timeB.localeCompare(timeA);
    });
  }, [data, customerFilter, productFilter, search, dateFrom, dateTo]);

  const getOrderValue = (r: DataRecord, col: string): string => {
    const map: Record<string, string> = {
      date: String(r.values['mod_ruou_order_date'] ?? ''),
      customer: String(r.values['mod_ruou_customer_name'] ?? ''),
      phone: String(r.values['mod_ruou_customer_phone'] ?? ''),
      address: String(r.values['mod_ruou_customer_address'] ?? ''),
      ward: String(r.values['mod_ruou_customer_district'] ?? ''),
      city: String(r.values['mod_ruou_customer_city'] ?? ''),
      product: String(r.values['mod_ruou_product_name'] ?? ''),
      color: String(r.values['mod_ruou_color'] ?? ''),
      price: String(r.values['mod_ruou_price'] ?? '0'),
      qty: String(r.values['mod_ruou_quantity'] ?? '0'),
      ship: String(r.values['mod_ruou_ship_fee'] ?? '0'),
      total: String(r.values['mod_ruou_total_amount'] ?? '0'),
      note: String(r.values['mod_ruou_note1'] ?? ''),
      note2: String(r.values['mod_ruou_note2'] ?? ''),
    };
    return map[col] ?? '';
  };

  const sortedOrders = useMemo(() => applySort(orders, getOrderValue), [orders, applySort]);

  const handleEdit = (record: DataRecord) => { setEditingRecord(record); setShowForm(true); };

  /** Trả lại kho theo values của đơn hàng (cộng qty vào stock). Chỉ gọi khi skip_inventory = 0. */
  const returnStockForOrder = (orderValues: Record<string, unknown>) => {
    // Đọc data mới nhất từ store (tránh closure cũ sau deleteRecord)
    const currentData = useAppStore.getState().data;
    if (!currentData) return;
    const palette = (currentData as Record<string, unknown>).wineColorPalette as Array<{ code: string; label: string }> | undefined ?? [];
    const resolveInv = (sku: string, color: string) => {
      const colorCode = color
        ? (palette.find((c) => c.label === color)?.code ?? color).toUpperCase()
        : '';
      const candidates = [
        colorCode ? `${sku}-${colorCode}` : '',
        color     ? `${sku}-${color}`    : '',
        sku,
      ].filter(Boolean);
      // Tìm theo thứ tự ưu tiên để tránh trừ nhầm record không màu
      for (const candidate of candidates) {
        const found = currentData.records.find((r) =>
          r.moduleId === 'mod_ruou_inventory' && !r.isDeleted &&
          String(r.values['mod_ruou_inventory_sku'] ?? '') === candidate
        );
        if (found) return found;
      }
      return undefined;
    };
    type Line = { sku: string; color: string; qty: number };
    const lines: Line[] = [];
    const plRaw = orderValues['mod_ruou_product_lines'];
    if (plRaw && typeof plRaw === 'string' && plRaw.length > 2) {
      try {
        const parsed = JSON.parse(plRaw) as Array<{ productSku: string; color: string; quantity: string }>;
        for (const l of parsed) {
          const sku = l.productSku || ''; const qty = parseInt(l.quantity || '0') || 0;
          if (sku && qty > 0) lines.push({ sku, color: l.color || '', qty });
        }
      } catch { /* ignore */ }
    }
    if (lines.length === 0) {
      const sku = String(orderValues['mod_ruou_product_sku'] ?? '');
      const qty = Number(orderValues['mod_ruou_quantity'] ?? 0);
      const color = String(orderValues['mod_ruou_color'] ?? '');
      if (sku && qty > 0) lines.push({ sku, color, qty });
    }
    for (const { sku, color, qty } of lines) {
      const inv = resolveInv(sku, color);
      if (inv) updateRecord(inv.id, { mod_ruou_inventory_stock: Number(inv.values['mod_ruou_inventory_stock'] ?? 0) + qty });
    }
  };

  const handleDelete = (id: string) => {
    const order = data?.records.find((r) => r.id === id);
    if (!order) return;
    if (!confirm('Xóa đơn hàng này?')) return;
    // Trả kho trước — dùng store.getState() trực tiếp để không phụ thuộc closure
    const skip = String(order.values['mod_ruou_skip_inventory'] ?? '') === '1' || order.values['mod_ruou_skip_inventory'] === true;
    if (!skip) {
      const currentData = useAppStore.getState().data;
      const storeUpdate = useRecordStore.getState().updateRecord;
      if (currentData) {
        const palette = (currentData as Record<string, unknown>).wineColorPalette as Array<{ code: string; label: string }> | undefined ?? [];
        type Line = { sku: string; color: string; qty: number };
        const lines: Line[] = [];
        const plRaw = order.values['mod_ruou_product_lines'];
        if (plRaw && typeof plRaw === 'string' && plRaw.length > 2) {
          try {
            const parsed = JSON.parse(plRaw) as Array<{ productSku: string; color: string; quantity: string }>;
            for (const l of parsed) {
              const sku = l.productSku || ''; const qty = parseInt(l.quantity || '0') || 0;
              if (sku && qty > 0) lines.push({ sku, color: l.color || '', qty });
            }
          } catch { /* ignore */ }
        }
        if (lines.length === 0) {
          const sku = String(order.values['mod_ruou_product_sku'] ?? '');
          const qty = Number(order.values['mod_ruou_quantity'] ?? 0);
          const color = String(order.values['mod_ruou_color'] ?? '');
          if (sku && qty > 0) lines.push({ sku, color, qty });
        }
        for (const { sku, color, qty } of lines) {
          const colorCode = color ? (palette.find((c) => c.label === color)?.code ?? color).toUpperCase() : '';
          const candidates = [colorCode ? `${sku}-${colorCode}` : '', color ? `${sku}-${color}` : '', sku].filter(Boolean);
          for (const candidate of candidates) {
            const inv = currentData.records.find((r) =>
              r.moduleId === 'mod_ruou_inventory' && !r.isDeleted &&
              String(r.values['mod_ruou_inventory_sku'] ?? '') === candidate
            );
            if (inv) {
              storeUpdate(inv.id, { mod_ruou_inventory_stock: Number(inv.values['mod_ruou_inventory_stock'] ?? 0) + qty });
              break;
            }
          }
        }
      }
    }
    // Xóa đơn sau khi đã trả kho
    deleteRecord(id);
  };

  const fmtMoney = (n: unknown) => { const num = Number(n ?? 0); return num ? num.toLocaleString('vi-VN') + '₫' : ''; };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Period filter row */}
      <div className="px-6 py-2 flex items-center gap-2 border-b border-[var(--color-border)]">
        <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
          {(['week', 'month', 'year', 'all'] as DatePreset[]).map((p) => (
            <button key={p} onClick={() => setDatePresetForModule(p, MODULE_ID)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${datePreset === p ? 'bg-blue-600 text-white' : 'bg-white text-[var(--color-text-secondary)] hover:bg-gray-50'}`}>
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {datePreset !== 'all' && (
          <div className="flex items-center gap-1">
            <button onClick={() => movePeriod(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Icon name="chevron-left" size={14} /></button>
            <input type="date" className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white" value={dateFrom} onChange={(e) => setDateRange(e.target.value, dateTo)} />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white" value={dateTo} onChange={(e) => setDateRange(dateFrom, e.target.value)} />
            <button onClick={() => movePeriod(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><Icon name="chevron-right" size={14} /></button>
          </div>
        )}
        <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{sortedOrders.length} đơn</span>
      </div>
      {/* Search + zoom toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input type="text" placeholder="Tìm đơn hàng..." className="input-field pl-8 py-1.5 text-xs w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] text-xs font-medium"
          title={expanded ? 'Thu gọn bảng vừa màn hình' : 'Mở rộng để xem đầy đủ'}
        >
          <Icon name={expanded ? 'minimize-2' : 'maximize-2'} size={13} />
          {expanded ? 'Thu gọn' : 'Mở rộng'}
        </button>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Tạo đơn mới (Alt+N)">
          <Icon name="plus" size={13} />
          Tạo đơn
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className={`${fontClass} ${expanded ? 'w-max min-w-full' : 'w-full'}`}>
          <thead className="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
            <tr className="text-left text-[var(--color-text-secondary)] whitespace-nowrap">
              <ColumnHeader column="date" label="Ngày" className="px-2 py-2 w-[72px]" sort={sort} filterValue={filters['date']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="customer" label="Khách" className="px-2 py-2 w-[90px]" sort={sort} filterValue={filters['customer']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="phone" label="SĐT" className="px-2 py-2 w-[85px]" sort={sort} filterValue={filters['phone']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="address" label="Địa chỉ" className={`px-2 py-2 ${expanded ? 'w-[130px]' : 'w-[80px]'}`} sort={sort} filterValue={filters['address']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="ward" label="Phường" className="px-2 py-2 w-[65px]" sort={sort} filterValue={filters['ward']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="city" label="TP" className="px-2 py-2 w-[45px]" sort={sort} filterValue={filters['city']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="product" label="SP" className="px-2 py-2 w-[120px]" sort={sort} filterValue={filters['product']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="color" label="Màu" className="px-2 py-2 w-[45px]" sort={sort} filterValue={filters['color']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-2 py-2 w-[25px] text-center">Ly</th>
              <th className="px-2 py-2 w-[30px] text-center">Hộp</th>
              <ColumnHeader column="price" label="Giá" className="px-2 py-2 text-right w-[70px]" sort={sort} filterValue={filters['price']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-2 py-2 w-[25px] text-center">SL</th>
              <ColumnHeader column="ship" label="Ship" className="px-2 py-2 text-right w-[55px]" sort={sort} filterValue={filters['ship']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="total" label="Tổng" className="px-2 py-2 text-right w-[75px]" sort={sort} filterValue={filters['total']} onSort={toggleSort} onFilter={setFilter} />
              {expanded && <ColumnHeader column="note" label="Ghi chú" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note']} onSort={toggleSort} onFilter={setFilter} />}
              {expanded && <ColumnHeader column="note2" label="Ghi chú 2" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note2']} onSort={toggleSort} onFilter={setFilter} />}
              <th className="px-2 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((r) => {
              const dateStr = String(r.values['mod_ruou_order_date'] ?? '');
              const fmtDate = dateStr ? (() => { const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; })() : '';
              const fullName = String(r.values['mod_ruou_product_name'] ?? '');
              const shortName = productShortNames.get(fullName) || fullName;

              // Parse multi-product lines if present
              let lines: { name: string; color: string; qty: string; glasses: string; boxes: string; price: string }[] = [];
              const linesJson = r.values['mod_ruou_product_lines'] as string;
              if (linesJson) {
                try {
                  const parsed = JSON.parse(linesJson) as { productName: string; color: string; quantity: string; glasses: string; boxes: string; price: string }[];
                  lines = parsed.map((l) => ({
                    name: productShortNames.get(l.productName) || l.productName,
                    color: l.color, qty: l.quantity, glasses: l.glasses, boxes: l.boxes, price: l.price,
                  }));
                } catch { /* ignore */ }
              }
              if (lines.length === 0) {
                lines = [{ name: shortName, color: String(r.values['mod_ruou_color'] ?? ''), qty: String(r.values['mod_ruou_quantity'] ?? ''), glasses: String(r.values['mod_ruou_glasses'] ?? ''), boxes: String(r.values['mod_ruou_boxes'] ?? ''), price: String(r.values['mod_ruou_price'] ?? '') }];
              }

              return (
                <tr key={r.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors align-top">
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]" title={fmtDate}>{fmtDate}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)] font-medium truncate" title={String(r.values['mod_ruou_customer_name'] ?? '')}>{String(r.values['mod_ruou_customer_name'] ?? '')}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate">{String(r.values['mod_ruou_customer_phone'] ?? '')}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_customer_address'] ?? '')}>{String(r.values['mod_ruou_customer_address'] ?? '')}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_customer_district'] ?? '')}>{String(r.values['mod_ruou_customer_district'] ?? '')}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_customer_city'] ?? '')}>{String(r.values['mod_ruou_customer_city'] ?? '')}</td>
                  {/* Multi-line product display */}
                  <td className="px-2 py-1.5 text-[var(--color-text)]">
                    {lines.map((l, i) => (<div key={i} className="truncate" title={l.name}>{l.name}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">
                    {lines.map((l, i) => (<div key={i}>{l.color}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[var(--color-text-secondary)]">
                    {lines.map((l, i) => (<div key={i}>{Number(l.glasses) || ''}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[var(--color-text-secondary)]">
                    {lines.map((l, i) => (<div key={i}>{Number(l.boxes) || ''}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[var(--color-text)] tabular-nums">
                    {lines.map((l, i) => (<div key={i}>{fmtMoney(l.price)}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[var(--color-text)]">
                    {lines.map((l, i) => (<div key={i}>{l.qty}</div>))}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[var(--color-text-secondary)] tabular-nums">{fmtMoney(r.values['mod_ruou_ship_fee'])}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-[var(--color-text)] tabular-nums">{fmtMoney(r.values['mod_ruou_total_amount'])}</td>
                  {expanded && <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_note1'] ?? '')}>{String(r.values['mod_ruou_note1'] ?? '')}</td>}
                  {expanded && <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_note2'] ?? '')}>{String(r.values['mod_ruou_note2'] ?? '')}</td>}
                  <td className="px-2 py-1.5">
                    <div className="flex gap-0.5">
                      <button onClick={() => handleEdit(r)} className="p-1 hover:bg-[var(--color-border)] rounded"><Icon name="edit" size={11} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"><Icon name="trash" size={11} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedOrders.length === 0 && (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">Chưa có đơn hàng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <WineOrderForm record={editingRecord} onClose={() => { setShowForm(false); setEditingRecord(null); }} />}
    </div>
  );
}
