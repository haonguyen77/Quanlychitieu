import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, Plus, Trash2, Edit, X, Play, Pause } from 'lucide-react';
import { formatMoney } from './mobileDataMapper';
import { showConfirm } from './mobileDialog';
import { v4 as uuidv4 } from 'uuid';
import type { RecurringTransaction, RecordValues } from '@/types';

export function RecurringMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<0 | 1>(0);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().slice(0, 10));

  const recurring = data?.recurringTransactions || [];

  const resetForm = () => { setShowForm(false); setEditId(null); setTitle(''); setAmount(''); setType(0); setFrequency('monthly'); setNextRunDate(new Date().toISOString().slice(0, 10)); };

  const handleSave = () => {
    if (!data || !title.trim()) return;
    const amt = Number(amount.replace(/\D/g, '')) || 0;
    const now = new Date().toISOString();
    const values: RecordValues = { mod_chitieu_title: title.trim(), mod_chitieu_amount: amt, mod_chitieu_type: String(type), mod_chitieu_date: nextRunDate };

    let updated: RecurringTransaction[];
    if (editId) {
      updated = recurring.map(r => r.id === editId ? { ...r, values, frequency, nextRunDate, createdAt: r.createdAt } : r);
    } else {
      updated = [...recurring, { id: uuidv4(), moduleId: 'mod_chitieu', values, frequency, nextRunDate, isActive: true, createdAt: now }];
    }
    useAppStore.getState().setData({ ...data, recurringTransactions: updated, lastModified: now });
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!data) return;
    const ok = await showConfirm({ title: 'Xóa giao dịch định kỳ?', confirmLabel: 'Xóa', danger: true });
    if (!ok) return;
    useAppStore.getState().setData({ ...data, recurringTransactions: recurring.filter(r => r.id !== id), lastModified: new Date().toISOString() });
  };

  const handleToggle = (id: string) => {
    if (!data) return;
    useAppStore.getState().setData({ ...data, recurringTransactions: recurring.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r), lastModified: new Date().toISOString() });
  };

  const handleEdit = (r: RecurringTransaction) => {
    setEditId(r.id);
    const t = Object.entries(r.values).find(([k]) => k.endsWith('_title'));
    const a = Object.entries(r.values).find(([k]) => k.endsWith('_amount'));
    const tp = Object.entries(r.values).find(([k]) => k.endsWith('_type'));
    setTitle(t ? String(t[1] ?? '') : '');
    setAmount(a ? String(Math.abs(Number(a[1]) || 0)) : '');
    setType(tp && String(tp[1]) === '1' ? 1 : 0);
    setFrequency(r.frequency);
    setNextRunDate(r.nextRunDate);
    setShowForm(true);
  };

  const freqLabel = (f: string) => ({ daily: 'Hàng ngày', weekly: 'Hàng tuần', monthly: 'Hàng tháng', yearly: 'Hàng năm' }[f] || f);

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Giao dịch định kỳ</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-blue-50"><Plus size={20} color="#1264F5" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {showForm && (
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm font-semibold">{editId ? 'Sửa' : 'Thêm'}</h4><button onClick={resetForm}><X size={18} color="#666" /></button></div>
            {/* Chi/Thu toggle (Android: SegmentedButton) */}
            <div className="flex gap-2">
              <button onClick={() => setType(0)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${type === 0 ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'}`}>Chi</button>
              <button onClick={() => setType(1)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${type === 1 ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500'}`}>Thu</button>
            </div>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên giao dịch" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Số tiền" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <div>
              <label className="text-xs text-gray-500">Tần suất</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as typeof frequency)} className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="yearly">Hàng năm</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Ngày tiếp theo</label>
              <input type="date" value={nextRunDate} onChange={e => setNextRunDate(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">Hủy</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Lưu</button>
            </div>
          </div>
        )}

        {recurring.length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-400"><p className="text-sm">Chưa có giao dịch định kỳ</p></div>
        )}

        {recurring.map(r => {
          const t = Object.entries(r.values).find(([k]) => k.endsWith('_title'));
          const a = Object.entries(r.values).find(([k]) => k.endsWith('_amount'));
          const rTitle = t ? String(t[1] ?? '') : '—';
          const rAmount = a ? Math.abs(Number(a[1]) || 0) : 0;
          return (
            <div key={r.id} className={`flex items-center gap-3 p-3 border rounded-xl ${r.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{rTitle}</p>
                <p className="text-[11px] text-gray-500">{freqLabel(r.frequency)} • Tiếp: {r.nextRunDate.split('-').reverse().join('/')}</p>
              </div>
              <span className="text-sm font-semibold text-red-600">{formatMoney(rAmount)}</span>
              <button onClick={() => handleToggle(r.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-gray-100">
                {r.isActive ? <Pause size={14} color="#666" /> : <Play size={14} color="#22C55E" />}
              </button>
              <button onClick={() => handleEdit(r)} className="w-7 h-7 rounded flex items-center justify-center active:bg-gray-100"><Edit size={14} color="#666" /></button>
              <button onClick={() => handleDelete(r.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={14} color="#EF4444" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
