import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
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
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(true);
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
    return records.sort((a, b) => String(b.values['mod_ruou_order_date'] ?? '').localeCompare(String(a.values['mod_ruou_order_date'] ?? '')));
  }, [data, customerFilter, productFilter, search]);

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
      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input type="text" placeholder="Tìm đơn hàng..." className="input-field pl-8 py-1.5 text-xs w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{sortedOrders.length} đơn</span>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
          title={expanded ? 'Thu gọn' : 'Mở rộng'}
        >
          <Icon name={expanded ? 'minimize-2' : 'maximize-2'} size={14} />
        </button>
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Tạo đơn mới (Alt+N)">
          <Icon name="plus" size={13} />
          Tạo đơn
        </button>
      </div>

      {/* Table - expanded widens columns, compact fits window */}
      <div className="flex-1 overflow-auto">
        <table className={`${fontClass} ${expanded ? 'w-max min-w-full' : 'w-full'}`}>
          <thead className="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
            <tr className="text-left text-[var(--color-text-secondary)] whitespace-nowrap">
              <ColumnHeader column="date" label="Ngày" className="px-2 py-2 w-[72px]" sort={sort} filterValue={filters['date']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="customer" label="Khách" className="px-2 py-2 w-[90px]" sort={sort} filterValue={filters['customer']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="phone" label="SĐT" className="px-2 py-2 w-[85px]" sort={sort} filterValue={filters['phone']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="address" label="Địa chỉ" className="px-2 py-2 w-[130px]" sort={sort} filterValue={filters['address']} onSort={toggleSort} onFilter={setFilter} />
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
              <ColumnHeader column="note" label="Ghi chú" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="note2" label="Ghi chú 2" className="px-2 py-2 w-[80px]" sort={sort} filterValue={filters['note2']} onSort={toggleSort} onFilter={setFilter} />
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
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_note1'] ?? '')}>{String(r.values['mod_ruou_note1'] ?? '')}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_note2'] ?? '')}>{String(r.values['mod_ruou_note2'] ?? '')}</td>
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
