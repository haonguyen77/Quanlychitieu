import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRecordStore } from '@/core/store/recordStore';
import { useAppStore } from '@/core/store/appStore';
import type { ModuleDefinition, DataRecord, RecordValues, RecordValue, CategoryDefinition, FieldDefinition, FinanceData } from '@/types';

import { FormHeader } from './FormHeader';
import { BasicForm } from './BasicForm';
import { ModuleSection } from './ModuleSection';
import { UploadImage } from './UploadImage';
import { NoteInput } from './NoteInput';
import { FormFooter, TipsBar } from './FormFooter';

// ─── Smart Default Helpers ───────────────────────────────────────────────────

/** Get smart default for a field: last used value, then most frequent this/last month */
function getSmartDefault(data: FinanceData | null, moduleId: string, fieldName: string): string | null {
  if (!data) return null;

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // "2026-08"
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  // Get recent records for this module, sorted by date desc
  const records = data.records
    .filter((r) => r.moduleId === moduleId && !r.isDeleted)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (records.length === 0) return null;

  // 1. Last used value (most recent record)
  const fieldKey = Object.keys(records[0].values).find((k) => k.endsWith('_' + fieldName));
  if (fieldKey) {
    const lastValue = records[0].values[fieldKey];
    if (lastValue && String(lastValue)) return String(lastValue);
  }

  // 2. Most frequent in this month + last month
  const freq = new Map<string, number>();
  for (const r of records) {
    const dateKey = Object.keys(r.values).find((k) => k.endsWith('_date'));
    const dateVal = dateKey ? String(r.values[dateKey] ?? '') : (r.createdAt?.slice(0, 10) || '');
    const recordMonth = dateVal.slice(0, 7);
    if (recordMonth !== thisMonth && recordMonth !== lastMonth) continue;

    const key = Object.keys(r.values).find((k) => k.endsWith('_' + fieldName));
    if (key && r.values[key]) {
      const v = String(r.values[key]);
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
  }

  if (freq.size === 0) return null;
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Get smart default category: last used, then most frequent this/last month */
function getSmartCategoryDefault(data: FinanceData | null, moduleId: string): string | undefined {
  if (!data) return undefined;

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  const records = data.records
    .filter((r) => r.moduleId === moduleId && !r.isDeleted && r.categoryId && !r.categoryId.startsWith('mod_'))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (records.length === 0) return undefined;

  // 1. Last used category
  const lastCat = records[0].categoryId;
  if (lastCat) return lastCat;

  // 2. Most frequent this/last month
  const freq = new Map<string, number>();
  for (const r of records) {
    const dateKey = Object.keys(r.values).find((k) => k.endsWith('_date'));
    const dateVal = dateKey ? String(r.values[dateKey] ?? '') : (r.createdAt?.slice(0, 10) || '');
    const recordMonth = dateVal.slice(0, 7);
    if (recordMonth !== thisMonth && recordMonth !== lastMonth) continue;

    if (r.categoryId) {
      freq.set(r.categoryId, (freq.get(r.categoryId) ?? 0) + 1);
    }
  }

  if (freq.size === 0) return undefined;
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ─────────────────────────────────────────────────────────────────────────────

interface RecordFormDialogProps {
  module: ModuleDefinition;
  record: DataRecord | null;
  onClose: () => void;
  defaultAccount?: string;
}

export function RecordFormDialog({ module, record, onClose, defaultAccount }: RecordFormDialogProps) {
  const { addRecord, getTitleSuggestions } = useRecordStore();
  const { data } = useAppStore();
  const isEditing = record !== null;

  // CRITICAL: For linked modules (Vàng/Shopee/Nhà trọ), always use Chi tiêu's form
  const isLinkedModule = ['mod_shopee', 'mod_vang', 'mod_nhatro'].includes(module.id);
  const isLinkedRecord = isEditing && record.moduleId === 'mod_chitieu' && module.id !== 'mod_chitieu';
  const formModule = useMemo(() => {
    if ((isLinkedModule || isLinkedRecord) && data) {
      return data.modules.find((m) => m.id === 'mod_chitieu') || module;
    }
    return module;
  }, [isLinkedModule, isLinkedRecord, data, module]);

  // Helper: get value from a record by fieldName
  const getRecordVal = (r: DataRecord, fieldName: string): RecordValue => {
    const key = Object.keys(r.values).find((k) => k.endsWith('_' + fieldName));
    return key ? (r.values[key] as RecordValue) : null;
  };

  // Initialize form values
  const [values, setValues] = useState<RecordValues>(() => {
    const defaults: RecordValues = {};
    for (const field of formModule.fields) {
      if (field.isVisible) {
        if (isEditing) {
          const directVal = record.values[field.id];
          if (directVal !== undefined) {
            defaults[field.id] = directVal;
          } else {
            defaults[field.id] = getRecordVal(record, field.fieldName);
          }
        } else {
          if (field.fieldType === 'date' || field.fieldType === 'datetime') {
            if (field.fieldName === 'warranty_date') {
              defaults[field.id] = null;
            } else {
              defaults[field.id] = new Date().toISOString().slice(0, 10);
            }
          } else if (field.fieldName === 'type') {
            defaults[field.id] = '0'; // Default: Chi
          } else if (field.fieldName === 'account') {
            // Use defaultAccount prop if provided (from credit card module)
            // Otherwise smart default: last used account, then most frequent this/last month
            defaults[field.id] = defaultAccount || getSmartDefault(data, formModule.id, 'account') || 'cash';
          } else if (field.fieldName === 'quantity') {
            defaults[field.id] = 1; // Default quantity to 1
          } else {
            defaults[field.id] = field.defaultValue ?? null;
          }
        }
      }
    }
    return defaults;
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(() => {
    if (!record) {
      // Smart default: last used category, then most frequent this/last month
      return getSmartCategoryDefault(data, formModule.id);
    }
    if (record.categoryId && !record.categoryId.startsWith('mod_')) return record.categoryId;
    return undefined;
  });

  const [selectedModuleLink, setSelectedModuleLink] = useState<string | null>(() => {
    if (!record) {
      if (isLinkedModule) return module.id;
      return null;
    }
    if (record.linkedModuleId) return record.linkedModuleId;
    if (record.categoryId?.startsWith('mod_')) return record.categoryId;
    return null;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((fieldId: string, value: RecordValue) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of formModule.fields) {
      if (!field.isVisible) continue;
      if (field.isRequired) {
        const val = values[field.id];
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          // Allow 0 or empty for money/number fields (e.g., gifts, DOJI)
          if (field.fieldType === 'money' || field.fieldType === 'number') {
            // Skip - these can be 0 or empty
          } else if (val !== 0 as unknown) {
            newErrors[field.id] = `${field.fieldLabel} la bat buoc`;
          }
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;

    const finalValues = { ...values };

    // Normalize money/number fields: null/undefined/'' → 0
    for (const field of formModule.fields) {
      if ((field.fieldType === 'money' || field.fieldType === 'number') && field.isVisible) {
        if (finalValues[field.id] === null || finalValues[field.id] === undefined || finalValues[field.id] === '') {
          finalValues[field.id] = 0;
        }
      }
    }

    if (isEditing) {
      const appStore = useAppStore.getState();
      const appData = appStore.data;
      if (appData) {
        const now = new Date().toISOString();
        const records = appData.records.map((r) =>
          r.id === record.id
            ? { ...r, values: { ...r.values, ...finalValues }, categoryId: selectedCategoryId, linkedModuleId: selectedModuleLink || undefined, updatedAt: now }
            : r
        );
        appStore.setData({ ...appData, records, lastModified: now });
      }
    } else {
      addRecord(formModule.id, finalValues, selectedCategoryId, selectedModuleLink || undefined);
    }
    onClose();
  };

  // Categories sorted by: 1) last used first, 2) frequency this/last month
  const categories = useMemo((): CategoryDefinition[] => {
    const active = formModule.categories?.filter((c) => c.isActive) || [];
    if (!data || active.length === 0) return active;

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

    // Find last used category and frequency in this/last month
    let lastUsedCatId: string | null = null;
    const freqMap = new Map<string, number>();

    const relevantRecords = data.records
      .filter((r) => r.moduleId === formModule.id && !r.isDeleted && r.categoryId && !r.categoryId.startsWith('mod_'))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // Last used
    if (relevantRecords.length > 0) {
      lastUsedCatId = relevantRecords[0].categoryId || null;
    }

    // Frequency this month + last month
    for (const r of relevantRecords) {
      const dateKey = Object.keys(r.values).find((k) => k.endsWith('_date'));
      const dateVal = dateKey ? String(r.values[dateKey] ?? '') : (r.createdAt?.slice(0, 10) || '');
      const recordMonth = dateVal.slice(0, 7);
      if (recordMonth === thisMonth || recordMonth === lastMonth) {
        freqMap.set(r.categoryId!, (freqMap.get(r.categoryId!) ?? 0) + 1);
      }
    }

    return [...active].sort((a, b) => {
      // Last used first
      if (a.id === lastUsedCatId && b.id !== lastUsedCatId) return -1;
      if (b.id === lastUsedCatId && a.id !== lastUsedCatId) return 1;
      // Then by frequency this/last month
      const fa = freqMap.get(a.id) ?? 0;
      const fb = freqMap.get(b.id) ?? 0;
      return fb - fa;
    });
  }, [formModule.categories, formModule.id, data]);

  // Linked modules
  const linkedModules = useMemo(() => {
    if (!data || formModule.id !== 'mod_chitieu') return [];
    return data.modules.filter(
      (m) => m.isActive && ['mod_shopee', 'mod_vang', 'mod_nhatro'].includes(m.id)
    );
  }, [data, formModule.id]);

  // Account options sorted by frequency
  const accountOptions = useMemo(() => {
    const accountField = formModule.fields.find((f) => f.fieldName === 'account');
    const baseOptions = accountField?.options?.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || [];

    if (!data) return baseOptions;
    const ccRecords = data.records.filter((r) => r.moduleId === 'mod_creditcard' && !r.isDeleted);
    const ccOptions = ccRecords.map((r, i) => {
      const name = getRecordVal(r, 'card_name') || 'The';
      return {
        id: `cc_${r.id}`,
        label: `💳 ${String(name)}`,
        value: `credit_card_${r.id}`,
        color: '#1A237E',
        sortOrder: 100 + i,
        isActive: true,
      };
    });

    const filtered = ccOptions.length > 0
      ? baseOptions.filter((o) => o.value !== 'credit_card')
      : baseOptions;

    const allOptions = [...filtered, ...ccOptions];

    const accFreq = new Map<string, number>();
    for (const r of data.records) {
      if (r.moduleId === formModule.id && !r.isDeleted) {
        const accKey = Object.keys(r.values).find((k) => k.endsWith('_account'));
        if (accKey && r.values[accKey]) {
          const v = String(r.values[accKey]);
          accFreq.set(v, (accFreq.get(v) ?? 0) + 1);
        }
      }
    }

    return allOptions.sort((a, b) => {
      const fa = accFreq.get(a.value) ?? 0;
      const fb = accFreq.get(b.value) ?? 0;
      return fb - fa;
    });
  }, [formModule.fields, formModule.id, data]);

  // Event suggestions
  const eventSuggestions = useMemo(() => {
    if (!data) return [];
    const tagsField = formModule.fields.find((f) => f.fieldName === 'tags');
    if (!tagsField) return [];

    const eventInfo = new Map<string, { count: number; lastDate: string }>();
    data.records.filter((r) => r.moduleId === 'mod_chitieu' && !r.isDeleted).forEach((r) => {
      const v = r.values[tagsField.id];
      const val = typeof v === 'string' ? v.trim() : (Array.isArray(v) ? v[0] : '');
      if (val) {
        const existing = eventInfo.get(val);
        const d = r.createdAt || '';
        if (existing) { existing.count++; if (d > existing.lastDate) existing.lastDate = d; }
        else eventInfo.set(val, { count: 1, lastDate: d });
      }
    });
    return Array.from(eventInfo.entries())
      .sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate) || b[1].count - a[1].count)
      .slice(0, 20).map(([e]) => e);
  }, [data, formModule.fields]);

  // Beneficiary options
  const beneficiaryOptions = useMemo(() => {
    const beneficiaryField = formModule.fields.find((f) => f.fieldName === 'beneficiary');
    const opts = (beneficiaryField?.options || [
      { id: 'ben_ba', label: 'Ba', value: 'ba', isActive: true, sortOrder: 0 },
      { id: 'ben_me', label: 'Me', value: 'me', isActive: true, sortOrder: 1 },
      { id: 'ben_vo', label: 'Vo', value: 'vo', isActive: true, sortOrder: 2 },
      { id: 'ben_con', label: 'Con', value: 'con', isActive: true, sortOrder: 3 },
      { id: 'ben_anh', label: 'Anh', value: 'anh', isActive: true, sortOrder: 4 },
      { id: 'ben_chi', label: 'Chi', value: 'chi', isActive: true, sortOrder: 5 },
      { id: 'ben_chong', label: 'Chong', value: 'chong', isActive: true, sortOrder: 6 },
      { id: 'ben_banthan', label: 'Minh', value: 'banthan', isActive: true, sortOrder: 7 },
    ]).filter((o) => o.isActive);

    if (!data) return opts;
    const freq = new Map<string, number>();
    for (const r of data.records) {
      if (r.moduleId === formModule.id && !r.isDeleted) {
        const k = Object.keys(r.values).find((x) => x.endsWith('_beneficiary'));
        if (k && r.values[k]) freq.set(String(r.values[k]), (freq.get(String(r.values[k])) ?? 0) + 1);
      }
    }
    return opts.sort((a, b) => (freq.get(b.value) ?? 0) - (freq.get(a.value) ?? 0));
  }, [formModule.fields, formModule.id, data]);

  // Get field helpers
  const getField = (name: string): FieldDefinition | undefined =>
    formModule.fields.find((f) => f.fieldName === name);

  const titleField = getField('title') || getField('order_name');
  const amountField = getField('amount') || getField('total_amount');
  const typeField = getField('type');
  const dateField = getField('date') || getField('order_date') || getField('month');
  const accountField = getField('account');
  const beneficiaryField = getField('beneficiary');
  const quantityField = getField('quantity');
  const warrantyMonthsField = getField('warranty_months');
  const warrantyDateField = getField('warranty_date');
  const imageField = getField('images');
  const noteField = getField('note');
  const tagsField = getField('tags');

  // Type options
  const typeOptions = useMemo(() => {
    return typeField?.options?.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || [
      { id: 'type_chi', label: 'Chi', value: '0', color: '#EF4444', isActive: true, sortOrder: 0 },
      { id: 'type_thu', label: 'Thu', value: '1', color: '#22C55E', isActive: true, sortOrder: 1 },
    ];
  }, [typeField]);

  // Keyboard shortcuts
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // Escape: close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl+Enter or Alt+S: save
      if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault();
        handleSubmitRef.current();
        return;
      }

      if (isInput) return;

      // 1-9: quick-select category
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < categories.length) {
          e.preventDefault();
          const cat = categories[idx];
          setSelectedCategoryId(selectedCategoryId === cat.id ? undefined : cat.id);
        }
        return;
      }

      // First-letter for account/category
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const letter = e.key.toLowerCase();
        if (accountField) {
          const match = accountOptions.find((opt) => {
            const cleanLabel = opt.label.replace(/[^\w\s]/g, '').trim().toLowerCase();
            return cleanLabel.startsWith(letter) || opt.value.toLowerCase().startsWith(letter);
          });
          if (match) {
            e.preventDefault();
            handleChange(accountField.id, match.value);
            return;
          }
        }
        const catMatch = categories.find((c) => c.name.toLowerCase().startsWith(letter));
        if (catMatch) {
          e.preventDefault();
          setSelectedCategoryId(selectedCategoryId === catMatch.id ? undefined : catMatch.id);
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedCategoryId, accountOptions, categories, formModule, onClose, handleChange, accountField]);

  // Warranty auto-calculate
  const handleWarrantyMonthsChange = (v: RecordValue) => {
    const fieldId = warrantyMonthsField?.id || `${formModule.id}_warranty_months`;
    const wdFieldId = warrantyDateField?.id || `${formModule.id}_warranty_date`;
    handleChange(fieldId, v);
    if (v && dateField && values[dateField.id]) {
      const months = Number(v);
      if (months > 0) {
        const purchaseDate = new Date(String(values[dateField.id]));
        purchaseDate.setMonth(purchaseDate.getMonth() + months);
        handleChange(wdFieldId, purchaseDate.toISOString().slice(0, 10));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative bg-[#F8FAFC] border border-[#E8EDF5] rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col animate-in"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {/* Header */}
        <FormHeader
          title={isEditing ? `Sua ${module.name.toLowerCase()}` : (module.id === 'mod_creditcard' ? 'Them giao dich the' : `Them ${module.name.toLowerCase()}`)}
          onClose={onClose}
        />

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Generic form for non-chitieu modules */}
          {formModule.id !== 'mod_chitieu' ? (
            <div className="bg-white border border-[#E8EDF5] rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formModule.fields
                  .filter((f) => f.isVisible)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((field) => (
                    <div key={field.id} className={`flex flex-col gap-1 ${field.fieldType === 'textarea' ? 'md:col-span-2' : ''}`}>
                      <label className="text-xs font-medium text-gray-700">
                        {field.fieldLabel}
                        {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {field.fieldType === 'textarea' ? (
                        <textarea
                          className="w-full h-[70px] px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200 resize-none"
                          value={String(values[field.id] ?? '')}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={`Nhap ${field.fieldLabel.toLowerCase()}...`}
                        />
                      ) : field.fieldType === 'dropdown' && field.options ? (
                        <select
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
                          value={String(values[field.id] ?? '')}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                        >
                          <option value="">-- Chon --</option>
                          {field.options.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => (
                            <option key={opt.id} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.fieldType === 'money' ? (
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
                            value={values[field.id] != null ? Number(values[field.id]).toLocaleString('vi-VN') : ''}
                            onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); handleChange(field.id, raw ? Number(raw) : null); }}
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">d</span>
                        </div>
                      ) : field.fieldType === 'date' ? (
                        <input
                          type="date"
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
                          value={String(values[field.id] ?? '')}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                        />
                      ) : field.fieldType === 'number' ? (
                        <input
                          type="number"
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
                          value={String(values[field.id] ?? '')}
                          onChange={(e) => handleChange(field.id, e.target.value ? Number(e.target.value) : null)}
                          placeholder={`Nhap ${field.fieldLabel.toLowerCase()}...`}
                        />
                      ) : (
                        <input
                          type="text"
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
                          value={String(values[field.id] ?? '')}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={`Nhap ${field.fieldLabel.toLowerCase()}...`}
                          autoFocus={field.sortOrder === 0}
                        />
                      )}
                      {errors[field.id] && <p className="text-xs text-red-500">{errors[field.id]}</p>}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
          <>
          {/* Section 1: Basic Info (Chi tiêu only) */}
          <BasicForm
            titleValue={values[titleField?.id || '']}
            amountValue={values[amountField?.id || '']}
            dateValue={values[dateField?.id || '']}
            typeValue={values[typeField?.id || '']}
            accountValue={values[accountField?.id || '']}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            typeOptions={typeOptions}
            accountOptions={accountOptions}
            onTitleChange={(v) => titleField && handleChange(titleField.id, v)}
            onAmountChange={(v) => amountField && handleChange(amountField.id, v)}
            onDateChange={(v) => dateField && handleChange(dateField.id, v)}
            onTypeChange={(v) => typeField && handleChange(typeField.id, v)}
            onAccountChange={(v) => accountField && handleChange(accountField.id, v)}
            onCategorySelect={setSelectedCategoryId}
            moduleId={module.id}
            getSuggestions={getTitleSuggestions}
            errors={errors}
            titleFieldId={titleField?.id}
            amountFieldId={amountField?.id}
            dateFieldId={dateField?.id}
            typeFieldId={typeField?.id}
            accountFieldId={accountField?.id}
          />

          {/* Section 2: Module Links (Chi tiêu only) */}
          {linkedModules.length > 0 && formModule.id === 'mod_chitieu' && (
            <ModuleSection
              linkedModules={linkedModules}
              selectedModuleLink={selectedModuleLink}
              onModuleLinkSelect={setSelectedModuleLink}
              formModuleId={formModule.id}
              tagsValue={values[tagsField?.id || `${formModule.id}_tags`]}
              onTagsChange={(v) => handleChange(tagsField?.id || `${formModule.id}_tags`, v)}
              eventSuggestions={eventSuggestions}
              beneficiaryValue={values[beneficiaryField?.id || `${formModule.id}_beneficiary`]}
              onBeneficiaryChange={(v) => handleChange(beneficiaryField?.id || `${formModule.id}_beneficiary`, v)}
              beneficiaryOptions={beneficiaryOptions}
              quantityValue={values[quantityField?.id || `${formModule.id}_quantity`]}
              onQuantityChange={(v) => handleChange(quantityField?.id || `${formModule.id}_quantity`, v)}
              warrantyMonthsValue={values[warrantyMonthsField?.id || `${formModule.id}_warranty_months`]}
              onWarrantyMonthsChange={handleWarrantyMonthsChange}
              warrantyDateValue={values[warrantyDateField?.id || `${formModule.id}_warranty_date`]}
              onWarrantyDateChange={(v) => handleChange(warrantyDateField?.id || `${formModule.id}_warranty_date`, v)}
            />
          )}

          {/* Image + Note (same row) */}
          {(imageField || noteField) && (
            <div className="bg-white border border-[#E8EDF5] rounded-xl p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imageField && (
                  <UploadImage
                    images={Array.isArray(values[imageField.id]) ? (values[imageField.id] as string[]) : []}
                    onChange={(imgs) => handleChange(imageField.id, imgs)}
                  />
                )}
                {noteField && (
                  <NoteInput
                    value={values[noteField.id]}
                    onChange={(v) => handleChange(noteField.id, v)}
                  />
                )}
              </div>
            </div>
          )}
          </>
          )}
        </form>

        {/* Footer */}
        <FormFooter
          isEditing={isEditing}
          onCancel={onClose}
          onSave={() => handleSubmit()}
          onSaveAndNew={() => { handleSubmit(); }}
          onSaveAndCopy={() => { handleSubmit(); }}
          onSaveAndClose={() => { handleSubmit(); }}
        />

        {/* Tips Bar */}
        <TipsBar />
      </div>
    </div>
  );
}
