import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { X, Calendar, Tag, Wallet, Layers, FileText, ChevronDown } from 'lucide-react';

interface Props {
  onClose: () => void;
}

/**
 * Mobile Add Expense — Fullscreen form with category + module pickers.
 * Design reference: Android App "Thêm chi tiêu" screen.
 */
export function AddExpenseMobile({ onClose }: Props) {
  const { data } = useAppStore();
  const { addRecord } = useRecordStore();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'0' | '1'>('0');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('cash');
  const [categoryId, setCategoryId] = useState('');
  const [moduleId, setModuleId] = useState('mod_chitieu');
  const [note, setNote] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showModulePicker, setShowModulePicker] = useState(false);

  const handleSave = () => {
    if (!title.trim() || !amount) return;

    const values: Record<string, unknown> = {
      mod_chitieu_title: title.trim(),
      mod_chitieu_amount: Number(amount.replace(/\./g, '').replace(/,/g, '')),
      mod_chitieu_type: type,
      mod_chitieu_date: date,
      mod_chitieu_account: account,
      mod_chitieu_note: note.trim(),
    };

    addRecord('mod_chitieu', values, categoryId || undefined, moduleId !== 'mod_chitieu' ? moduleId : undefined);
    onClose();
  };

  const accounts = data?.modules.find(m => m.id === 'mod_chitieu')?.fields.find(f => f.fieldName === 'account')?.options || [];
  const categories = data?.modules.find(m => m.id === 'mod_chitieu')?.categories || [];
  const modules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];

  const selectedCategoryName = categories.find(c => c.id === categoryId)?.name || 'Chọn danh mục';
  const selectedModuleName = modules.find(m => m.id === moduleId)?.name || 'Chi tiêu';

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 safe-area-top">
        <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100">
          <X size={22} className="text-gray-600" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Thêm chi tiêu</h2>
        <button
          onClick={handleSave}
          disabled={!title.trim() || !amount}
          className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform"
        >
          Lưu
        </button>
      </header>

      {/* Form */}
      <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button onClick={() => setType('0')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${type === '0' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>Chi</button>
          <button onClick={() => setType('1')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${type === '1' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>Thu</button>
        </div>

        {/* Title */}
        <Field label="Tên giao dịch *">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tên giao dịch" className="input-mobile" />
        </Field>

        {/* Amount */}
        <Field label="Số tiền *">
          <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="input-mobile text-lg font-bold" />
        </Field>

        {/* Date */}
        <Field label="Ngày" icon={<Calendar size={14} />}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-mobile" />
        </Field>

        {/* Category Picker */}
        <Field label="Danh mục" icon={<Tag size={14} />}>
          <button onClick={() => setShowCategoryPicker(true)} className="input-mobile flex items-center justify-between text-left">
            <span className={categoryId ? 'text-gray-900' : 'text-gray-400'}>{selectedCategoryName}</span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
        </Field>

        {/* Module Picker */}
        <Field label="Module" icon={<Layers size={14} />}>
          <button onClick={() => setShowModulePicker(true)} className="input-mobile flex items-center justify-between text-left">
            <span className="text-gray-900">{selectedModuleName}</span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
        </Field>

        {/* Account */}
        <Field label="Tài khoản" icon={<Wallet size={14} />}>
          <select value={account} onChange={e => setAccount(e.target.value)} className="input-mobile bg-white">
            {accounts.map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
          </select>
        </Field>

        {/* Note */}
        <Field label="Ghi chú" icon={<FileText size={14} />}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." rows={2} className="input-mobile resize-none" />
        </Field>
      </div>

      {/* Category Bottom Sheet */}
      {showCategoryPicker && (
        <BottomSheet title="Chọn danh mục" onClose={() => setShowCategoryPicker(false)}>
          <button onClick={() => { setCategoryId(''); setShowCategoryPicker(false); }} className={`w-full px-4 py-3 text-left text-sm ${!categoryId ? 'text-primary-500 font-semibold' : 'text-gray-600'}`}>
            Không chọn
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setCategoryId(cat.id); setShowCategoryPicker(false); }}
              className={`w-full px-4 py-3 text-left text-sm border-t border-gray-50 ${categoryId === cat.id ? 'text-primary-500 font-semibold bg-primary-50' : 'text-gray-900 active:bg-gray-50'}`}>
              {cat.name}
            </button>
          ))}
        </BottomSheet>
      )}

      {/* Module Bottom Sheet */}
      {showModulePicker && (
        <BottomSheet title="Chọn module" onClose={() => setShowModulePicker(false)}>
          {modules.map(m => (
            <button key={m.id} onClick={() => { setModuleId(m.id); setShowModulePicker(false); }}
              className={`w-full px-4 py-3 text-left text-sm border-t border-gray-50 ${moduleId === m.id ? 'text-primary-500 font-semibold bg-primary-50' : 'text-gray-900 active:bg-gray-50'}`}>
              {m.name}
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
        {icon}{label}
      </label>
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
