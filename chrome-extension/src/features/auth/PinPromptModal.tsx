import { useState } from 'react';
import { Lock, X } from 'lucide-react';

/**
 * PinPromptModal — reusable PIN entry (create/enter). Parent performs the crypto in onSubmit.
 */
interface Props {
  mode: 'create' | 'enter';
  title?: string;
  subtitle?: string;
  busy?: boolean;
  error?: string;
  submitLabel?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  onSkip?: () => void;
}

export function PinPromptModal({ mode, title, subtitle, busy, error, submitLabel, onSubmit, onCancel, onSkip }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localErr, setLocalErr] = useState('');

  const submit = () => {
    if (!/^\d{4,6}$/.test(pin)) { setLocalErr('Mã PIN gồm 4-6 chữ số'); return; }
    if (mode === 'create' && pin !== confirm) { setLocalErr('Nhập lại PIN không khớp'); return; }
    setLocalErr('');
    onSubmit(pin);
  };

  const err = localErr || error;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6C2BD9' }}>
            <Lock size={22} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">{title || (mode === 'create' ? 'Tạo mã PIN' : 'Nhập mã PIN')}</h3>
            {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center flex-shrink-0"><X size={18} className="text-gray-400" /></button>
        </div>

        <input
          type="password" inputMode="numeric" autoFocus value={pin} maxLength={6}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setLocalErr(''); }}
          placeholder={mode === 'create' ? 'Nhập mã PIN (4-6 số)' : 'Mã PIN'}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg tracking-[0.3em] text-center outline-none focus:border-purple-500"
        />
        {mode === 'create' && (
          <input
            type="password" inputMode="numeric" value={confirm} maxLength={6}
            onChange={e => { setConfirm(e.target.value.replace(/\D/g, '')); setLocalErr(''); }}
            placeholder="Nhập lại mã PIN"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg tracking-[0.3em] text-center outline-none focus:border-purple-500"
          />
        )}
        {err && <p className="text-sm text-red-500 text-center">{err}</p>}

        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#6C2BD9' }}>
          {busy ? 'Đang xử lý...' : (submitLabel || (mode === 'create' ? 'Tạo & bảo mật' : 'Xác nhận'))}
        </button>
        {onSkip && (
          <button onClick={onSkip} className="w-full py-2 text-sm font-medium text-gray-500">Bỏ qua</button>
        )}
      </div>
    </div>
  );
}
