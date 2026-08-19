import { create } from 'zustand';
import type { RecordValues } from '@/types';
import { useAppStore } from './appStore';

const MAX_HISTORY = 50;

export interface UndoAction {
  type: 'add' | 'update' | 'delete';
  recordId: string;
  moduleId?: string;
  previousValues?: RecordValues;
  newValues?: RecordValues;
  categoryId?: string;
  linkedModuleId?: string;
  timestamp: string;
}

interface UndoState {
  past: UndoAction[];
  future: UndoAction[];
  pushAction: (action: UndoAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],

  pushAction: (action) => {
    set((state) => ({
      past: [...state.past, action].slice(-MAX_HISTORY),
      future: [], // Clear redo stack on new action
    }));
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const action = past[past.length - 1];
    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return;

    const now = new Date().toISOString();

    switch (action.type) {
      case 'add': {
        // Undo add = soft delete the record
        const records = data.records.map((r) =>
          r.id === action.recordId ? { ...r, isDeleted: true, deletedAt: now, updatedAt: now } : r
        );
        appStore.setData({ ...data, records, lastModified: now });
        break;
      }
      case 'update': {
        // Undo update = restore previous values
        if (action.previousValues) {
          const records = data.records.map((r) =>
            r.id === action.recordId ? { ...r, values: { ...r.values, ...action.previousValues }, updatedAt: now } : r
          );
          appStore.setData({ ...data, records, lastModified: now });
        }
        break;
      }
      case 'delete': {
        // Undo delete = restore the record
        const records = data.records.map((r) =>
          r.id === action.recordId ? { ...r, isDeleted: false, deletedAt: undefined, updatedAt: now } : r
        );
        appStore.setData({ ...data, records, lastModified: now });
        break;
      }
    }

    set((state) => ({
      past: state.past.slice(0, -1),
      future: [action, ...state.future],
    }));
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const action = future[0];
    const appStore = useAppStore.getState();
    const data = appStore.data;
    if (!data) return;

    const now = new Date().toISOString();

    switch (action.type) {
      case 'add': {
        // Redo add = un-delete the record
        const records = data.records.map((r) =>
          r.id === action.recordId ? { ...r, isDeleted: false, deletedAt: undefined, updatedAt: now } : r
        );
        appStore.setData({ ...data, records, lastModified: now });
        break;
      }
      case 'update': {
        // Redo update = apply new values
        if (action.newValues) {
          const records = data.records.map((r) =>
            r.id === action.recordId ? { ...r, values: { ...r.values, ...action.newValues }, updatedAt: now } : r
          );
          appStore.setData({ ...data, records, lastModified: now });
        }
        break;
      }
      case 'delete': {
        // Redo delete = soft delete again
        const records = data.records.map((r) =>
          r.id === action.recordId ? { ...r, isDeleted: true, deletedAt: now, updatedAt: now } : r
        );
        appStore.setData({ ...data, records, lastModified: now });
        break;
      }
    }

    set((state) => ({
      past: [...state.past, action],
      future: state.future.slice(1),
    }));
  },
}));
