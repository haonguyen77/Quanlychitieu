import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { getWineColorPalette } from './wineColors';

interface Props {
  onClose: () => void;
}

// Parsed row from Excel
interface ImportRow {
  rowNum: number;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerWard: string;
  customerCity: string;
  productName: string;
  productSku: string;
  color: string;
  quantity: number;
  price: number;
  glasses: number;
  boxes: number;
  shipFee: number;
  note1: string;
  note2: string;
  error?: string;
}

const TEMPLATE_COLS = [
  'Ngày đặt (dd/mm/yyyy)',
  'Tên khách hàng *',
  'SĐT',
  'Địa chỉ',
  'Phường/Xã',
  'Thành phố',
  'Tên SP *',
  'Mã SKU',
  'Màu (mã màu)',
  'Số lượng *',
  'Đơn giá *',
  'Ly',
  'Hộp',
  'Phí ship',
  'Ghi chú 1',
  'Ghi chú 2',
];

function parseDate(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Excel serial number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(raw).trim();
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* */ }
  return new Date().toISOString().slice(0, 10);
}

function n(v: unknown): number {
  const num = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function s(v: unknown): string {
  return String(v ?? '').trim();
}

export function WineOrderImportDialog({ onClose }: Props) {
  const { data } = useAppStore();
  const { addRecord } = useRecordStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const colorPalette = useMemo(() => getWineColorPalette(data), [data]);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  // Products list for dropdown validation in template
  const products = useMemo(() =>
    data ? data.records.filter(r => r.moduleId === 'mod_ruou_products' && !r.isDeleted)
      .map(r => ({
        name: s(r.values['mod_ruou_products_product_name']),
        sku: s(r.values['mod_ruou_products_sku']),
      })).filter(p => p.sku)
    : [], [data]);

  // ─── Download template ───────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Orders ──────────────────────────────────────────────────────
    const orderWs = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLS,
      // Sample row
      [
        new Date().toLocaleDateString('vi-VN'),
        'Nguyễn Văn A',
        '0901234567',
        '123 Đường ABC',
        'Phường 1',
        'TP.HCM',
        products[0]?.name || 'Gạo 1L',
        products[0]?.sku || 'G-1L',
        colorPalette[0]?.code || 'TRANG',
        1,
        150000,
        0,
        0,
        30000,
        '',
        '',
      ],
    ]);

    // Column widths
    orderWs['!cols'] = [
      { wch: 18 }, // Ngày
      { wch: 20 }, // Tên KH
      { wch: 14 }, // SĐT
      { wch: 28 }, // Địa chỉ
      { wch: 16 }, // Phường
      { wch: 14 }, // TP
      { wch: 24 }, // Tên SP
      { wch: 12 }, // SKU
      { wch: 12 }, // Màu
      { wch: 10 }, // SL
      { wch: 12 }, // Giá
      { wch: 6  }, // Ly
      { wch: 6  }, // Hộp
      { wch: 10 }, // Ship
      { wch: 20 }, // Note1
      { wch: 20 }, // Note2
    ];

    // Data validation: SKU dropdown (col H = index 7)
    if (products.length > 0) {
      const skuList = products.map(p => p.sku).join(',');
      if (skuList.length <= 255) { // Excel formula string limit
        orderWs['!dataValidation'] = orderWs['!dataValidation'] || [];
        (orderWs['!dataValidation'] as unknown[]).push({
          sqref: 'H2:H10000',
          type: 'list',
          formula1: `"${skuList}"`,
          showDropDown: false,
          showErrorMessage: true,
          errorTitle: 'SKU không hợp lệ',
          error: 'Chọn SKU từ danh sách',
        });
      }
    }

    // Color dropdown (col I = index 8)
    if (colorPalette.length > 0) {
      const colorList = colorPalette.map(c => c.code).join(',');
      if (colorList.length <= 255) {
        orderWs['!dataValidation'] = orderWs['!dataValidation'] || [];
        (orderWs['!dataValidation'] as unknown[]).push({
          sqref: 'I2:I10000',
          type: 'list',
          formula1: `"${colorList}"`,
          showDropDown: false,
          showErrorMessage: false,
        });
      }
    }

    XLSX.utils.book_append_sheet(wb, orderWs, 'Đơn hàng');

    // ── Sheet 2: Lookup (SKU + Màu reference) ─────────────────────────────────
    const lookupData: unknown[][] = [
      ['=== Danh sách SKU sản phẩm ===', '', '', '=== Bảng màu ===', ''],
      ['Mã SKU', 'Tên sản phẩm', '', 'Mã màu', 'Tên màu'],
    ];
    const maxLen = Math.max(products.length, colorPalette.length);
    for (let i = 0; i < maxLen; i++) {
      lookupData.push([
        products[i]?.sku ?? '',
        products[i]?.name ?? '',
        '',
        colorPalette[i]?.code ?? '',
        colorPalette[i]?.label ?? '',
      ]);
    }
    const lookupWs = XLSX.utils.aoa_to_sheet(lookupData);
    lookupWs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 4 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, lookupWs, 'Danh mục SKU & Màu');

    // Write and download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_don_hang_ruou.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Parse uploaded file ─────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

      // Find header row (first row that has ≥ 3 non-empty cells)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, raw.length); i++) {
        if (raw[i].filter(c => String(c).trim()).length >= 3) { headerIdx = i; break; }
      }

      const parsed: ImportRow[] = [];
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const r = raw[i];
        // Skip fully empty rows
        if (!r.some(c => String(c).trim())) continue;
        const customerName = s(r[1]);
        const productName = s(r[6]);
        const qty = n(r[9]);
        const price = n(r[10]);

        const row: ImportRow = {
          rowNum: i + 1,
          orderDate: parseDate(r[0]),
          customerName,
          customerPhone: s(r[2]),
          customerAddress: s(r[3]),
          customerWard: s(r[4]),
          customerCity: s(r[5]),
          productName,
          productSku: s(r[7]),
          color: s(r[8]),
          quantity: qty,
          price,
          glasses: n(r[11]),
          boxes: n(r[12]),
          shipFee: n(r[13]),
          note1: s(r[14]),
          note2: s(r[15]),
        };

        // Validate
        if (!customerName) row.error = 'Thiếu tên khách hàng';
        else if (!productName) row.error = 'Thiếu tên sản phẩm';
        else if (qty <= 0) row.error = 'Số lượng phải > 0';
        else if (price <= 0) row.error = 'Đơn giá phải > 0';

        parsed.push(row);
      }
      setRows(parsed);
      setDone(false);
    } catch (err) {
      alert('Lỗi đọc file. Vui lòng dùng file .xlsx đúng định dạng.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Import valid rows ────────────────────────────────────────────────────────
  const handleImport = () => {
    if (!data) return;
    setImporting(true);
    const validRows = rows.filter(r => !r.error);
    let count = 0;
    for (const row of validRows) {
      const totalAmount = row.price * row.quantity + row.shipFee;
      const values = {
        mod_ruou_order_date: row.orderDate,
        mod_ruou_customer_name: row.customerName,
        mod_ruou_customer_phone: row.customerPhone,
        mod_ruou_customer_address: row.customerAddress,
        mod_ruou_customer_district: row.customerWard,
        mod_ruou_customer_city: row.customerCity,
        mod_ruou_product_name: row.productName,
        mod_ruou_product_sku: row.productSku,
        mod_ruou_color: row.color,
        mod_ruou_quantity: row.quantity,
        mod_ruou_price: row.price,
        mod_ruou_glasses: row.glasses,
        mod_ruou_boxes: row.boxes,
        mod_ruou_ship_fee: row.shipFee,
        mod_ruou_total_amount: totalAmount,
        mod_ruou_note1: row.note1,
        mod_ruou_note2: row.note2,
        mod_ruou_skip_inventory: 1, // import = không tự trừ kho
        mod_ruou_product_lines: null,
      };
      addRecord('mod_ruou', values);
      count++;
    }
    setImportCount(count);
    setImporting(false);
    setDone(true);
  };

  const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '';
  const validCount = rows.filter(r => !r.error).length;
  const errorCount = rows.filter(r => r.error).length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col"
        style={{ width: 1100, maxWidth: '96vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Icon name="upload" size={16} color="#f05423" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Import đơn hàng từ Excel</h2>
              <p className="text-[11px] text-gray-500">Tải file .xlsx theo đúng template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            <Icon name="download" size={13} />
            Tải template mẫu
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#f05423] text-[#f05423] rounded-lg hover:bg-orange-50 cursor-pointer font-medium">
            <Icon name="file-text" size={13} />
            Chọn file Excel (.xlsx)
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>

          {rows.length > 0 && (
            <span className="text-xs text-gray-500">
              {rows.length} dòng đọc được —{' '}
              <span className="text-green-600 font-medium">{validCount} hợp lệ</span>
              {errorCount > 0 && <span className="text-red-500 font-medium"> · {errorCount} lỗi</span>}
            </span>
          )}
          <div className="flex-1" />
          {rows.length > 0 && !done && (
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#f05423] text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50"
            >
              <Icon name="check" size={13} />
              Import {validCount} đơn hàng
            </button>
          )}
        </div>

        {/* Done state */}
        {done && (
          <div className="mx-6 my-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 flex-shrink-0">
            <Icon name="check" size={15} color="#16a34a" />
            <span className="text-sm text-green-700 font-medium">Đã import thành công {importCount} đơn hàng!</span>
            <button onClick={onClose} className="ml-auto text-xs text-green-600 underline">Đóng</button>
          </div>
        )}

        {/* Preview table */}
        <div className="flex-1 overflow-auto px-6 py-2 min-h-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Icon name="upload" size={36} />
              <p className="text-sm">Chọn file Excel để xem preview trước khi import</p>
              <p className="text-xs">Tải template mẫu để biết đúng định dạng cần nhập</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                <tr className="text-left text-gray-600 dark:text-gray-300 [&>th]:px-2 [&>th]:py-1.5 [&>th]:border [&>th]:border-gray-200 [&>th]:whitespace-nowrap">
                  <th>#</th>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th>SĐT</th>
                  <th>Địa chỉ</th>
                  <th>Phường</th>
                  <th>TP</th>
                  <th>Tên SP</th>
                  <th>SKU</th>
                  <th>Màu</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Ly</th>
                  <th>Hộp</th>
                  <th>Ship</th>
                  <th>GC1</th>
                  <th>GC2</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowNum}
                    className={`[&>td]:px-2 [&>td]:py-1 [&>td]:border [&>td]:border-gray-100 [&>td]:max-w-[120px] [&>td]:truncate ${
                      row.error ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="text-gray-400">{row.rowNum}</td>
                    <td>{row.orderDate}</td>
                    <td className="font-medium text-gray-900 dark:text-white" title={row.customerName}>{row.customerName}</td>
                    <td>{row.customerPhone}</td>
                    <td title={row.customerAddress}>{row.customerAddress}</td>
                    <td>{row.customerWard}</td>
                    <td>{row.customerCity}</td>
                    <td title={row.productName}>{row.productName}</td>
                    <td className="font-mono text-purple-600">{row.productSku}</td>
                    <td>{row.color ? (colorPalette.find(c => c.code.toUpperCase() === row.color.toUpperCase())?.label ?? row.color) : ''}</td>
                    <td className="text-center font-medium">{row.quantity || ''}</td>
                    <td className="text-right tabular-nums">{fmtMoney(row.price)}</td>
                    <td className="text-center">{row.glasses || ''}</td>
                    <td className="text-center">{row.boxes || ''}</td>
                    <td className="text-right tabular-nums">{fmtMoney(row.shipFee)}</td>
                    <td title={row.note1}>{row.note1}</td>
                    <td title={row.note2}>{row.note2}</td>
                    <td>
                      {row.error
                        ? <span className="text-red-500 font-medium" title={row.error}>⚠ {row.error}</span>
                        : <span className="text-green-600">✓ OK</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p className="text-[10px] text-gray-400">
            Lưu ý: Import sẽ <b>không tự trừ kho</b>. Vào tab Kho để cập nhật tồn kho sau khi import.
          </p>
        </div>
      </div>
    </div>
  );
}
