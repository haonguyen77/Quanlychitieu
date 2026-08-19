import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, Plus, Edit, Trash2, Tag } from 'lucide-react';

/**
 * CategoriesMobile — Category management based on Android categories_screen.dart.
 * List + Add + Edit + Delete. Data from data.modules[mod_chitieu].categories.
 */
export function CategoriesMobile() {
  const { pop } = useMobileNav();
  const { data, setData } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const categories = data?.modules.find(m => m.id === 'mod_chitieu')?.categories || [];

  const saveCategory = () => {
    if (!newName.trim() || !data) return;
    const id = editId || `cat_${Date.now()}`;
    const now = new Date().toISOString();
    const updatedModules = data.modules.map(m => {
      if (m.id !== 'mod_chitieu') return m;
      const existingCats = m.categories || [];
      if (editId) {
        return { ...m, categories: existingCats.map(c => c.id === editId ? { ...c, name: newName.trim(), updatedAt: now } : c) };
      } else {
        return { ...m, categories: [...existingCats, { id, moduleId: 'mod_chitieu', name: newName.trim(), icon: 'other', color: '#607D8B', sortOrder: existingCats.length, isActive: true, createdAt: now, updatedAt: now }] };
      }
    });
    setData({ ...data, modules: updatedModules, lastModified: now });
    setNewName(''); setShowAdd(false); setEditId(null);
  };

  const deleteCategory = (id: string) => {
    if (!data || !confirm('Xóa danh mục này?')) return;
    const updatedModules = data.modules.map(m => {
      if (m.id !== 'mod_chitieu') return m;
      return { ...m, categories: (m.categories || []).filter(c => c.id !== id) };
    });
    setData({ ...data, modules: updatedModules, lastModified: new Date().toISOString() });
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Danh mục</h2>
        <button onClick={() => { setShowAdd(true); setEditId(null); setNewName(''); }} className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Plus size={18} className="text-blue-600" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {categories.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Chưa có danh mục</p>}
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center"><Tag size={16} className="text-gray-500" /></div>
            <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
            <button onClick={() => { setEditId(cat.id); setNewName(cat.name); setShowAdd(true); }} className="w-8 h-8 flex items-center justify-center"><Edit size={15} className="text-gray-400" /></button>
            <button onClick={() => deleteCategory(cat.id)} className="w-8 h-8 flex items-center justify-center"><Trash2 size={15} className="text-red-400" /></button>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">{editId ? 'Sửa danh mục' : 'Thêm danh mục'}</h3>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên danh mục" autoFocus className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={saveCategory} disabled={!newName.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-40">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
