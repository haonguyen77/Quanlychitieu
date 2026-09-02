import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { useTableZoom, ZoomControls } from '@/shared/components/ui/TableZoom';
import { useTableSortFilter, ColumnHeader } from '@/shared/components/ui/ColumnHeader';
import { SuggestInput } from './SuggestInput';
import type { DataRecord } from '@/types';

interface Props {
  onCustomerClick: (customerName: string) => void;
}

export function WineCustomersTab({ onCustomerClick }: Props) {
  const { data } = useAppStore();
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
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

  const customers = useMemo(() => {
    if (!data) return [];
    let records = data.records.filter((r) => r.moduleId === 'mod_ruou_customers' && !r.isDeleted);
    if (search) {
      const q = search.toLowerCase();
      records = records.filter((r) => Object.values(r.values).some((v) => v !== null && String(v).toLowerCase().includes(q)));
    }
    return records.sort((a, b) => String(a.values['mod_ruou_customers_full_name'] ?? '').localeCompare(String(b.values['mod_ruou_customers_full_name'] ?? ''), 'vi'));
  }, [data, search]);

  const getCustValue = (r: DataRecord, col: string): string => {
    const map: Record<string, string> = {
      name: String(r.values['mod_ruou_customers_full_name'] ?? ''),
      phone: String(r.values['mod_ruou_customers_phone'] ?? ''),
      address: String(r.values['mod_ruou_customers_address'] ?? ''),
      ward: String(r.values['mod_ruou_customers_district'] ?? ''),
      city: String(r.values['mod_ruou_customers_city'] ?? ''),
      orders: String(r.values['mod_ruou_customers_total_orders'] ?? '0'),
      lastOrder: String(r.values['mod_ruou_customers_last_order_date'] ?? ''),
      note: String(r.values['mod_ruou_customers_note'] ?? ''),
    };
    return map[col] ?? '';
  };
  const sortedCustomers = useMemo(() => applySort(customers, getCustValue), [customers, applySort]);

  const handleDelete = (id: string) => { if (confirm('Xóa khách hàng này?')) deleteRecord(id); };
  const handleEdit = (r: DataRecord) => { setEditingRecord(r); setShowForm(true); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input type="text" placeholder="Tìm khách hàng..." className="input-field pl-8 py-1.5 text-xs w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{sortedCustomers.length} KH</span>
        <ZoomControls fontSize={fontSize} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" title="Thêm khách hàng (Alt+N)">
          <Icon name="plus" size={13} /> Thêm KH
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className={`w-full ${fontClass}`}>
          <thead className="sticky top-0 text-white" style={{ backgroundColor: '#0ea5e9' }}>
            <tr className="text-left">
              <ColumnHeader column="name" label="Họ tên" className="px-3 py-2 w-[120px]" sort={sort} filterValue={filters['name']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="phone" label="SĐT" className="px-3 py-2 w-[100px]" sort={sort} filterValue={filters['phone']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="address" label="Địa chỉ" className="px-3 py-2 w-[180px]" sort={sort} filterValue={filters['address']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="ward" label="Quận" className="px-3 py-2 w-[80px]" sort={sort} filterValue={filters['ward']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="city" label="TP" className="px-3 py-2 w-[55px]" sort={sort} filterValue={filters['city']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="orders" label="Đơn" className="px-3 py-2 w-[40px] text-center" sort={sort} filterValue={filters['orders']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="lastOrder" label="Đơn cuối" className="px-3 py-2 w-[70px]" sort={sort} filterValue={filters['lastOrder']} onSort={toggleSort} onFilter={setFilter} />
              <ColumnHeader column="note" label="Ghi chú" className="px-3 py-2 w-[120px]" sort={sort} filterValue={filters['note']} onSort={toggleSort} onFilter={setFilter} />
              <th className="px-3 py-2 w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer" onClick={() => onCustomerClick(String(r.values['mod_ruou_customers_full_name'] ?? ''))}>
                <td className="px-3 py-2 text-[var(--color-text)] font-medium">{String(r.values['mod_ruou_customers_full_name'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{String(r.values['mod_ruou_customers_phone'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-normal break-words" title={String(r.values['mod_ruou_customers_address'] ?? '')}>{String(r.values['mod_ruou_customers_address'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{String(r.values['mod_ruou_customers_district'] ?? '')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{String(r.values['mod_ruou_customers_city'] ?? '')}</td>
                <td className="px-3 py-2 text-center text-[var(--color-text)] font-semibold">{String(r.values['mod_ruou_customers_total_orders'] ?? '0')}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{String(r.values['mod_ruou_customers_last_order_date'] ?? '').slice(5)}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] truncate" title={String(r.values['mod_ruou_customers_note'] ?? '')}>{String(r.values['mod_ruou_customers_note'] ?? '')}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(r); }} className="p-1 hover:bg-[var(--color-border)] rounded"><Icon name="edit" size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"><Icon name="trash" size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedCustomers.length === 0 && (<tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--color-text-secondary)]">Chưa có khách hàng nào</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      {showForm && (
        <CustomerFormDialog record={editingRecord} onClose={() => { setShowForm(false); setEditingRecord(null); }} />
      )}
    </div>
  );
}

/** Inline customer add/edit dialog */
function CustomerFormDialog({ record, onClose }: { record: DataRecord | null; onClose: () => void }) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const [name, setName] = useState(record?.values['mod_ruou_customers_full_name'] as string ?? '');
  const [phone, setPhone] = useState(record?.values['mod_ruou_customers_phone'] as string ?? '');
  const [address, setAddress] = useState(record?.values['mod_ruou_customers_address'] as string ?? '');
  const [district, setDistrict] = useState(record?.values['mod_ruou_customers_district'] as string ?? '');
  const [city, setCity] = useState(record?.values['mod_ruou_customers_city'] as string ?? '');
  const [note, setNote] = useState(record?.values['mod_ruou_customers_note'] as string ?? '');

  // Unique values for autocomplete
  const customers = useMemo(() => data ? data.records.filter((r) => r.moduleId === 'mod_ruou_customers' && !r.isDeleted) : [], [data]);
  const suggAddresses = useMemo(() => [...new Set(customers.map((r) => String(r.values['mod_ruou_customers_address'] ?? '')).filter(Boolean))], [customers]);
  const suggWards = useMemo(() => [...new Set(customers.map((r) => String(r.values['mod_ruou_customers_district'] ?? '')).filter(Boolean))], [customers]);
  const suggCities = useMemo(() => [...new Set(customers.map((r) => String(r.values['mod_ruou_customers_city'] ?? '')).filter(Boolean))], [customers]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleSaveRef.current(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = () => {
    if (!name.trim()) return;
    const values = {
      mod_ruou_customers_full_name: name.trim(),
      mod_ruou_customers_phone: phone.trim(),
      mod_ruou_customers_address: address.trim(),
      mod_ruou_customers_district: district.trim(),
      mod_ruou_customers_city: city.trim(),
      mod_ruou_customers_note: note.trim(),
      mod_ruou_customers_total_orders: record ? Number(record.values['mod_ruou_customers_total_orders'] ?? 0) : 0,
      mod_ruou_customers_last_order_date: record?.values['mod_ruou_customers_last_order_date'] as string ?? '',
    };
    if (record) updateRecord(record.id, values);
    else addRecord('mod_ruou_customers', values);
    onClose();
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{record ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface)] rounded"><Icon name="x" size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] text-[var(--color-text-secondary)]">Họ tên *</label>
            <input type="text" className="input-field py-1.5 px-2 text-xs w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-secondary)]">SĐT</label>
            <input type="text" className="input-field py-1.5 px-2 text-xs w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-secondary)]">Địa chỉ</label>
            <SuggestInput value={address} onChange={setAddress} suggestions={suggAddresses} placeholder="Địa chỉ..." className="input-field py-1.5 px-2 text-xs w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-secondary)]">Quận/Huyện</label>
              <SuggestInput value={district} onChange={setDistrict} suggestions={suggWards} placeholder="Quận/Huyện..." className="input-field py-1.5 px-2 text-xs w-full" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-text-secondary)]">Tỉnh/TP</label>
              <SuggestInput value={city} onChange={setCity} suggestions={suggCities} placeholder="Tỉnh/TP..." className="input-field py-1.5 px-2 text-xs w-full" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-secondary)]">Ghi chú</label>
            <textarea className="input-field py-1 px-2 text-xs w-full h-14 resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] rounded-md">Hủy</button>
          <button onClick={handleSave} className="btn-primary px-4 py-1.5 text-xs" disabled={!name.trim()}>{record ? 'Cập nhật' : 'Thêm'}</button>
        </div>
      </div>
    </div>
  );
}
