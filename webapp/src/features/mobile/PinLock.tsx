import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Lock, Delete } from 'lucide-react';

/**
 * PinLock — Full-screen PIN entry shown when data is encrypted and locked.
 * Calls unlockApp(pin) which derives the key and reloads data.
 */
export function PinLock() {
  const { unlockApp } = useAppStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    const ok = await unlockApp(value);
    setBusy(false);
    if (!ok) { setError(true); setPin(''); setTimeout(() => setError(false), 1500); }
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) submit(next);
  };
  const back = () => setPin(pin.slice(0, -1));

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center px-8" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#6C2BD9' }}>
        <Lock size={28} color="white" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Nhập mã PIN</h2>
      <p className="text-sm text-gray-500 mt-1">Dữ liệu được mã hóa trên thiết bị này</p>

      {/* PIN dots */}
      <div className="flex gap-3 my-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full transition-colors"
            style={{ backgroundColor: error ? '#EF4444' : (i < pin.length ? '#6C2BD9' : '#E5E7EB') }} />
        ))}
      </div>
      {error && <p className="text-sm text-red-500 -mt-4 mb-4">Mã PIN không đúng</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => press(d)} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} className="w-16 h-16 rounded-full text-2xl font-semibold text-gray-800 active:bg-gray-100">0</button>
        <button onClick={back} className="w-16 h-16 rounded-full flex items-center justify-center active:bg-gray-100"><Delete size={22} className="text-gray-500" /></button>
      </div>
    </div>
  );
}
