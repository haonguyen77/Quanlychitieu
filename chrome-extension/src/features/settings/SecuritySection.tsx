import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { passcodeService } from '@/services/passcode/passcodeService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { ShieldCheck, KeyRound } from 'lucide-react';

const pinInput = (val: string, set: (v: string) => void, ph: string, onClear: () => void) => (
  <input type="password" inputMode="numeric" value={val} maxLength={6}
    onChange={(e) => { set(e.target.value.replace(/\D/g, '')); onClear(); }}
    placeholder={ph} className="input-field py-2 px-3 text-sm tracking-widest w-full" />
);

/** PIN bảo vệ dữ liệu (encryption) — standalone card. */
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

  const handleResetPin = async () => {
    const ok = window.confirm('⚠️ CẢNH BÁO: Reset PIN\n\nThao tác này sẽ XÓA TOÀN BỘ DỮ LIỆU mã hóa trên thiết bị này và trên Google Drive.\n\nSau khi reset, bạn sẽ tạo PIN mới và bắt đầu lại từ đầu.\n\nBạn có chắc chắn muốn tiếp tục?');
    if (!ok) return;
    setBusy(true);
    try {
      await cryptoService.disable();
      await indexedDBService.clearData();
      try { sessionStorage.removeItem('__pdp_k'); } catch { /* */ }
      try { localStorage.removeItem('pdp_pin_prompted'); } catch { /* */ }
    } catch { /* */ }
    setBusy(false);
    location.reload();
  };

  const handleSet = async () => {
    if (!/^\d{4,6}$/.test(f1)) { setErr('PIN gồm 4-6 chữ số'); return; }
    if (f1 !== f2) { setErr('Nhập lại PIN không khớp'); return; }
    if (!data) return;
    setBusy(true); await cryptoService.setupPin(f1); await indexedDBService.saveData(data);
    setBusy(false); reset(); setMsg('Đã thiết lập PIN.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('PIN mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại không khớp'); return; }
    if (!data) return;
    setBusy(true); const ok = await cryptoService.changePin(f1, f2);
    if (!ok) { setBusy(false); setErr('PIN hiện tại sai'); return; }
    await indexedDBService.saveData(data);
    setBusy(false); reset(); setMsg('Đã đổi PIN.'); setTimeout(() => setMsg(''), 5000);
  };

  return (
    <section className="card p-5 h-full">
      <div className="flex items-center gap-2 mb-2"><ShieldCheck size={16} className="text-green-600" /><h2 className="text-sm font-semibold text-[var(--color-text)]">PIN bảo vệ dữ liệu</h2></div>
      <p className="text-[10px] text-[var(--color-text-secondary)] mb-2">Trạng thái: {pinEnabled ? '✓ Đã thiết lập' : '○ Chưa thiết lập'}</p>
      {msg && <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      {mode === 'none' && (!pinEnabled
        ? <button onClick={() => setMode('set')} className="btn-primary text-sm">Thiết lập PIN</button>
        : <div className="flex gap-2"><button onClick={() => setMode('change')} className="btn-secondary text-sm">Đổi PIN</button><button onClick={handleResetPin} className="btn-secondary text-sm text-red-500">Reset PIN</button></div>)}
      {mode === 'set' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'PIN (4-6 số)', () => setErr(''))}{pinInput(f2, setF2, 'Nhập lại PIN', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Lưu</button></div></div>}
      {mode === 'change' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'PIN hiện tại', () => setErr(''))}{pinInput(f2, setF2, 'PIN mới', () => setErr(''))}{pinInput(f3, setF3, 'Nhập lại PIN mới', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
      {mode === 'none' && <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">Quên PIN = mất dữ liệu đã mã hóa.</p>}
    </section>
  );
}

/** Passcode khóa ứng dụng (app lock) — standalone card. */
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
    if (f1 !== f2) { setErr('Nhập lại không khớp'); return; }
    setBusy(true); await passcodeService.setup(f1);
    setBusy(false); setPasscodeEnabled(true); reset(); setMsg('Đã bật Passcode.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleChange = async () => {
    if (!/^\d{4,6}$/.test(f2)) { setErr('Passcode mới gồm 4-6 chữ số'); return; }
    if (f2 !== f3) { setErr('Nhập lại không khớp'); return; }
    setBusy(true); const ok = await passcodeService.change(f1, f2);
    if (!ok) { setBusy(false); setErr('Passcode hiện tại sai'); return; }
    setBusy(false); reset(); setMsg('Đã đổi Passcode.'); setTimeout(() => setMsg(''), 5000);
  };
  const handleOff = async () => {
    setBusy(true); const ok = await passcodeService.disable(f1);
    if (!ok) { setBusy(false); setErr('Passcode sai'); return; }
    setBusy(false); setPasscodeEnabled(false); reset(); setMsg('Đã tắt Passcode.'); setTimeout(() => setMsg(''), 5000);
  };

  return (
    <section className="card p-5 h-full">
      <div className="flex items-center gap-2 mb-2"><KeyRound size={16} style={{ color: '#6C2BD9' }} /><h2 className="text-sm font-semibold text-[var(--color-text)]">Passcode khóa ứng dụng</h2></div>
      <p className="text-[10px] text-[var(--color-text-secondary)] mb-2">Trạng thái: {passcodeEnabled ? '● Đang bật' : '○ Tắt'}</p>
      {msg && <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">{msg}</div>}
      {mode === 'none' && (!passcodeEnabled
        ? <button onClick={() => setMode('set')} className="btn-primary text-sm">Bật Passcode</button>
        : <div className="flex gap-2"><button onClick={() => setMode('change')} className="btn-secondary text-sm">Đổi</button><button onClick={() => setMode('off')} className="btn-secondary text-sm text-red-500">Tắt</button></div>)}
      {mode === 'set' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Passcode (4-6 số)', () => setErr(''))}{pinInput(f2, setF2, 'Nhập lại', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Bật</button></div></div>}
      {mode === 'change' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Passcode hiện tại', () => setErr(''))}{pinInput(f2, setF2, 'Passcode mới', () => setErr(''))}{pinInput(f3, setF3, 'Nhập lại', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
      {mode === 'off' && <div className="space-y-2 max-w-xs">{pinInput(f1, setF1, 'Nhập Passcode để tắt', () => setErr(''))}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handleOff} disabled={busy} className="text-sm flex-1 rounded-lg bg-red-500 text-white py-2 disabled:opacity-50">Tắt</button></div></div>}
      {mode === 'none' && <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">Đổi Passcode không ảnh hưởng dữ liệu.</p>}
    </section>
  );
}

/** Backward-compatible combined section (kept for any other callers). */
export function SecuritySection() {
  return (<><div className="mb-4"><PinCard /></div><PasscodeCard /></>);
}
