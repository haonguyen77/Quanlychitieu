import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/components/ui/Icon';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import * as XLSX from 'xlsx';

interface Props {
  onClose: () => void;
}

interface ImportRow {
  sku: string;
  name: string;
  shortName: string;
  volume: string;
  wineType: string;
  bottleType: string;
  note: string;
}

const TEMPLATE_COLUMNS = ['SKU', 'Tên dài', 'Tên ngắn', 'ML', 'Loại rượu', 'Loại chai', 'Ghi chú'];

// Map wine type labels to values
const WINE_TYPE_MAP: Record<string, string> = {
  'gạo': 'gao', 'gao': 'gao',
  'nếp': 'nep', 'nep': 'nep',
  'đậu xanh': 'dauxanh', 'dau xanh': 'dauxanh', 'dauxanh': 'dauxanh',
  'vang nếp': 'vangnep', 'vang nep': 'vangnep', 'vangnep': 'vangnep',
  'đtht': 'dtht', 'dtht': 'dtht',
};

// Map bottle type labels to values
const BOTTLE_TYPE_MAP: Record<string, string> = {
  'pet': 'pet',
  'sứ': 'su', 'su': 'su',
  'thuỷ tinh': 'thuytinh', 'thủy tinh': 'thuytinh', 'thuy tinh': 'thuytinh', 'thuytinh': 'thuytinh',
};

export function WineProductImportDialog({ onClose }: Props) {
  const { data } = useAppStore();
  const addRecord = useRecordStore((s) => s.addRecord);
  const updateRecord = useRecordStore((s) => s.updateRecord);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Existing products indexed by SKU for upsert
  const existingBySku = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const r of data.records) {
      if (r.moduleId === 'mod_ruou_products' && !r.isDeleted) {
        const sku = String(r.values['mod_ruou_products_sku'] ?? '').trim();
        if (sku) map.set(sku.toLowerCase(), r.id);
      }
    }
    return map;
  }, [data]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // SKU
      { wch: 35 }, // Tên dài
      { wch: 20 }, // Tên ngắn
      { wch: 8 },  // ML
      { wch: 12 }, // Loại rượu
      { wch: 12 }, // Loại chai
      { wch: 25 }, // Ghi chú
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
    XLSX.writeFile(wb, 'Template_San_Pham.xlsx');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

      const parsed: ImportRow[] = jsonData.map((row) => {
        // Support both Vietnamese headers and English field names
        const sku = String(row['SKU'] ?? row['sku'] ?? '').trim();
        const name = String(row['Tên dài'] ?? row['Ten dai'] ?? row['name'] ?? '').trim();
        const shortName = String(row['Tên ngắn'] ?? row['Ten ngan'] ?? row['shortName'] ?? '').trim();
        const volume = String(row['ML'] ?? row['ml'] ?? row['volume'] ?? '').trim();
        const wineType = String(row['Loại rượu'] ?? row['Loai ruou'] ?? row['wineType'] ?? '').trim();
        const bottleType = String(row['Loại chai'] ?? row['Loai chai'] ?? row['bottleType'] ?? '').trim();
        const note = String(row['Ghi chú'] ?? row['Ghi chu'] ?? row['note'] ?? '').trim();

        return { sku, name, shortName, volume, wineType, bottleType, note };
      }).filter((r) => r.sku || r.name); // Filter out completely empty rows

      setRows(parsed);
      setResult(null);
    } catch {
      alert('Không đọc được file. Hãy đảm bảo file đúng định dạng .xlsx hoặc .csv');
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = () => {
    if (rows.length === 0) return;
    setImporting(true);

    const errors: string[] = [];
    let success = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name) {
        errors.push(`Dòng ${i + 1}: Thiếu tên sản phẩm`);
        continue;
      }

      // Resolve wine type
      const wineTypeVal = WINE_TYPE_MAP[row.wineType.toLowerCase()] ?? row.wineType;
      // Resolve bottle type
      const bottleTypeVal = BOTTLE_TYPE_MAP[row.bottleType.toLowerCase()] ?? row.bottleType;
      // Strip "ml" from volume
      const volumeClean = row.volume.replace(/\s*ml\s*/i, '').trim();

      const values = {
        mod_ruou_products_sku: row.sku,
        mod_ruou_products_product_name: row.name,
        mod_ruou_products_short_name: row.shortName,
        mod_ruou_products_volume_ml: volumeClean ? Number(volumeClean) : null,
        mod_ruou_products_wine_type: wineTypeVal || null,
        mod_ruou_products_bottle_type: bottleTypeVal || null,
        mod_ruou_products_note: row.note || null,
      };

      try {
        // Check if SKU already exists → update
        const existingId = row.sku ? existingBySku.get(row.sku.toLowerCase()) : undefined;
        if (existingId) {
          updateRecord(existingId, values);
          updated++;
        } else {
          addRecord('mod_ruou_products', values);
          success++;
        }
      } catch {
        errors.push(`Dòng ${i + 1}: Lỗi khi xử lý "${row.name}"`);
      }
    }

    setResult({ success, updated, errors });
    setImporting(false);
    if (errors.length === 0) {
      setRows([]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="upload" size={18} className="text-purple-600" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">Import Sản phẩm từ Excel</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-medium">Hướng dẫn:</p>
            <p>1. Tải template Excel → điền thông tin sản phẩm</p>
            <p>2. Chọn file để import. Các cột: <strong>{TEMPLATE_COLUMNS.join(', ')}</strong></p>
            <p>3. Xem trước dữ liệu rồi nhấn "Import"</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={downloadTemplate} className="px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5">
              <Icon name="download" size={13} /> Tải template
            </button>
            <label className="px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-1.5">
              <Icon name="upload" size={13} /> Chọn file Excel
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="border border-[var(--color-border)] rounded-lg overflow-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">#</th>
                    {TEMPLATE_COLUMNS.map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{i + 1}</td>
                      <td className="px-2 py-1 font-mono text-[var(--color-text)]">{row.sku}</td>
                      <td className="px-2 py-1 text-[var(--color-text)]">{row.name}</td>
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{row.shortName}</td>
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{row.volume}</td>
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{row.wineType}</td>
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{row.bottleType}</td>
                      <td className="px-2 py-1 text-[var(--color-text-secondary)]">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-3 text-xs ${result.errors.length > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'}`}>
              <p className="font-medium">Kết quả: {result.success} mới, {result.updated} cập nhật (trùng SKU)</p>
              {result.errors.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {result.errors.map((err, i) => (<p key={i}>• {err}</p>))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {rows.length > 0 ? `${rows.length} sản phẩm sẽ được import` : 'Chưa có dữ liệu'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Đóng
            </button>
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="upload" size={13} />
              {importing ? 'Đang import...' : `Import ${rows.length} SP`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
