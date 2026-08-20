import { create } from 'zustand';
import { useState } from 'react';

/**
 * Mobile Dialog System — replaces window.confirm/prompt/alert with internal modals.
 * Promise-based imperative API for minimal code changes.
 *
 * Usage:
 *   const ok = await showConfirm({ title: 'Xóa?', message: '...', confirmLabel: 'Xóa', danger: true });
 *   const values = await showPrompt({ title: 'Thêm', fields: [{ key: 'name', label: 'Tên', required: true }] });
 *   await showAlert({ title: 'Lỗi', message: '...' });
 *
 * Render <MobileDialogHost /> once at the app root (inside MobileShell).
 */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  numeric?: boolean;
  initialValue?: string;
}

interface PromptOptions {
  title: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
}

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: Record<string, string> | null) => void }
  | { kind: 'alert'; options: { title: string; message?: string }; resolve: () => void }
  | null;

interface DialogStore {
  state: DialogState;
  setState: (s: DialogState) => void;
}

const useDialogStore = create<DialogStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));

// ─── Imperative API ─────────────────────────────────────────────────────────

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().setState({ kind: 'confirm', options, resolve });
  });
}

export function showPrompt(options: PromptOptions): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().setState({ kind: 'prompt', options, resolve });
  });
}

export function showAlert(options: { title: string; message?: string }): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState().setState({ kind: 'alert', options, resolve });
  });
}

// ─── Host Component ─────────────────────────────────────────────────────────

export function MobileDialogHost() {
  const { state, setState } = useDialogStore();
  if (!state) return null;

  const close = () => setState(null);

  if (state.kind === 'confirm') {
    const { title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger } = state.options;
    return (
      <Overlay onClose={() => { state.resolve(false); close(); }}>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
        {message && <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">{message}</p>}
        <div className="flex gap-3 mt-2">
          <button onClick={() => { state.resolve(false); close(); }} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 active:scale-95">{cancelLabel}</button>
          <button onClick={() => { state.resolve(true); close(); }} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 ${danger ? 'bg-red-500' : ''}`} style={danger ? undefined : { backgroundColor: '#6C2BD9' }}>{confirmLabel}</button>
        </div>
      </Overlay>
    );
  }

  if (state.kind === 'alert') {
    const { title, message } = state.options;
    return (
      <Overlay onClose={() => { state.resolve(); close(); }}>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
        {message && <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">{message}</p>}
        <button onClick={() => { state.resolve(); close(); }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95" style={{ backgroundColor: '#6C2BD9' }}>OK</button>
      </Overlay>
    );
  }

  // prompt
  return <PromptDialog options={state.options} onResolve={(v) => { state.resolve(v); close(); }} />;
}

function PromptDialog({ options, onResolve }: { options: PromptOptions; onResolve: (v: Record<string, string> | null) => void }) {
  const { title, fields, confirmLabel = 'Lưu', cancelLabel = 'Hủy' } = options;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = f.initialValue ?? '';
    return init;
  });
  const [error, setError] = useState('');

  const handleSave = () => {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`Vui lòng nhập ${f.label}`);
        return;
      }
    }
    onResolve(values);
  };

  return (
    <Overlay onClose={() => onResolve(null)}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-600">{f.label}{f.required && ' *'}</label>
            <input
              type="text"
              inputMode={f.numeric ? 'numeric' : 'text'}
              value={values[f.key]}
              onChange={(e) => { setValues({ ...values, [f.key]: f.numeric ? e.target.value.replace(/\D/g, '') : e.target.value }); setError(''); }}
              placeholder={f.placeholder || f.label}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"
              autoFocus={f === fields[0]}
            />
          </div>
        ))}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={() => onResolve(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 active:scale-95">{cancelLabel}</button>
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95" style={{ backgroundColor: '#6C2BD9' }}>{confirmLabel}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
