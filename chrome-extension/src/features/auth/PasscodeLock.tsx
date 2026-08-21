import { useState, useEffect, useRef } from 'react';
import { passcodeService } from '@/services/passcode/passcodeService';
import { Lock } from 'lucide-react';

/**
 * PasscodeLock — Extension app-lock. Desktop-style compact card with keyboard input.
 * INDEPENDENT from encryption PIN.
 */
export function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    if (busy || code.length < 4) return;
    setBusy(true); setError(false);
    const ok = await passcodeService.verify(code);
    setBusy(false);
    if (ok) onUnlock();
    else { setError(true); setCode(''); setTimeout(() => setError(false), 1500); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--color-bg,#f9fafb)] flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-xs text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: '#6C2BD9' }}>
          <Lock size={26} color="white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text,#111)]">Nhập Passcode</h2>
          <p className="text-xs text-[var(--color-text-secondary,#6b7280)] mt-1">Khóa ứng dụng</p>
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
        <button onClick={submit} disabled={busy || code.length < 4}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: '#6C2BD9' }}>
          {busy ? 'Đang kiểm tra...' : 'Xác nhận'}
        </button>
      </div>
    </div>
  );
}
