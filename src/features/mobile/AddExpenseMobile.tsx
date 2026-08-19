import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { X, ChevronLeft, ChevronRight, Calendar, ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react';
import type { RecordValues } from '@/types';

interface Props {
  onClose: () => void;
  editRecord?: { id: string; values: RecordValues; categoryId?: string; linkedModuleId?: string; moduleId?: string };
}

/**
 * AddExpenseMobile — REBUILD based on Android add_transaction_screen.dart.
 * Exact reproduction: Date row (< date >) + Chi/Thu + Title (with suggestions) + Amount (with suggestions) + Quantity
 * + Payment grid chips + Category grid chips + Module pills + Beneficiary + Note + Expanded (Event/Store/Warranty)
 */
export function AddExpenseMobile({ onClose, editRecord }: Props) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const isEditing = !!editRecord;

  const getVal = (suffix: string): string => {
    if (!editRecord) return '';
    const key = Object.keys(editRecord.values).find(k => k.endsWith(`_${suffix}`));
    return key ? String(editRecord.values[key] ?? '') : '';
  };

  const [type, setType] = useState<0 | 1>(getVal('type') === '1' ? 1 : 0);
  const [title, setTitle] = useState(getVal('title'));
  const [amount, setAmount] = useState(getVal('amount') ? String(Math.abs(Number(getVal('amount')))) : '');
  const [quantity, setQuantity] = useState(Number(getVal('quantity')) || 1);
  const [categoryId, setCategoryId] = useState(editRecord?.categoryId || '');
  const [accountId, setAccountId] = useState(getVal('account') || 'cash');
  const [moduleId, setModuleId] = useState(editRecord?.linkedModuleId || editRecord?.moduleId || 'mod_chitieu');
  const [date, setDate] = useState(getVal('date') || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(getVal('note'));
  const [beneficiary, setBeneficiary] = useState(getVal('beneficiary'));
  const [event, setEvent] = useState(getVal('event'));
  const [store, setStore] = useState(getVal('store'));
  const [warrantyMonths, setWarrantyMonths] = useState(getVal('warranty_months'));
  const [showExpanded, setShowExpanded] = useState(!!(getVal('event') || getVal('store') || getVal('warranty_months')));
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [showAccSheet, setShowAccSheet] = useState(false);

  const categories = data?.modules.find(m => m.id === 'mod_chitieu')?.categories?.filter(c => c.isActive) || [];
  const accounts = data?.accounts?.filter(a => a.isActive) || [];
  const modules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];
  const beneficiaries = data?.modules.find(m => m.id === 'mod_chitieu')?.fields.find(f => f.fieldName === 'beneficiary')?.options || [];

  // Amount suggestions
  const amountSuggestions = useMemo(() => {
    const base = Number(amount.replace(/\D/g, '')) || 0;
    if (base <= 0) return [];
    const sugs = new Set<number>();
    for (const m of [1000, 10000, 100000, 1000000]) { const v = base * m; if (v > base && v >= 1000 && v <= 1000000000) sugs.add(v); }
    return Array.from(sugs).sort().slice(0, 4);
  }, [amount]);

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');

  // Date navigation
  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)); };
  const fmtDate = (d: string) => { const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  const handleSave = () => {
    const amt = Number(amount.replace(/\D/g, '')) || 0;
    const values: RecordValues = {
      mod_chitieu_title: title.trim() || 'Giao dịch',
      mod_chitieu_amount: amt,
      mod_chitieu_type: String(type),
      mod_chitieu_date: date,
      mod_chitieu_account: accountId,
      mod_chitieu_note: note.trim() || null,
      mod_chitieu_beneficiary: beneficiary || null,
      mod_chitieu_event: event.trim() || null,
      mod_chitieu_store: store.trim() || null,
      mod_chitieu_warranty_months: warrantyMonths || null,
      mod_chitieu_quantity: quantity > 1 ? quantity : null,
    };
    if (isEditing && editRecord) { updateRecord(editRecord.id, values); }
    else { addRecord('mod_chitieu', values, categoryId || undefined, moduleId !== 'mod_chitieu' ? moduleId : undefined); }
    onClose();
  };

  // Visible categories (max 7 + "Thêm")
  const visibleCats = categories.length > 8 ? categories.slice(0, 7) : categories;
  const hasMoreCats = categories.length > 8;
  // Visible accounts (max 3 + "Thêm")
  const visibleAccs = accounts.length > 4 ? accounts.slice(0, 3) : accounts;
  const hasMoreAccs = accounts.length > 4;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header — Android style: back + title + Lưu button */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center"><X size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-bold text-gray-900">{isEditing ? 'Sửa chi tiêu' : 'Thêm chi tiêu'}</h2>
        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-white text-sm font-semibold active:scale-95" style={{ backgroundColor: '#004DEB' }}>Lưu</button>
      </header>

      {/* Form — scrollable */}
      <div className="flex-1 overflow-auto px-4 pb-8">
        {/* Date + Type Row — Android style */}
        <div className="flex items-center gap-1 py-3 px-2 mt-2 rounded-xl" style={{ backgroundColor: '#FFF0F0' }}>
          <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center"><ChevronLeft size={20} className="text-gray-600" /></button>
          <button className="flex items-center gap-1.5 flex-1 justify-center">
            <Calendar size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-800">{fmtDate(date)}</span>
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="absolute opacity-0 w-0 h-0" />
          <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center"><ChevronRight size={20} className="text-gray-600" /></button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          {/* Type pills */}
          <button onClick={() => setType(0)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${type === 0 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
            <ArrowDown size={14} className={type === 0 ? 'text-red-500' : 'text-gray-400'} />
            <span className={`text-xs font-semibold ${type === 0 ? 'text-red-500' : 'text-gray-400'}`}>Chi</span>
          </button>
          <button onClick={() => setType(1)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${type === 1 ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
            <ArrowUp size={14} className={type === 1 ? 'text-green-500' : 'text-gray-400'} />
            <span className={`text-xs font-semibold ${type === 1 ? 'text-green-500' : 'text-gray-400'}`}>Thu</span>
          </button>
        </div>

        {/* Title */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Tên giao dịch *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tên giao dịch" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" />
        </div>

        {/* Amount + Quantity */}
        <div className="mt-4 flex gap-3">
          <div className="flex-[3]">
            <label className="text-xs font-medium text-gray-700">Số tiền *</label>
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="flex-[2]">
            <label className="text-xs font-medium text-gray-700">Số lượng</label>
            <div className="flex mt-1.5 h-[46px]">
              <button onClick={() => quantity > 1 && setQuantity(quantity - 1)} className="w-10 border border-gray-200 rounded-l-xl flex items-center justify-center"><Minus size={16} className="text-gray-600" /></button>
              <div className="flex-1 border-y border-gray-200 flex items-center justify-center text-base font-semibold">{quantity}</div>
              <button onClick={() => setQuantity(quantity + 1)} className="w-10 border border-gray-200 rounded-r-xl flex items-center justify-center"><Plus size={16} className="text-gray-600" /></button>
            </div>
          </div>
        </div>

        {/* Amount suggestions */}
        {amountSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {amountSuggestions.map(v => (
              <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-xs text-blue-700">{fmtMoney(v)}₫</button>
            ))}
          </div>
        )}

        {/* Payment Method — Grid chips */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Phương thức thanh toán *</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {visibleAccs.map(acc => (
              <Chip key={acc.id} label={acc.name} selected={accountId === acc.id} onTap={() => setAccountId(acc.id)} />
            ))}
            {hasMoreAccs && <Chip label="Thêm" selected={false} onTap={() => setShowAccSheet(true)} />}
          </div>
        </div>

        {/* Category — Grid chips (Wrap) */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Danh mục *</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {visibleCats.map(cat => (
              <Chip key={cat.id} label={cat.name} selected={categoryId === cat.id} onTap={() => setCategoryId(cat.id)} />
            ))}
            {hasMoreCats && <Chip label="Thêm" selected={false} onTap={() => setShowCatSheet(true)} />}
          </div>
        </div>

        {/* Module — Pills */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Module *</label>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {modules.map(m => (
              <button key={m.id} onClick={() => setModuleId(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${moduleId === m.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Beneficiary */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Người nhận</label>
          {beneficiaries.length > 0 ? (
            <div className="flex gap-2 mt-2 flex-wrap">
              {beneficiaries.map(b => (
                <Chip key={b.id} label={b.label} selected={beneficiary === b.value} onTap={() => setBeneficiary(beneficiary === b.value ? '' : b.value)} />
              ))}
            </div>
          ) : (
            <input type="text" value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="Người nhận" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" />
          )}
        </div>

        {/* Note */}
        <div className="mt-5">
          <label className="text-xs font-medium text-gray-700">Ghi chú</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." rows={2} className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 resize-none" />
        </div>

        {/* Expanded toggle */}
        {!showExpanded && (
          <button onClick={() => setShowExpanded(true)} className="mt-4 text-xs font-medium text-blue-600">+ Thêm thông tin (Sự kiện, Cửa hàng, Bảo hành...)</button>
        )}
        {showExpanded && (
          <div className="mt-4 space-y-4">
            <div><label className="text-xs font-medium text-gray-700">Sự kiện</label><input type="text" value={event} onChange={e => setEvent(e.target.value)} placeholder="Sự kiện" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-700">Cửa hàng</label><input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="Cửa hàng" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" /></div>
            <div><label className="text-xs font-medium text-gray-700">Bảo hành (tháng)</label><input type="text" inputMode="numeric" value={warrantyMonths} onChange={e => setWarrantyMonths(e.target.value.replace(/\D/g, ''))} placeholder="VD: 12" className="w-full mt-1.5 px-3.5 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" /></div>
          </div>
        )}

        {/* Image notice */}
        <p className="mt-4 text-[10px] text-gray-400">📷 Đính kèm ảnh/hóa đơn chưa hỗ trợ trên Web</p>

        {/* Save button — full width */}
        <button onClick={handleSave} className="w-full mt-6 py-3.5 rounded-xl text-white text-sm font-semibold active:scale-[0.98]" style={{ backgroundColor: '#004DEB' }}>
          {isEditing ? 'Cập nhật' : 'Lưu giao dịch'}
        </button>
      </div>

      {/* Category Bottom Sheet */}
      {showCatSheet && (
        <Sheet title="Chọn danh mục" onClose={() => setShowCatSheet(false)}>
          {categories.map(c => (
            <SheetItem key={c.id} label={c.name} selected={categoryId === c.id} onTap={() => { setCategoryId(c.id); setShowCatSheet(false); }} />
          ))}
        </Sheet>
      )}
      {/* Account Bottom Sheet */}
      {showAccSheet && (
        <Sheet title="Phương thức thanh toán" onClose={() => setShowAccSheet(false)}>
          {accounts.map(a => (
            <SheetItem key={a.id} label={a.name} selected={accountId === a.id} onTap={() => { setAccountId(a.id); setShowAccSheet(false); }} />
          ))}
        </Sheet>
      )}
    </div>
  );
}

function Chip({ label, selected, onTap }: { label: string; selected: boolean; onTap: () => void }) {
  return (
    <button onClick={onTap} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-white'}`}>
      {label}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-t-2xl max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function SheetItem({ label, selected, onTap }: { label: string; selected: boolean; onTap: () => void }) {
  return (
    <button onClick={onTap} className={`w-full px-4 py-3.5 text-left text-sm border-b border-gray-50 active:bg-gray-50 ${selected ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-900'}`}>{label}</button>
  );
}
