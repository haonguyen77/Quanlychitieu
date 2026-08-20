import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { showConfirm, showAlert } from './mobileDialog';
import { ArrowLeft, Plus, Trash2, Edit, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { ModuleDefinition } from '@/types';

const ICON_OPTIONS = ['expense', 'shopee', 'gold', 'rent', 'card', 'other'];
const COLOR_OPTIONS = ['#F44336', '#FF5722', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0', '#1A237E', '#607D8B'];

export function ModuleManagementMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('other');
  const [color, setColor] = useState('#607D8B');
  const [description, setDescription] = useState('');

  const modules = data?.modules || [];

  const resetForm = () => { setShowForm(false); setEditId(null); setName(''); setIcon('other'); setColor('#607D8B'); setDescription(''); };

  const handleEdit = (m: ModuleDefinition) => {
    setEditId(m.id); setName(m.name); setIcon(m.icon); setColor(m.color); setDescription(m.description || ''); setShowForm(true);
  };

  const handleSave = () => {
    if (!data || !name.trim()) return;
    const now = new Date().toISOString();
    let updated: ModuleDefinition[];
    if (editId) {
      updated = modules.map(m => m.id === editId ? { ...m, name: name.trim(), icon, color, description: description.trim(), updatedAt: now } : m);
    } else {
      const newMod: ModuleDefinition = {
        id: `mod_${uuidv4().slice(0, 8)}`, name: name.trim(), icon, color, description: description.trim(),
        sortOrder: modules.length, isDefault: false, isActive: true, isVisible: true,
        fields: [], categories: [], createdAt: now, updatedAt: now,
      };
      updated = [...modules, newMod];
    }
    useAppStore.getState().setData({ ...data, modules: updated, lastModified: now });
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!data) return;
    const mod = modules.find(m => m.id === id);
    if (mod?.isDefault) { await showAlert({ title: 'Không thể xóa', message: 'Đây là module mặc định.' }); return; }
    const ok = await showConfirm({ title: 'Xóa module?', message: `Xóa module "${mod?.name}"?`, confirmLabel: 'Xóa', danger: true });
    if (!ok) return;
    useAppStore.getState().setData({ ...data, modules: modules.filter(m => m.id !== id), lastModified: new Date().toISOString() });
  };

  const handleToggle = (id: string) => {
    if (!data) return;
    const now = new Date().toISOString();
    useAppStore.getState().setData({ ...data, modules: modules.map(m => m.id === id ? { ...m, isActive: !m.isActive, updatedAt: now } : m), lastModified: now });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Quản lý Module</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-blue-50"><Plus size={20} color="#1264F5" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {showForm && (
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">{editId ? 'Sửa module' : 'Thêm module'}</h4>
              <button onClick={resetForm}><X size={18} color="#666" /></button>
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tên module" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả (tùy chọn)" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <div>
              <label className="text-xs text-gray-500">Icon</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {ICON_OPTIONS.map(i => (
                  <button key={i} onClick={() => setIcon(i)} className={`px-3 py-1.5 rounded-lg text-xs border ${icon === i ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>{i}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Màu</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-lg border-2" style={{ backgroundColor: c, borderColor: color === c ? '#000' : 'transparent' }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">Hủy</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Lưu</button>
            </div>
          </div>
        )}

        {modules.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}20` }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: m.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{m.name}</p>
              {m.description && <p className="text-[10px] text-gray-500 truncate">{m.description}</p>}
              <p className="text-[10px] text-gray-400">{m.isDefault ? 'Mặc định' : 'Tùy chỉnh'} • {m.icon}</p>
            </div>
            <button onClick={() => handleToggle(m.id)} className={`w-10 h-5 rounded-full relative ${m.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${m.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
            <button onClick={() => handleEdit(m)} className="w-8 h-8 flex items-center justify-center active:bg-gray-100 rounded"><Edit size={14} color="#666" /></button>
            {!m.isDefault && <button onClick={() => handleDelete(m.id)} className="w-8 h-8 flex items-center justify-center active:bg-red-50 rounded"><Trash2 size={14} color="#EF4444" /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}
