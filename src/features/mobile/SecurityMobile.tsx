import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { cryptoService } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { showConfirm, showAlert } from './mobileDialog';
import { ArrowLeft, Lock, ShieldCheck, ShieldOff } from 'lucide-react';

/**
 * SecurityMobile — PIN encryption settings (Cách A).
 * Enable/disable/change local AES-GCM encryption keyed by a user PIN.
 * Drive sync stays plaintext (unaffected).
 */
export function SecurityMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [enabled, setEnabled] = useState(cryptoService.isEnabled());
  const [mode, setMode] = useState<'none' | 'set' | 'change' | 'off'>('none');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode('none'); setPin(''); setPin2(''); setOldPin(''); setErr(''); };

  const handleSet = async () => {
    if (pin.length < 4) { setErr('PIN tối thiểu 4 số'); return; }
    if (pin !== pin2) { setErr('PIN nhập lại không khớp'); return; }
    if (!data) return;
    setBusy(true);
    await cryptoService.enablePin(pin);
    await indexedDBService.saveData(data); // re-save encrypted
    setBusy(false);
    setEnabled(true);
    reset();
    await showAlert({ title: 'Đã bật mã hóa', message: 'Dữ liệu trên thiết bị này giờ được mã hóa bằng PIN.' });
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
    await showAlert({ title: 'Đã đổi PIN', message: 'Mã PIN đã được cập nhật.' });
  };

  const handleOff = async () => {
    if (!data) return;
    setBusy(true);
    const ok = await cryptoService.unlock(oldPin);
    if (!ok) { setBusy(false); setErr('PIN không đúng'); return; }
    cryptoService.disablePin();
    await indexedDBService.saveData(data); // re-save plaintext
    setBusy(false);
    setEnabled(false);
    reset();
    await showAlert({ title: 'Đã tắt mã hóa', message: 'Dữ liệu trở lại dạng thường trên thiết bị này.' });
  };

  const numInput = (val: string, set: (v: string) => void, placeholder: string) => (
    <input type="password" inputMode="numeric" value={val} maxLength={6}
      onChange={e => { set(e.target.value.replace(/\D/g, '')); setErr(''); }}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg tracking-widest text-center outline-none focus:border-purple-500" />
  );

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Bảo mật</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: enabled ? '#E8F5E9' : '#F3E5F5' }}>
            {enabled ? <ShieldCheck size={22} className="text-green-600" /> : <Lock size={22} style={{ color: '#6C2BD9' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{enabled ? 'Mã hóa đang BẬT' : 'Mã hóa đang TẮT'}</p>
            <p className="text-[11px] text-gray-500">{enabled ? 'Dữ liệu local được mã hóa bằng PIN' : 'Dữ liệu local đang ở dạng thường'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-[11px] text-gray-500 leading-relaxed">
          Mã hóa AES-256 áp dụng cho dữ liệu lưu trên thiết bị (IndexedDB). Đồng bộ Google Drive vẫn hoạt động bình thường. <strong>Lưu ý:</strong> nếu quên PIN, dữ liệu đã mã hóa trên thiết bị này không thể khôi phục — hãy đảm bảo đã đồng bộ Drive.
        </div>

        {/* Actions */}
        {mode === 'none' && (
          <div className="space-y-2">
            {!enabled ? (
              <button onClick={() => setMode('set')} className="w-full py-3 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#6C2BD9' }}>Đặt mã PIN</button>
            ) : (
              <>
                <button onClick={() => setMode('change')} className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white">Đổi mã PIN</button>
                <button onClick={async () => { if (await showConfirm({ title: 'Tắt mã hóa?', message: 'Dữ liệu sẽ trở lại dạng thường.', confirmLabel: 'Tắt', danger: true })) setMode('off'); }} className="w-full py-3 rounded-xl border border-red-200 text-sm font-medium text-red-500 bg-white flex items-center justify-center gap-2"><ShieldOff size={16} /> Tắt mã hóa</button>
              </>
            )}
          </div>
        )}

        {mode === 'set' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Đặt mã PIN (4-6 số)</p>
            {numInput(pin, setPin, 'Nhập PIN')}
            {numInput(pin2, setPin2, 'Nhập lại PIN')}
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={handleSet} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Lưu</button>
            </div>
          </div>
        )}

        {mode === 'change' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Đổi mã PIN</p>
            {numInput(oldPin, setOldPin, 'PIN hiện tại')}
            {numInput(pin, setPin, 'PIN mới')}
            {numInput(pin2, setPin2, 'Nhập lại PIN mới')}
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={handleChange} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>Đổi</button>
            </div>
          </div>
        )}

        {mode === 'off' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Nhập PIN để tắt mã hóa</p>
            {numInput(oldPin, setOldPin, 'PIN hiện tại')}
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={handleOff} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 disabled:opacity-50">Tắt mã hóa</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
