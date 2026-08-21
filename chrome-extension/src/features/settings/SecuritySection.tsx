import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { passcodeService } from '@/services/passcode/passcodeService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { Lock, ShieldCheck, KeyRound } from 'lucide-react';

/**
 * SecuritySection (EXT) — 2 independent sections:
 * 1. PIN bảo vệ dữ liệu (encryption).
 * 2. Passcode khóa ứng dụng (app lock).
 */
export function SecuritySection() {
  const { data } = useAppStore();
  const [pinEnabled] = useState(cryptoService.isEnabled());
  const [passcodeEnabled, setPasscodeEnabled] = useState(passcodeService.isEnabled());
  const [mode, setMode] = useState<'none' | 'pin-set' | 'pin-change' | 'pc-set' | 'pc-change' | 'pc-off'>('none');
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('none'); setF1(''); setF2(''); setF3(''); setErr(''); };
  const inp = (val: string, set: (v: string) => void, ph: string) => (
    <input type="password" inputMode="numeric" value={val} maxLength={6} onChange={e => { set(e.target.value.replace(/\D/g, '')); setErr(''); }} placeholder={ph} className="input-field py-2 px-3 text-sm tracking-widest w-full" />
  );

  const handleResetPin = async () => {
    const ok = window.confirm('⚠️ CẢNH BÁO: Reset PIN\n\nThao tác này sẽ XÓA TOÀN BỘ DỮ LIỆU mã hóa trên thiết bị này và trên Google Drive.\n\nSau khi reset, bạn sẽ tạo PIN mới và bắt đầu lại từ đầu.\n\nBạn có chắc chắn muốn tiếp tục?');
    if (!ok) return;
    setBusy(true);
    try {
      await cryptoService.disable();
      await indexedDBService.clearData();
      try { sessionStorage.removeItem('__pdp_k'); } catch {}
      try { localStorage.removeItem('pdp_pin_prompted'); } catch {}
    } catch {}
    setBusy(false);
    location.reload();
  };

  const handlePinSet = async () => { if (!/^\d{4,6}$/.test(f1)) { setErr('PIN gồm 4-6 chữ số'); return; } if (f1 !== f2) { setErr('Nhập lại PIN không khớp'); return; } if (!data) return; setBusy(true); await cryptoService.setupPin(f1); await indexedDBService.saveData(data); setBusy(false); reset(); setMsg('Đã thiết lập PIN.'); setTimeout(() => setMsg(''), 5000); };
  const handlePinChange = async () => { if (!/^\d{4,6}$/.test(f2)) { setErr('PIN mới gồm 4-6 chữ số'); return; } if (f2 !== f3) { setErr('Nhập lại không khớp'); return; } if (!data) return; setBusy(true); const ok = await cryptoService.changePin(f1, f2); if (!ok) { setBusy(false); setErr('PIN hiện tại sai'); return; } await indexedDBService.saveData(data); setBusy(false); reset(); setMsg('Đã đổi PIN.'); setTimeout(() => setMsg(''), 5000); };
  const handlePcSet = async () => { if (!/^\d{4,6}$/.test(f1)) { setErr('Passcode gồm 4-6 chữ số'); return; } if (f1 !== f2) { setErr('Nhập lại không khớp'); return; } setBusy(true); await passcodeService.setup(f1); setBusy(false); setPasscodeEnabled(true); reset(); setMsg('Đã bật Passcode.'); setTimeout(() => setMsg(''), 5000); };
  const handlePcChange = async () => { if (!/^\d{4,6}$/.test(f2)) { setErr('Passcode mới gồm 4-6 chữ số'); return; } if (f2 !== f3) { setErr('Nhập lại không khớp'); return; } setBusy(true); const ok = await passcodeService.change(f1, f2); if (!ok) { setBusy(false); setErr('Passcode hiện tại sai'); return; } setBusy(false); reset(); setMsg('Đã đổi Passcode.'); setTimeout(() => setMsg(''), 5000); };
  const handlePcOff = async () => { setBusy(true); const ok = await passcodeService.disable(f1); if (!ok) { setBusy(false); setErr('Passcode sai'); return; } setBusy(false); setPasscodeEnabled(false); reset(); setMsg('Đã tắt Passcode.'); setTimeout(() => setMsg(''), 5000); };

  return (
    <>
      {msg && <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">{msg}</div>}
      <section className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-2"><ShieldCheck size={16} className="text-green-600" /><h2 className="text-sm font-semibold text-[var(--color-text)]">PIN bảo vệ dữ liệu</h2></div>
        <p className="text-[10px] text-[var(--color-text-secondary)] mb-2">Trạng thái: {pinEnabled ? '✓ Đã thiết lập' : '○ Chưa thiết lập'}</p>
        {mode === 'none' && (!pinEnabled ? <button onClick={() => setMode('pin-set')} className="btn-primary text-sm">Thiết lập PIN</button> : <div className="flex gap-2"><button onClick={() => setMode('pin-change')} className="btn-secondary text-sm">Đổi PIN</button><button onClick={handleResetPin} className="btn-secondary text-sm text-red-500">Reset PIN</button></div>)}
        {mode === 'pin-set' && <div className="space-y-2 max-w-xs">{inp(f1, setF1, 'PIN (4-6 số)')}{inp(f2, setF2, 'Nhập lại PIN')}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handlePinSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Lưu</button></div></div>}
        {mode === 'pin-change' && <div className="space-y-2 max-w-xs">{inp(f1, setF1, 'PIN hiện tại')}{inp(f2, setF2, 'PIN mới')}{inp(f3, setF3, 'Nhập lại PIN mới')}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handlePinChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">Quên PIN = mất dữ liệu đã mã hóa.</p>
      </section>
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-2"><KeyRound size={16} style={{ color: '#6C2BD9' }} /><h2 className="text-sm font-semibold text-[var(--color-text)]">Passcode khóa ứng dụng</h2></div>
        <p className="text-[10px] text-[var(--color-text-secondary)] mb-2">Trạng thái: {passcodeEnabled ? '● Đang bật' : '○ Tắt'}</p>
        {mode === 'none' && (!passcodeEnabled ? <button onClick={() => setMode('pc-set')} className="btn-primary text-sm">Bật Passcode</button> : <div className="flex gap-2"><button onClick={() => setMode('pc-change')} className="btn-secondary text-sm">Đổi</button><button onClick={() => setMode('pc-off')} className="btn-secondary text-sm text-red-500">Tắt</button></div>)}
        {mode === 'pc-set' && <div className="space-y-2 max-w-xs">{inp(f1, setF1, 'Passcode (4-6 số)')}{inp(f2, setF2, 'Nhập lại')}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handlePcSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Bật</button></div></div>}
        {mode === 'pc-change' && <div className="space-y-2 max-w-xs">{inp(f1, setF1, 'Passcode hiện tại')}{inp(f2, setF2, 'Passcode mới')}{inp(f3, setF3, 'Nhập lại')}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handlePcChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button></div></div>}
        {mode === 'pc-off' && <div className="space-y-2 max-w-xs">{inp(f1, setF1, 'Nhập Passcode để tắt')}{err && <p className="text-xs text-red-500">{err}</p>}<div className="flex gap-2"><button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button><button onClick={handlePcOff} disabled={busy} className="text-sm flex-1 rounded-lg bg-red-500 text-white py-2 disabled:opacity-50">Tắt</button></div></div>}
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">Đổi Passcode không ảnh hưởng dữ liệu.</p>
      </section>
    </>
  );
}
