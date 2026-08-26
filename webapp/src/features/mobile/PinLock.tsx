import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { Lock, Delete } from 'lucide-react';

/**
 * PinLock — full-screen PIN entry shown when data is encrypted and locked.
 * Accepts 4-6 digits, confirmed with an explicit OK button (no forced auto-submit),
 * so existing 4-digit PINs work too. Shows a busy state while verifying (PBKDF2).
 */
export function PinLock() {
  const unlockWithPin = useAppStore((s) => s.unlockWithPin);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    setError(false);
    const ok = await unlockWithPin(pin);
    setBusy(false);
    if (!ok) { setError(true); setPin(''); setTimeout(() => setError(false), 1800); }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(false);
    setPin(p => (p + d).slice(0, 6));
  };
  const back = () => { if (!busy) setPin(p => p.slice(0, -1)); };

  const reset = async () => {
    const ok = window.confirm(
      'Đặt lại sẽ xóa mã PIN và dữ liệu đã mã hóa TRÊN THIẾT BỊ NÀY để bạn tạo lại từ đầu.\n\n' +
      'Nếu đã đồng bộ Google Drive, dữ liệu vẫn còn trên Drive và có thể tải lại (nhập đúng PIN cũ khi đồng bộ).\n\nTiếp tục?'
    );
    if (!ok) return;
    cryptoService.disable();
    try { await indexedDBService.clearData(); } catch { /* ignore */ }
    try { localStorage.removeItem('pdp_pin_prompted'); } catch { /* ignore */ }
    location.reload();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center px-8" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#6C2BD9' }}>
        <Lock size={28} color="white" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Nhập mã PIN</h2>
      <p className="text-sm text-gray-500 mt-1">Dữ liệu được mã hóa trên thiết bị này</p>

      {/* PIN dots (up to 6) */}
      <div className="flex gap-3 my-7">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full transition-colors"
            style={{ backgroundColor: error ? '#EF4444' : (i < pin.length ? '#6C2BD9' : '#E5E7EB') }} />
        ))}
      </div>
      {error && <p className="text-sm text-red-500 -mt-3 mb-3">Mã PIN không đúng</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => press(d)} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">0</button>
        <button onClick={back} className="w-16 h-16 rounded-full flex items-center justify-center active:bg-gray-100"><Delete size={22} className="text-gray-500" /></button>
      </div>

      {/* OK / confirm */}
      <button
        onClick={submit}
        disabled={busy || pin.length < 4}
        className="mt-6 w-full max-w-[248px] py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ backgroundColor: '#6C2BD9' }}
      >
        {busy ? 'Đang kiểm tra...' : 'OK'}
      </button>

      <button onClick={reset} className="mt-4 text-xs text-gray-400 underline">Quên mã PIN? Đặt lại</button>
    </div>
  );
}
