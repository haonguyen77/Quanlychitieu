import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { syncService } from '@/services/sync/syncService';
import { driveService } from '@/services/drive/driveService';
import { parseCSV, importCSVToModule } from '@/services/export/exportService';
import { exportToGoogleSheets, importFromGoogleSheets } from '@/services/sheets/sheetsService';
import { Icon } from '@/shared/components/ui/Icon';
import { SharedConfigSection } from './SharedConfigSection';
import { ReminderSection } from './ReminderSection';
import { RecurringReminderSection } from './RecurringReminderSection';
import { SecuritySection } from './SecuritySection';
import { cryptoService, type EncryptedEnvelope } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { PinPromptModal } from '@/features/mobile/PinPromptModal';

export function SettingsView() {
  const { data, userEmail, setSyncing, setData, setAuth } = useAppStore();
  const [syncStatus, setSyncStatus] = useState('');
  const [pinPrompt, setPinPrompt] = useState<{ mode: 'create' | 'enter'; remoteEnv?: EncryptedEnvelope } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinErr, setPinErr] = useState('');

  // Ensure a PIN/key before syncing — Google Drive must always store encrypted data.
  const ensurePinThenSync = async () => {
    if (cryptoService.hasKey()) return true;
    let token = driveService.token;
    if (!token) {
      token = await driveService.login();
      if (!token) { setSyncStatus(`Lỗi: ${driveService.getLastError() || 'Unknown'}`); return false; }
      const profile = await driveService.getUserProfile();
      if (profile) setAuth(profile.email, profile.avatar || undefined);
    }
    let raw: unknown = null;
    try { raw = await driveService.fetchRemoteRaw(); } catch { /* no file */ }
    if (raw && cryptoService.isEncryptedEnvelope(raw)) { setPinErr(''); setPinPrompt({ mode: 'enter', remoteEnv: raw as EncryptedEnvelope }); }
    else if (cryptoService.isEnabled()) { setPinErr(''); setPinPrompt({ mode: 'enter' }); }
    else { setPinErr(''); setPinPrompt({ mode: 'create' }); }
    return false;
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pinPrompt) return;
    setPinBusy(true); setPinErr('');
    try {
      if (pinPrompt.mode === 'create') {
        await cryptoService.setupPin(pin);
        if (data) await indexedDBService.saveData(data);
      } else if (pinPrompt.remoteEnv) {
        const decrypted = await cryptoService.establishFromEnvelope(pin, pinPrompt.remoteEnv);
        if (!decrypted) { setPinBusy(false); setPinErr('Mã PIN không đúng'); return; }
        await indexedDBService.saveData(decrypted as never);
        setData(decrypted as never);
      } else {
        const ok = await cryptoService.verifyPin(pin);
        if (!ok) { setPinBusy(false); setPinErr('Mã PIN không đúng'); return; }
      }
      setPinBusy(false); setPinPrompt(null);
      await doSync();
    } catch (e) { setPinBusy(false); setPinErr(String(e)); }
  };

  const handleSync = async () => {
    const ready = await ensurePinThenSync();
    if (ready) await doSync();
  };

  const doSync = async () => {
    setSyncing(true);
    setSyncStatus('Đang đồng bộ...');
    try {
      let token = driveService.token;
      if (!token) {
        token = await driveService.login();
        if (!token) { setSyncStatus(`Lỗi: ${driveService.getLastError() || 'Unknown'}`); setSyncing(false); return; }
        const profile = await driveService.getUserProfile();
        if (profile) setAuth(profile.email, profile.avatar || undefined);
      }
      const result = await syncService.fullSync();
      if (result.status === 'error') {
        // Try re-login on auth errors
        await driveService.revokeToken();
        const freshToken = await driveService.login();
        if (freshToken) {
          const profile = await driveService.getUserProfile();
          if (profile) setAuth(profile.email, profile.avatar || undefined);
          const retry = await syncService.fullSync();
          if (retry.data) setData({ ...retry.data, metadata: { ...retry.data.metadata, lastSyncAt: new Date().toISOString() } });
          else if (retry.status === 'success') { const s = useAppStore.getState(); if (s.data) setData({ ...s.data, metadata: { ...s.data.metadata, lastSyncAt: new Date().toISOString() } }); }
          setSyncStatus(`✓ ${retry.message}`);
        } else { setSyncStatus(`Lỗi: ${driveService.getLastError() || 'Unknown'}`); }
      } else {
        if (result.data) {
          const recordCount = result.data.records?.length ?? 0;
          setData({ ...result.data, metadata: { ...result.data.metadata, lastSyncAt: new Date().toISOString() } });
          setSyncStatus(`✓ ${result.message} (${recordCount} giao dịch)`);
        } else if (result.status === 'success') {
          const s = useAppStore.getState();
          if (s.data) setData({ ...s.data, metadata: { ...s.data.metadata, lastSyncAt: new Date().toISOString() } });
          setSyncStatus(`✓ ${result.message}`);
        } else {
          setSyncStatus(`✓ ${result.message}`);
        }
      }
    } catch (err) {
      await driveService.revokeToken();
      setSyncStatus(`Lỗi: ${err instanceof Error ? err.message : 'Unknown'}. Nhấn lại để thử.`);
    }
    setSyncing(false);
    setTimeout(() => setSyncStatus(''), 5000);
  };

  const handleExport = async () => {
    await syncService.exportJSON();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const result = await syncService.importJSON(file);
        if (result.data) {
          setData(result.data);
        }
      }
    };
    input.click();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 border-b border-[var(--color-border)]">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Cài đặt</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Quản lý ứng dụng</p>
      </div>

      <div className="p-6 max-w-2xl space-y-5">
        {/* Reminder */}
        <ReminderSection />

        {/* Recurring Reminders */}
        <RecurringReminderSection />

        {/* Warranty notification */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Thông báo bảo hành</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--color-text-secondary)]">Cảnh báo trước</label>
            <input type="number" className="input-field py-1.5 px-2 w-16 text-sm text-center"
              value={data?.settings?.warrantyAlertDays ?? 10}
              onChange={(e) => {
                const days = parseInt(e.target.value, 10);
                if (!isNaN(days) && days >= 0) {
                  const appStore = useAppStore.getState();
                  appStore.updateSettings({ warrantyAlertDays: days });
                }
              }}
              min="0" max="90" />
            <span className="text-sm text-[var(--color-text-secondary)]">ngày</span>
          </div>
        </section>

        {/* Google Drive Sync */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Google Drive</h2>
          <div className="space-y-3">
            {/* Account info */}
            {userEmail && userEmail !== 'offline@local' && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Icon name="user" size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-text)]">{userEmail}</div>
                  <div className="text-[10px] text-green-600">Đã kết nối</div>
                </div>
                <button onClick={async () => { await driveService.revokeToken(); useAppStore.getState().clearAuth(); }}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-red-500">Ngắt kết nối</button>
              </div>
            )}
            {/* Sync button + status */}
            <div className="flex items-center gap-3">
              <button onClick={handleSync} className="btn-primary flex items-center gap-2 justify-center w-44">
                <Icon name="refresh" size={15} />
                Đồng bộ ngay
              </button>
              {syncStatus && (
                <span className={`text-xs ${syncStatus.startsWith('✓') ? 'text-green-600' : syncStatus.startsWith('Lỗi') ? 'text-red-500' : 'text-[var(--color-text-secondary)]'}`}>
                  {syncStatus}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {data?.metadata.lastSyncAt
                ? `Lần cuối: ${new Date(data.metadata.lastSyncAt).toLocaleString('vi-VN')}`
                : 'Chưa đồng bộ'} · Auto sync khi có thay đổi
            </div>
            {/* Debug: Drive diagnostics */}
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                🔍 Kiểm tra dữ liệu Drive
              </summary>
              <DriveDebugPanel />
            </details>
          </div>
        </section>

        {/* Security: PIN encryption */}
        <SecuritySection />

        {/* Shared Config: Tài khoản, Danh mục, Người nhận */}
        <SharedConfigSection />

        {/* Module ON/OFF */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Quản lý Module</h2>
          <div className="space-y-3">
            {[
              { key: 'pdp_ws_chitieu', label: 'Quản lý chi tiêu', desc: 'Chi tiêu, Shopee, Vàng, Nhà trọ, Thẻ tín dụng' },
              { key: 'pdp_ws_ruou', label: 'Quản lý rượu', desc: 'Đơn hàng, Khách hàng, Kho, Sản phẩm' },
            ].map((mod) => {
              const enabled = localStorage.getItem(mod.key) !== '0';
              return (
                <div key={mod.key} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-[var(--color-text)]">{mod.label}</span>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{mod.desc}</p>
                  </div>
                  <button
                    onClick={() => { localStorage.setItem(mod.key, enabled ? '0' : '1'); window.location.reload(); }}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">OFF = ẩn module, dữ liệu vẫn giữ nguyên</p>
        </section>

        {/* Backup - 6 buttons only */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Sao lưu & Xuất dữ liệu</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
              <Icon name="download" size={15} />
              Export JSON
            </button>
            <button onClick={handleImport} className="btn-secondary flex items-center gap-2">
              <Icon name="upload" size={15} />
              Import JSON
            </button>
            <button onClick={() => {
              if (!data) return;
              const XLSX = (window as any).__xlsx || import('xlsx').then(m => { (window as any).__xlsx = m; return m; });
              Promise.resolve(XLSX).then((xlsx: any) => {
                const wb = xlsx.utils.book_new();
                const sheetDefs = [
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
                  const records = data.records.filter((r: any) => r.moduleId === sheet.moduleId && !r.isDeleted);
                  const headers = sheet.columns.map((c) => c.label);
                  const rows = records.map((r: any) => sheet.columns.map((c) => { const v = r.values[c.key]; if (v == null) return ''; if (c.type === 'n') return Number(v) || 0; return String(v); }));
                  const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
                  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
                  ws['!cols'] = headers.map((h: string, i: number) => { let max = h.length; for (const row of rows) { const c = String(row[i] ?? ''); if (c.length > max) max = c.length; } return { wch: Math.min(Math.max(max + 2, 8), 40) }; });
                  xlsx.utils.book_append_sheet(wb, ws, sheet.name);
                }
                const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `chitieu-data-${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
              });
            }} className="btn-secondary flex items-center gap-2">
              <Icon name="download" size={15} />
              Export Excel (.xlsx)
            </button>
            <button onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = '.csv,.xlsx';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file || !data) return;
                const text = await file.text();
                const rows = parseCSV(text);
                if (rows.length < 2) { alert('File CSV trống'); return; }
                const mapping: Record<number, string> = {};
                const headerMap: Record<string, string> = { 'ngày': 'date', 'tên giao dịch': 'title', 'số tiền': 'amount', 'loại': 'type', 'tài khoản': 'account', 'ghi chú': 'note' };
                rows[0].forEach((h, i) => { const m = headerMap[h.toLowerCase()]; if (m) mapping[i] = m; });
                const { updatedData, result } = importCSVToModule(data, 'mod_chitieu', rows, mapping);
                if (result.success) { setData(updatedData); alert(`Đã import ${result.recordsImported} bản ghi`); }
                else alert(`Lỗi: ${result.errors.join(', ')}`);
              };
              input.click();
            }} className="btn-secondary flex items-center gap-2">
              <Icon name="upload" size={15} />
              Import CSV / Excel
            </button>
            <button onClick={async () => {
              if (!data) return;
              setSyncStatus('Đang export Google Sheets...');
              try {
                const url = await exportToGoogleSheets(data);
                if (url) { setSyncStatus('✓ Exported'); window.open(url, '_blank'); }
                else setSyncStatus('Lỗi: Không thể tạo spreadsheet');
              } catch (e) { setSyncStatus(`Lỗi: ${e instanceof Error ? e.message : 'Unknown'}`); }
              setTimeout(() => setSyncStatus(''), 5000);
            }} className="btn-secondary flex items-center gap-2">
              <Icon name="upload" size={15} />
              Export Google Sheets
            </button>
            <button onClick={async () => {
              if (!data) return;
              const url = prompt('Nhập URL hoặc ID Google Sheets:');
              if (!url) return;
              const id = url.includes('/') ? url.match(/\/d\/([^/]+)/)?.[1] || url : url;
              if (!id) { alert('URL không hợp lệ'); return; }
              setSyncStatus('Đang import...');
              try {
                const updated = await importFromGoogleSheets(id, data);
                setData(updated);
                setSyncStatus(`✓ Imported`);
              } catch (e) { setSyncStatus(`Lỗi: ${e instanceof Error ? e.message : 'Unknown'}`); }
              setTimeout(() => setSyncStatus(''), 5000);
            }} className="btn-secondary flex items-center gap-2">
              <Icon name="download" size={15} />
              Import Google Sheets
            </button>
          </div>
        </section>

        {/* Data info */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Thông tin dữ liệu</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Tổng bản ghi</span>
              <span className="font-medium text-[var(--color-text)]">{data?.metadata.totalRecords || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Modules</span>
              <span className="font-medium text-[var(--color-text)]">{data?.modules.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Schema version</span>
              <span className="font-medium text-[var(--color-text)]">{data?.version || '—'}</span>
            </div>
          </div>
        </section>
      </div>

      {pinPrompt && (
        <PinPromptModal
          mode={pinPrompt.mode}
          busy={pinBusy}
          error={pinErr}
          title={pinPrompt.mode === 'create' ? 'Tạo mã PIN để đồng bộ' : 'Nhập mã PIN'}
          subtitle={pinPrompt.mode === 'create'
            ? 'Google Drive chỉ lưu dữ liệu đã mã hóa. Đặt mã PIN để bảo mật (dùng chung để mở khóa app).'
            : 'Dữ liệu trên Drive đã mã hóa. Nhập đúng mã PIN để giải mã và đồng bộ.'}
          onSubmit={handlePinSubmit}
          onCancel={() => { setPinPrompt(null); setPinErr(''); }}
        />
      )}
    </div>
  );
}


// ─── Drive Debug Panel ─────────────────────────────────────────────────────

function DriveDebugPanel() {
  const [info, setInfo] = useState<{
    connected: boolean;
    email?: string;
    fileFound: boolean;
    fileId?: string;
    fileModified?: string;
    fileSize?: string;
    moduleCount?: number;
    recordCount?: number;
    accountCount?: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    setInfo(null);
    try {
      // 1. Check connection
      const token = driveService.token;
      if (!token) {
        setInfo({ connected: false, fileFound: false, error: 'Not authenticated. Login first.' });
        setLoading(false);
        return;
      }

      // 2. Get profile
      const profile = await driveService.getUserProfile();
      const email = profile?.email || 'Unknown';

      // 3. Find file
      const file = await driveService.findFile();
      if (!file) {
        setInfo({ connected: true, email, fileFound: false, error: 'finance.json not found on Drive' });
        setLoading(false);
        return;
      }

      // 4. Download and inspect
      const data = await driveService.downloadFile(file.id);
      if (!data) {
        setInfo({ connected: true, email, fileFound: true, fileId: file.id, fileModified: file.modifiedTime, error: 'Failed to download file content' });
        setLoading(false);
        return;
      }

      const jsonStr = JSON.stringify(data);
      const sizeKB = (jsonStr.length / 1024).toFixed(1);

      setInfo({
        connected: true,
        email,
        fileFound: true,
        fileId: file.id,
        fileModified: new Date(file.modifiedTime).toLocaleString('vi-VN'),
        fileSize: `${sizeKB} KB`,
        moduleCount: data.modules?.length ?? 0,
        recordCount: data.records?.length ?? 0,
        accountCount: data.accounts?.length ?? 0,
      });
    } catch (err) {
      setInfo({ connected: false, fileFound: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
    setLoading(false);
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-[var(--color-border)] space-y-2">
      <button onClick={check} disabled={loading}
        className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50">
        {loading ? 'Đang kiểm tra...' : 'Kiểm tra Drive'}
      </button>
      {info && (
        <div className="space-y-1 font-mono text-[11px]">
          <div>Google: <span className={info.connected ? 'text-green-600' : 'text-red-500'}>{info.connected ? 'Connected' : 'Not connected'}</span></div>
          {info.email && <div>Email: {info.email}</div>}
          <div>finance.json: <span className={info.fileFound ? 'text-green-600' : 'text-red-500'}>{info.fileFound ? 'Found' : 'Not found'}</span></div>
          {info.fileId && <div>File ID: {info.fileId.slice(0, 20)}...</div>}
          {info.fileModified && <div>Modified: {info.fileModified}</div>}
          {info.fileSize && <div>Size: {info.fileSize}</div>}
          {info.moduleCount !== undefined && <div>Modules: {info.moduleCount}</div>}
          {info.recordCount !== undefined && <div>Records: {info.recordCount}</div>}
          {info.accountCount !== undefined && <div>Accounts: {info.accountCount}</div>}
          {info.error && <div className="text-red-500">Error: {info.error}</div>}
        </div>
      )}
    </div>
  );
}
