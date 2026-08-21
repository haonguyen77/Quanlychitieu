import { useState, useEffect, useRef, useCallback } from 'react';
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
    case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

function priorityLabel(p: AppNotification['priority']): string {
  switch (p) {
    case 'high': return 'Khẩn';
    case 'medium': return 'Trung bình';
    case 'low': return 'Thấp';
  }
}

export function NotificationCenter() {
  const { data } = useAppStore();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);
  const panelRef = useRef<HTMLDivElement>(null);

  // Generate notifications
  const allNotifications = generateNotifications(data);
  const notifications = allNotifications.filter(n => !dismissedIds.has(n.id));
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Mark all as read when opening panel
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
    <div className="relative" ref={panelRef}>
      {/* Bell icon button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:bg-opacity-50 transition-colors"
        title="Thông báo"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-[70vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Thông báo {notifications.length > 0 && `(${notifications.length})`}
            </h3>
            {notifications.length > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors"
                title="Ẩn tất cả"
              >
                <CheckCheck size={14} />
                <span>Ẩn tất cả</span>
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                  <Check size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] text-center">
                  Không có thông báo nào
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    isRead={readIds.has(n.id)}
                    onDismiss={() => handleDismiss(n.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notification Item ────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: AppNotification;
  isRead: boolean;
  onDismiss: () => void;
}

function NotificationItem({ notification, isRead, onDismiss }: NotificationItemProps) {
  const { icon, title, message, priority, daysLeft } = notification;

  return (
    <div
      className={`group relative px-4 py-3 hover:bg-[var(--color-border)] hover:bg-opacity-30 transition-colors ${
        !isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--color-border)] flex items-center justify-center text-base">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-[var(--color-text)] truncate">{title}</span>
            {!isRead && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
            {message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColor(priority)}`}>
              {priorityLabel(priority)}
            </span>
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              {daysLeft === 0 ? 'Hôm nay' : daysLeft === 1 ? 'Ngày mai' : `Còn ${daysLeft} ngày`}
            </span>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-border)] transition-all"
          title="Ẩn thông báo"
          aria-label="Ẩn thông báo"
        >
          <X size={14} className="text-[var(--color-text-secondary)]" />
        </button>
      </div>
    </div>
  );
}
