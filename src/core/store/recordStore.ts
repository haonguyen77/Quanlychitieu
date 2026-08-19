import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { DataRecord, RecordValues, FilterCondition } from '@/types';
import { useAppStore } from './appStore';
import { useUndoStore } from './undoStore';
import { addActivityLog } from '@/core/utils/activityLogger';

export type DatePreset = 'week' | 'month' | 'year' | 'all' | 'custom';

/** Default date presets per module */
const MODULE_DEFAULT_PRESETS: Record<string, DatePreset> = {
  mod_chitieu: 'month',
  mod_vang: 'year',
  mod_nhatro: 'year',
  mod_creditcard: 'month',
};

/** Get the default preset for a module (falls back to 'month') */
export function getModuleDefaultPreset(moduleId: string): DatePreset {
  return MODULE_DEFAULT_PRESETS[moduleId] || 'month';
}

interface RecordState {
  // Filters & search
  searchQuery: string;
  filters: FilterCondition[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
  dateFrom: string;
  dateTo: string;
  datePreset: DatePreset;
  filterCategory: string | null;
  filterModule: string | null;
  filterAccount: string | null;
  filterWarrantyAlert: boolean;
  _skipApplyDefault: boolean;

  // Actions
  setSearchQuery: (query: string) => void;
  setFilters: (filters: FilterCondition[]) => void;
  setSort: (fieldId: string, direction: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setDateRange: (from: string, to: string) => void;
  setDatePreset: (preset: DatePreset) => void;
  setDatePresetForModule: (preset: DatePreset, moduleId: string) => void;
  applyModuleDefault: (moduleId: string) => void;
  setFilterCategory: (catId: string | null) => void;
  setFilterModule: (modId: string | null) => void;
  setFilterAccount: (accValue: string | null) => void;

  // CRUD
  addRecord: (moduleId: string, values: RecordValues, categoryId?: string, linkedModuleId?: string) => DataRecord;
  updateRecord: (recordId: string, values: RecordValues) => void;
  deleteRecord: (recordId: string, permanent?: boolean) => void;
  restoreRecord: (recordId: string) => void;

  // Queries
  getRecordsByModule: (moduleId: string) => DataRecord[];
  getRecordById: (recordId: string) => DataRecord | undefined;
  getFilteredRecords: (moduleId: string) => DataRecord[];
  getTitleSuggestions: (moduleId: string, query: string) => string[];
}

function getYearStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export const useRecordStore = create<RecordState>((set, get) => ({
  searchQuery: '',
  filters: [],
  sortField: null,
  sortDirection: 'desc',
  currentPage: 1,
  pageSize: 50,
  dateFrom: getMonthStart(),
  dateTo: getToday(),
  datePreset: 'month',
  filterCategory: null,
  filterModule: null,
  filterAccount: null,
  filterWarrantyAlert: false,
  _skipApplyDefault: false,

  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setFilters: (filters) => set({ filters, currentPage: 1 }),
  setSort: (fieldId, direction) => set({ sortField: fieldId, sortDirection: direction }),
  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to, datePreset: 'custom', currentPage: 1 }),
  setFilterCategory: (catId) => set({ filterCategory: catId, currentPage: 1 }),
  setFilterModule: (modId) => set({ filterModule: modId, currentPage: 1 }),
  setFilterAccount: (accValue) => set({ filterAccount: accValue, currentPage: 1 }),

  setDatePreset: (preset) => {
    switch (preset) {
      case 'week':
        set({ datePreset: preset, dateFrom: getWeekStart(), dateTo: getToday(), currentPage: 1 });
        break;
      case 'month':
        set({ datePreset: preset, dateFrom: getMonthStart(), dateTo: getToday(), currentPage: 1 });
        break;
      case 'year':
        set({ datePreset: preset, dateFrom: getYearStart(), dateTo: getToday(), currentPage: 1 });
        break;
      case 'all':
        set({ datePreset: preset, dateFrom: '', dateTo: '', currentPage: 1 });
        break;
      default:
        set({ datePreset: preset, currentPage: 1 });
    }
    // Save preference
    try {
      localStorage.setItem('pdp_datePreset', preset);
    } catch { /* ignore */ }
  },

  setDatePresetForModule: (preset, moduleId) => {
    // Same as setDatePreset but saves per-module
    get().setDatePreset(preset);
    try {
      localStorage.setItem(`pdp_datePreset_${moduleId}`, preset);
    } catch { /* ignore */ }
  },

  applyModuleDefault: (moduleId) => {
    // Skip if explicitly flagged (from dashboard navigation)
    if (get()._skipApplyDefault) {
      set({ _skipApplyDefault: false });
      return;
    }
    // Skip if custom date range was just set
    const state = get();
    if (state.datePreset === 'custom' && state.dateFrom && state.dateTo) return;
    // Clear filters when switching module normally
    set({ filterAccount: null, filterCategory: null, filterModule: null, filterWarrantyAlert: false });
    // Load saved preference for this module, or use module default
    let preset: DatePreset;
    try {
      const saved = localStorage.getItem(`pdp_datePreset_${moduleId}`);
      preset = (saved as DatePreset) || getModuleDefaultPreset(moduleId);
    } catch {
      preset = getModuleDefaultPreset(moduleId);
    }
    get().setDatePreset(preset);
  },

  addRecord: (moduleId, values, categoryId, linkedModuleId) => {
    const now = new Date().toISOString();
    const newRecord: DataRecord = {
      id: uuidv4(),
      moduleId,
      linkedModuleId: linkedModuleId || undefined,
      categoryId,
      values,
      tags: [],
      images: [],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return newRecord;

    let updatedData = {
      ...data,
      records: [...data.records, newRecord],
      metadata: { ...data.metadata, totalRecords: data.metadata.totalRecords + 1 },
      lastModified: now,
    };

    // Activity log
    const mod = data.modules.find((m) => m.id === moduleId);
    updatedData = addActivityLog(updatedData, 'create', `Thêm bản ghi "${values[Object.keys(values).find((k) => k.endsWith('_title') || k.endsWith('_order_name') || k.endsWith('_card_name')) || ''] || 'Mới'}" vào ${mod?.name || moduleId}`, moduleId, newRecord.id);

    appStore.setData(updatedData);

    // Mark that user entered expense today (for reminder skip logic)
    if (moduleId === 'mod_chitieu' || moduleId === 'mod_shopee' || moduleId === 'mod_creditcard') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('lastExpenseDate', today);
      } catch { /* */ }
    }

    // Push to undo stack
    useUndoStore.getState().pushAction({
      type: 'add',
      recordId: newRecord.id,
      moduleId,
      newValues: values,
      categoryId,
      linkedModuleId,
      timestamp: now,
    });

    return newRecord;
  },

  updateRecord: (recordId, values) => {
    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return;

    const now = new Date().toISOString();
    const existingRecord = data.records.find((r) => r.id === recordId);
    const previousValues = existingRecord ? { ...existingRecord.values } : undefined;

    const records = data.records.map((r) =>
      r.id === recordId
        ? { ...r, values: { ...r.values, ...values }, updatedAt: now }
        : r
    );

    let updatedData = { ...data, records, lastModified: now };
    updatedData = addActivityLog(updatedData, 'update', `Cập nhật bản ghi`, existingRecord?.moduleId, recordId);
    appStore.setData(updatedData);

    // Push to undo stack
    if (previousValues) {
      useUndoStore.getState().pushAction({
        type: 'update',
        recordId,
        previousValues,
        newValues: values,
        timestamp: now,
      });
    }
  },

  deleteRecord: (recordId, permanent = false) => {
    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return;

    const now = new Date().toISOString();
    const existingRecord = data.records.find((r) => r.id === recordId);
    let records: DataRecord[];

    if (permanent) {
      records = data.records.filter((r) => r.id !== recordId);
    } else {
      records = data.records.map((r) =>
        r.id === recordId ? { ...r, isDeleted: true, deletedAt: now, updatedAt: now } : r
      );
    }

    let updatedData = {
      ...data,
      records,
      metadata: {
        ...data.metadata,
        totalRecords: permanent ? data.metadata.totalRecords - 1 : data.metadata.totalRecords,
      },
      lastModified: now,
    };
    updatedData = addActivityLog(updatedData, 'delete', `Xóa bản ghi${permanent ? ' vĩnh viễn' : ''}`, existingRecord?.moduleId, recordId);
    appStore.setData(updatedData);

    // Push to undo stack (only for soft delete)
    if (!permanent && existingRecord) {
      useUndoStore.getState().pushAction({
        type: 'delete',
        recordId,
        moduleId: existingRecord.moduleId,
        previousValues: existingRecord.values,
        timestamp: now,
      });
    }
  },

  restoreRecord: (recordId) => {
    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return;

    const now = new Date().toISOString();
    const records = data.records.map((r) =>
      r.id === recordId
        ? { ...r, isDeleted: false, deletedAt: undefined, updatedAt: now }
        : r
    );

    let updatedData = { ...data, records, lastModified: now };
    updatedData = addActivityLog(updatedData, 'restore', `Khôi phục bản ghi từ thùng rác`, undefined, recordId);
    appStore.setData(updatedData);
  },

  getRecordsByModule: (moduleId) => {
    const data = useAppStore.getState().data;
    if (!data) return [];
    return data.records.filter((r) => (r.moduleId === moduleId || r.linkedModuleId === moduleId) && !r.isDeleted);
  },

  getRecordById: (recordId) => {
    const data = useAppStore.getState().data;
    if (!data) return undefined;
    return data.records.find((r) => r.id === recordId);
  },

  getFilteredRecords: (moduleId) => {
    const { searchQuery, filters, sortField, sortDirection, dateFrom, dateTo, filterCategory, filterModule } = get();
    const data = useAppStore.getState().data;
    if (!data) return [];

    // Get module to find date field
    const module = data.modules.find((m) => m.id === moduleId);
    const dateField = module?.fields.find(
      (f) => f.fieldType === 'date' && (f.fieldName === 'date' || f.fieldName === 'order_date' || f.fieldName === 'month')
    );

    let records = data.records.filter((r) =>
      (r.moduleId === moduleId || r.linkedModuleId === moduleId ||
       // Legacy support: categoryId might be a module link
       (r.categoryId && r.categoryId.startsWith('mod_') && r.categoryId === moduleId)
      ) && !r.isDeleted
    );

    // CORE LOGIC: If search is active, bypass ALL filters and search entire module data
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      records = records.filter((r) =>
        Object.values(r.values).some((v) =>
          v !== null && String(v).toLowerCase().includes(query)
        )
      );
    } else {
      // No search → apply all filters normally

      // Apply date range filter
      if (dateField && (dateFrom || dateTo)) {
        const dateFieldName = dateField.fieldName;
        records = records.filter((r) => {
          let dateVal = r.values[dateField.id];
          if (dateVal === undefined) {
            const key = Object.keys(r.values).find((k) => k.endsWith('_' + dateFieldName));
            if (key) dateVal = r.values[key];
          }
          if (!dateVal) return true;
          const recordDate = String(dateVal);
          if (dateFrom && recordDate < dateFrom) return false;
          if (dateTo && recordDate > dateTo) return false;
          return true;
        });
      }

      // Apply category filter
      if (filterCategory) {
        records = records.filter((r) => {
          const catId = r.categoryId && !r.categoryId.startsWith('mod_') ? r.categoryId : undefined;
          return catId === filterCategory;
        });
      }

      // Apply module filter
      if (filterModule) {
        records = records.filter((r) => {
          const linked = r.linkedModuleId || (r.categoryId?.startsWith('mod_') ? r.categoryId : undefined);
          return linked === filterModule;
        });
      }

      // Apply account filter
      const { filterAccount, filterWarrantyAlert } = get();
      if (filterAccount) {
        records = records.filter((r) => {
          const accKey = Object.keys(r.values).find((k) => k.endsWith('_account'));
          return accKey ? String(r.values[accKey] ?? '') === filterAccount : false;
        });
      }

      // Apply warranty alert filter
      if (filterWarrantyAlert) {
        const appData = useAppStore.getState().data;
        const alertDays = appData?.settings?.warrantyAlertDays ?? 10;
        const now = new Date();
        records = records.filter((r) => {
          const wk = r.values['mod_chitieu_warranty_date'];
          if (!wk || wk === '' || wk === null) return false;
          const wd = new Date(String(wk));
          if (isNaN(wd.getTime())) return false;
          const dl = Math.ceil((wd.getTime() - now.getTime()) / 86400000);
          return dl <= alertDays;
        });
      }

      // Apply custom filters
      for (const filter of filters) {
        records = records.filter((r) => applyFilter(r, filter));
      }
    }

    // Apply sort
    if (sortField) {
      records.sort((a, b) => {
        const aVal = a.values[sortField];
        const bVal = b.values[sortField];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = String(aVal).localeCompare(String(bVal), 'vi', { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    } else if (dateField) {
      // Default: sort by date desc, then createdAt desc (newest first within same day)
      const dfn = dateField.fieldName;
      records.sort((a, b) => {
        let aDate = a.values[dateField.id];
        let bDate = b.values[dateField.id];
        if (aDate === undefined) {
          const k = Object.keys(a.values).find((x) => x.endsWith('_' + dfn));
          if (k) aDate = a.values[k];
        }
        if (bDate === undefined) {
          const k = Object.keys(b.values).find((x) => x.endsWith('_' + dfn));
          if (k) bDate = b.values[k];
        }
        const dateCmp = String(bDate ?? '').localeCompare(String(aDate ?? ''));
        if (dateCmp !== 0) return dateCmp;
        // Secondary sort: createdAt desc (newest created first within same date)
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } else {
      records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    return records;
  },

  // Get title/note suggestions from past records - sorted by most recent first, then frequency
  getTitleSuggestions: (moduleId, query) => {
    if (!query || query.length < 1) return [];
    const data = useAppStore.getState().data;
    if (!data) return [];

    const module = data.modules.find((m) => m.id === moduleId);
    const titleField = module?.fields.find(
      (f) => f.fieldName === 'title' || f.fieldName === 'order_name'
    );
    const noteField = module?.fields.find((f) => f.fieldName === 'note');

    // Track frequency and most recent date for each suggestion
    const titleInfo = new Map<string, { count: number; lastDate: string }>();
    const lowerQuery = query.toLowerCase();

    for (const record of data.records) {
      if (record.moduleId !== moduleId || record.isDeleted) continue;

      // Search title field
      if (titleField) {
        // Try direct field id match first
        let title = record.values[titleField.id];
        // Fallback: try key ending with _title or _order_name
        if (title === undefined || title === null) {
          const key = Object.keys(record.values).find((k) => k.endsWith('_title') || k.endsWith('_order_name'));
          if (key) title = record.values[key];
        }
        if (title && typeof title === 'string' && title.toLowerCase().includes(lowerQuery)) {
          const existing = titleInfo.get(title);
          const recDate = record.createdAt || record.updatedAt || '';
          if (existing) {
            existing.count++;
            if (recDate > existing.lastDate) existing.lastDate = recDate;
          } else {
            titleInfo.set(title, { count: 1, lastDate: recDate });
          }
        }
      }

      // Also search note field for suggestions
      if (noteField) {
        const note = record.values[noteField.id];
        if (note && typeof note === 'string' && note.toLowerCase().includes(lowerQuery) && !titleInfo.has(note)) {
          const recDate = record.createdAt || record.updatedAt || '';
          titleInfo.set(note, { count: 1, lastDate: recDate });
        }
      }

      // Fallback: search values with _title or _note suffix
      if (!titleField) {
        for (const [key, val] of Object.entries(record.values)) {
          if ((key.endsWith('_title') || key.endsWith('_note')) && val && typeof val === 'string') {
            if (val.toLowerCase().includes(lowerQuery) && !titleInfo.has(val)) {
              titleInfo.set(val, { count: 1, lastDate: record.createdAt || '' });
            }
          }
        }
      }
    }

    // Sort: prefix matches first, then by most recent, then by frequency
    const entries = Array.from(titleInfo.entries());
    entries.sort((a, b) => {
      const aPrefix = a[0].toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      const bPrefix = b[0].toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      // Most recent first
      if (a[1].lastDate !== b[1].lastDate) return b[1].lastDate.localeCompare(a[1].lastDate);
      return b[1].count - a[1].count; // Then higher frequency
    });

    return entries.slice(0, 10).map(([title]) => title);
  },
}));

function applyFilter(record: DataRecord, filter: FilterCondition): boolean {
  const value = record.values[filter.fieldId];

  switch (filter.operator) {
    case 'eq':
      return value === filter.value;
    case 'neq':
      return value !== filter.value;
    case 'gt':
      return Number(value) > Number(filter.value);
    case 'gte':
      return Number(value) >= Number(filter.value);
    case 'lt':
      return Number(value) < Number(filter.value);
    case 'lte':
      return Number(value) <= Number(filter.value);
    case 'contains':
      return String(value ?? '').toLowerCase().includes(String(filter.value).toLowerCase());
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(value as string);
    case 'between':
      return Number(value) >= Number(filter.value) && Number(value) <= Number(filter.value2);
    default:
      return true;
  }
}
