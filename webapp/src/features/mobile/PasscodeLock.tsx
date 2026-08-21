import { useState, useEffect, useRef } from 'react';
import { passcodeService } from '@/services/passcode/passcodeService';
import { Lock, Delete } from 'lucide-react';

/**
 * PasscodeLock — full-screen passcode gate (app lock).
 * INDEPENDENT from encryption PIN. Only controls UI access.
 *
 * Desktop: compact centered card with text input (keyboard-friendly).
 * Mobile: numeric keypad for touch.
 * Detects viewport to choose presentation.
 */
export function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (value?: string) => {
    const pin = value ?? code;
    if (busy || pin.length < 4) return;
    setBusy(true); setError(false);
    const ok = await passcodeService.verify(pin);
    setBusy(false);
    if (ok) { onUnlock(); }
    else { setError(true); setCode(''); setTimeout(() => setError(false), 1500); }
  };

  const press = (d: string) => { if (busy) return; setError(false); setCode(p => (p + d).slice(0, 6)); };
  const back = () => { if (!busy) setCode(p => p.slice(0, -1)); };

  // Desktop: compact card with input
  if (!isMobile) {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-xs text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: '#6C2BD9' }}>
            <Lock size={26} color="white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nhập Passcode</h2>
            <p className="text-xs text-gray-500 mt-1">Khóa ứng dụng</p>
          </div>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            className={`w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-[0.4em] outline-none ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-purple-500'}`}
            placeholder="••••"
          />
          {error && <p className="text-sm text-red-500">Passcode không đúng</p>}
          <button onClick={() => submit()} disabled={busy || code.length < 4}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: '#6C2BD9' }}>
            {busy ? 'Đang kiểm tra...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    );
  }

  // Mobile: keypad
  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center px-8" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#6C2BD9' }}>
        <Lock size={26} color="white" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Nhập Passcode</h2>
      <p className="text-xs text-gray-500 mt-1">Khóa ứng dụng</p>

      <div className="flex gap-3 my-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-3 h-3 rounded-full transition-colors"
            style={{ backgroundColor: error ? '#EF4444' : (i < code.length ? '#6C2BD9' : '#E5E7EB') }} />
        ))}
      </div>
      {error && <p className="text-sm text-red-500 -mt-2 mb-2">Passcode không đúng</p>}

      <div className="grid grid-cols-3 gap-4">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => press(d)} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">0</button>
        <button onClick={back} className="w-16 h-16 rounded-full flex items-center justify-center active:bg-gray-100"><Delete size={22} className="text-gray-500" /></button>
      </div>

      <button onClick={() => submit()} disabled={busy || code.length < 4}
        className="mt-5 w-full max-w-[248px] py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#6C2BD9' }}>
        {busy ? 'Đang kiểm tra...' : 'OK'}
      </button>
    </div>
  );
}
