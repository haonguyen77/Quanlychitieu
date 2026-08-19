import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { X, Calendar, Clock, Tag, Wallet, Layers, FileText, User, MapPin, ShoppingBag, Shield, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onClose: () => void;
  editRecord?: { id: string; values: Record<string, unknown>; categoryId?: string; linkedModuleId?: string; moduleId?: string };
}

/**
 * AddExpenseMobile — Full reproduction of Android add_transaction_screen.dart.
 * Fullscreen form with all fields: type, title, amount, category, account, module, date, time, note, beneficiary, event, store, warranty.
 */
export function AddExpenseMobile({ onClose, editRecord }: Props) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();

  const isEditing = !!editRecord;

  // Extract values from editRecord
  const getVal = (suffix: string): string => {
    if (!editRecord) return '';
    const key = Object.keys(editRecord.values).find(k => k.endsWith(`_${suffix}`));
    return key ? String(editRecord.values[key] ?? '') : '';
  };

  const [type, setType] = useState<'0' | '1'>(getVal('type') === '1' ? '1' : '0');
  const [title, setTitle] = useState(getVal('title'));
  const [amount, setAmount] = useState(getVal('amount') ? String(Math.abs(Number(getVal('amount')))) : '');
  const [categoryId, setCategoryId] = useState(editRecord?.categoryId || '');
  const [account, setAccount] = useState(getVal('account') || 'cash');
  const [moduleId, setModuleId] = useState(editRecord?.linkedModuleId || editRecord?.moduleId || 'mod_chitieu');
  const [date, setDate] = useState(getVal('date') || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(getVal('time') || new Date().toTimeString().slice(0, 5));
  const [note, setNote] = useState(getVal('note'));
  const [beneficiary, setBeneficiary] = useState(getVal('beneficiary'));
  const [event, setEvent] = useState(getVal('event'));
  const [store, setStore] = useState(getVal('store'));
  const [showMore, setShowMore] = useState(!!(getVal('beneficiary') || getVal('event') || getVal('store')));
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showAccPicker, setShowAccPicker] = useState(false);
  const [showModPicker, setShowModPicker] = useState(false);

  const categories = data?.modules.find(m => m.id === 'mod_chitieu')?.categories || [];
  const accounts = data?.modules.find(m => m.id === 'mod_chitieu')?.fields.find(f => f.fieldName === 'account')?.options || [];
  const modules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];

  const selectedCatName = categories.find(c => c.id === categoryId)?.name || 'Chọn danh mục';
  const selectedAccName = accounts.find(o => o.value === account)?.label || account;
  const selectedModName = modules.find(m => m.id === moduleId)?.name || 'Chi tiêu';

  const handleSave = () => {
    if (!title.trim() || !amount) return;
    const values: Record<string, unknown> = {
      mod_chitieu_title: title.trim(),
      mod_chitieu_amount: Number(amount.replace(/\./g, '').replace(/,/g, '')),
      mod_chitieu_type: type,
      mod_chitieu_date: date,
      mod_chitieu_time: time,
      mod_chitieu_account: account,
      mod_chitieu_note: note.trim() || undefined,
      mod_chitieu_beneficiary: beneficiary.trim() || undefined,
      mod_chitieu_event: event.trim() || undefined,
      mod_chitieu_store: store.trim() || undefined,
    };

    if (isEditing && editRecord) {
      updateRecord(editRecord.id, values);
    } else {
      addRecord('mod_chitieu', values, categoryId || undefined, moduleId !== 'mod_chitieu' ? moduleId : undefined);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><X size={22} className="text-gray-600" /></button>
        <h2 className="text-base font-semibold text-gray-900">{isEditing ? 'Sửa giao dịch' : 'Thêm chi tiêu'}</h2>
        <button onClick={handleSave} disabled={!title.trim() || !amount}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-40"
          style={{ backgroundColor: '#004DEB' }}>Lưu</button>
      </header>

      {/* Form */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button onClick={() => setType('0')} className={`flex-1 py-3 rounded-xl text-sm font-semibold ${type === '0' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>↓ Chi</button>
          <button onClick={() => setType('1')} className={`flex-1 py-3 rounded-xl text-sm font-semibold ${type === '1' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>↑ Thu</button>
        </div>

        {/* Title */}
        <FormField label="Tên giao dịch *">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tên giao dịch" className="form-input" />
        </FormField>

        {/* Amount */}
        <FormField label="Số tiền *">
          <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="form-input text-lg font-bold" />
        </FormField>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Ngày" icon={<Calendar size={13} />}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input text-sm" />
          </FormField>
          <FormField label="Giờ" icon={<Clock size={13} />}>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="form-input text-sm" />
          </FormField>
        </div>

        {/* Category */}
        <FormField label="Danh mục" icon={<Tag size={13} />}>
          <button onClick={() => setShowCatPicker(true)} className="form-input flex items-center justify-between text-left">
            <span className={categoryId ? 'text-gray-900' : 'text-gray-400'}>{selectedCatName}</span><ChevronDown size={16} className="text-gray-400" />
          </button>
        </FormField>

        {/* Account */}
        <FormField label="Tài khoản" icon={<Wallet size={13} />}>
          <button onClick={() => setShowAccPicker(true)} className="form-input flex items-center justify-between text-left">
            <span className="text-gray-900">{selectedAccName}</span><ChevronDown size={16} className="text-gray-400" />
          </button>
        </FormField>

        {/* Module */}
        <FormField label="Module" icon={<Layers size={13} />}>
          <button onClick={() => setShowModPicker(true)} className="form-input flex items-center justify-between text-left">
            <span className="text-gray-900">{selectedModName}</span><ChevronDown size={16} className="text-gray-400" />
          </button>
        </FormField>

        {/* Note */}
        <FormField label="Ghi chú" icon={<FileText size={13} />}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." rows={2} className="form-input resize-none" />
        </FormField>

        {/* Expanded fields */}
        {!showMore && (
          <button onClick={() => setShowMore(true)} className="text-xs font-medium" style={{ color: '#004DEB' }}>+ Thêm thông tin (Người nhận, Sự kiện, Cửa hàng...)</button>
        )}
        {showMore && (
          <>
            <FormField label="Người nhận" icon={<User size={13} />}>
              <input type="text" value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="Người nhận" className="form-input" />
            </FormField>
            <FormField label="Sự kiện" icon={<Calendar size={13} />}>
              <input type="text" value={event} onChange={e => setEvent(e.target.value)} placeholder="Sự kiện" className="form-input" />
            </FormField>
            <FormField label="Cửa hàng" icon={<ShoppingBag size={13} />}>
              <input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="Cửa hàng" className="form-input" />
            </FormField>
          </>
        )}

        {/* Image — limitation notice */}
        <p className="text-[10px] text-gray-400">📷 Đính kèm ảnh/hóa đơn chưa hỗ trợ trên Web</p>
      </div>

      {/* Pickers */}
      {showCatPicker && <BottomSheet title="Chọn danh mục" onClose={() => setShowCatPicker(false)}>
        <PickerItem label="Không chọn" selected={!categoryId} onTap={() => { setCategoryId(''); setShowCatPicker(false); }} />
        {categories.map(c => <PickerItem key={c.id} label={c.name} selected={categoryId === c.id} onTap={() => { setCategoryId(c.id); setShowCatPicker(false); }} />)}
      </BottomSheet>}
      {showAccPicker && <BottomSheet title="Phương thức thanh toán" onClose={() => setShowAccPicker(false)}>
        {accounts.map(o => <PickerItem key={o.id} label={o.label} selected={account === o.value} onTap={() => { setAccount(o.value); setShowAccPicker(false); }} />)}
      </BottomSheet>}
      {showModPicker && <BottomSheet title="Chọn module" onClose={() => setShowModPicker(false)}>
        {modules.map(m => <PickerItem key={m.id} label={m.name} selected={moduleId === m.id} onTap={() => { setModuleId(m.id); setShowModPicker(false); }} />)}
      </BottomSheet>}
    </div>
  );
}

function FormField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">{icon}{label}</label>
      {children}
    </div>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

function PickerItem({ label, selected, onTap }: { label: string; selected: boolean; onTap: () => void }) {
  return (
    <button onClick={onTap} className={`w-full px-4 py-3 text-left text-sm border-b border-gray-50 active:bg-gray-50 ${selected ? 'text-[#004DEB] font-semibold bg-blue-50' : 'text-gray-900'}`}>{label}</button>
  );
}
