import { useState, useRef } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { showConfirm } from './mobileDialog';
import { ArrowLeft, Download, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import type { FinanceData } from '@/types';

export function BackupRestoreMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!data) { setStatus({ type: 'error', msg: 'Không có dữ liệu để export' }); return; }
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: 'Đã export thành công!' });
    } catch (e) {
      setStatus({ type: 'error', msg: 'Lỗi export: ' + String(e) });
    }
  };

  const handleExportExcel = async () => {
    if (!data) { setStatus({ type: 'error', msg: 'Không có dữ liệu để export' }); return; }
    try {
      const xlsx = await import('xlsx');
      const wb = xlsx.utils.book_new();
      const sheetDefs: { name: string; moduleId: string; columns: { key: string; label: string; type?: 'n' }[] }[] = [
        { name: 'Chi tiêu', moduleId: 'mod_chitieu', columns: [
          { key: 'mod_chitieu_date', label: 'Ngày' }, { key: 'mod_chitieu_title', label: 'Tên giao dịch' },
          { key: 'mod_chitieu_amount', label: 'Số tiền', type: 'n' }, { key: 'mod_chitieu_type', label: 'Loại' },
          { key: 'mod_chitieu_account', label: 'Tài khoản' }, { key: 'mod_chitieu_beneficiary', label: 'Người nhận' },
          { key: 'mod_chitieu_quantity', label: 'Số lượng', type: 'n' }, { key: 'mod_chitieu_warranty_months', label: 'Tháng BH', type: 'n' },
          { key: 'mod_chitieu_warranty_date', label: 'Hạn BH' }, { key: 'mod_chitieu_note', label: 'Ghi chú' },
        ]},
        { name: 'Shopee', moduleId: 'mod_shopee', columns: [
          { key: 'mod_shopee_date', label: 'Ngày' }, { key: 'mod_shopee_order_name', label: 'Tên đơn' },
          { key: 'mod_shopee_amount', label: 'Số tiền', type: 'n' }, { key: 'mod_shopee_status', label: 'Trạng thái' },
          { key: 'mod_shopee_category', label: 'Phân loại' }, { key: 'mod_shopee_note', label: 'Ghi chú' },
        ]},
        { name: 'Vàng', moduleId: 'mod_vang', columns: [
          { key: 'mod_vang_date', label: 'Ngày' }, { key: 'mod_vang_type', label: 'Loại GD' },
          { key: 'mod_vang_gold_type', label: 'Loại vàng' }, { key: 'mod_vang_quantity', label: 'Số lượng', type: 'n' },
          { key: 'mod_vang_price_per_unit', label: 'Giá/chỉ', type: 'n' }, { key: 'mod_vang_total_amount', label: 'Tổng tiền', type: 'n' },
          { key: 'mod_vang_note', label: 'Ghi chú' },
        ]},
        { name: 'Nhà trọ', moduleId: 'mod_nhatro', columns: [
          { key: 'mod_nhatro_month', label: 'Tháng' }, { key: 'mod_nhatro_room_name', label: 'Phòng' },
          { key: 'mod_nhatro_tenant_name', label: 'Người thuê' }, { key: 'mod_nhatro_rent_amount', label: 'Tiền phòng', type: 'n' },
          { key: 'mod_nhatro_electricity', label: 'Điện', type: 'n' }, { key: 'mod_nhatro_water', label: 'Nước', type: 'n' },
          { key: 'mod_nhatro_internet', label: 'Internet', type: 'n' }, { key: 'mod_nhatro_total', label: 'Tổng', type: 'n' },
          { key: 'mod_nhatro_status', label: 'Trạng thái' }, { key: 'mod_nhatro_note', label: 'Ghi chú' },
        ]},
        { name: 'Thẻ tín dụng', moduleId: 'mod_creditcard', columns: [
          { key: 'mod_creditcard_card_name', label: 'Tên thẻ' }, { key: 'mod_creditcard_bank_name', label: 'Ngân hàng' },
          { key: 'mod_creditcard_last4', label: '4 số cuối' }, { key: 'mod_creditcard_credit_limit', label: 'Hạn mức', type: 'n' },
          { key: 'mod_creditcard_is_installment', label: 'Trả góp' }, { key: 'mod_creditcard_installment_months', label: 'Số tháng', type: 'n' },
          { key: 'mod_creditcard_installment_amount', label: 'Tiền/tháng', type: 'n' }, { key: 'mod_creditcard_installment_remaining', label: 'Còn lại', type: 'n' },
          { key: 'mod_creditcard_note', label: 'Ghi chú' },
        ]},
      ];
      for (const sheet of sheetDefs) {
        const records = data.records.filter(r => r.moduleId === sheet.moduleId && !r.isDeleted);
        const headers = sheet.columns.map(c => c.label);
        const rows = records.map(r => sheet.columns.map(c => { const v = r.values[c.key]; if (v == null) return ''; if (c.type === 'n') return Number(v) || 0; return String(v); }));
        const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
        if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
        ws['!cols'] = headers.map((h, i) => { let max = h.length; for (const row of rows) { const cVal = String(row[i] ?? ''); if (cVal.length > max) max = cVal.length; } return { wch: Math.min(Math.max(max + 2, 8), 40) }; });
        xlsx.utils.book_append_sheet(wb, ws, sheet.name);
      }
      const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `chitieu-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: 'Đã export Excel thành công!' });
    } catch (e) {
      setStatus({ type: 'error', msg: 'Lỗi export Excel: ' + String(e) });
    }
  };

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as FinanceData;
      // Validate structure
      if (!parsed.version || !parsed.modules || !parsed.records || !Array.isArray(parsed.records)) {
        setStatus({ type: 'error', msg: 'File không đúng format finance.json (thiếu version/modules/records)' });
        return;
      }
      const ok = await showConfirm({ title: 'Ghi đè dữ liệu?', message: `Import sẽ ghi đè toàn bộ dữ liệu hiện tại.\n\nFile: ${file.name}\nRecords: ${parsed.records.length}\nModules: ${parsed.modules.length}`, confirmLabel: 'Import', danger: true });
      if (!ok) return;
      // Import
      useAppStore.getState().setData({ ...parsed, lastModified: new Date().toISOString() });
      setStatus({ type: 'success', msg: `Import thành công! ${parsed.records.length} records, ${parsed.modules.length} modules.` });
    } catch (err) {
      setStatus({ type: 'error', msg: 'Lỗi đọc file: ' + (err instanceof SyntaxError ? 'JSON không hợp lệ' : String(err)) });
    }
    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Sao lưu & Khôi phục</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-4">
        {/* Status */}
        {status && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${status.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {status.type === 'success' ? <CheckCircle size={18} className="text-green-600" /> : <AlertCircle size={18} className="text-red-500" />}
            <span className={`text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{status.msg}</span>
          </div>
        )}

        {/* Export */}
        <div className="border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-1">Export (Sao lưu)</h3>
          <p className="text-xs text-gray-500 mb-3">Tải xuống file finance.json chứa toàn bộ dữ liệu.</p>
          <button onClick={handleExport} className="w-full py-3 rounded-lg bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98]">
            <Download size={16} /> Export finance.json
          </button>
          <button onClick={handleExportExcel} className="w-full mt-2 py-3 rounded-lg border border-green-600 text-green-700 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98]">
            <Download size={16} /> Export Excel (.xlsx)
          </button>
          {data && <p className="text-[10px] text-gray-400 mt-2 text-center">{data.records.length} records • {data.modules.length} modules • {data.accounts?.length || 0} accounts</p>}
        </div>

        {/* Import */}
        <div className="border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-1">Import (Khôi phục)</h3>
          <p className="text-xs text-gray-500 mb-3">Chọn file finance.json để khôi phục dữ liệu. Dữ liệu hiện tại sẽ bị ghi đè.</p>
          <button onClick={handleImport} className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 flex items-center justify-center gap-2 active:bg-gray-50">
            <Upload size={16} /> Chọn file finance.json
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileSelected} className="hidden" />
        </div>

        {/* Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs text-yellow-800"><strong>Lưu ý:</strong> Import sẽ ghi đè toàn bộ dữ liệu. Hãy export trước khi import nếu cần giữ dữ liệu cũ. Google Drive sync sẽ đồng bộ dữ liệu mới sau khi import.</p>
        </div>
      </div>
    </div>
  );
}
