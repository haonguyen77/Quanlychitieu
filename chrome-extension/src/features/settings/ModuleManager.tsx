import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import { v4 as uuidv4 } from 'uuid';
import type { ModuleDefinition, FieldDefinition, CategoryDefinition } from '@/types';

type ManagerTab = 'modules' | 'fields' | 'categories' | 'menu';

export function ModuleManager({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, setData } = useAppStore();
  const [activeTab, setActiveTab] = useState<ManagerTab>('modules');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<Partial<ModuleDefinition> | null>(null);
  const [editingField, setEditingField] = useState<Partial<FieldDefinition> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<CategoryDefinition> | null>(null);

  if (!data) return null;

  const selectedModule = selectedModuleId ? data.modules.find((m) => m.id === selectedModuleId) : null;

  const tabs: { key: ManagerTab; label: string; icon: string }[] = [
    { key: 'modules', label: 'Modules', icon: 'box' },
    { key: 'fields', label: 'Fields', icon: 'columns' },
    { key: 'categories', label: 'Danh mục', icon: 'tag' },
    { key: 'menu', label: 'Menu & Cấu hình', icon: 'menu' },
  ];

  // ─── Module CRUD ──────────────────────────────────────────────
  const saveModule = (mod: Partial<ModuleDefinition>) => {
    const now = new Date().toISOString();
    if (mod.id && data.modules.find((m) => m.id === mod.id)) {
      // Update
      const modules = data.modules.map((m) => m.id === mod.id ? { ...m, ...mod, updatedAt: now } : m);
      setData({ ...data, modules, lastModified: now });
    } else {
      // Create — check duplicate name
      const trimmedName = (mod.name || 'Module mới').trim();
      if (data.modules.some(m => m.name.toLowerCase() === trimmedName.toLowerCase())) {
        if (!confirm(`Module "${trimmedName}" đã tồn tại. Vẫn tạo thêm?`)) {
          setEditingModule(null);
          return;
        }
      }
      const newModule: ModuleDefinition = {
        id: `mod_${uuidv4().slice(0, 8)}`,
        name: trimmedName,
        icon: mod.icon || 'box',
        color: mod.color || '#607D8B',
        description: mod.description || '',
        sortOrder: data.modules.length,
        isDefault: false,
        isActive: true,
        isVisible: true,
        fields: [],
        categories: [],
        createdAt: now,
        updatedAt: now,
      };
      // Auto-add menu item for the new module
      const newMenuItem = {
        id: `menu_${newModule.id}`,
        label: newModule.name,
        icon: newModule.icon,
        type: 'module' as const,
        targetId: newModule.id,
        sortOrder: data.menu.length > 0 ? Math.max(...data.menu.map(m => m.sortOrder)) + 1 : data.modules.length + 1,
        isVisible: true,
      };
      // Insert before settings/trash items
      const menuCopy = [...data.menu];
      const settingsIdx = menuCopy.findIndex(m => m.type === 'settings');
      if (settingsIdx >= 0) {
        menuCopy.splice(settingsIdx, 0, newMenuItem);
      } else {
        menuCopy.push(newMenuItem);
      }
      setData({ ...data, modules: [...data.modules, newModule], menu: menuCopy, lastModified: now });
    }
    setEditingModule(null);
  };

  const SYSTEM_MODULES = ['mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro', 'mod_creditcard', 'mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory'];

  const deleteModule = (moduleId: string) => {
    if (SYSTEM_MODULES.includes(moduleId)) {
      alert('Không thể xóa module hệ thống.');
      return;
    }
    if (!confirm('Xóa module này? Giao dịch Chi tiêu đã gắn module này sẽ vẫn còn.')) return;
    const now = new Date().toISOString();
    const modules = data.modules.filter((m) => m.id !== moduleId);
    const menu = data.menu.filter((m) => m.targetId !== moduleId);
    // Tombstone so the deletion propagates across devices (merge would otherwise
    // re-add the module from remote).
    const deletedModuleIds = [...(((data as unknown as { deletedModuleIds?: Array<{ id: string; deletedAt: string }> }).deletedModuleIds) || []).filter((t) => t.id !== moduleId), { id: moduleId, deletedAt: now }];
    // Do NOT delete or modify records — they belong to mod_chitieu
    setData({ ...data, modules, menu, deletedModuleIds, lastModified: now } as never);
  };

  // ─── Field CRUD ───────────────────────────────────────────────
  const saveField = (field: Partial<FieldDefinition>) => {
    if (!selectedModule) return;
    const now = new Date().toISOString();
    let fields: FieldDefinition[];
    if (field.id && selectedModule.fields.find((f) => f.id === field.id)) {
      fields = selectedModule.fields.map((f) => f.id === field.id ? { ...f, ...field, updatedAt: now } : f);
    } else {
      const newField: FieldDefinition = {
        id: `${selectedModule.id}_${field.fieldName || uuidv4().slice(0, 6)}`,
        moduleId: selectedModule.id,
        fieldName: field.fieldName || `field_${Date.now()}`,
        fieldLabel: field.fieldLabel || 'Field mới',
        fieldType: field.fieldType || 'text',
        sortOrder: selectedModule.fields.length,
        isRequired: field.isRequired || false,
        isVisible: true,
        isTableVisible: field.isTableVisible ?? true,
        options: field.options || undefined,
        createdAt: now,
        updatedAt: now,
      };
      fields = [...selectedModule.fields, newField];
    }
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, fields, updatedAt: now } : m);
    setData({ ...data, modules, lastModified: now });
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    if (!selectedModule || !confirm('Xóa field này?')) return;
    const fields = selectedModule.fields.filter((f) => f.id !== fieldId);
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, fields, updatedAt: new Date().toISOString() } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
  };

  // ─── Category CRUD ────────────────────────────────────────────
  const saveCategory = (cat: Partial<CategoryDefinition>) => {
    if (!selectedModule) return;
    const now = new Date().toISOString();
    let categories = selectedModule.categories || [];
    if (cat.id && categories.find((c) => c.id === cat.id)) {
      categories = categories.map((c) => c.id === cat.id ? { ...c, ...cat } : c);
    } else {
      const newCat: CategoryDefinition = {
        id: `cat_${uuidv4().slice(0, 8)}`,
        moduleId: selectedModule.id,
        name: cat.name || 'Danh mục mới',
        icon: cat.icon || 'tag',
        color: cat.color || '#607D8B',
        sortOrder: categories.length,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      categories = [...categories, newCat];
    }
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, categories, updatedAt: now } : m);
    setData({ ...data, modules, lastModified: now });
    setEditingCategory(null);
  };

  const deleteCategory = (catId: string) => {
    if (!selectedModule || !confirm('Xóa danh mục này?')) return;
    const categories = (selectedModule.categories || []).filter((c) => c.id !== catId);
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, categories, updatedAt: new Date().toISOString() } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
  };

  // ─── Reorder helpers ──────────────────────────────────────────
  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const sorted = [...data.modules].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((m, i) => { sorted[i] = { ...m, sortOrder: i }; });
    const idx = sorted.findIndex((m) => m.id === moduleId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx].sortOrder;
    sorted[idx] = { ...sorted[idx], sortOrder: sorted[swapIdx].sortOrder };
    sorted[swapIdx] = { ...sorted[swapIdx], sortOrder: tempOrder };
    setData({ ...data, modules: sorted, lastModified: new Date().toISOString() });
  };

  const toggleFieldVisibility = (fieldId: string) => {
    if (!selectedModule) return;
    const fields = selectedModule.fields.map((f) => f.id === fieldId ? { ...f, isTableVisible: !f.isTableVisible } : f);
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, fields, updatedAt: new Date().toISOString() } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
  };

  const toggleCompactVisibility = (fieldId: string) => {
    if (!selectedModule) return;
    const now = new Date().toISOString();
    const tableConfig = selectedModule.tableConfig || { columns: [], pageSize: 50 };
    const existingCol = tableConfig.columns.find((c) => c.fieldId === fieldId);
    let updatedColumns;
    if (existingCol) {
      updatedColumns = tableConfig.columns.map((c) => c.fieldId === fieldId ? { ...c, isCompactVisible: !c.isCompactVisible } : c);
    } else {
      updatedColumns = [...tableConfig.columns, { fieldId, isVisible: true, isCompactVisible: true, sortOrder: tableConfig.columns.length }];
    }
    const updatedConfig = { ...tableConfig, columns: updatedColumns };
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, tableConfig: updatedConfig, updatedAt: now } : m);
    setData({ ...data, modules, lastModified: now });
  };

  const isCompactVisible = (fieldId: string): boolean => {
    if (!selectedModule?.tableConfig?.columns) return false;
    const col = selectedModule.tableConfig.columns.find((c) => c.fieldId === fieldId);
    return col?.isCompactVisible ?? false;
  };

  const moveFieldOrColumn = (itemId: string, direction: 'up' | 'down') => {
    if (!selectedModule) return;
    
    // Build combined list of real fields + virtual columns
    const realFields = [...selectedModule.fields].sort((a, b) => a.sortOrder - b.sortOrder);
    const tableConfig = selectedModule.tableConfig;
    
    const virtualItems: Array<{ id: string; sortOrder: number }> = [];
    if ((selectedModule.categories?.length ?? 0) > 0) {
      const cfg = tableConfig?.columns?.find((c) => c.fieldId === '__category');
      virtualItems.push({ id: '__category', sortOrder: cfg?.sortOrder ?? 900 });
    }
    if (selectedModule.id === 'mod_chitieu') {
      const cfg = tableConfig?.columns?.find((c) => c.fieldId === '__module');
      virtualItems.push({ id: '__module', sortOrder: cfg?.sortOrder ?? 901 });
    }
    
    // Combined and re-indexed
    type ItemRef = { id: string; sortOrder: number; isField: boolean };
    const allItems: ItemRef[] = [
      ...realFields.map((f) => ({ id: f.id, sortOrder: f.sortOrder, isField: true })),
      ...virtualItems.map((v) => ({ id: v.id, sortOrder: v.sortOrder, isField: false })),
    ].sort((a, b) => a.sortOrder - b.sortOrder);
    allItems.forEach((item, i) => { item.sortOrder = i; });
    
    // Find and swap
    const idx = allItems.findIndex((item) => item.id === itemId);
    if (idx < 0) return;
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= allItems.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    const temp = allItems[idx].sortOrder;
    allItems[idx].sortOrder = allItems[swapIdx].sortOrder;
    allItems[swapIdx].sortOrder = temp;
    
    // Apply back: update real fields' sortOrder
    const updatedFields = realFields.map((f) => {
      const item = allItems.find((i) => i.id === f.id);
      return item ? { ...f, sortOrder: item.sortOrder } : f;
    });
    
    // Update tableConfig columns with new sortOrders for virtual columns
    const existingColumns = tableConfig?.columns || [];
    const updatedColumns = [...existingColumns];
    
    // Update or add virtual column entries
    for (const vi of virtualItems) {
      const item = allItems.find((i) => i.id === vi.id);
      const existingIdx = updatedColumns.findIndex((c) => c.fieldId === vi.id);
      if (existingIdx >= 0) {
        updatedColumns[existingIdx] = { ...updatedColumns[existingIdx], sortOrder: item?.sortOrder ?? vi.sortOrder };
      } else {
        updatedColumns.push({ fieldId: vi.id, isVisible: true, sortOrder: item?.sortOrder ?? vi.sortOrder });
      }
    }
    
    // Also update real field columns in tableConfig
    for (const f of updatedFields) {
      const existingIdx = updatedColumns.findIndex((c) => c.fieldId === f.id);
      if (existingIdx >= 0) {
        updatedColumns[existingIdx] = { ...updatedColumns[existingIdx], sortOrder: f.sortOrder };
      }
    }
    
    const newTableConfig = { ...(tableConfig || { columns: [], pageSize: 50 }), columns: updatedColumns };
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, fields: updatedFields, tableConfig: newTableConfig, updatedAt: new Date().toISOString() } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
  };

  const moveCategory = (catId: string, direction: 'up' | 'down') => {
    if (!selectedModule) return;
    const cats = [...(selectedModule.categories || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    cats.forEach((c, i) => { cats[i] = { ...c, sortOrder: i }; });
    const idx = cats.findIndex((c) => c.id === catId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= cats.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempOrder = cats[idx].sortOrder;
    cats[idx] = { ...cats[idx], sortOrder: cats[swapIdx].sortOrder };
    cats[swapIdx] = { ...cats[swapIdx], sortOrder: tempOrder };
    const modules = data.modules.map((m) => m.id === selectedModule.id ? { ...m, categories: cats, updatedAt: new Date().toISOString() } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
  };

  const moveMenuItem = (itemId: string, direction: 'up' | 'down') => {
    const sorted = [...data.menu].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((m, i) => { sorted[i] = { ...m, sortOrder: i }; });
    const idx = sorted.findIndex((m) => m.id === itemId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx].sortOrder;
    sorted[idx] = { ...sorted[idx], sortOrder: sorted[swapIdx].sortOrder };
    sorted[swapIdx] = { ...sorted[swapIdx], sortOrder: tempOrder };
    setData({ ...data, menu: sorted, lastModified: new Date().toISOString() });
  };

  const toggleMenuVisibility = (itemId: string) => {
    const menu = data.menu.map((m) => m.id === itemId ? { ...m, isVisible: !m.isVisible } : m);
    setData({ ...data, menu, lastModified: new Date().toISOString() });
  };

  return (
    <div className={embedded ? '' : 'flex-1 overflow-y-auto'}>
      {!embedded && (
        <div className="px-6 py-5 border-b border-[var(--color-border)]">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Quản lý Module & Metadata</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Thêm/sửa/xóa modules, fields, danh mục</p>
        </div>
      )}

      {/* Tab bar */}
      <div className={`${embedded ? '' : 'px-6'} border-b border-[var(--color-border)] flex gap-1`}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}>
            <Icon name={tab.icon} size={14} />{tab.label}
          </button>
        ))}
      </div>

      <div className={embedded ? 'pt-4' : 'p-6'}>
        {/* Module selector for fields/categories tabs */}
        {(activeTab === 'fields' || activeTab === 'categories') && (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-secondary)]">Module:</span>
            <select className="input-field py-1.5 px-3 text-sm w-48" value={selectedModuleId || ''} onChange={(e) => setSelectedModuleId(e.target.value || null)}>
              <option value="">-- Chọn module --</option>
              {data.modules.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </div>
        )}

        {/* Modules Tab */}
        {activeTab === 'modules' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--color-text)]">Danh sách Modules ({data.modules.length})</h2>
              <button onClick={() => setEditingModule({})} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Icon name="plus" size={13} />Thêm module</button>
            </div>
            <div className="space-y-1">
              {data.modules.sort((a, b) => a.sortOrder - b.sortOrder).map((mod, idx) => (
                <div key={mod.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveModule(mod.id, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-up" size={12} /></button>
                    <button onClick={() => moveModule(mod.id, 'down')} disabled={idx === data.modules.length - 1} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-down" size={12} /></button>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.color + '15' }}>
                    <Icon name={mod.icon} size={16} color={mod.color} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--color-text)]">{mod.name}</div>
                    <div className="text-[10px] text-[var(--color-text-secondary)]">{mod.fields.length} fields · {mod.categories?.length || 0} danh mục · {mod.isActive ? 'Hoạt động' : 'Ẩn'}</div>
                  </div>
                  <button onClick={() => setEditingModule(mod)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="edit" size={14} /></button>
                  {!mod.isDefault && <button onClick={() => deleteModule(mod.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500"><Icon name="trash" size={14} /></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fields Tab */}
        {activeTab === 'fields' && selectedModule && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--color-text)]">Fields của {selectedModule.name} ({selectedModule.fields.filter((f) => f.isTableVisible).length})</h2>
              <button onClick={() => setEditingField({})} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Icon name="plus" size={13} />Thêm field</button>
            </div>
            <div className="space-y-1">
              {(() => {
                // Build combined list: real fields + virtual columns (Danh mục, Module)
                // For modules with virtual columns (Vàng, Nhà trọ), only show fields visible in table
                const isVirtualModule = selectedModule.id === 'mod_vang' || selectedModule.id === 'mod_nhatro';
                
                let realFields = [...selectedModule.fields];
                
                // Only show fields that are actually displayed in the table
                if (selectedModule.tableConfig?.columns) {
                  const visibleFieldIds = new Set(selectedModule.tableConfig.columns.filter((c) => c.isVisible).map((c) => c.fieldId));
                  realFields = realFields.filter((f) => visibleFieldIds.has(f.id) || f.isTableVisible);
                  const colOrder = new Map(selectedModule.tableConfig.columns.map((c, i) => [c.fieldId, i]));
                  realFields.sort((a, b) => {
                    const aIdx = colOrder.get(a.id) ?? 999;
                    const bIdx = colOrder.get(b.id) ?? 999;
                    if (aIdx !== bIdx) return aIdx - bIdx;
                    return a.sortOrder - b.sortOrder;
                  });
                } else {
                  realFields = realFields.filter((f) => f.isTableVisible);
                  realFields.sort((a, b) => a.sortOrder - b.sortOrder);
                }
                
                const virtualEntries: Array<{ id: string; fieldLabel: string; fieldName: string; sortOrder: number; isVirtual: true }> = [];
                if ((selectedModule.categories?.length ?? 0) > 0) {
                  const catConfig = selectedModule.tableConfig?.columns?.find((c) => c.fieldId === '__category');
                  virtualEntries.push({ id: '__category', fieldLabel: 'Danh muc', fieldName: '__category', sortOrder: catConfig?.sortOrder ?? 900, isVirtual: true });
                }
                if (selectedModule.id === 'mod_chitieu') {
                  const modConfig = selectedModule.tableConfig?.columns?.find((c) => c.fieldId === '__module');
                  virtualEntries.push({ id: '__module', fieldLabel: 'Module', fieldName: '__module', sortOrder: modConfig?.sortOrder ?? 901, isVirtual: true });
                }
                const allItems = [...realFields.map((f) => ({ ...f, isVirtual: false as const })), ...virtualEntries].sort((a, b) => a.sortOrder - b.sortOrder);

                return allItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveFieldOrColumn(item.id, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-up" size={12} /></button>
                      <button onClick={() => moveFieldOrColumn(item.id, 'down')} disabled={idx === allItems.length - 1} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-down" size={12} /></button>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)] w-6">{item.sortOrder}</span>
                    <div className="flex-1">
                      <div className="text-sm text-[var(--color-text)]">
                        {item.fieldLabel}
                        {item.isVirtual && <span className="text-[10px] text-purple-500 ml-2">(auto)</span>}
                        {!item.isVirtual && <span className="text-[10px] text-[var(--color-text-secondary)]"> ({(item as typeof realFields[0]).fieldType})</span>}
                      </div>
                      {!item.isVirtual && (
                        <div className="text-[10px] text-[var(--color-text-secondary)]">{(item as typeof realFields[0]).fieldName} · {(item as typeof realFields[0]).isRequired ? 'Bắt buộc' : 'Tùy chọn'} · {(item as typeof realFields[0]).isTableVisible ? 'Hiện bảng' : 'Ẩn bảng'}</div>
                      )}
                    </div>
                    {!item.isVirtual && (
                      <>
                        <button onClick={() => toggleFieldVisibility(item.id)} className={`p-1.5 rounded ${(item as typeof realFields[0]).isTableVisible ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`} title={(item as typeof realFields[0]).isTableVisible ? 'Ẩn khỏi bảng' : 'Hiện trong bảng'}>
                          <Icon name={(item as typeof realFields[0]).isTableVisible ? 'eye' : 'eye-off'} size={14} />
                        </button>
                        <button onClick={() => toggleCompactVisibility(item.id)} className={`p-1.5 rounded text-xs font-bold ${isCompactVisible(item.id) ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`} title={isCompactVisible(item.id) ? 'Ẩn khi Thu gọn' : 'Hiện khi Thu gọn'}>
                          T
                        </button>
                        <button onClick={() => setEditingField(item as typeof realFields[0])} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="edit" size={14} /></button>
                        <button onClick={() => deleteField(item.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500"><Icon name="trash" size={14} /></button>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && selectedModule && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--color-text)]">Danh mục của {selectedModule.name} ({selectedModule.categories?.length || 0})</h2>
              <button onClick={() => setEditingCategory({})} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Icon name="plus" size={13} />Thêm danh mục</button>
            </div>
            <div className="space-y-1">
              {(selectedModule.categories || []).sort((a, b) => a.sortOrder - b.sortOrder).map((cat, idx) => (
                <div key={cat.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveCategory(cat.id, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-up" size={12} /></button>
                    <button onClick={() => moveCategory(cat.id, 'down')} disabled={idx === (selectedModule.categories || []).length - 1} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-down" size={12} /></button>
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '15' }}>
                    <Icon name={cat.icon || 'tag'} size={12} color={cat.color} />
                  </div>
                  <span className="flex-1 text-sm text-[var(--color-text)]">{cat.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.color + '15', color: cat.color }}>{cat.isActive ? 'Active' : 'Hidden'}</span>
                  <button onClick={() => setEditingCategory(cat)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="edit" size={14} /></button>
                  <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu & Config Tab */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">Menu sidebar</h2>
            <div className="space-y-1">
              {data.menu.sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)]">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveMenuItem(item.id, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-up" size={12} /></button>
                    <button onClick={() => moveMenuItem(item.id, 'down')} disabled={idx === data.menu.length - 1} className="p-0.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-20"><Icon name="chevron-down" size={12} /></button>
                  </div>
                  <Icon name={item.icon} size={14} className="text-[var(--color-text-secondary)]" />
                  <span className="flex-1 text-sm text-[var(--color-text)]">{item.label}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)]">{item.type}</span>
                  <button onClick={() => toggleMenuVisibility(item.id)} className={`text-[10px] px-2 py-0.5 rounded ${item.isVisible ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-500 dark:bg-red-900/20'}`}>
                    {item.isVisible ? 'Hien' : 'An'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fields' && !selectedModule && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">Chọn module ở trên để quản lý fields</p>
        )}
        {activeTab === 'categories' && !selectedModule && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">Chọn module ở trên để quản lý danh mục</p>
        )}
      </div>

      {/* Module Edit Dialog */}
      {editingModule !== null && (
        <EditDialog title={editingModule.id ? 'Sửa Module' : 'Thêm Module'} onClose={() => setEditingModule(null)}>
          <ModuleForm initial={editingModule} onSave={saveModule} onCancel={() => setEditingModule(null)} />
        </EditDialog>
      )}

      {/* Field Edit Dialog */}
      {editingField !== null && (
        <EditDialog title={editingField.id ? 'Sửa Field' : 'Thêm Field'} onClose={() => setEditingField(null)}>
          <FieldForm initial={editingField} onSave={saveField} onCancel={() => setEditingField(null)} />
        </EditDialog>
      )}

      {/* Category Edit Dialog */}
      {editingCategory !== null && (
        <EditDialog title={editingCategory.id ? 'Sửa Danh mục' : 'Thêm Danh mục'} onClose={() => setEditingCategory(null)}>
          <CategoryForm initial={editingCategory} onSave={saveCategory} onCancel={() => setEditingCategory(null)} />
        </EditDialog>
      )}
    </div>
  );
}

function EditDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-border)]"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModuleForm({ initial, onSave, onCancel }: { initial: Partial<ModuleDefinition>; onSave: (m: Partial<ModuleDefinition>) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial.name || '');
  const [icon, setIcon] = useState(initial.icon || 'box');
  const [color, setColor] = useState(initial.color || '#607D8B');
  const [description, setDescription] = useState(initial.description || '');
  const [isActive, setIsActive] = useState(initial.isActive ?? true);

  return (
    <div className="space-y-3">
      <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Tên module *</label>
        <input className="input-field py-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Chi tiêu" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Icon</label>
          <input className="input-field py-2 mt-1" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="lucide icon name" /></div>
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Màu</label>
          <input type="color" className="input-field py-1 mt-1 h-9 w-full" value={color} onChange={(e) => setColor(e.target.value)} /></div>
      </div>
      <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Mô tả</label>
        <input className="input-field py-2 mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <label className="text-xs text-[var(--color-text)]">Hoạt động</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="btn-secondary px-4 py-2 text-xs">Hủy</button>
        <button onClick={() => onSave({ ...initial, name, icon, color, description, isActive })} disabled={!name} className="btn-primary px-4 py-2 text-xs">Lưu</button>
      </div>
    </div>
  );
}

function FieldForm({ initial, onSave, onCancel }: { initial: Partial<FieldDefinition>; onSave: (f: Partial<FieldDefinition>) => void; onCancel: () => void }) {
  const [fieldLabel, setFieldLabel] = useState(initial.fieldLabel || '');
  const [fieldName, setFieldName] = useState(initial.fieldName || '');
  const [fieldType, setFieldType] = useState(initial.fieldType || 'text');
  const [isRequired, setIsRequired] = useState(initial.isRequired || false);
  const [isTableVisible, setIsTableVisible] = useState(initial.isTableVisible ?? true);

  const fieldTypes = ['text', 'number', 'money', 'date', 'datetime', 'dropdown', 'radio', 'textarea', 'tag', 'image', 'checkbox'];

  return (
    <div className="space-y-3">
      <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Nhãn hiển thị *</label>
        <input className="input-field py-2 mt-1" value={fieldLabel} onChange={(e) => { setFieldLabel(e.target.value); if (!initial.id) setFieldName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')); }} placeholder="VD: Số tiền" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Tên field (key)</label>
          <input className="input-field py-2 mt-1" value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="amount" /></div>
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Loại field</label>
          <select className="input-field py-2 mt-1" value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldDefinition['fieldType'])}>
            {fieldTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select></div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text)]"><input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />Bắt buộc</label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text)]"><input type="checkbox" checked={isTableVisible} onChange={(e) => setIsTableVisible(e.target.checked)} />Hiện trong bảng</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="btn-secondary px-4 py-2 text-xs">Hủy</button>
        <button onClick={() => onSave({ ...initial, fieldLabel, fieldName, fieldType, isRequired, isTableVisible })} disabled={!fieldLabel || !fieldName} className="btn-primary px-4 py-2 text-xs">Lưu</button>
      </div>
    </div>
  );
}

function CategoryForm({ initial, onSave, onCancel }: { initial: Partial<CategoryDefinition>; onSave: (c: Partial<CategoryDefinition>) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial.name || '');
  const [icon, setIcon] = useState(initial.icon || 'tag');
  const [color, setColor] = useState(initial.color || '#607D8B');
  const [isActive, setIsActive] = useState(initial.isActive ?? true);

  return (
    <div className="space-y-3">
      <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Tên danh mục *</label>
        <input className="input-field py-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Ăn uống" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Icon</label>
          <input className="input-field py-2 mt-1" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="lucide icon name" /></div>
        <div><label className="text-xs font-medium text-[var(--color-text-secondary)]">Màu</label>
          <input type="color" className="input-field py-1 mt-1 h-9 w-full" value={color} onChange={(e) => setColor(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <label className="text-xs text-[var(--color-text)]">Hoạt động</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="btn-secondary px-4 py-2 text-xs">Hủy</button>
        <button onClick={() => onSave({ ...initial, name, icon, color, isActive })} disabled={!name} className="btn-primary px-4 py-2 text-xs">Lưu</button>
      </div>
    </div>
  );
}
