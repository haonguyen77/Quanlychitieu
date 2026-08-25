import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { cryptoService } from '@/services/crypto/cryptoService';
import { passcodeService } from '@/services/passcode/passcodeService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';

/**
 * SecurityMobile — 2 independent sections:
 * 1. PIN bảo vệ dữ liệu (encryption) — setup/change PIN, re-encrypt data.
 * 2. Passcode khóa ứng dụng (app lock) — enable/disable/change, no encryption effect.
 */
export function SecurityMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [pinEnabled] = useState(cryptoService.isEnabled());
  const [passcodeEnabled, setPasscodeEnabled] = useState(passcodeService.isEnabled());
  const [mode, setMode] = useState<'none' | 'pin-set' | 'pin-change' | 'pc-set' | 'pc-change' | 'pc-off'>('none');
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reset = () => { setMode('none'); setF1(''); setF2(''); setF3(''); setErr(''); };
  const numInput = (val: string, set: (v: string) => void, placeholder: string) => (
    <input type="password" inputMode="numeric" value={val} maxLength={6}
      onChange={e => { set(e.target.value.replace(/\D/g, '')); setErr(''); }}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg tracking-widest text-center outline-none focus:border-purple-500" />
  );

  // ─── PIN handlers ───────────────────────────────────────────────────────
  const handleResetPin = async () => {
    const ok = window.confirm(
      '⚠️ CẢNH BÁO: Reset PIN\n\n' +
      'Thao tác này sẽ XÓA TOÀN BỘ DỮ LIỆU mã hóa trên thiết bị này và trên Google Drive.\n\n' +
      'Sau khi reset, bạn sẽ tạo PIN mới và bắt đầu lại từ đầu.\n\n' +
      'Bạn có chắc chắn muốn tiếp tục?'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await cryptoService.disable();
      await indexedDBService.clearData();
      try { sessionStorage.removeItem('__pdp_k'); } catch {}
      try { localStorage.removeItem('pdp_pin_prompted'); } catch {}
      // Try to delete Drive file if connected
      try {
        const { driveService } = await import('@/services/drive/driveService');
        const { createDefaultFinanceData } = await import('@/core/defaults/defaultData');
        if (driveService.token) {
          const file = await driveService.findFile();
          if (file) {
            // Upload valid default data (not empty) so other clients don't crash
            await driveService.uploadFile(createDefaultFinanceData());
          }
        }
      } catch {}
    } catch {}
    setBusy(false);
    location.reload();
  };

  const handlePinSet = async () => {
    if (!/^\d{4,6}$/.test(f1)) { setErr('PIN gồm 4-6 chữ số'); return; }
    if (f1 !== f2) { setErr('Nhập lại PIN không khớp'); return; }
    if (!data) return;
    setBusy(true);
    await cryptoService.setupPin(f1);
    await indexedDBService.saveData(data);
    setBusy(false); reset();
    setMsg('Đã thiết lập PIN mã hóa dữ liệu.');
    setTimeout(() => setMsg(''), 5000);
  };

  const handlePinChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('PIN mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại PIN mới không khớp'); return; }
    if (!data) return;
    setBusy(true);
    const ok = await cryptoService.changePin(f1, f2);
    if (!ok) { setBusy(false); setErr('PIN hiện tại không đúng'); return; }
    await indexedDBService.saveData(data); // re-encrypt with new key
    setBusy(false); reset();
    setMsg('Đã đổi PIN. Dữ liệu đã được mã hóa lại. Nhấn Đồng bộ để cập nhật Drive.');
    setTimeout(() => setMsg(''), 6000);
  };

  // ─── Passcode handlers ──────────────────────────────────────────────────
  const handlePcSet = async () => {
    if (!/^\d{4,6}$/.test(f1)) { setErr('Passcode gồm 4-6 chữ số'); return; }
    if (f1 !== f2) { setErr('Nhập lại Passcode không khớp'); return; }
    setBusy(true);
    await passcodeService.setup(f1);
    setBusy(false); setPasscodeEnabled(true); reset();
    setMsg('Đã bật Passcode khóa ứng dụng.');
    setTimeout(() => setMsg(''), 5000);
  };

  const handlePcChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('Passcode mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại Passcode không khớp'); return; }
    setBusy(true);
    const ok = await passcodeService.change(f1, f2);
    if (!ok) { setBusy(false); setErr('Passcode hiện tại không đúng'); return; }
    setBusy(false); reset();
    setMsg('Đã đổi Passcode.');
    setTimeout(() => setMsg(''), 5000);
  };

  const handlePcOff = async () => {
    setBusy(true);
    const ok = await passcodeService.disable(f1);
    if (!ok) { setBusy(false); setErr('Passcode không đúng'); return; }
    setBusy(false); setPasscodeEnabled(false); reset();
    setMsg('Đã tắt Passcode.');
    setTimeout(() => setMsg(''), 5000);
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Bảo mật</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {msg && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs text-green-700">{msg}</div>}

        {/* ═══ SECTION 1: PIN BẢO VỆ DỮ LIỆU ═══ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E8F5E9' }}>
              <ShieldCheck size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">PIN bảo vệ dữ liệu</p>
              <p className="text-[10px] text-gray-500">Mã hóa và giải mã dữ liệu tài chính trên Google Drive.</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">Trạng thái: <span className="font-medium">{pinEnabled ? '✓ Đã thiết lập' : '○ Chưa thiết lập'}</span></p>

          {mode === 'none' && (
            <div className="flex gap-2">
              {!pinEnabled ? (
                <button onClick={() => setMode('pin-set')} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#6C2BD9' }}>Thiết lập PIN</button>
              ) : (
                <>
                  <button onClick={() => setMode('pin-change')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700">Đổi PIN</button>
                  <button onClick={handleResetPin} className="flex-1 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500">Reset PIN</button>
                </>
              )}
            </div>
          )}

          {mode === 'pin-set' && (
            <div className="space-y-2">
              {numInput(f1, setF1, 'Nhập PIN (4-6 số)')}
              {numInput(f2, setF2, 'Nhập lại PIN')}
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={handlePinSet} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Lưu</button>
              </div>
            </div>
          )}

          {mode === 'pin-change' && (
            <div className="space-y-2">
              {numInput(f1, setF1, 'PIN hiện tại')}
              {numInput(f2, setF2, 'PIN mới')}
              {numInput(f3, setF3, 'Nhập lại PIN mới')}
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={handlePinChange} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Đổi</button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-3">PIN được dùng để mã hóa dữ liệu và đồng bộ Google Drive an toàn. Nếu quên PIN, dữ liệu đã mã hóa không thể khôi phục.</p>
        </div>

        {/* ═══ SECTION 2: PASSCODE KHÓA ỨNG DỤNG ═══ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}>
              <KeyRound size={20} style={{ color: '#6C2BD9' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Passcode khóa ứng dụng</p>
              <p className="text-[10px] text-gray-500">Yêu cầu nhập Passcode mỗi lần mở app. Không ảnh hưởng dữ liệu.</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">Trạng thái: <span className="font-medium">{passcodeEnabled ? '● Đang bật' : '○ Tắt'}</span></p>

          {mode === 'none' && (
            <div className="flex gap-2">
              {!passcodeEnabled ? (
                <button onClick={() => setMode('pc-set')} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#6C2BD9' }}>Bật Passcode</button>
              ) : (
                <>
                  <button onClick={() => setMode('pc-change')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700">Đổi Passcode</button>
                  <button onClick={() => setMode('pc-off')} className="flex-1 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500">Tắt</button>
                </>
              )}
            </div>
          )}

          {mode === 'pc-set' && (
            <div className="space-y-2">
              {numInput(f1, setF1, 'Nhập Passcode (4-6 số)')}
              {numInput(f2, setF2, 'Nhập lại Passcode')}
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={handlePcSet} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Bật</button>
              </div>
            </div>
          )}

          {mode === 'pc-change' && (
            <div className="space-y-2">
              {numInput(f1, setF1, 'Passcode hiện tại')}
              {numInput(f2, setF2, 'Passcode mới')}
              {numInput(f3, setF3, 'Nhập lại Passcode mới')}
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={handlePcChange} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Đổi</button>
              </div>
            </div>
          )}

          {mode === 'pc-off' && (
            <div className="space-y-2">
              {numInput(f1, setF1, 'Nhập Passcode để tắt')}
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
                <button onClick={handlePcOff} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Tắt</button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-3">Passcode chỉ khóa quyền truy cập giao diện. Đổi Passcode không ảnh hưởng dữ liệu mã hóa hoặc Google Drive.</p>
        </div>
      </div>
    </div>
  );
}
