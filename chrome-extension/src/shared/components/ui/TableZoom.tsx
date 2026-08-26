import { useSyncExternalStore } from 'react';

export type FontSize = 'sm' | 'base' | 'lg';

const FONT_CLASSES: Record<FontSize, string> = {
  sm: 'text-xs',
  base: 'text-sm',
  lg: 'text-base',
};

// Simple global store for font size (shared across all components)
let _fontSize: FontSize = (localStorage.getItem('wine_table_font') as FontSize) || 'base';
const listeners = new Set<() => void>();
function subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
function getSnapshot() { return _fontSize; }
function setFontSize(fs: FontSize) { _fontSize = fs; localStorage.setItem('wine_table_font', fs); listeners.forEach((fn) => fn()); }

export function useTableZoom() {
  const fontSize = useSyncExternalStore(subscribe, getSnapshot);
  const zoomIn = () => setFontSize(fontSize === 'sm' ? 'base' : 'lg');
  const zoomOut = () => setFontSize(fontSize === 'lg' ? 'base' : 'sm');
  return { fontSize, fontClass: FONT_CLASSES[fontSize], zoomIn, zoomOut };
}

// ── Compact/expand mode, per module (shared between header and table) ─────────
const compactListeners = new Set<() => void>();
function compactKey(moduleId: string) { return `pdp_compact_${moduleId}`; }
function readCompact(moduleId: string): boolean {
  const saved = localStorage.getItem(compactKey(moduleId));
  return saved === null ? true : saved === '1'; // default: compact (thu gọn)
}
export function setCompactMode(moduleId: string, val: boolean) {
  localStorage.setItem(compactKey(moduleId), val ? '1' : '0');
  compactListeners.forEach((fn) => fn());
}
export function useCompactMode(moduleId: string) {
  const compact = useSyncExternalStore(
    (fn) => { compactListeners.add(fn); return () => compactListeners.delete(fn); },
    () => readCompact(moduleId),
  );
  const toggle = () => setCompactMode(moduleId, !readCompact(moduleId));
  return { compact, toggle };
}

export function ZoomControls({ fontSize, onZoomIn, onZoomOut }: { fontSize: FontSize; onZoomIn: () => void; onZoomOut: () => void }) {
  return (
    <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-md overflow-hidden">
      <button onClick={onZoomOut} className="px-1.5 py-1 hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]" title="Thu nhỏ chữ" disabled={fontSize === 'sm'}>
        <span className="text-xs font-bold">A-</span>
      </button>
      <button onClick={onZoomIn} className="px-1.5 py-1 hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]" title="Phóng to chữ" disabled={fontSize === 'lg'}>
        <span className="text-xs font-bold">A+</span>
      </button>
    </div>
  );
}
