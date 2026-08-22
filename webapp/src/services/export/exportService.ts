import type { FinanceData, DataRecord } from '@/types';

/**
 * Export/Import Service
 * Handles multi-sheet Excel export, CSV import, and data encryption.
 */

// ─── Helper: Get record value by field name ─────────────────────────────────
function getVal(record: DataRecord, fieldName: string): string {
  const k = Object.keys(record.values).find((x) => x.endsWith('_' + fieldName));
  return k ? String(record.values[k] ?? '') : '';
}

// ─── Export Multi-Sheet CSV (Tab-separated sheets in one download) ───────────
export function exportMultiSheetCSV(data: FinanceData): void {
  const sheets: { name: string; csv: string }[] = [];

  for (const mod of data.modules.filter((m) => m.isActive)) {
    const records = data.records.filter((r) =>
      (r.moduleId === mod.id || r.linkedModuleId === mod.id) && !r.isDeleted
    );
    if (records.length === 0) continue;

    // For filter modules (no fields), use Chi tiêu fields
    const effectiveFields = mod.fields.length > 0 ? mod.fields : (data.modules.find(m => m.id === 'mod_chitieu')?.fields || []);
    const fields = effectiveFields.filter((f) => f.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
    const headers = ['Ngày', ...fields.map((f) => f.fieldLabel), 'Danh mục', 'Module liên kết'];

    const rows = records.map((r) => {
      const date = getVal(r, 'date') || getVal(r, 'order_date') || getVal(r, 'month') || '';
      const fieldValues = fields.map((f) => {
        const val = getVal(r, f.fieldName);
        // Resolve dropdown labels
        if (f.fieldType === 'dropdown' && f.options) {
          const opt = f.options.find((o) => o.value === val);
          return opt?.label || val;
        }
        return val;
      });
      const catName = r.categoryId ? (mod.categories?.find((c) => c.id === r.categoryId)?.name || '') : '';
      const linkedMod = r.linkedModuleId ? (data.modules.find((m) => m.id === r.linkedModuleId)?.name || '') : '';
      return [date, ...fieldValues, catName, linkedMod];
    });

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    sheets.push({ name: mod.name, csv });
  }

  // Download each sheet as separate CSV (multi-sheet not possible in pure CSV)
  // Instead, create one combined file with sheet separators
  if (sheets.length === 1) {
    downloadFile(sheets[0].csv, `${sheets[0].name}_${dateStr()}.csv`, 'text/csv;charset=utf-8');
  } else {
    // Download as zip-like combined or individual files
    sheets.forEach((sheet) => {
      downloadFile(sheet.csv, `${sheet.name}_${dateStr()}.csv`, 'text/csv;charset=utf-8');
    });
  }
}

// ─── Export Single Module CSV ────────────────────────────────────────────────
export function exportModuleCSV(data: FinanceData, moduleId: string): void {
  const mod = data.modules.find((m) => m.id === moduleId);
  if (!mod) return;

  const records = data.records.filter((r) =>
    (r.moduleId === moduleId || r.linkedModuleId === moduleId) && !r.isDeleted
  );

  const fields = mod.fields.filter((f) => f.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
  const headers = fields.map((f) => f.fieldLabel);
  if (mod.categories?.length) headers.push('Danh mục');

  const rows = records.map((r) => {
    const vals = fields.map((f) => {
      const val = getVal(r, f.fieldName);
      if (f.fieldType === 'dropdown' && f.options) {
        return f.options.find((o) => o.value === val)?.label || val;
      }
      if (f.fieldType === 'money') return Number(val).toLocaleString('vi-VN');
      return val;
    });
    if (mod.categories?.length) {
      vals.push(mod.categories.find((c) => c.id === r.categoryId)?.name || '');
    }
    return vals;
  });

  const bom = '\uFEFF';
  const csv = bom + [headers, ...rows].map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  downloadFile(csv, `${mod.name}_${dateStr()}.csv`, 'text/csv;charset=utf-8');
}

// ─── Import CSV ──────────────────────────────────────────────────────────────
export function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

export interface ImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
}

export function importCSVToModule(
  data: FinanceData,
  moduleId: string,
  csvRows: string[][],
  columnMapping: Record<number, string> // colIndex → fieldName
): { updatedData: FinanceData; result: ImportResult } {
  const mod = data.modules.find((m) => m.id === moduleId);
  if (!mod) return { updatedData: data, result: { success: false, recordsImported: 0, errors: ['Module not found'] } };

  // For filter modules (no fields), use Chi tiêu fields and set linkedModuleId
  const isFilterModule = !mod.fields || mod.fields.length === 0;
  const chiTieu = data.modules.find(m => m.id === 'mod_chitieu');
  const effectiveFields = isFilterModule ? (chiTieu?.fields || []) : mod.fields;
  const effectiveModuleId = isFilterModule ? 'mod_chitieu' : moduleId;
  const linkedModuleId = isFilterModule ? moduleId : undefined;

  const now = new Date().toISOString();
  const newRecords: DataRecord[] = [];
  const errors: string[] = [];

  // Skip header row
  for (let i = 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    if (row.every((c) => !c)) continue; // skip empty rows

    const values: Record<string, unknown> = {};
    for (const [colIdx, fieldName] of Object.entries(columnMapping)) {
      const field = effectiveFields.find((f) => f.fieldName === fieldName);
      if (!field) continue;
      const cellValue = row[Number(colIdx)] || '';
      const fieldId = field.id;

      if (field.fieldType === 'money' || field.fieldType === 'number') {
        const num = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
        values[fieldId] = isNaN(num) ? null : num;
      } else {
        values[fieldId] = cellValue || null;
      }
    }

    newRecords.push({
      id: `rec_${Date.now()}_${i}`,
      moduleId: effectiveModuleId,
      linkedModuleId,
      values: values as DataRecord['values'],
      tags: [],
      images: [],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  const updatedData: FinanceData = {
    ...data,
    records: [...data.records, ...newRecords],
    metadata: { ...data.metadata, totalRecords: data.metadata.totalRecords + newRecords.length },
    lastModified: now,
  };

  return {
    updatedData,
    result: { success: true, recordsImported: newRecords.length, errors },
  };
}

// ─── Import Android App Backup (JSON) ────────────────────────────────────────
export function importAndroidBackup(file: FinanceData, existing: FinanceData): FinanceData {
  // Merge strategy: Add records from imported file that don't exist in current data
  const existingIds = new Set(existing.records.map((r) => r.id));
  const newRecords = file.records.filter((r) => !existingIds.has(r.id));

  return {
    ...existing,
    records: [...existing.records, ...newRecords],
    metadata: {
      ...existing.metadata,
      totalRecords: existing.metadata.totalRecords + newRecords.length,
    },
    lastModified: new Date().toISOString(),
  };
}

// ─── AES Encryption ──────────────────────────────────────────────────────────
export async function encryptData(data: FinanceData, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(dataStr));

  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...packed));
}

export async function decryptData(encryptedBase64: string, password: string): Promise<FinanceData | null> {
  try {
    const encoder = new TextEncoder();
    const packed = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const ciphertext = packed.slice(28);

    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json) as FinanceData;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
