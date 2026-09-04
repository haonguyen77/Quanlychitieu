import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore, type DatePreset } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import { useTableSortFilter, ColumnHeader } from '@/shared/components/ui/ColumnHeader';
import { WineOrderForm } from './WineOrderForm';
import { WineOrderImportDialog } from './WineOrderImportDialog';
import { getWineColorPalette } from './wineColors';
import type { DataRecord } from '@/types';

const MODULE_ID = 'mod_ruou';
const PRESET_LABELS: Record<DatePreset, string> = { week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả', custom: 'Tùy chọn' };

function fmtDate2(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

interface WineOrdersTabProps {
  customerFilter: string | null;
  productFilter: string | null;
  newOrderTrigger?: number;
}

export function WineOrdersTab({ customerFilter, productFilter, newOrderTrigger }: WineOrdersTabProps) {
  const { data } = useAppStore();
  const { deleteRecord } = useRecordStore();
  const colorPalette = useMemo(() => getWineColorPalette(data), [data]);
  const resolveColorLabel = (code: string): string => {
    if (!code) return '';
    const found = colorPalette.find((c) => c.code.toUpperCase() === code.toUpperCase());
    return found ? found.label : code;
  };
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('wine_orders_expanded') !== '0'; } catch { return true; }
  });

  // Date filter state
  const [datePreset, setLocalPreset] = useState<DatePreset>('year');
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const applyPreset = (preset: DatePreset) => {
    setLocalPreset(preset);
    const now = new Date();
    if (preset === 'week') {
      const dow = now.getDay(); const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
      setDateFrom(fmtDate2(mon)); setDateTo(fmtDate2(now));
    } else if (preset === 'month') {
      setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
      setDateTo(fmtDate2(now));
    } else if (preset === 'year') {
      setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(fmtDate2(now));
    } else if (preset === 'all') {
      setDateFrom(''); setDateTo('');
    }
  };

  const movePeriod = (direction: -1 | 1) => {
    if (datePreset === 'week') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      ref.setDate(ref.getDate() + direction * 7);
      const dow = ref.getDay(); const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(ref); mon.setDate(ref.getDate() + diffToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDateFrom(fmtDate2(mon)); setDateTo(fmtDate2(sun));
    } else if (datePreset === 'month') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const first = new Date(ref.getFullYear(), ref.getMonth() + direction, 1);
      const last = new Date(ref.getFullYear(), ref.getMonth() + direction + 1, 0);
      setDateFrom(fmtDate2(first)); setDateTo(fmtDate2(last));
    } else if (datePreset === 'year') {
      const ref = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date();
      const y = ref.getFullYear() + direction;
      setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`);
    } else if (datePreset === 'custom' && dateFrom && dateTo) {
      const from = new Date(dateFrom + 'T00:00:00'); const to = new Date(dateTo + 'T00:00:00');
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      from.setDate(from.getDate() + direction * days); to.setDate(to.getDate() + direction * days);
      setDateFrom(fmtDate2(from)); setDateTo(fmtDate2(to));
    }
  };
  const { fontSize, fontClass, zoomIn, zoomOut } = useTableZoom();
  const { sort, filters, toggleSort, setFilter, applySort } = useTableSortFilter();

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
      const dateA = String(a.values['mod_ruou_order_date'] ?? '');
      const dateB = String(b.values['mod_ruou_order_date'] ?? '');
      const dateCmp = dateB.localeCompare(dateA);
      if (dateCmp !== 0) return dateCmp;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });
  }, [data, dateFrom, dateTo, customerFilter, productFilter, search]);

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
  const handleDelete = (id: string) => { if (confirm('Xóa đơn hàng này?')) deleteRecord(id); };

  const fmtMoney = (n: unknown) => { const num = Number(n ?? 0); return num ? num.toLocaleString('vi-VN') + '₫' : ''; };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Period filter row */}
      <div className="px-6 py-2 flex items-center gap-2 border-b border-[var(--color-border)]">
        <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
          {(['week', 'month', 'year', 'all'] as DatePreset[]).map((p) => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${datePreset === p ? 'bg-blue-600 text-white' : 'bg-white text-[var(--color-text-secondary)] hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {datePreset !== 'all' && (
          <div className="flex items-center gap-1">
            <button onClick={() => movePeriod(-1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Icon name="chevron-left" size={14} /></button>
            <input type="date" className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white dark:bg-gray-800 dark:text-[var(--color-text)]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setLocalPreset('custom'); }} />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" className="text-xs border border-[var(--color-border)] rounded px-2 py-1 w-[115px] bg-white dark:bg-gray-800 dark:text-[var(--color-text)]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setLocalPreset('custom'); }} />
            <button onClick={() => movePeriod(1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Icon name="chevron-right" size={14} /></button>
          </div>
        )}
        <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{sortedOrders.length} đơn</span>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input type="text" placeholder="Tìm đơn hàng..." className="input-field pl-8 py-1.5 text-xs w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button
          onClick={() => { const next = !expanded; setExpanded(next); try { localStorage.setItem('wine_orders_expanded', next ? '1' : '0'); } catch { /* */ } }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] text-xs font-medium"
          title={expanded ? 'Thu gọn bảng vừa màn hình' : 'Mở rộng để xem đầy đủ'}
        >
          <Icon name={expanded ? 'minimize-2' : 'maximize-2'} size={13} />
          {expanded ? 'Thu gọn' : 'Mở rộng'}
        </button>
        <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#f05423] text-[#f05423] hover:bg-orange-50 text-xs font-medium" title="Import đơn hàng từ Excel">
          <Icon name="upload" size={13} />
          Import
        </button>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Tạo đơn mới (Alt+N)">
          <Icon name="plus" size={13} />
          Tạo đơn
        </button>
      </div>

      {/* Table - expanded widens columns, compact fits window */}
      <div className="flex-1 overflow-auto">
        <table className={`${fontClass} ${expanded ? 'w-max min-w-full' : 'w-full'}`}>
          <thead className="sticky top-0 text-white" style={{ backgroundColor: '#f05423' }}>
            <tr className="text-left whitespace-nowrap [&>th]:border-r [&>th]:border-white/30 [&>th:last-child]:border-r-0">
              <ColumnHeader column="date" label="Ngày" className="px-2 py-2 w-[72px]" sort={sort} filterValue={filters['date']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="customer" label="Khách" className={`px-2 py-2 ${expanded ? 'w-[90px]' : 'w-[70px]'}`} sort={sort} filterValue={filters['customer']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="phone" label="SĐT" className="px-2 py-2 w-[85px]" sort={sort} filterValue={filters['phone']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="address" label="Địa chỉ" className={`px-2 py-2 ${expanded ? 'w-[130px]' : 'w-[60px]'}`} sort={sort} filterValue={filters['address']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="ward" label="Phường" className={`px-2 py-2 ${expanded ? 'w-[65px]' : 'w-[40px]'}`} sort={sort} filterValue={filters['ward']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="city" label="TP" className="px-2 py-2 w-[45px]" sort={sort} filterValue={filters['city']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="product" label="SP" className={`px-2 py-2 ${expanded ? 'w-[120px]' : 'w-[80px]'}`} sort={sort} filterValue={filters['product']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="color" label="Màu" className="px-2 py-2 w-[45px]" sort={sort} filterValue={filters['color']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-2 py-2 w-[25px] text-center">Ly</th>
              <th className="px-2 py-2 w-[30px] text-center">Hộp</th>
              <ColumnHeader column="price" label="Giá" className="px-2 py-2 text-right w-[70px]" sort={sort} filterValue={filters['price']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-2 py-2 w-[25px] text-center">SL</th>
              <ColumnHeader column="ship" label="Ship" className="px-2 py-2 text-right w-[55px]" sort={sort} filterValue={filters['ship']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="total" label="Tổng" className="px-2 py-2 text-right w-[75px]" sort={sort} filterValue={filters['total']} onSort={toggleSort} onFilter={setFilter} />
              {expanded && <ColumnHeader column="note" label="Ghi chú" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note']} onSort={toggleSort} onFilter={setFilter} />}
              {expanded && <ColumnHeader column="note2" label="Ghi chú 2" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note2']} onSort={toggleSort} onFilter={setFilter} />}              <th className="px-2 py-2 w-[40px]"></th>
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
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] whitespace-nowrap">
                    {lines.map((l, i) => (<div key={i}>{resolveColorLabel(l.color)}</div>))}
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
      {showImport && <WineOrderImportDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
