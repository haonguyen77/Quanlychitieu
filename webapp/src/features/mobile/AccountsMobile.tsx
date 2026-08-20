import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { showConfirm } from './mobileDialog';
import { ArrowLeft, Plus, Edit, Trash2, Wallet } from 'lucide-react';

/**
 * AccountsMobile — Payment methods management based on Android accounts_screen.dart.
 * CRUD for accounts. Data from data.accounts.
 */
export function AccountsMobile() {
  const { pop } = useMobileNav();
  const { data, setData } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');

  const accounts = data?.accounts || [];
  const totalBalance = accounts.filter(a => a.isActive && a.includeInTotal).reduce((s, a) => s + (a.currentBalance || 0), 0);
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + '₫';

  const save = () => {
    if (!name.trim() || !data) return;
    const now = new Date().toISOString();
    const bal = Number(balance.replace(/\D/g, '')) || 0;
    if (editId) {
      const updated = data.accounts.map(a => a.id === editId ? { ...a, name: name.trim(), currentBalance: bal, updatedAt: now } : a);
      setData({ ...data, accounts: updated, lastModified: now });
    } else {
      const id = `acc_${Date.now()}`;
      const newAcc = { id, name: name.trim(), icon: 'wallet', color: '#2196F3', initialBalance: bal, currentBalance: bal, includeInTotal: true, isActive: true, sortOrder: accounts.length, createdAt: now, updatedAt: now };
      setData({ ...data, accounts: [...data.accounts, newAcc], lastModified: now });
    }
    setName(''); setBalance(''); setShowAdd(false); setEditId(null);
  };

  const remove = async (id: string) => {
    if (!data) return;
    const ok = await showConfirm({ title: 'Xóa tài khoản?', confirmLabel: 'Xóa', danger: true });
    if (!ok) return;
    setData({ ...data, accounts: data.accounts.filter(a => a.id !== id), lastModified: new Date().toISOString() });
  };

  const startEdit = (acc: typeof accounts[0]) => {
    setEditId(acc.id); setName(acc.name); setBalance(String(acc.currentBalance || 0)); setShowAdd(true);
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Phương thức thanh toán</h2>
        <button onClick={() => { setShowAdd(true); setEditId(null); setName(''); setBalance(''); }} className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Plus size={18} className="text-blue-600" /></button>
      </header>

      {/* Total */}
      <div className="mx-4 mt-3 p-4 rounded-2xl text-center text-white" style={{ background: 'linear-gradient(135deg, #6C2BD9, #9B59B6)' }}>
        <p className="text-xs opacity-80">Tổng tài sản</p>
        <p className="text-2xl font-bold mt-1">{fmtMoney(totalBalance)}</p>
        <p className="text-[10px] opacity-70 mt-1">{accounts.filter(a => a.isActive).length} tài khoản</p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {accounts.filter(a => a.isActive).map(acc => (
          <div key={acc.id} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Wallet size={18} className="text-blue-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{acc.name}</p>
              <p className={`text-xs font-semibold ${(acc.currentBalance || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtMoney(acc.currentBalance || 0)}</p>
            </div>
            <button onClick={() => startEdit(acc)} className="w-8 h-8 flex items-center justify-center"><Edit size={15} className="text-gray-400" /></button>
            <button onClick={() => remove(acc.id)} className="w-8 h-8 flex items-center justify-center"><Trash2 size={15} className="text-red-400" /></button>
          </div>
        ))}
      </div>

      {/* Add/Edit */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">{editId ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h3>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tên tài khoản" autoFocus className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 mb-3" />
            <input type="text" inputMode="numeric" value={balance} onChange={e => setBalance(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Số dư" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={save} disabled={!name.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-40">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
