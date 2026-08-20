import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { cryptoService } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { PinPromptModal } from './PinPromptModal';

const FLAG = 'pdp_pin_prompted';

/**
 * PinOnboarding — one-time optional offer (first launch) to create a security PIN.
 * Skippable. If created, the same PIN encrypts data AND locks the app on open.
 * Shown only when: data loaded, encryption not yet enabled, and not prompted before.
 */
export function PinOnboarding() {
  const { data } = useAppStore();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data && !cryptoService.isEnabled() && localStorage.getItem(FLAG) !== '1') {
      const t = setTimeout(() => setShow(true), 700); // let the UI settle first
      return () => clearTimeout(t);
    }
  }, [data]);

  if (!show) return null;

  const dismiss = () => { localStorage.setItem(FLAG, '1'); setShow(false); };

  const create = async (pin: string) => {
    setBusy(true); setErr('');
    try {
      await cryptoService.setupPin(pin);
      if (data) await indexedDBService.saveData(data); // re-store locally encrypted
      localStorage.setItem(FLAG, '1');
      setBusy(false); setShow(false);
    } catch (e) { setBusy(false); setErr(String(e)); }
  };

  return (
    <PinPromptModal
      mode="create"
      busy={busy}
      error={err}
      title="Bảo mật dữ liệu bằng mã PIN?"
      subtitle="Tạo mã PIN để mã hóa dữ liệu và khóa ứng dụng khi mở. Có thể bỏ qua và bật sau ở Cài đặt → Bảo mật."
      submitLabel="Tạo mã PIN"
      onSubmit={create}
      onCancel={dismiss}
      onSkip={dismiss}
    />
  );
}
