import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useAppStore } from '@/core/store/appStore';
import { generateNotifications, type AppNotification } from '@/services/notifications/notificationEngine';

const READ_KEY = 'pdp_notifications_read';
const DISMISSED_KEY = 'pdp_notifications_dismissed';

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>): void {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); } catch { /* */ }
}

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDismissedIds(ids: Set<string>): void {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch { /* */ }
}

function priorityColor(p: AppNotification['priority']): string {
  switch (p) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    case 'low': return 'bg-blue-100 text-blue-700';
  }
}

function priorityLabel(p: AppNotification['priority']): string {
  switch (p) {
    case 'high': return 'Khẩn';
    case 'medium': return 'Trung bình';
    case 'low': return 'Thấp';
  }
}

type FilterType = 'all' | AppNotification['type'];

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'Tất cả', icon: '🔔' },
  { key: 'credit_card', label: 'Thẻ', icon: '💳' },
  { key: 'rent', label: 'Nhà trọ', icon: '🏠' },
  { key: 'warranty', label: 'Bảo hành', icon: '🛡️' },
  { key: 'recurring', label: 'Định kỳ', icon: '🔄' },
  { key: 'budget', label: 'Ngân sách', icon: '💰' },
];

/**
 * Mobile notification bell button — shows badge + opens bottom sheet.
 */
export function NotificationBellMobile() {
  const { data } = useAppStore();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);
  const [filter, setFilter] = useState<FilterType>('all');

  const allNotifications = generateNotifications(data);
  const notifications = allNotifications.filter(n => !dismissedIds.has(n.id));
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);

  // Mark all as read when opening
  useEffect(() => {
    if (open && unreadCount > 0) {
      const newRead = new Set(readIds);
      notifications.forEach(n => newRead.add(n.id));
      setReadIds(newRead);
      saveReadIds(newRead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDismiss = useCallback((id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
  }, [dismissedIds]);

  const handleDismissAll = useCallback(() => {
    const newDismissed = new Set(dismissedIds);
    notifications.forEach(n => newDismissed.add(n.id));
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
  }, [dismissedIds, notifications]);

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative w-9 h-9 flex items-center justify-center"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
      >
        <Bell size={20} color="#0F1F4D" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Sheet */}
          <div
            className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                Thông báo {notifications.length > 0 && `(${notifications.length})`}
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={handleDismissAll}
                    className="text-xs text-gray-500 flex items-center gap-1"
                  >
                    <CheckCheck size={14} />
                    <span>Ẩn tất cả</span>
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto no-scrollbar">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                    filter === f.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto pb-safe">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <p className="text-sm text-gray-500">Không có thông báo nào</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map(n => (
                    <div key={n.id} className="flex gap-3 px-4 py-3 active:bg-gray-50">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                        {n.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{n.title}</span>
                          {!readIds.has(n.id) && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColor(n.priority)}`}>
                            {priorityLabel(n.priority)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {n.daysLeft === 0 ? 'Hôm nay' : n.daysLeft === 1 ? 'Ngày mai' : `Còn ${n.daysLeft} ngày`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDismiss(n.id)}
                        className="flex-shrink-0 p-1 self-start"
                        aria-label="Ẩn thông báo"
                      >
                        <X size={14} className="text-gray-300" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animation style */}
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        .pb-safe { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
