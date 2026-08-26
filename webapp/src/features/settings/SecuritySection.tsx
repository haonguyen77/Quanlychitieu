import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { passcodeService } from '@/services/passcode/passcodeService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { ShieldCheck, KeyRound } from 'lucide-react';

/** Shared numeric password input used by both cards. */
function pinInput(val: string, set: (v: string) => void, ph: string, onClear: () => void) {
  return (
    <input type="password" inputMode="numeric" value={val} maxLength={6}
      onChange={(e) => { set(e.target.value.replace(/\D/g, '')); onClear(); }}
      placeholder={ph} className="input-field py-2 px-3 text-sm tracking-widest w-full" />
  );
}

/**
 * PinCard — "PIN bảo vệ dữ liệu" (encryption). Independent card so it can sit in
 * the top grid alongside Google Drive and Passcode.
 */
export function PinCard() {
  const { data } = useAppStore();
  const [pinEnabled] = useState(cryptoService.isEnabled());
  const [mode, setMode] = useState<'none' | 'set' | 'change'>('none');
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('none'); setF1(''); setF2(''); setF3(''); setErr(''); };

  const handleReset = async () => {
    const ok = window.confirm('⚠️ CẢNH BÁO: Reset PIN\n\nThao tác này sẽ XÓA TOÀN BỘ DỮ LIỆU mã hóa trên thiết bị này và trên Google Drive.\n\nSau khi reset, bạn sẽ tạo PIN mới và bắt đầu lại từ đầu.\n\nBạn có chắc chắn muốn tiếp tục?');
    if (!ok) return;
    setBusy(true);
    try {
      await cryptoService.disable();
      await indexedDBService.clearData();
      try { sessionStorage.removeItem('__pdp_k'); } catch {}
      try { localStorage.removeItem('pdp_pin_prompted'); } catch {}
      try { const { driveService } = await import('@/services/drive/driveService'); const { createDefaultFinanceData } = await import('@/core/defaults/defaultData'); if (driveService.token) { const file = await driveService.findFile(); if (file) await driveService.uploadFile(createDefaultFinanceData()); } } catch {}
    } catch {}
    setBusy(false);
    location.reload();
  };

  const handleSet = async () => {
    if (!/^\d{4,6}$/.test(f1)) { setErr('PIN gồm 4-6 chữ số'); return; }
    if (f1 !== f2) { setErr('Nhập lại PIN không khớp'); return; }
    if (!data) return;
    setBusy(true); await cryptoService.setupPin(f1); await indexedDBService.saveData(data); setBusy(false); reset();
    setMsg('Đã thiết lập PIN mã hóa.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('PIN mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại PIN mới không khớp'); return; }
    if (!data) return;
    setBusy(true);
    const ok = await cryptoService.changePin(f1, f2);
    if (!ok) { setBusy(false); setErr('PIN hiện tại không đúng'); return; }
    await indexedDBService.saveData(data); setBusy(false); reset();
    setMsg('Đã đổi PIN. Nhấn Đồng bộ để cập nhật Drive.'); setTimeout(() => setMsg(''), 6000);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50"><ShieldCheck size={18} className="text-green-600" /></div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">PIN bảo vệ dữ liệu</h2>
          <p className="text-[10px] text-[var(--color-text-secondary)]">Mã hóa dữ liệu tài chính trên Google Drive.</p>
        </div>
      </div>
      {msg && <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">Trạng thái: <span className="font-medium">{pinEnabled ? '✓ Đã thiết lập' : '○ Chưa thiết lập'}</span></p>
      {mode === 'none' && (
        !pinEnabled
          ? <button onClick={() => setMode('set')} className="btn-primary text-sm">Thiết lập PIN</button>
          : <div className="flex gap-2"><button onClick={() => setMode('change')} className="btn-secondary text-sm">Đổi PIN</button><button onClick={handleReset} className="btn-secondary text-sm text-red-500">Reset PIN</button></div>
      )}
      {mode === 'set' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Nhập PIN (4-6 số)', () => setErr(''))}{pinInput(f2, setF2, 'Nhập lại PIN', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Lưu</button></div></div>}
      {mode === 'change' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'PIN hiện tại', () => setErr(''))}{pinInput(f2, setF2, 'PIN mới', () => setErr(''))}{pinInput(f3, setF3, 'Nhập lại PIN mới', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-3">Nếu quên PIN, dữ liệu đã mã hóa không thể khôi phục.</p>
    </section>
  );
}

/**
 * PasscodeCard — "Passcode khóa ứng dụng" (app lock, does not touch data).
 */
export function PasscodeCard() {
  const [passcodeEnabled, setPasscodeEnabled] = useState(passcodeService.isEnabled());
  const [mode, setMode] = useState<'none' | 'set' | 'change' | 'off'>('none');
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('none'); setF1(''); setF2(''); setF3(''); setErr(''); };

  const handleSet = async () => {
    if (!/^\d{4,6}$/.test(f1)) { setErr('Passcode gồm 4-6 chữ số'); return; }
    if (f1 !== f2) { setErr('Nhập lại Passcode không khớp'); return; }
    setBusy(true); await passcodeService.setup(f1); setBusy(false); setPasscodeEnabled(true); reset();
    setMsg('Đã bật Passcode.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('Passcode mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại Passcode không khớp'); return; }
    setBusy(true); const ok = await passcodeService.change(f1, f2);
    if (!ok) { setBusy(false); setErr('Passcode hiện tại không đúng'); return; }
    setBusy(false); reset(); setMsg('Đã đổi Passcode.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleOff = async () => {
    setBusy(true); const ok = await passcodeService.disable(f1);
    if (!ok) { setBusy(false); setErr('Passcode không đúng'); return; }
    setBusy(false); setPasscodeEnabled(false); reset(); setMsg('Đã tắt Passcode.'); setTimeout(() => setMsg(''), 5000);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}><KeyRound size={18} style={{ color: '#6C2BD9' }} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Passcode khóa ứng dụng</h2>
          <p className="text-[10px] text-[var(--color-text-secondary)]">Khóa ứng dụng khi mở. Không ảnh hưởng dữ liệu.</p>
        </div>
      </div>
      {msg && <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">Trạng thái: <span className="font-medium">{passcodeEnabled ? '● Đang bật' : '○ Tắt'}</span></p>
      {mode === 'none' && (
        !passcodeEnabled
          ? <button onClick={() => setMode('set')} className="btn-primary text-sm">Bật Passcode</button>
          : <div className="flex gap-2"><button onClick={() => setMode('change')} className="btn-secondary text-sm">Đổi Passcode</button><button onClick={() => setMode('off')} className="btn-secondary text-sm text-red-500">Tắt</button></div>
      )}
      {mode === 'set' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Nhập Passcode (4-6 số)', () => setErr(''))}{pinInput(f2, setF2, 'Nhập lại Passcode', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Bật</button></div></div>}
      {mode === 'change' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Passcode hiện tại', () => setErr(''))}{pinInput(f2, setF2, 'Passcode mới', () => setErr(''))}{pinInput(f3, setF3, 'Nhập lại Passcode mới', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
      {mode === 'off' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Nhập Passcode để tắt', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleOff} disabled={busy} className="text-sm flex-1 rounded-lg bg-red-500 text-white py-2 disabled:opacity-50">Tắt</button></div></div>}
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-3">Đổi Passcode không ảnh hưởng mã hóa dữ liệu hoặc Google Drive.</p>
    </section>
  );
}

/** Backward-compatible combined section (PIN + Passcode stacked). */
export function SecuritySection() {
  return (
    <>
      <div className="mb-4"><PinCard /></div>
      <PasscodeCard />
    </>
  );
}
