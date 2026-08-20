import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * PwaInstall — "Cài đặt ứng dụng" button for mobile.
 *
 * Behavior:
 * - Chrome/Android: listens for `beforeinstallprompt`, shows button, calls prompt() on click.
 * - iOS Safari: no beforeinstallprompt → shows Add-to-Home-Screen guidance sheet.
 * - Hidden when already installed (display-mode: standalone) or after install.
 * - Mobile-only (parent renders only on mobile).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Read a prompt event that may have been captured before React mounted. */
function getStashedPrompt(): BeforeInstallPromptEvent | null {
  return (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt ?? null;
}

export function PwaInstall() {
  // Initialize from the early-captured prompt (main.tsx) so we don't miss it.
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(getStashedPrompt);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa_install_dismissed') === '1');

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    // Fired by main.tsx when it captured the prompt before React mounted.
    const onPwaAvailable = () => setDeferredPrompt(getStashedPrompt());
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('pwa-available', onPwaAvailable);
    window.addEventListener('appinstalled', onInstalled);
    // In case the event landed between module load and this effect running.
    if (!deferredPrompt) { const s = getStashedPrompt(); if (s) setDeferredPrompt(s); }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('pwa-available', onPwaAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hidden only if already installed, or dismissed for this session (X button).
  // Otherwise ALWAYS shown on mobile — even before the browser fires the prompt.
  if (installed || dismissed) return null;

  const ios = isIOS();

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt = undefined;
    } else {
      // Prompt not available yet (iOS, or Chrome criteria pending) → show manual steps.
      setShowIosGuide(true);
    }
  };

  const dismiss = () => { setDismissed(true); sessionStorage.setItem('pwa_install_dismissed', '1'); };

  return (
    <>
      {/* Install banner — above bottom nav */}
      <div className="fixed left-0 right-0 z-40 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-lg px-4 py-3" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6C2BD9' }}>
            <Download size={20} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Cài đặt ứng dụng</p>
            <p className="text-[11px] text-gray-500 truncate">Thêm vào màn hình chính để dùng nhanh hơn</p>
          </div>
          <button onClick={handleClick} className="px-3 py-2 rounded-lg text-white text-xs font-semibold flex-shrink-0 active:scale-95" style={{ backgroundColor: '#6C2BD9' }}>Cài đặt</button>
          <button onClick={dismiss} className="w-7 h-7 flex items-center justify-center flex-shrink-0"><X size={16} className="text-gray-400" /></button>
        </div>
      </div>

      {/* Add-to-Home guidance (iOS Safari, or Android when the prompt isn't ready) */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setShowIosGuide(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl w-full p-5 space-y-3" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-900">{ios ? 'Cài đặt trên iPhone/iPad' : 'Cài đặt ứng dụng'}</h3>
              <button onClick={() => setShowIosGuide(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            {ios ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Nhấn nút Chia sẻ <Share size={14} className="inline text-blue-500" /> ở thanh Safari</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Chọn "Thêm vào MH chính" (Add to Home Screen)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Nhấn "Thêm" để hoàn tất</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Mở menu ⋮ ở góc trên bên phải trình duyệt</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Chọn "Cài đặt ứng dụng" hoặc "Thêm vào Màn hình chính"</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Nhấn "Cài đặt" / "Thêm" để hoàn tất</span>
                </li>
              </ol>
            )}
            <button onClick={() => setShowIosGuide(false)} className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-2" style={{ backgroundColor: '#6C2BD9' }}>Đã hiểu</button>
          </div>
        </div>
      )}
    </>
  );
}
