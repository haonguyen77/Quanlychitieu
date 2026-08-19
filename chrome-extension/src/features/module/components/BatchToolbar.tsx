import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import type { ModuleDefinition } from '@/types';

interface BatchToolbarProps {
  selectedCount: number;
  module: ModuleDefinition;
  onDelete: () => void;
  onEditField: (fieldId: string, value: unknown) => void;
  onEditCategory: (categoryId: string | undefined) => void;
  onEditLinkedModule: (moduleId: string | null) => void;
  onClearSelection: () => void;
}

type EditMode = 'field' | 'category' | 'module' | null;

export function BatchToolbar({ selectedCount, module, onDelete, onEditField, onEditCategory, onEditLinkedModule, onClearSelection }: BatchToolbarProps) {
  const { data } = useAppStore();
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // All visible fields that can be batch edited
  const editableFields = useMemo(() => {
    return module.fields.filter((f) => f.isVisible && ['dropdown', 'date', 'text', 'money'].includes(f.fieldType));
  }, [module.fields]);

  // Account options (include credit cards)
  const accountOptions = useMemo(() => {
    const accField = module.fields.find((f) => f.fieldName === 'account');
    const baseOpts = accField?.options?.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || [];
    if (!data) return baseOpts;
    const ccRecords = data.records.filter((r) => r.moduleId === 'mod_creditcard' && !r.isDeleted);
    const ccOpts = ccRecords.map((r, i) => {
      const nameKey = Object.keys(r.values).find((k) => k.endsWith('_card_name'));
      const name = nameKey ? r.values[nameKey] : 'Thẻ';
      return { id: `cc_${r.id}`, label: `💳 ${String(name)}`, value: `credit_card_${r.id}`, color: '#1A237E', sortOrder: 100 + i, isActive: true };
    });
    const filtered = ccOpts.length > 0 ? baseOpts.filter((o) => o.value !== 'credit_card') : baseOpts;
    return [...filtered, ...ccOpts];
  }, [module.fields, data]);

  const linkedModules = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((m) => m.isActive && ['mod_shopee', 'mod_vang', 'mod_nhatro'].includes(m.id));
  }, [data]);

  const activeField = editingField ? module.fields.find((f) => f.id === editingField) : null;

  const handleApplyField = () => {
    if (!editingField || editValue === '') return;
    // For money fields, convert to number
    if (activeField?.fieldType === 'money') {
      const num = parseInt(editValue.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num)) onEditField(editingField, num);
    } else {
      onEditField(editingField, editValue);
    }
    setEditMode(null);
    setEditingField(null);
    setEditValue('');
  };

  const renderFieldInput = () => {
    if (!activeField) return null;

    if (activeField.fieldType === 'dropdown' || activeField.fieldName === 'account') {
      const options = activeField.fieldName === 'account' ? accountOptions : (activeField.options?.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || []);
      return (
        <select className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-[var(--color-text)]" value={editValue} onChange={(e) => setEditValue(e.target.value)}>
          <option value="">-- Chọn --</option>
          {options.map((opt) => (<option key={opt.id} value={opt.value}>{opt.label}</option>))}
        </select>
      );
    }
    if (activeField.fieldType === 'date') {
      return <input type="date" className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-[var(--color-text)]" value={editValue} onChange={(e) => setEditValue(e.target.value)} />;
    }
    if (activeField.fieldType === 'money') {
      return <input type="text" className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-[var(--color-text)] w-28" value={editValue} onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); setEditValue(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : ''); }} placeholder="Số tiền" />;
    }
    // text
    return <input type="text" className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-[var(--color-text)] w-36" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder={activeField.fieldLabel} />;
  };

  return (
    <div className="px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-3 flex-shrink-0">
      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
        {selectedCount} đã chọn
      </span>

      <div className="flex items-center gap-2 ml-auto">
        {/* Edit mode selector */}
        {!editMode && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setEditMode('field'); setEditingField(editableFields[0]?.id || null); setEditValue(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]">
              <Icon name="edit" size={13} />Sửa field
            </button>
            {(module.categories?.length ?? 0) > 0 && (
              <button onClick={() => setEditMode('category')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]">
                <Icon name="tag" size={13} />Danh mục
              </button>
            )}
            {module.id === 'mod_chitieu' && linkedModules.length > 0 && (
              <button onClick={() => setEditMode('module')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]">
                <Icon name="link" size={13} />Module
              </button>
            )}
          </div>
        )}

        {/* Field edit mode */}
        {editMode === 'field' && (
          <div className="flex items-center gap-2">
            <select className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-[var(--color-text)]"
              value={editingField || ''} onChange={(e) => { setEditingField(e.target.value); setEditValue(''); }}>
              {editableFields.map((f) => (<option key={f.id} value={f.id}>{f.fieldLabel}</option>))}
            </select>
            {renderFieldInput()}
            <button onClick={handleApplyField} disabled={editValue === ''}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">Áp dụng</button>
            <button onClick={() => { setEditMode(null); setEditingField(null); setEditValue(''); }}
              className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="x" size={14} /></button>
          </div>
        )}

        {/* Category edit mode */}
        {editMode === 'category' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { onEditCategory(undefined); setEditMode(null); }}
              className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">Bỏ danh mục</button>
            {module.categories?.filter((c) => c.isActive).map((cat) => (
              <button key={cat.id} onClick={() => { onEditCategory(cat.id); setEditMode(null); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border"
                style={{ borderColor: cat.color, color: cat.color, backgroundColor: cat.color + '15' }}>
                <Icon name={cat.icon || 'tag'} size={11} />{cat.name}
              </button>
            ))}
            <button onClick={() => setEditMode(null)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="x" size={14} /></button>
          </div>
        )}

        {/* Module edit mode */}
        {editMode === 'module' && (
          <div className="flex items-center gap-2">
            <button onClick={() => { onEditLinkedModule(null); setEditMode(null); }}
              className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">Chỉ Chi tiêu</button>
            {linkedModules.map((m) => (
              <button key={m.id} onClick={() => { onEditLinkedModule(m.id); setEditMode(null); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border font-medium"
                style={{ borderColor: m.color, color: m.color, backgroundColor: m.color + '15' }}>
                <Icon name={m.icon} size={11} />{m.name}
              </button>
            ))}
            <button onClick={() => setEditMode(null)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"><Icon name="x" size={14} /></button>
          </div>
        )}

        {/* Batch delete */}
        <button onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50">
          <Icon name="trash" size={13} />Xóa
        </button>

        {/* Clear selection */}
        <button onClick={onClearSelection} className="p-1.5 rounded-md hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]" title="Bỏ chọn">
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
