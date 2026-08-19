import type { FinanceData, DataRecord } from '@/types';
import { driveService } from '@/services/drive/driveService';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function getVal(record: DataRecord, fieldName: string): string {
  const k = Object.keys(record.values).find((x) => x.endsWith('_' + fieldName));
  return k ? String(record.values[k] ?? '') : '';
}

/**
 * Export all modules to Google Sheets (one sheet per module)
 */
export async function exportToGoogleSheets(data: FinanceData): Promise<string | null> {
  const token = driveService.token;
  if (!token) { await driveService.login(); }
  if (!driveService.token) return null;

  // Build sheets data
  const sheets: { title: string; data: string[][] }[] = [];

  for (const mod of data.modules.filter((m) => m.isActive)) {
    const records = data.records.filter((r) =>
      (r.moduleId === mod.id || r.linkedModuleId === mod.id) && !r.isDeleted
    );
    if (records.length === 0) continue;

    const fields = mod.fields.filter((f) => f.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
    const headers = fields.map((f) => f.fieldLabel);
    if (mod.categories?.length) headers.push('Danh mục');

    const rows = records.map((r) => {
      const vals = fields.map((f) => {
        const val = getVal(r, f.fieldName);
        if (f.fieldType === 'dropdown' && f.options) {
          return f.options.find((o) => o.value === val)?.label || val;
        }
        if (f.fieldType === 'money') {
          const n = Number(val);
          return isNaN(n) ? val : n.toLocaleString('vi-VN');
        }
        return val;
      });
      if (mod.categories?.length) {
        vals.push(mod.categories.find((c) => c.id === r.categoryId)?.name || '');
      }
      return vals;
    });

    sheets.push({ title: mod.name, data: [headers, ...rows] });
  }

  if (sheets.length === 0) return null;

  // Create spreadsheet with multiple sheets
  const createBody = {
    properties: { title: `Quản lý chi tiêu - ${new Date().toLocaleDateString('vi-VN')}` },
    sheets: sheets.map((s) => ({
      properties: { title: s.title },
      data: [{
        startRow: 0, startColumn: 0,
        rowData: s.data.map((row) => ({
          values: row.map((cell) => ({ userEnteredValue: { stringValue: cell } }))
        }))
      }]
    }))
  };

  const resp = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${driveService.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `Sheets API error: ${resp.status}`);
  }

  const result = await resp.json();
  return result.spreadsheetUrl || result.spreadsheetId;
}

/**
 * Import from Google Sheets by URL/ID
 */
export async function importFromGoogleSheets(spreadsheetId: string, data: FinanceData): Promise<FinanceData> {
  const token = driveService.token;
  if (!token) { await driveService.login(); }
  if (!driveService.token) throw new Error('Not authenticated');

  // Get all sheet names
  const metaResp = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${driveService.token}` },
  });
  if (!metaResp.ok) throw new Error('Cannot access spreadsheet');
  const meta = await metaResp.json();
  const sheetNames: string[] = meta.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];

  const now = new Date().toISOString();
  let newRecords: DataRecord[] = [];

  for (const sheetName of sheetNames) {
    // Find matching module
    const mod = data.modules.find((m) => m.name === sheetName);
    if (!mod) continue;

    // Read sheet data
    const range = encodeURIComponent(`'${sheetName}'`);
    const dataResp = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`, {
      headers: { Authorization: `Bearer ${driveService.token}` },
    });
    if (!dataResp.ok) continue;
    const sheetData = await dataResp.json();
    const rows: string[][] = sheetData.values || [];
    if (rows.length < 2) continue;

    const headers = rows[0];
    const fields = mod.fields.filter((f) => f.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);

    // Map headers to fields
    const colToField = new Map<number, typeof fields[0]>();
    headers.forEach((h, i) => {
      const field = fields.find((f) => f.fieldLabel === h);
      if (field) colToField.set(i, field);
    });

    // Parse rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => !c)) continue;

      const values: Record<string, unknown> = {};
      colToField.forEach((field, colIdx) => {
        const cellValue = row[colIdx] || '';
        if (field.fieldType === 'money' || field.fieldType === 'number') {
          const num = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
          values[field.id] = isNaN(num) ? null : num;
        } else if (field.fieldType === 'dropdown' && field.options) {
          // Match by label
          const opt = field.options.find((o) => o.label === cellValue);
          values[field.id] = opt?.value || cellValue;
        } else {
          values[field.id] = cellValue || null;
        }
      });

      // Find category by name
      const catColIdx = headers.indexOf('Danh mục');
      const catName = catColIdx >= 0 ? row[catColIdx] : '';
      const categoryId = catName ? (mod.categories?.find((c) => c.name === catName)?.id) : undefined;

      newRecords.push({
        id: `sheet_${Date.now()}_${i}_${mod.id}`,
        moduleId: mod.id,
        categoryId,
        values: values as DataRecord['values'],
        tags: [],
        images: [],
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    ...data,
    records: [...data.records, ...newRecords],
    metadata: { ...data.metadata, totalRecords: data.metadata.totalRecords + newRecords.length },
    lastModified: now,
  };
}
