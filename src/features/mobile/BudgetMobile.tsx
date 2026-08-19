import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { getCategoryDisplay, formatMoney, getRecordField } from './mobileDataMapper';
import { v4 as uuidv4 } from 'uuid';
import type { Budget } from '@/types';

export function BudgetMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');

  const budgets = data?.budgets || [];
  const categories = data?.modules.find(m => m.id === 'mod_chitieu')?.categories?.filter(c => c.isActive) || [];

  // Calculate spent per category this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const getSpent = (categoryId: string) => {
    if (!data) return 0;
    return data.records.filter(r => {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu' || r.categoryId !== categoryId) return false;
      const d = getRecordField(r, 'date');
      const type = getRecordField(r, 'type');
      return d >= monthStart && d <= monthEnd && type === '0';
    }).reduce((s, r) => s + Math.abs(Number(getRecordField(r, 'amount')) || 0), 0);
  };

  const handleSave = () => {
    if (!data || !selectedCatId || !limitAmount) return;
    const limit = Number(limitAmount.replace(/\D/g, '')) || 0;
    if (limit <= 0) return;

    let updatedBudgets: Budget[];
    if (editId) {
      updatedBudgets = budgets.map(b => b.id === editId ? { ...b, categoryId: selectedCatId, monthlyLimit: limit, isActive: true } : b);
    } else {
      updatedBudgets = [...budgets, { id: uuidv4(), categoryId: selectedCatId, monthlyLimit: limit, isActive: true }];
    }
    useAppStore.getState().setData({ ...data, budgets: updatedBudgets, lastModified: new Date().toISOString() });
    setShowAdd(false); setEditId(null); setSelectedCatId(''); setLimitAmount('');
  };

  const handleDelete = (id: string) => {
    if (!data || !confirm('Xóa ngân sách này?')) return;
    useAppStore.getState().setData({ ...data, budgets: budgets.filter(b => b.id !== id), lastModified: new Date().toISOString() });
  };

  const handleEdit = (b: Budget) => {
    setEditId(b.id); setSelectedCatId(b.categoryId); setLimitAmount(String(b.monthlyLimit)); setShowAdd(true);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Ngân sách</h2>
        <button onClick={() => { setShowAdd(true); setEditId(null); setSelectedCatId(''); setLimitAmount(''); }} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-blue-50"><Plus size={20} color="#1264F5" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {budgets.length === 0 && !showAdd && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Chưa có ngân sách</p>
            <p className="text-xs mt-1">Nhấn + để thêm ngân sách mới</p>
          </div>
        )}

        {/* Add/Edit form */}
        {showAdd && (
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
            <h4 className="text-sm font-semibold">{editId ? 'Sửa ngân sách' : 'Thêm ngân sách'}</h4>
            <div>
              <label className="text-xs text-gray-600">Danh mục</label>
              <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Chọn danh mục</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Hạn mức / tháng (₫)</label>
              <input type="text" inputMode="numeric" value={limitAmount} onChange={e => setLimitAmount(e.target.value.replace(/\D/g, ''))} placeholder="VD: 5000000"
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Hủy</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Lưu</button>
            </div>
          </div>
        )}

        {/* Budget list */}
        {budgets.map(b => {
          const catInfo = getCategoryDisplay(b.categoryId, data);
          const spent = getSpent(b.categoryId);
          const pct = b.monthlyLimit > 0 ? Math.min((spent / b.monthlyLimit) * 100, 100) : 0;
          const isOver = spent > b.monthlyLimit;
          return (
            <div key={b.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catInfo.bgColor }}>
                    <span className="text-xs">{catInfo.label.slice(0, 2)}</span>
                  </div>
                  <span className="text-sm font-medium">{catInfo.label}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(b)} className="w-7 h-7 rounded flex items-center justify-center active:bg-gray-100"><Edit size={14} color="#666" /></button>
                  <button onClick={() => handleDelete(b.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={14} color="#EF4444" /></button>
                </div>
              </div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className={isOver ? 'text-red-500 font-medium' : 'text-gray-600'}>{formatMoney(spent)}</span>
                <span className="text-gray-500">/ {formatMoney(b.monthlyLimit)}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isOver ? '#EF4444' : pct > 80 ? '#F59E0B' : '#22C55E' }} />
              </div>
              {isOver && <p className="text-[10px] text-red-500 mt-1">⚠️ Vượt ngân sách {formatMoney(spent - b.monthlyLimit)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
