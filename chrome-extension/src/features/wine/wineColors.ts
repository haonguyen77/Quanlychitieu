// ─── Wine color palette: single synced source of truth ─────────────────────
// The palette lives in finance.json as `data.wineColorPalette` ({code,label}[])
// and is synced across app / extension / webapp. localStorage['wine_color_codes']
// is kept ONLY as a one-time migration fallback for older installs — it is no
// longer the long-term source. Changing the palette here does NOT change color
// values already stored on records (mod_ruou_color); it only changes the list
// of selectable colors.

import type { FinanceData } from '@/types';

export interface WineColor { code: string; label: string; }

export const DEFAULT_WINE_COLORS: WineColor[] = [
  { code: 'DL', label: 'Da lươn' },
  { code: 'DEN', label: 'Đen' },
  { code: 'HONG', label: 'Hồng' },
  { code: 'TRANG', label: 'Trắng' },
  { code: 'XN', label: 'Xanh ngọc' },
  { code: 'XR', label: 'Xanh rêu' },
  { code: 'XBB', label: 'Xanh bút bi' },
];

const LEGACY_KEY = 'wine_color_codes';

/** Read the legacy localStorage palette (migration fallback only). */
function readLegacyPalette(): WineColor[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WineColor[];
    if (Array.isArray(parsed) && parsed.every((c) => c && typeof c.code === 'string')) return parsed;
  } catch { /* ignore */ }
  return null;
}

/**
 * Resolve the wine color palette for display/selection.
 * Priority: data.wineColorPalette → legacy localStorage → defaults.
 */
export function getWineColorPalette(data: FinanceData | null | undefined): WineColor[] {
  const fromData = (data as unknown as { wineColorPalette?: WineColor[] } | null | undefined)?.wineColorPalette;
  if (Array.isArray(fromData) && fromData.length > 0) return fromData;
  const legacy = readLegacyPalette();
  if (legacy && legacy.length > 0) return legacy;
  return DEFAULT_WINE_COLORS;
}

/**
 * Return a new FinanceData with the palette set. Caller is responsible for
 * persisting (setData + indexedDBService.saveData). Also mirrors to legacy
 * localStorage so any not-yet-migrated read path stays consistent until reload.
 */
export function setWineColorPalette(data: FinanceData, palette: WineColor[]): FinanceData {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(palette)); } catch { /* ignore */ }
  return {
    ...data,
    wineColorPalette: palette,
    lastModified: new Date().toISOString(),
  } as FinanceData;
}

/** Look up a label by code, falling back to the code itself. */
export function wineColorLabel(palette: WineColor[], code: string): string {
  return palette.find((c) => c.code === code)?.label ?? code;
}
