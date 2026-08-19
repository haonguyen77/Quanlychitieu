import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import type { FieldDefinition } from '@/types';

// Color palette for auto-assignment (no duplicates within same list)
const COLOR_PALETTE = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#009688', '#FF5722', '#3F51B5', '#E91E63', '#00BCD4',
  '#8BC34A', '#FFC107', '#673AB7', '#795548', '#607D8B',
  '#CDDC39', '#03A9F4', '#FF4081', '#00E676', '#651FFF',
];

/**
 * Shared Config Section: CRUD for Tài khoản, Danh mục, Người nhận
 * These are dropdown options shared across all modules (Chi tiêu, Shopee, etc.)
 */
export function SharedConfigSection() {
  const { data, setData } = useAppStore();
  const [activeTab, setActiveTab] = useState<'account' | 'category' | 'beneficiary'>('account');
  const [editingItem, setEditingItem] = useState<{ idx: number; label: string; value: string; color?: string } | null>(null);
  const [newLabel, setNewLabel] = useState('');

  if (!data) return null;

  // Find Chi tiêu module (source of truth for shared fields)
  const chiTieu = data.modules.find((m) => m.id === 'mod_chitieu');
  if (!chiTieu) return null;

  const getField = (fieldName: string): FieldDefinition | undefined =>
    chiTieu.fields.find((f) => f.fieldName === fieldName);

  const accountField = getField('account');
  const beneficiaryField = getField('beneficiary');
  const categories = chiTieu.categories || [];

  const getOptions = () => {
    if (activeTab === 'account') return accountField?.options?.filter((o) => o.isActive) || [];
    if (activeTab === 'beneficiary') return beneficiaryField?.options?.filter((o) => o.isActive) || [];
    return [];
  };

  const addOption = () => {
    if (!newLabel.trim()) return;
    const field = activeTab === 'account' ? accountField : beneficiaryField;
    if (!field || !field.options) return;

    const id = `${field.fieldName}_${Date.now()}`;
    const value = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
    // Auto-assign unique color from palette
    const usedColors = new Set(field.options.map((o) => o.color));
    const nextColor = COLOR_PALETTE.find((c) => !usedColors.has(c)) || COLOR_PALETTE[field.options.length % COLOR_PALETTE.length];
    const newOpt = { id, label: newLabel.trim(), value, color: nextColor, sortOrder: field.options.length, isActive: true };
    
    const updatedField = { ...field, options: [...field.options, newOpt] };
    const updatedFields = chiTieu.fields.map((f) => f.id === field.id ? updatedField : f);
    
    // Update all modules that share this field
    const now = new Date().toISOString();
    const updatedModules = data.modules.map((m) => {
      const mField = m.fields.find((f) => f.fieldName === field.fieldName);
      if (mField && mField.options) {
        const mUpdated = { ...mField, options: [...mField.options, newOpt] };
        return { ...m, fields: m.fields.map((f) => f.fieldName === field.fieldName ? mUpdated : f) };
      }
      if (m.id === 'mod_chitieu') return { ...m, fields: updatedFields };
      return m;
    });

    setData({ ...data, modules: updatedModules, lastModified: now });
    setNewLabel('');
  };

  const removeOption = (value: string) => {
    const field = activeTab === 'account' ? accountField : beneficiaryField;
    if (!field || !field.options) return;

    const now = new Date().toISOString();
    const updatedModules = data.modules.map((m) => {
      const mField = m.fields.find((f) => f.fieldName === field.fieldName);
      if (mField && mField.options) {
        return { ...m, fields: m.fields.map((f) => f.fieldName === field.fieldName ? { ...f, options: f.options?.filter((o) => o.value !== value) } : f) };
      }
      return m;
    });
    setData({ ...data, modules: updatedModules, lastModified: now });
  };

  const addCategory = () => {
    if (!newLabel.trim()) return;
    const now = new Date().toISOString();
    // Auto-assign unique color
    const usedColors = new Set(categories.map((c) => c.color));
    const nextColor = COLOR_PALETTE.find((c) => !usedColors.has(c)) || COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
    const newCat = {
      id: `cat_${Date.now()}`,
      moduleId: 'mod_chitieu',
      name: newLabel.trim(),
      icon: 'tag',
      color: nextColor,
      sortOrder: categories.length,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const updatedModule = { ...chiTieu, categories: [...categories, newCat] };
    setData({ ...data, modules: data.modules.map((m) => m.id === 'mod_chitieu' ? updatedModule : m), lastModified: now });
    setNewLabel('');
  };

  const saveEditCategory = (catId: string, newName: string) => {
    if (!newName.trim()) { setEditingItem(null); return; }
    const now = new Date().toISOString();
    const updatedCats = categories.map((c) => c.id === catId ? { ...c, name: newName.trim(), updatedAt: now } : c);
    const updatedModule = { ...chiTieu, categories: updatedCats };
    setData({ ...data, modules: data.modules.map((m) => m.id === 'mod_chitieu' ? updatedModule : m), lastModified: now });
    setEditingItem(null);
  };

  const saveEditOption = (optValue: string, newLabel: string) => {
    if (!newLabel.trim()) { setEditingItem(null); return; }
    const field = activeTab === 'account' ? accountField : beneficiaryField;
    if (!field || !field.options) { setEditingItem(null); return; }
    const now = new Date().toISOString();
    const updatedModules = data.modules.map((m) => {
      const mField = m.fields.find((f) => f.fieldName === field.fieldName);
      if (mField && mField.options) {
        return { ...m, fields: m.fields.map((f) => f.fieldName === field.fieldName ? { ...f, options: f.options?.map((o) => o.value === optValue ? { ...o, label: newLabel.trim() } : o) } : f) };
      }
      return m;
    });
    setData({ ...data, modules: updatedModules, lastModified: now });
    setEditingItem(null);
  };

  const removeCategory = (catId: string) => {
    const now = new Date().toISOString();
    const updatedCats = categories.filter((c) => c.id !== catId);
    const updatedModule = { ...chiTieu, categories: updatedCats };
    setData({ ...data, modules: data.modules.map((m) => m.id === 'mod_chitieu' ? updatedModule : m), lastModified: now });
  };

  const tabs = [
    { key: 'account' as const, label: 'Tài khoản', icon: 'wallet' },
    { key: 'category' as const, label: 'Danh mục', icon: 'tag' },
    { key: 'beneficiary' as const, label: 'Người nhận', icon: 'user' },
  ];

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Danh mục dùng chung</h2>
      
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <Icon name={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'category' ? (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)]">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#607D8B' }} />
              {editingItem?.idx === categories.indexOf(cat) ? (
                <input type="text" value={editingItem.label} onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { saveEditCategory(cat.id, editingItem.label); } if (e.key === 'Escape') setEditingItem(null); }}
                  onBlur={() => saveEditCategory(cat.id, editingItem.label)}
                  className="input-field text-sm py-0.5 flex-1" autoFocus />
              ) : (
                <span className="text-sm flex-1">{cat.name}</span>
              )}
              <button onClick={() => setEditingItem({ idx: categories.indexOf(cat), label: cat.name, value: cat.id })} className="p-1 text-gray-400 hover:text-blue-500"><Icon name="edit" size={13} /></button>
              <button onClick={() => removeCategory(cat.id)} className="p-1 text-gray-400 hover:text-red-500"><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="input-field text-sm py-1.5 flex-1" placeholder="Tên danh mục mới..." />
            <button onClick={addCategory} className="btn-primary text-xs px-3">Thêm</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {getOptions().map((opt, i) => (
            <div key={opt.id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)]">
              {opt.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />}
              {editingItem?.idx === i && editingItem.value === opt.value ? (
                <input type="text" value={editingItem.label} onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { saveEditOption(opt.value, editingItem.label); } if (e.key === 'Escape') setEditingItem(null); }}
                  onBlur={() => saveEditOption(opt.value, editingItem.label)}
                  className="input-field text-sm py-0.5 flex-1" autoFocus />
              ) : (
                <span className="text-sm flex-1">{opt.label}</span>
              )}
              <span className="text-[10px] text-gray-400">{opt.value}</span>
              <button onClick={() => setEditingItem({ idx: i, label: opt.label, value: opt.value })} className="p-1 text-gray-400 hover:text-blue-500"><Icon name="edit" size={13} /></button>
              <button onClick={() => removeOption(opt.value)} className="p-1 text-gray-400 hover:text-red-500"><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOption()}
              className="input-field text-sm py-1.5 flex-1" placeholder={`Thêm ${activeTab === 'account' ? 'tài khoản' : 'người nhận'}...`} />
            <button onClick={addOption} className="btn-primary text-xs px-3">Thêm</button>
          </div>
        </div>
      )}
    </section>
  );
}
