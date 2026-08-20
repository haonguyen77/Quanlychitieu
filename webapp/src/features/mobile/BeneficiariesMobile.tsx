import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { showConfirm } from './mobileDialog';
import { ArrowLeft, Plus, Edit, Trash2, User } from 'lucide-react';

/**
 * BeneficiariesMobile — Beneficiary management based on Android beneficiaries_screen.dart.
 * Extracts unique beneficiaries from transaction records + allows CRUD.
 * Stored in module field options (mod_chitieu → beneficiary field).
 */
export function BeneficiariesMobile() {
  const { pop } = useMobileNav();
  const { data, setData } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [newName, setNewName] = useState('');

  // Beneficiaries from module field options
  const beneficiaries = useMemo(() => {
    const mod = data?.modules.find(m => m.id === 'mod_chitieu');
    const field = mod?.fields.find(f => f.fieldName === 'beneficiary');
    return field?.options || [];
  }, [data]);

  const save = () => {
    if (!newName.trim() || !data) return;
    const now = new Date().toISOString();
    const updatedModules = data.modules.map(m => {
      if (m.id !== 'mod_chitieu') return m;
      return { ...m, fields: m.fields.map(f => {
        if (f.fieldName !== 'beneficiary') return f;
        const opts = [...(f.options || [])];
        if (editIdx !== null) {
          opts[editIdx] = { ...opts[editIdx], label: newName.trim(), value: newName.trim().toLowerCase() };
        } else {
          opts.push({ id: `ben_${Date.now()}`, label: newName.trim(), value: newName.trim().toLowerCase(), sortOrder: opts.length, isActive: true });
        }
        return { ...f, options: opts };
      }) };
    });
    setData({ ...data, modules: updatedModules, lastModified: now });
    setNewName(''); setShowAdd(false); setEditIdx(null);
  };

  const remove = async (idx: number) => {
    if (!data) return;
    const ok = await showConfirm({ title: 'Xóa người nhận?', confirmLabel: 'Xóa', danger: true });
    if (!ok) return;
    const updatedModules = data.modules.map(m => {
      if (m.id !== 'mod_chitieu') return m;
      return { ...m, fields: m.fields.map(f => {
        if (f.fieldName !== 'beneficiary') return f;
        const opts = [...(f.options || [])];
        opts.splice(idx, 1);
        return { ...f, options: opts };
      }) };
    });
    setData({ ...data, modules: updatedModules, lastModified: new Date().toISOString() });
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Người nhận</h2>
        <button onClick={() => { setShowAdd(true); setEditIdx(null); setNewName(''); }} className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><Plus size={18} className="text-purple-600" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {beneficiaries.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Chưa có người nhận</p>}
        {beneficiaries.map((b, i) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><User size={16} className="text-purple-500" /></div>
            <span className="flex-1 text-sm font-medium text-gray-900">{b.label}</span>
            <button onClick={() => { setEditIdx(i); setNewName(b.label); setShowAdd(true); }} className="w-8 h-8 flex items-center justify-center"><Edit size={15} className="text-gray-400" /></button>
            <button onClick={() => remove(i)} className="w-8 h-8 flex items-center justify-center"><Trash2 size={15} className="text-red-400" /></button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">{editIdx !== null ? 'Sửa người nhận' : 'Thêm người nhận'}</h3>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên người nhận" autoFocus className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={save} disabled={!newName.trim()} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-sm font-semibold text-white disabled:opacity-40">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
