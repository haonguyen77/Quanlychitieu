import { useEffect, useCallback } from 'react';
import { useUndoStore } from '@/core/store/undoStore';

interface KeyboardShortcutOptions {
  onNewRecord?: () => void;
  onDeleteSelected?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for module views:
 * - Ctrl+N or N (when not focused on input): Open new record form
 * - Delete/Backspace (when not focused on input): Delete selected records
 * - Ctrl+Z: Undo last action
 * - Ctrl+Shift+Z: Redo last undone action
 */
export function useKeyboardShortcuts({ onNewRecord, onDeleteSelected, enabled = true }: KeyboardShortcutOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

    // Ctrl+Z: Undo (always works)
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      useUndoStore.getState().undo();
      return;
    }

    // Ctrl+Shift+Z: Redo (always works)
    if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      useUndoStore.getState().redo();
      return;
    }

    // Ctrl+N or Alt+N: new record (always works, even in inputs)
    if ((e.ctrlKey && e.key === 'n') || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
      e.preventDefault();
      onNewRecord?.();
      return;
    }

    // Skip shortcuts below when input is focused
    if (isInputFocused) return;

    // N key (without modifiers): new record
    if (e.key === 'n' || e.key === 'N') {
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onNewRecord?.();
        return;
      }
    }

    // Delete or Backspace: delete selected records
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDeleteSelected?.();
      return;
    }
  }, [enabled, onNewRecord, onDeleteSelected]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
