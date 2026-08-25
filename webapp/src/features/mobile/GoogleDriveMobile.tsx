import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { driveService } from '@/services/drive/driveService';
import { syncService } from '@/services/sync/syncService';
import { cryptoService, type EncryptedEnvelope } from '@/services/crypto/cryptoService';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { useMobileNav } from './MobileNavigation';
import { PinPromptModal } from './PinPromptModal';
import { ArrowLeft, Cloud, CloudOff, RefreshCw, LogOut, User, Check } from 'lucide-react';

/**
 * Mobile Google Drive Screen — Login, Sync, Logout.
 * Based on Android: screens/settings/google_drive_screen.dart
 */
export function GoogleDriveMobile() {
  const { pop } = useMobileNav();
  const { data, setData, userEmail, setAuth, clearAuth } = useAppStore();
  const [isConnected, setIsConnected] = useState(!!driveService.token);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [email, setEmail] = useState(userEmail || '');
  // PIN gate before sync: Drive must always store encrypted data.
  const [pinPrompt, setPinPrompt] = useState<{ mode: 'create' | 'enter'; remoteEnv?: EncryptedEnvelope } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    setIsConnected(!!driveService.token);
    if (driveService.token && !email) {
      driveService.getUserProfile().then(p => { if (p) { setEmail(p.email); setAuth(p.email, p.avatar || undefined); } });
    }
  }, []);

  const handleLogin = async () => {
    setSyncResult(null);
    const token = await driveService.login();
    if (token) {
      setIsConnected(true);
      const profile = await driveService.getUserProfile();
      if (profile) { setEmail(profile.email); setAuth(profile.email, profile.avatar || undefined); }
      setSyncResult({ type: 'success', message: 'Đăng nhập thành công!' });
    } else {
      setSyncResult({ type: 'error', message: driveService.getLastError() || 'Đăng nhập thất bại' });
    }
  };

  // Actual sync (runs only once a PIN key is loaded → Drive stays encrypted).
  const doSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncService.fullSync();
      if (result.status === 'success') {
        if (result.data) {
          setData({ ...result.data, metadata: { ...result.data.metadata, lastSyncAt: new Date().toISOString() } });
        }
        setSyncResult({ type: 'success', message: result.message });
      } else if (result.status === 'locked') {
        // Remote is encrypted and we still have no key → ask for PIN.
        const raw = await driveService.fetchRemoteRaw();
        if (raw && cryptoService.isEncryptedEnvelope(raw)) setPinPrompt({ mode: 'enter', remoteEnv: raw as EncryptedEnvelope });
        setSyncResult({ type: 'info', message: 'Cần nhập mã PIN để giải mã dữ liệu trên Drive.' });
      } else {
        setSyncResult({ type: result.status === 'error' ? 'error' : 'info', message: result.message });
      }
    } catch (e) {
      setSyncResult({ type: 'error', message: String(e) });
    }
    setIsSyncing(false);
  };

  // Sync entry point — only requires PIN if encryption key is NOT loaded (first-time / key lost).
  const handleSync = async () => {
    if (cryptoService.hasKey()) { await doSync(); return; }
    // Key not available — need PIN to establish it.
    if (!cryptoService.isEnabled()) {
      // No encryption at all — must create PIN so Drive stores encrypted data.
      setIsSyncing(true); setSyncResult(null);
      let raw: unknown = null;
      try { raw = await driveService.fetchRemoteRaw(); } catch {}
      setIsSyncing(false);
      if (raw && cryptoService.isEncryptedEnvelope(raw)) {
        setPinErr(''); setPinPrompt({ mode: 'enter', remoteEnv: raw as EncryptedEnvelope });
      } else {
        setPinErr(''); setPinPrompt({ mode: 'create' });
      }
      return;
    }
    // Encryption enabled but key not loaded (key was cleared/lost) — ask PIN once.
    setIsSyncing(true); setSyncResult(null);
    let raw: unknown = null;
    try { raw = await driveService.fetchRemoteRaw(); } catch {}
    setIsSyncing(false);
    if (raw && cryptoService.isEncryptedEnvelope(raw)) {
      setPinErr(''); setPinPrompt({ mode: 'enter', remoteEnv: raw as EncryptedEnvelope });
    } else {
      setPinErr(''); setPinPrompt({ mode: 'enter' });
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pinPrompt) return;
    setPinBusy(true); setPinErr('');
    try {
      if (pinPrompt.mode === 'create') {
        await cryptoService.setupPin(pin);
        if (data) await indexedDBService.saveData(data); // re-store locally encrypted
      } else if (pinPrompt.remoteEnv) {
        const decrypted = await cryptoService.establishFromEnvelope(pin, pinPrompt.remoteEnv);
        if (!decrypted) { setPinBusy(false); setPinErr('Mã PIN không đúng'); return; }
        await indexedDBService.saveData(decrypted as never);
        setData(decrypted as never);
      } else {
        const ok = await cryptoService.verifyPin(pin);
        if (!ok) { setPinBusy(false); setPinErr('Mã PIN không đúng'); return; }
      }
      setPinBusy(false);
      setPinPrompt(null);
      await doSync();
    } catch (e) {
      setPinBusy(false);
      setPinErr(String(e));
    }
  };

  const handleLogout = async () => {
    await driveService.revokeToken();
    clearAuth();
    setIsConnected(false);
    setEmail('');
    setSyncResult({ type: 'info', message: 'Đã đăng xuất. Dữ liệu offline vẫn còn.' });
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Google Drive</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isConnected ? 'bg-green-50' : 'bg-gray-100'}`}>
              {isConnected ? <Cloud size={28} className="text-green-500" /> : <CloudOff size={28} className="text-gray-400" />}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-gray-900">
                {isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
              </p>
              {email && isConnected && (
                <div className="flex items-center gap-1.5 mt-1">
                  <User size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{email}</span>
                </div>
              )}
              {!isConnected && (
                <p className="text-xs text-gray-500 mt-0.5">Đăng nhập để đồng bộ dữ liệu</p>
              )}
            </div>
            {isConnected && (
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={16} className="text-green-600" />
              </div>
            )}
          </div>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className={`rounded-xl p-3 text-sm ${
            syncResult.type === 'success' ? 'bg-green-50 text-green-700' :
            syncResult.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {syncResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!isConnected ? (
            <button
              onClick={handleLogin}
              className="w-full py-3.5 rounded-xl bg-[#1264F5] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Cloud size={18} />
              Đăng nhập Google
            </button>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full py-3.5 rounded-xl bg-[#20A84A] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-50"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </>
          )}
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-700">Thông tin</p>
          <p className="text-[11px] text-gray-500">• Dữ liệu được lưu trên Google Drive trong thư mục QLCT</p>
          <p className="text-[11px] text-gray-500">• Đồng bộ 2 chiều với Android App và Chrome Extension</p>
          <p className="text-[11px] text-gray-500">• Dữ liệu offline vẫn hoạt động khi không có internet</p>
          <p className="text-[11px] text-gray-500">• Đăng xuất không xóa dữ liệu đã lưu trên thiết bị</p>
          <p className="text-[11px] text-gray-500">• Dữ liệu trên Drive được mã hóa bằng mã PIN của bạn</p>
        </div>
      </div>

      {pinPrompt && (
        <PinPromptModal
          mode={pinPrompt.mode}
          busy={pinBusy}
          error={pinErr}
          title={pinPrompt.mode === 'create' ? 'Tạo mã PIN để đồng bộ' : 'Nhập mã PIN'}
          subtitle={pinPrompt.mode === 'create'
            ? 'Google Drive chỉ lưu dữ liệu đã mã hóa. Đặt mã PIN để bảo mật (dùng chung cho mở khóa app).'
            : 'Dữ liệu trên Drive đã mã hóa. Nhập đúng mã PIN để giải mã và đồng bộ.'}
          onSubmit={handlePinSubmit}
          onCancel={() => { setPinPrompt(null); setPinErr(''); }}
        />
      )}
    </div>
  );
}
