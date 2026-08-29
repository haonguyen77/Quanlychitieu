import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { showConfirm } from './mobileDialog';
import { getWineColorPalette } from '@/features/wine/wineColors';
import { deductInventoryForOrder, adjustInventoryForEdit, shouldCreateCustomer, getCustomerValues } from './wineService';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, Plus, X, Search, Wine, QrCode,
  User, Phone, MapPin, Map, Building2, Edit3, ChevronDown, Package, LogIn,
} from 'lucide-react';
import type { DataRecord, RecordValues } from '@/types';

const PURPLE = '#6C2BD9';
const NAVY = '#101B4D';
const BORDER = '#E5E7EB';

const WINE_TYPES = ['gao', 'gao loai 2', 'nep', 'dauxanh', 'vangnep', 'dtht'];
const BOTTLE_TYPES = ['pet', 'su', 'thuytinh'];

const nf = (n: number) => Math.round(n).toLocaleString('vi-VN');
const todayIso = () => new Date().toISOString().slice(0, 10);
function get(r: { values: Record<string, unknown> }, s: string): string {
  const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`));
  return k ? String(r.values[k] ?? '') : '';
}

/** Money quick-suggestion chips — matches the Flutter app: n*1000/n*10000/n*100000. */
function moneySuggestions(raw: string): number[] {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length > 3) return [];
  const n = parseInt(digits, 10);
  if (!n || n <= 0) return [];
  return [n * 1000, n * 10000, n * 100000];
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER FORM (create/edit) — full-screen, matches Flutter wine_order_form_screen
// ═══════════════════════════════════════════════════════════════════════════

interface OrderLine { name: string; sku: string; qty: string; price: string; color: string; }
function emptyLine(): OrderLine { return { name: '', sku: '', qty: '1', price: '', color: '' }; }

export function WineOrderFormMobile({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const editRecord = editId ? data?.records.find(r => r.id === editId) ?? null : null;

  const colorPalette = useMemo(() => getWineColorPalette(data), [data]);

  const [date, setDate] = useState(() => (editRecord ? get(editRecord, 'order_date') : '') || todayIso());
  const [name, setName] = useState(() => editRecord ? get(editRecord, 'customer_name') : '');
  const [phone, setPhone] = useState(() => editRecord ? get(editRecord, 'customer_phone') : '');
  const [address, setAddress] = useState(() => editRecord ? get(editRecord, 'customer_address') : '');
  const [ward, setWard] = useState(() => editRecord ? get(editRecord, 'customer_district') : '');
  const [city, setCity] = useState(() => editRecord ? get(editRecord, 'customer_city') : '');
  const [note1, setNote1] = useState(() => editRecord ? get(editRecord, 'note1') : '');
  const [note2, setNote2] = useState(() => editRecord ? get(editRecord, 'note2') : '');
  const [shipFee, setShipFee] = useState(() => editRecord ? get(editRecord, 'ship_fee') : '');
  const [skipInventory, setSkipInventory] = useState(() =>
    editRecord ? (String(editRecord.values['mod_ruou_skip_inventory'] ?? '') === '1' || editRecord.values['mod_ruou_skip_inventory'] === true) : false);
  const [lines, setLines] = useState<OrderLine[]>(() => {
    if (editRecord) {
      const raw = editRecord.values['mod_ruou_product_lines'];
      if (raw && typeof raw === 'string' && raw.length > 2) {
        try { return (JSON.parse(raw) as Array<Record<string, string>>).map(p => ({ name: p.productName || '', sku: p.productSku || '', qty: p.quantity || '1', price: p.price || '', color: p.color || '' })); } catch { /* */ }
      }
      return [{ name: get(editRecord, 'product_name'), sku: get(editRecord, 'product_sku'), qty: get(editRecord, 'quantity') || '1', price: get(editRecord, 'price'), color: get(editRecord, 'color') }];
    }
    return [emptyLine()];
  });

  // Suggestion state: which customer field is active + the money chip target.
  const [suggField, setSuggField] = useState<'name' | 'phone' | 'address' | 'ward' | 'city' | null>(null);
  const [productSuggIdx, setProductSuggIdx] = useState<number | null>(null);
  const [priceChipIdx, setPriceChipIdx] = useState<number | null>(null);
  const [shipChip, setShipChip] = useState(false);

  const customers = useMemo(() => (data?.records ?? [])
    .filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_customers')
    .map(r => ({ name: get(r, 'full_name'), phone: get(r, 'phone'), address: get(r, 'address'), ward: get(r, 'district'), city: get(r, 'city') })), [data]);
  const products = useMemo(() => (data?.records ?? [])
    .filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_products')
    .map(r => ({ name: get(r, 'product_name'), sku: get(r, 'sku'), shortName: get(r, 'short_name') })), [data]);

  const totalGoods = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const ship = Number(shipFee.replace(/\D/g, '')) || 0;
  const grandTotal = totalGoods + ship;

  const custMatches = (field: 'name' | 'phone' | 'address' | 'ward' | 'city', q: string) => {
    const lq = q.trim().toLowerCase();
    if (!lq) return [];
    const key = field === 'ward' ? 'ward' : field === 'city' ? 'city' : field;
    const seen = new Set<string>();
    const out: typeof customers = [];
    for (const c of customers) {
      const v = (c[key as keyof typeof c] || '').toString();
      if (!v || !v.toLowerCase().includes(lq)) continue;
      if (seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase()); out.push(c);
      if (out.length >= 6) break;
    }
    return out;
  };
  const fillFromCustomer = (c: typeof customers[0]) => {
    setName(c.name || name); setPhone(c.phone || ''); setAddress(c.address || ''); setWard(c.ward || ''); setCity(c.city || '');
    setSuggField(null);
  };

  const productMatches = (q: string) => {
    const lq = q.trim().toLowerCase();
    if (!lq) return [];
    return products.filter(p => p.sku.toLowerCase().includes(lq) || p.name.toLowerCase().includes(lq) || p.shortName.toLowerCase().includes(lq)).slice(0, 6);
  };

  const setLine = (i: number, patch: Partial<OrderLine>) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev);

  const handleSave = () => {
    if (!name.trim()) return;
    const valid = lines.filter(l => l.name.trim() && (Number(l.qty) || 0) > 0);
    const first = valid[0] || emptyLine();
    const values: RecordValues = {
      mod_ruou_order_date: date,
      mod_ruou_customer_name: name.trim(),
      mod_ruou_customer_phone: phone.trim(),
      mod_ruou_customer_address: address.trim(),
      mod_ruou_customer_district: ward.trim(),
      mod_ruou_customer_city: city.trim(),
      mod_ruou_product_sku: first.sku || first.name.trim(),
      mod_ruou_product_name: first.name.trim(),
      mod_ruou_color: first.color,
      mod_ruou_quantity: Number(first.qty) || 1,
      mod_ruou_price: Number(first.price) || 0,
      mod_ruou_glasses: 0,
      mod_ruou_boxes: 0,
      mod_ruou_ship_fee: ship,
      mod_ruou_total_amount: grandTotal,
      mod_ruou_note1: note1.trim(),
      mod_ruou_note2: note2.trim(),
      mod_ruou_skip_inventory: skipInventory ? 1 : 0,
    };
    if (valid.length > 1) {
      values['mod_ruou_product_lines'] = JSON.stringify(valid.map(l => ({
        productName: l.name.trim(), productSku: l.sku || l.name.trim(),
        quantity: String(Number(l.qty) || 1), price: String(Number(l.price) || 0),
        color: l.color, glasses: '0', boxes: '0',
      })));
    }
    if (editId && editRecord) {
      adjustInventoryForEdit(editRecord.values, values);
      updateRecord(editId, values);
    } else {
      addRecord('mod_ruou', values);
      deductInventoryForOrder(values);
      if (shouldCreateCustomer(values)) addRecord('mod_ruou_customers', getCustomerValues(values));
    }
    onClose();
  };

  const shiftDay = (d: number) => { const x = new Date(date); x.setDate(x.getDate() + d); setDate(x.toISOString().slice(0, 10)); };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col mobile-density" style={{ height: '100dvh' }}>
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <h1 className="flex-1 text-center text-[18px] font-bold" style={{ color: NAVY }}>{editId ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới'}</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-2.5">
        {/* Date */}
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDay(-1)} className="w-9 h-9 flex items-center justify-center"><ChevronLeft size={22} color={PURPLE} /></button>
          <label className="flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 relative" style={{ borderColor: BORDER }}>
            <Calendar size={16} color={PURPLE} />
            <span className="text-[14px]" style={{ color: NAVY }}>{date.split('-').reverse().join('/')}</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="absolute inset-0 opacity-0" />
          </label>
          <button onClick={() => shiftDay(1)} className="w-9 h-9 flex items-center justify-center"><ChevronRight size={22} color={PURPLE} /></button>
        </div>

        {/* Customer fields with inline suggestion dropdowns */}
        <SuggestField icon={<User size={16} color="#9CA3AF" />} placeholder="Tên khách hàng..." value={name}
          onChange={v => { setName(v); setSuggField('name'); }} onFocus={() => setSuggField('name')} onClose={() => setSuggField(null)}
          matches={suggField === 'name' ? custMatches('name', name) : []}
          renderMatch={c => ({ primary: c.name, secondary: c.phone })} onPick={fillFromCustomer} />
        <SuggestField icon={<Phone size={16} color="#9CA3AF" />} placeholder="Số điện thoại..." value={phone} inputMode="tel"
          onChange={v => { setPhone(v); setSuggField('phone'); }} onFocus={() => setSuggField('phone')} onClose={() => setSuggField(null)}
          matches={suggField === 'phone' ? custMatches('phone', phone) : []}
          renderMatch={c => ({ primary: c.phone, secondary: c.name })} onPick={fillFromCustomer} />
        <SuggestField icon={<MapPin size={16} color="#9CA3AF" />} placeholder="Nhập địa chỉ..." value={address}
          onChange={v => { setAddress(v); setSuggField('address'); }} onFocus={() => setSuggField('address')} onClose={() => setSuggField(null)}
          matches={suggField === 'address' ? custMatches('address', address) : []}
          renderMatch={c => ({ primary: c.address, secondary: c.name })} onPick={fillFromCustomer} />
        <div className="flex gap-2">
          <div className="flex-1">
            <SuggestField icon={<Map size={16} color="#9CA3AF" />} placeholder="Phường/Xã..." value={ward}
              onChange={v => { setWard(v); setSuggField('ward'); }} onFocus={() => setSuggField('ward')} onClose={() => setSuggField(null)}
              matches={suggField === 'ward' ? custMatches('ward', ward) : []}
              renderMatch={c => ({ primary: c.ward, secondary: '' })} onPick={c => { setWard(c.ward); setSuggField(null); }} />
          </div>
          <div className="flex-1">
            <SuggestField icon={<Building2 size={16} color="#9CA3AF" />} placeholder="Thành phố..." value={city}
              onChange={v => { setCity(v); setSuggField('city'); }} onFocus={() => setSuggField('city')} onClose={() => setSuggField(null)}
              matches={suggField === 'city' ? custMatches('city', city) : []}
              renderMatch={c => ({ primary: c.city, secondary: '' })} onPick={c => { setCity(c.city); setSuggField(null); }} />
          </div>
        </div>

        {/* Products */}
        <div className="flex items-center pt-1">
          <span className="text-[14px] font-semibold" style={{ color: NAVY }}>Sản phẩm</span>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[12px] mr-3 select-none" style={{ color: NAVY }}>
            <input type="checkbox" checked={skipInventory} onChange={e => setSkipInventory(e.target.checked)} style={{ accentColor: PURPLE }} />
            Không trừ kho
          </label>
          <button onClick={addLine} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: PURPLE }}><Plus size={14} /> Thêm SP</button>
        </div>

        {lines.map((line, i) => {
          const pMatches = productSuggIdx === i ? productMatches(line.name) : [];
          const pChips = priceChipIdx === i ? moneySuggestions(line.price) : [];
          return (
            <div key={i} className="border rounded-lg p-2.5 space-y-2" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: `${PURPLE}33`, color: PURPLE }}>{i + 1}</span>
                <div className="flex-1 relative">
                  <input value={line.name} placeholder="Tìm sản phẩm / SKU..."
                    onChange={e => { setLine(i, { name: e.target.value }); setProductSuggIdx(i); }}
                    onFocus={() => setProductSuggIdx(i)}
                    onBlur={() => setTimeout(() => setProductSuggIdx(p => p === i ? null : p), 150)}
                    className="w-full px-2.5 py-2 border rounded-md text-[13px] outline-none" style={{ borderColor: BORDER }} />
                  {pMatches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-auto" style={{ borderColor: BORDER }}>
                      {pMatches.map((p, k) => (
                        <button key={k} onMouseDown={e => { e.preventDefault(); setLine(i, { name: p.shortName || p.name, sku: p.sku, qty: line.qty || '1' }); setProductSuggIdx(null); }}
                          className="w-full text-left px-3 py-2 active:bg-gray-50 border-b last:border-b-0" style={{ borderColor: `${BORDER}80` }}>
                          <p className="text-[13px] font-medium" style={{ color: NAVY }}>{p.shortName || p.name}</p>
                          <p className="text-[11px] text-gray-500">SKU: {p.sku}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {lines.length > 1 && <button onClick={() => removeLine(i)} className="w-7 h-7 flex items-center justify-center text-red-400"><X size={16} /></button>}
              </div>
              <div className="flex gap-2 items-start">
                <input value={line.qty} inputMode="numeric" placeholder="SL"
                  onChange={e => setLine(i, { qty: e.target.value.replace(/\D/g, '') })}
                  className="w-14 px-2 py-2 border rounded-md text-[13px] text-center outline-none" style={{ borderColor: BORDER }} />
                <div className="flex-1 relative">
                  <input value={line.price} inputMode="numeric" placeholder="Đơn giá"
                    onChange={e => { setLine(i, { price: e.target.value.replace(/\D/g, '') }); setPriceChipIdx(i); }}
                    onFocus={() => setPriceChipIdx(i)}
                    onBlur={() => setTimeout(() => setPriceChipIdx(p => p === i ? null : p), 150)}
                    className="w-full px-2 py-2 border rounded-md text-[13px] outline-none" style={{ borderColor: BORDER }} />
                  {pChips.length > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {pChips.map(v => (
                        <button key={v} onMouseDown={e => { e.preventDefault(); setLine(i, { price: String(v) }); setPriceChipIdx(null); }}
                          className="px-2 py-1 rounded-md text-[11px]" style={{ backgroundColor: `${PURPLE}14`, color: PURPLE }}>{nf(v)}đ</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Color dropdown (stores LABEL to match the app) */}
                <div className="relative">
                  <select value={line.color} onChange={e => setLine(i, { color: e.target.value })}
                    className="w-[92px] px-2 py-2 border rounded-md text-[13px] outline-none appearance-none bg-white" style={{ borderColor: BORDER, color: line.color ? NAVY : '#9CA3AF' }}>
                    <option value="">Màu</option>
                    {colorPalette.map(c => <option key={c.code} value={c.label}>{c.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[14px] font-medium" style={{ color: NAVY }}>Tổng tiền:</span>
          <span className="text-[14px] font-bold" style={{ color: PURPLE }}>{nf(totalGoods)} đ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px]" style={{ color: NAVY }}>Phí ship:</span>
          <div className="flex-1" />
          <div className="w-[150px] relative">
            <input value={shipFee} inputMode="numeric" placeholder="Phí ship"
              onChange={e => { setShipFee(e.target.value.replace(/\D/g, '')); setShipChip(true); }}
              onFocus={() => setShipChip(true)}
              onBlur={() => setTimeout(() => setShipChip(false), 150)}
              className="w-full px-2.5 py-2 border rounded-md text-[13px] text-right outline-none" style={{ borderColor: BORDER }} />
            {shipChip && moneySuggestions(shipFee).length > 0 && (
              <div className="flex gap-1.5 mt-1 flex-wrap justify-end">
                {moneySuggestions(shipFee).map(v => (
                  <button key={v} onMouseDown={e => { e.preventDefault(); setShipFee(String(v)); setShipChip(false); }}
                    className="px-2 py-1 rounded-md text-[11px]" style={{ backgroundColor: `${PURPLE}14`, color: PURPLE }}>{nf(v)}đ</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold" style={{ color: PURPLE }}>Thanh toán:</span>
          <span className="text-[16px] font-bold" style={{ color: PURPLE }}>{nf(grandTotal)} đ</span>
        </div>

        {/* Notes */}
        <NoteField placeholder="Ghi chú 1..." value={note1} onChange={setNote1} />
        <NoteField placeholder="Ghi chú 2..." value={note2} onChange={setNote2} />

        <button onClick={handleSave} className="w-full mt-2 py-3.5 rounded-xl text-white text-[15px] font-semibold active:scale-[0.99]" style={{ backgroundColor: PURPLE }}>
          {editId ? 'Lưu đơn hàng' : 'Tạo đơn hàng'}
        </button>
        <div className="h-4" />
      </div>
    </div>
  );
}

function SuggestField<T>({ icon, placeholder, value, onChange, onFocus, onClose, inputMode, matches, renderMatch, onPick }: {
  icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; onFocus: () => void; onClose: () => void;
  inputMode?: 'tel' | 'numeric'; matches: T[]; renderMatch: (m: T) => { primary: string; secondary: string }; onPick: (m: T) => void;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 border rounded-xl px-3 h-12" style={{ borderColor: BORDER }}>
        {icon}
        <input value={value} placeholder={placeholder} inputMode={inputMode} onChange={e => onChange(e.target.value)} onFocus={onFocus}
          onBlur={() => setTimeout(onClose, 150)}
          className="flex-1 text-[14px] outline-none bg-transparent" style={{ color: NAVY }} />
        <ChevronDown size={18} className="text-gray-400" />
      </div>
      {matches.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto" style={{ borderColor: BORDER }}>
          {matches.map((m, i) => {
            const { primary, secondary } = renderMatch(m);
            return (
              <button key={i} onMouseDown={e => { e.preventDefault(); onPick(m); }}
                className="w-full text-left px-3 py-2.5 active:bg-gray-50 border-b last:border-b-0" style={{ borderColor: `${BORDER}80` }}>
                <p className="text-[14px] font-medium" style={{ color: NAVY }}>{primary}</p>
                {secondary ? <p className="text-[12px] text-gray-500">{secondary}</p> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteField({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 border rounded-xl px-3 h-12" style={{ borderColor: BORDER }}>
      <Edit3 size={16} color="#9CA3AF" />
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="flex-1 text-[14px] outline-none bg-transparent" style={{ color: NAVY }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER FORM (add/edit) — bottom sheet, matches Flutter add-customer form
// ═══════════════════════════════════════════════════════════════════════════

export function WineCustomerForm({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const rec = editId ? data?.records.find(r => r.id === editId) ?? null : null;

  const [name, setName] = useState(rec ? get(rec, 'full_name') : '');
  const [phone, setPhone] = useState(rec ? get(rec, 'phone') : '');
  const [address, setAddress] = useState(rec ? get(rec, 'address') : '');
  const [ward, setWard] = useState(rec ? get(rec, 'district') : '');
  const [city, setCity] = useState(rec ? get(rec, 'city') : '');
  const [note, setNote] = useState(rec ? get(rec, 'note') : '');

  const save = () => {
    if (!name.trim()) return;
    const values: RecordValues = {
      mod_ruou_customers_full_name: name.trim(),
      mod_ruou_customers_phone: phone.trim(),
      mod_ruou_customers_address: address.trim(),
      mod_ruou_customers_district: ward.trim(),
      mod_ruou_customers_city: city.trim(),
      mod_ruou_customers_note: note.trim(),
    };
    if (editId && rec) updateRecord(editId, { ...rec.values, ...values });
    else addRecord('mod_ruou_customers', { ...values, mod_ruou_customers_total_orders: 0 });
    onClose();
  };

  const fld = (icon: React.ReactNode, ph: string, v: string, set: (s: string) => void, inputMode?: 'tel') => (
    <div className="flex items-center gap-2 border rounded-xl px-3 h-12" style={{ borderColor: BORDER }}>
      {icon}
      <input value={v} placeholder={ph} inputMode={inputMode} onChange={e => set(e.target.value)} className="flex-1 text-[14px] outline-none" style={{ color: NAVY }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 mobile-density" onClick={onClose}>
      <div className="relative bg-white rounded-t-2xl w-full max-h-[88vh] overflow-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: NAVY }}>{editId ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h3>
          <button onClick={onClose}><X size={18} color="#666" /></button>
        </div>
        {fld(<User size={16} color="#9CA3AF" />, 'Họ tên *', name, setName)}
        {fld(<Phone size={16} color="#9CA3AF" />, 'Số điện thoại', phone, setPhone, 'tel')}
        {fld(<MapPin size={16} color="#9CA3AF" />, 'Địa chỉ', address, setAddress)}
        <div className="flex gap-2">
          <div className="flex-1">{fld(<Map size={16} color="#9CA3AF" />, 'Phường/Xã', ward, setWard)}</div>
          <div className="flex-1">{fld(<Building2 size={16} color="#9CA3AF" />, 'Thành phố', city, setCity)}</div>
        </div>
        {fld(<Edit3 size={16} color="#9CA3AF" />, 'Ghi chú', note, setNote)}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border text-[14px] font-medium" style={{ borderColor: BORDER, color: NAVY }}>Hủy</button>
          <button onClick={save} className="flex-[2] py-3 rounded-xl text-white text-[14px] font-semibold" style={{ backgroundColor: PURPLE }}>{editId ? 'Cập nhật' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS SCREEN + PRODUCT FORM — matches Flutter wine_products_screen
// ═══════════════════════════════════════════════════════════════════════════

export function WineProductsScreenMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const { deleteRecord } = useRecordStore();
  const [query, setQuery] = useState('');
  const [formId, setFormId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const products = useMemo(() => (data?.records ?? [])
    .filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_products')
    .map(r => ({ id: r.id, name: get(r, 'product_name'), sku: get(r, 'sku'), shortName: get(r, 'short_name'), volume: get(r, 'volume_ml'), wineType: get(r, 'wine_type'), bottleType: get(r, 'bottle_type') }))
    .sort((a, b) => (a.shortName || a.name).localeCompare(b.shortName || b.name, 'vi')), [data]);
  const filtered = products.filter(p => !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()) || p.shortName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col mobile-density" style={{ height: '100dvh' }}>
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <h1 className="flex-1 text-center text-[18px] font-bold" style={{ color: NAVY }}>Sản phẩm</h1>
        <div className="w-10" />
      </header>
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: BORDER }}>
          <Search size={18} color="#9CA3AF" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm sản phẩm..." className="flex-1 text-sm outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 pb-24">
        {filtered.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">Chưa có sản phẩm</p> : filtered.map((p, idx) => (
          <div key={p.id} className={`flex items-center gap-3 py-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium" style={{ color: NAVY }}>{p.shortName || p.name}</p>
              <p className="text-[11px] text-gray-500 truncate">SKU: {p.sku}{p.volume ? ` • ${p.volume}ml` : ''}{p.wineType ? ` • ${p.wineType}` : ''}{p.bottleType ? ` • ${p.bottleType}` : ''}</p>
            </div>
            <button onClick={() => { setFormId(p.id); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center"><Edit3 size={16} style={{ color: PURPLE }} /></button>
            <button onClick={async () => { if (await showConfirm({ title: 'Xóa sản phẩm?', message: `Xóa "${p.shortName || p.name}"?`, confirmLabel: 'Xóa', danger: true })) deleteRecord(p.id); }} className="w-8 h-8 flex items-center justify-center text-red-400"><X size={16} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => { setFormId(null); setShowForm(true); }} className="absolute right-5 bottom-6 w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: PURPLE, boxShadow: '0 4px 8px rgba(108,43,217,0.3)' }}>
        <Plus size={26} />
      </button>
      {showForm && <WineProductForm editId={formId} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function WineProductForm({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const rec = editId ? data?.records.find(r => r.id === editId) ?? null : null;

  const [name, setName] = useState(rec ? get(rec, 'product_name') : '');
  const [sku, setSku] = useState(rec ? get(rec, 'sku') : '');
  const [shortName, setShortName] = useState(rec ? get(rec, 'short_name') : '');
  const [volume, setVolume] = useState(rec ? get(rec, 'volume_ml') : '');
  const [wineType, setWineType] = useState(rec ? get(rec, 'wine_type') : '');
  const [bottleType, setBottleType] = useState(rec ? get(rec, 'bottle_type') : '');

  const save = () => {
    if (!name.trim() || !sku.trim()) return;
    const values: RecordValues = {
      mod_ruou_products_product_name: name.trim(),
      mod_ruou_products_sku: sku.trim(),
      mod_ruou_products_short_name: shortName.trim(),
      mod_ruou_products_volume_ml: Number(volume) || 0,
      mod_ruou_products_wine_type: wineType,
      mod_ruou_products_bottle_type: bottleType,
    };
    if (editId && rec) updateRecord(editId, { ...rec.values, ...values });
    else addRecord('mod_ruou_products', { ...values, mod_ruou_products_note: '' });
    onClose();
  };

  const fld = (icon: React.ReactNode, ph: string, v: string, set: (s: string) => void, opts?: { numeric?: boolean; suffix?: string }) => (
    <div className="flex items-center gap-2 border rounded-xl px-3 h-[52px]" style={{ borderColor: BORDER }}>
      {icon}
      <input value={v} placeholder={ph} inputMode={opts?.numeric ? 'numeric' : undefined}
        onChange={e => set(opts?.numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        className="flex-1 text-[14px] outline-none" style={{ color: NAVY }} />
      {opts?.suffix && <span className="text-[13px] text-gray-400">{opts.suffix}</span>}
    </div>
  );
  const dropdown = (icon: React.ReactNode, ph: string, v: string, set: (s: string) => void, options: string[]) => (
    <div className="flex items-center gap-2 border rounded-xl px-3 h-[52px] relative" style={{ borderColor: BORDER }}>
      {icon}
      <select value={v} onChange={e => set(e.target.value)} className="flex-1 text-[14px] outline-none appearance-none bg-white" style={{ color: v ? NAVY : '#9CA3AF' }}>
        <option value="">{ph}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} className="text-gray-400 pointer-events-none" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 mobile-density" onClick={onClose}>
      <div className="relative bg-white rounded-t-2xl w-full max-h-[90vh] overflow-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button onClick={onClose}><ArrowLeft size={20} style={{ color: NAVY }} /></button>
          <h3 className="flex-1 text-center text-base font-bold" style={{ color: NAVY }}>{editId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h3>
          <div className="w-5" />
        </div>
        {fld(<Wine size={16} color="#9CA3AF" />, 'Tên sản phẩm *', name, setName)}
        {fld(<QrCode size={16} color="#9CA3AF" />, 'SKU *', sku, setSku)}
        {fld(<Edit3 size={16} color="#9CA3AF" />, 'Tên ngắn (tùy chọn)', shortName, setShortName)}
        {fld(<Package size={16} color="#9CA3AF" />, 'Dung tích (ml)', volume, setVolume, { numeric: true, suffix: 'ml' })}
        {dropdown(<Wine size={16} color="#9CA3AF" />, 'Loại rượu', wineType, setWineType, WINE_TYPES)}
        {dropdown(<Wine size={16} color="#9CA3AF" />, 'Loại chai', bottleType, setBottleType, BOTTLE_TYPES)}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border text-[14px] font-medium" style={{ borderColor: BORDER, color: NAVY }}>Hủy</button>
          <button onClick={save} className="flex-[2] py-3 rounded-xl text-white text-[14px] font-semibold" style={{ backgroundColor: PURPLE }}>Lưu</button>
        </div>
        <div className="h-2" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK-IN SCREEN (Nhập kho) — record-based (upserts mod_ruou_inventory)
// ═══════════════════════════════════════════════════════════════════════════

interface StockEntry { name: string; sku: string; qty: string; color: string; note: string; }
function emptyEntry(): StockEntry { return { name: '', sku: '', qty: '', color: '', note: '' }; }

export function WineStockInMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const colorPalette = useMemo(() => getWineColorPalette(data), [data]);
  const [date, setDate] = useState(todayIso());
  const [entries, setEntries] = useState<StockEntry[]>([emptyEntry()]);
  const [suggIdx, setSuggIdx] = useState<number | null>(null);
  const savingRef = useRef(false);

  const products = useMemo(() => (data?.records ?? [])
    .filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_products')
    .map(r => ({ name: get(r, 'product_name'), sku: get(r, 'sku'), shortName: get(r, 'short_name'), wineType: get(r, 'wine_type'), bottleType: get(r, 'bottle_type') })), [data]);

  const productMatches = (q: string) => {
    const lq = q.trim().toLowerCase();
    if (!lq) return [];
    return products.filter(p => p.sku.toLowerCase().includes(lq) || p.name.toLowerCase().includes(lq) || p.shortName.toLowerCase().includes(lq)).slice(0, 6);
  };
  const setEntry = (i: number, patch: Partial<StockEntry>) => setEntries(prev => prev.map((e, j) => j === i ? { ...e, ...patch } : e));

  const shiftDay = (d: number) => { const x = new Date(date); x.setDate(x.getDate() + d); setDate(x.toISOString().slice(0, 10)); };

  const save = () => {
    if (savingRef.current || !data) return;
    const valid = entries.filter(e => e.sku.trim() && (Number(e.qty) || 0) > 0);
    if (valid.length === 0) return;
    savingRef.current = true;
    for (const e of valid) {
      const qty = Number(e.qty) || 0;
      const fullSku = e.color ? `${e.sku}-${e.color}` : e.sku;
      const existing = data.records.find(r => r.moduleId === 'mod_ruou_inventory' && !r.isDeleted && String(r.values['mod_ruou_inventory_sku'] ?? '') === fullSku);
      if (existing) {
        updateRecord(existing.id, {
          mod_ruou_inventory_stock: (Number(existing.values['mod_ruou_inventory_stock'] ?? 0) || 0) + qty,
          mod_ruou_inventory_note: e.note.trim() || String(existing.values['mod_ruou_inventory_note'] ?? ''),
        });
      } else {
        const p = products.find(pp => pp.sku === e.sku);
        addRecord('mod_ruou_inventory', {
          mod_ruou_inventory_sku: fullSku,
          mod_ruou_inventory_product_name: p ? (p.shortName || p.name) : e.name || e.sku,
          mod_ruou_inventory_color: e.color,
          mod_ruou_inventory_wine_type: p?.wineType || '',
          mod_ruou_inventory_bottle_type: p?.bottleType || '',
          mod_ruou_inventory_stock: qty,
          mod_ruou_inventory_note: e.note.trim(),
        });
      }
    }
    pop();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col mobile-density" style={{ height: '100dvh' }}>
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <h1 className="flex-1 text-center text-[18px] font-bold" style={{ color: NAVY }}>Nhập kho</h1>
        <div className="w-10" />
      </header>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Date */}
        <div className="flex items-center border rounded-lg" style={{ borderColor: BORDER }}>
          <button onClick={() => shiftDay(-1)} className="px-2 py-3"><ChevronLeft size={24} color={PURPLE} /></button>
          <label className="flex-1 flex items-center justify-center gap-2 relative py-3">
            <Calendar size={18} color={PURPLE} />
            <span className="text-[15px] font-medium" style={{ color: NAVY }}>{date.split('-').reverse().join('/')}</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="absolute inset-0 opacity-0" />
          </label>
          <button onClick={() => shiftDay(1)} className="px-2 py-3"><ChevronRight size={24} color={PURPLE} /></button>
        </div>

        {entries.map((e, i) => {
          const matches = suggIdx === i ? productMatches(e.name) : [];
          return (
            <div key={i} className="space-y-2">
              {entries.length > 1 && (
                <div className="flex items-center">
                  <span className="text-[13px] font-semibold" style={{ color: NAVY }}>Sản phẩm {i + 1}</span>
                  <div className="flex-1" />
                  <button onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))} className="text-red-400"><X size={18} /></button>
                </div>
              )}
              <div className="relative">
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12" style={{ borderColor: BORDER }}>
                  <Search size={16} color="#9CA3AF" />
                  <input value={e.name} placeholder="Tìm theo SKU hoặc tên sản phẩm..."
                    onChange={ev => { setEntry(i, { name: ev.target.value }); setSuggIdx(i); }}
                    onFocus={() => setSuggIdx(i)}
                    onBlur={() => setTimeout(() => setSuggIdx(p => p === i ? null : p), 150)}
                    className="flex-1 text-[14px] outline-none" style={{ color: NAVY }} />
                </div>
                {matches.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-auto" style={{ borderColor: BORDER }}>
                    {matches.map((p, k) => (
                      <button key={k} onMouseDown={ev => { ev.preventDefault(); setEntry(i, { name: `${p.sku} - ${p.shortName || p.name}`, sku: p.sku }); setSuggIdx(null); }}
                        className="w-full text-left px-3 py-2 active:bg-gray-50 border-b last:border-b-0" style={{ borderColor: `${BORDER}80` }}>
                        <p className="text-[13px] font-medium" style={{ color: NAVY }}>{p.shortName || p.name}</p>
                        <p className="text-[11px] text-gray-500">SKU: {p.sku}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input value={e.qty} inputMode="numeric" placeholder="Số lượng"
                  onChange={ev => setEntry(i, { qty: ev.target.value.replace(/\D/g, '') })}
                  className="w-24 px-3 py-2.5 border rounded-lg text-[14px] text-center outline-none" style={{ borderColor: BORDER }} />
                <div className="flex-1 relative">
                  <select value={e.color} onChange={ev => setEntry(i, { color: ev.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-[14px] outline-none appearance-none bg-white" style={{ borderColor: BORDER, color: e.color ? NAVY : '#9CA3AF' }}>
                    <option value="">Chọn màu sắc</option>
                    {colorPalette.map(c => <option key={c.code} value={c.label}>{c.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <input value={e.note} placeholder="Nhập ghi chú..." onChange={ev => setEntry(i, { note: ev.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-[14px] outline-none" style={{ borderColor: BORDER }} />
            </div>
          );
        })}

        <button onClick={() => setEntries(prev => [...prev, emptyEntry()])} className="w-full py-3 rounded-lg border-2 flex items-center justify-center gap-2 text-[15px] font-semibold" style={{ borderColor: PURPLE, color: PURPLE }}>
          <Plus size={20} /> Thêm sản phẩm khác
        </button>

        <div className="flex gap-3 pt-1">
          <button onClick={pop} className="flex-1 py-3.5 rounded-lg border text-[15px] font-bold" style={{ borderColor: BORDER, color: NAVY }}>Hủy</button>
          <button onClick={save} className="flex-1 py-3.5 rounded-lg text-white text-[15px] font-bold flex items-center justify-center gap-2" style={{ backgroundColor: PURPLE }}>
            <LogIn size={18} /> Nhập kho
          </button>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
