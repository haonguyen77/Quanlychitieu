import { useState } from 'react';
import { Bell, CreditCard, Home, Shield, Repeat, Wallet } from 'lucide-react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/services/notifications/notificationEngine';

const NOTIFICATION_TYPES: {
  key: keyof Omit<NotificationSettings, 'reminderDays'>;
  label: string;
  desc: string;
  icon: typeof Bell;
}[] = [
  { key: 'creditCard', label: 'Thẻ tín dụng', desc: 'Nhắc ngày thanh toán', icon: CreditCard },
  { key: 'rent', label: 'Nhà trọ', desc: 'Nhắc ngày đóng tiền', icon: Home },
  { key: 'warranty', label: 'Bảo hành sản phẩm', desc: 'Sản phẩm sắp hết hạn', icon: Shield },
  { key: 'recurring', label: 'Giao dịch định kỳ', desc: 'Nhắc giao dịch sắp tới', icon: Repeat },
  { key: 'budget', label: 'Ngân sách', desc: 'Cảnh báo vượt ngân sách', icon: Wallet },
];

export function NotificationSettingsSection({ embedded = false }: { embedded?: boolean } = {}) {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings);

  const toggle = (key: keyof Omit<NotificationSettings, 'reminderDays'>) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const updateReminderDays = (days: number[]) => {
    const updated = { ...settings, reminderDays: days };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const toggleDay = (day: number) => {
    const current = settings.reminderDays;
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b);
    if (next.length > 0) updateReminderDays(next);
  };

  const DAYS_OPTIONS = [1, 3, 5, 7, 14, 30];

  const body = (
    <div className={embedded ? 'pt-2' : ''}>
      {/* Toggle list */}
      <div className="space-y-1">
        {NOTIFICATION_TYPES.map(({ key, label, desc, icon: IconComp }) => (
          <div key={key} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[var(--color-border)] hover:bg-opacity-30 transition-colors">
            <IconComp size={16} className="text-[var(--color-text-secondary)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text)]">{label}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{desc}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={settings[key]}
              aria-label={`${label} notification toggle`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  settings[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Reminder days */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <p className="text-sm text-[var(--color-text)] mb-2">Nhắc trước (ngày)</p>
        <div className="flex flex-wrap gap-2">
          {DAYS_OPTIONS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                settings.reminderDays.includes(day)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-blue-400'
              }`}
            >
              {day} ngày
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Thông báo</h2>
      </div>
      {body}
    </section>
  );
}
