import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { Lock, ShieldCheck } from 'lucide-react';

/**
 * SecuritySection — PIN encryption settings (Phase 6.0 E2E).
 * Enable/disable/change local + Drive AES-GCM encryption keyed by a user PIN.
 * Same PIN unlocks the same data on WebApp / Android / Extension.
 */
export function SecuritySection() {
  const { data } = useAppStore();
  const [enabled, setEnabled] = useState(cryptoService.isEnabled());
  const [mode, setMode] = useState<'none' | 'set' | 'change' | 'off'>('none');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('none'); setPin(''); setPin2(''); setOldPin(''); setErr(''); };

  const handleSet = async () => {
    if (pin.length < 4) { setErr('PIN tối thiểu 4 số'); return; }
    if (pin !== pin2) { setErr('PIN nhập lại không khớp'); return; }
    if (!data) return;
    setBusy(true);
    await cryptoService.setupPin(pin);
    await indexedDBService.saveData(data); // re-save encrypted
    setBusy(false);
    setEnabled(true);
    reset();
    setMsg('Đã bật mã hóa. Dữ liệu trên thiết bị này và Google Drive giờ được mã hóa bằng PIN.');
    setTimeout(() => setMsg(''), 6000);
  };

  const handleChange = async () => {
    if (pin.length < 4) { setErr('PIN mới tối thiểu 4 số'); return; }
    if (pin !== pin2) { setErr('PIN nhập lại không khớp'); return; }
    if (!data) return;
    setBusy(true);
    const ok = await cryptoService.changePin(oldPin, pin);
    if (!ok) { setBusy(false); setErr('PIN cũ không đúng'); return; }
    await indexedDBService.saveData(data);
    setBusy(false);
    reset();
    setMsg('Đã đổi mã PIN.');
    setTimeout(() => setMsg(''), 6000);
  };

  const handleOff = async () => {
    if (!data) return;
    setBusy(true);
    const ok = await cryptoService.verifyPin(oldPin);
    if (!ok) { setBusy(false); setErr('PIN không đúng'); return; }
    cryptoService.disable();
    await indexedDBService.saveData(data); // re-save plaintext
    setBusy(false);
    setEnabled(false);
    reset();
    setMsg('Đã tắt mã hóa. Dữ liệu trở lại dạng thường trên thiết bị này.');
    setTimeout(() => setMsg(''), 6000);
  };

  const pinInput = (val: string, set: (v: string) => void, placeholder: string) => (
    <input type="password" inputMode="numeric" value={val} maxLength={6}
      onChange={(e) => { set(e.target.value.replace(/\D/g, '')); setErr(''); }}
      placeholder={placeholder}
      className="input-field py-2 px-3 text-sm tracking-widest w-full" />
  );

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-1">Bảo mật &amp; Mã hóa</h2>
      <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
        Mã hóa AES-256-GCM (PBKDF2 310k). Cùng một mã PIN sẽ mở khóa cùng dữ liệu trên WebApp / App / Extension và trên Google Drive.
        <strong> Lưu ý:</strong> nếu quên PIN, dữ liệu đã mã hóa không thể khôi phục.
      </p>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: enabled ? '#E8F5E9' : '#F3E5F5' }}>
          {enabled ? <ShieldCheck size={18} className="text-green-600" /> : <Lock size={18} style={{ color: '#6C2BD9' }} />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text)]">{enabled ? 'Mã hóa đang BẬT' : 'Mã hóa đang TẮT'}</p>
          <p className="text-[10px] text-[var(--color-text-secondary)]">{enabled ? 'Dữ liệu local + Drive được mã hóa bằng PIN' : 'Dữ liệu đang ở dạng thường'}</p>
        </div>
      </div>

      {msg && <div className="text-xs text-green-600 mb-3">{msg}</div>}

      {mode === 'none' && (
        <div className="flex gap-3">
          {!enabled ? (
            <button onClick={() => setMode('set')} className="btn-primary text-sm">Đặt mã PIN</button>
          ) : (
            <>
              <button onClick={() => setMode('change')} className="btn-secondary text-sm">Đổi mã PIN</button>
              <button onClick={() => { if (window.confirm('Tắt mã hóa? Dữ liệu sẽ trở lại dạng thường.')) setMode('off'); }} className="btn-secondary text-sm text-red-500">Tắt mã hóa</button>
            </>
          )}
        </div>
      )}

      {mode === 'set' && (
        <div className="space-y-2 max-w-xs">
          <p className="text-sm font-medium text-[var(--color-text)]">Đặt mã PIN (4-6 số)</p>
          {pinInput(pin, setPin, 'Nhập PIN')}
          {pinInput(pin2, setPin2, 'Nhập lại PIN')}
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button>
            <button onClick={handleSet} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Lưu</button>
          </div>
        </div>
      )}

      {mode === 'change' && (
        <div className="space-y-2 max-w-xs">
          <p className="text-sm font-medium text-[var(--color-text)]">Đổi mã PIN</p>
          {pinInput(oldPin, setOldPin, 'PIN hiện tại')}
          {pinInput(pin, setPin, 'PIN mới')}
          {pinInput(pin2, setPin2, 'Nhập lại PIN mới')}
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button>
            <button onClick={handleChange} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">Đổi</button>
          </div>
        </div>
      )}

      {mode === 'off' && (
        <div className="space-y-2 max-w-xs">
          <p className="text-sm font-medium text-[var(--color-text)]">Nhập PIN để tắt mã hóa</p>
          {pinInput(oldPin, setOldPin, 'PIN hiện tại')}
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary text-sm flex-1">Hủy</button>
            <button onClick={handleOff} disabled={busy} className="text-sm flex-1 rounded-lg bg-red-500 text-white py-2 disabled:opacity-50">Tắt mã hóa</button>
          </div>
        </div>
      )}
    </section>
  );
}
