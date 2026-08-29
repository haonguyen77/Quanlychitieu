import { useState } from 'react';
import { useMobileNav } from './MobileNavigation';
import { getNotificationSettings, saveNotificationSettings, type NotificationSettings } from '@/services/notifications/notificationEngine';
import { ArrowLeft, Bell, Clock, CreditCard, Home, Shield, Repeat, Wallet, AlarmClock } from 'lucide-react';

/**
 * NotificationSettingsMobile — mobile settings UI for reminders/alerts.
 * Reuses the SAME storage as desktop so config is shared:
 *  - Daily reminders: localStorage 'pdp_expense_reminders' (ReminderSection format)
 *  - Alert toggles + reminderDays: notificationEngine ('pdp_notification_settings')
 * UI/config only — does not change finance data or sync. Actual OS/web push
 * delivery is handled elsewhere (app) / not yet wired on web.
 */

const REMINDER_KEY = 'pdp_expense_reminders';
const PURPLE = '#6C2BD9';

interface DailyReminder { id: string; time: string; enabled: boolean; }
interface ReminderConfig { enabled: boolean; skipIfAlreadyEntered: boolean; reminders: DailyReminder[]; }

function defaultReminderConfig(): ReminderConfig {
  return {
    enabled: true,
    skipIfAlreadyEntered: true,
    reminders: [
      { id: 'rem_default_1', time: '12:00', enabled: true },
      { id: 'rem_default_2', time: '21:00', enabled: true },
    ],
  };
}
function loadReminderConfig(): ReminderConfig {
  try { const s = localStorage.getItem(REMINDER_KEY); if (s) return JSON.parse(s); } catch { /* */ }
  return defaultReminderConfig();
}
function saveReminderConfig(c: ReminderConfig) { try { localStorage.setItem(REMINDER_KEY, JSON.stringify(c)); } catch { /* */ } }

const ALERT_TYPES: { key: keyof Omit<NotificationSettings, 'reminderDays'>; label: string; desc: string; icon: typeof Bell }[] = [
  { key: 'creditCard', label: 'Nhắc thanh toán thẻ', desc: 'Nhắc trước ngày đến hạn', icon: CreditCard },
  { key: 'recurring', label: 'Nhắc giao dịch định kỳ', desc: 'Nhắc vào ngày đến hạn', icon: Repeat },
  { key: 'budget', label: 'Cảnh báo vượt ngân sách', desc: 'Thông báo khi chi vượt giới hạn', icon: Wallet },
  { key: 'rent', label: 'Nhắc tiền nhà trọ', desc: 'Nhắc ngày đóng tiền', icon: Home },
  { key: 'warranty', label: 'Bảo hành sản phẩm', desc: 'Sản phẩm sắp hết hạn bảo hành', icon: Shield },
];
const DAY_OPTIONS = [1, 3, 5, 7, 14, 30];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? '' : 'bg-gray-300'}`} style={on ? { backgroundColor: PURPLE } : undefined}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function NotificationSettingsMobile() {
  const { pop } = useMobileNav();
  const [rc, setRc] = useState<ReminderConfig>(loadReminderConfig);
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings);

  const updateRc = (next: ReminderConfig) => { setRc(next); saveReminderConfig(next); };
  const updateSettings = (next: NotificationSettings) => { setSettings(next); saveNotificationSettings(next); };

  const sorted = [...rc.reminders].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold" style={{ color: '#1A1A1A' }}>Nhắc nhập chi tiêu</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
        {/* NHẮC NHỞ HÀNG NGÀY */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-2 px-1">NHẮC NHỞ HÀNG NGÀY</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}><Bell size={18} style={{ color: PURPLE }} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Bật nhắc nhở</p>
                <p className="text-[11px] text-gray-500">Không nhắc nếu hôm nay đã nhập chi tiêu</p>
              </div>
              <Toggle on={rc.enabled} onClick={() => updateRc({ ...rc, enabled: !rc.enabled })} />
            </div>

            {rc.enabled && (
              <>
                <div className="h-px bg-gray-50 mx-4" />
                <label className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-gray-600">
                  <input type="checkbox" checked={rc.skipIfAlreadyEntered} onChange={() => updateRc({ ...rc, skipIfAlreadyEntered: !rc.skipIfAlreadyEntered })} style={{ accentColor: PURPLE }} />
                  Bỏ qua nếu hôm nay đã nhập
                </label>
                {sorted.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}><Clock size={17} style={{ color: PURPLE }} /></div>
                    <span className="flex-1 text-sm text-gray-900">Nhắc lúc</span>
                    <input type="time" value={r.time}
                      onChange={e => updateRc({ ...rc, reminders: rc.reminders.map(x => x.id === r.id ? { ...x, time: e.target.value } : x) })}
                      className="text-sm font-medium rounded-lg px-2 py-1 border-0" style={{ backgroundColor: '#F3E5F5', color: PURPLE }} />
                    <Toggle on={r.enabled} onClick={() => updateRc({ ...rc, reminders: rc.reminders.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x) })} />
                  </div>
                ))}
                <button
                  onClick={() => updateRc({ ...rc, reminders: [...rc.reminders, { id: `rem_${Date.now()}`, time: '08:00', enabled: true }] })}
                  className="w-full flex items-center gap-2 px-4 py-3 border-t border-gray-50 text-[13px] font-medium" style={{ color: PURPLE }}>
                  <AlarmClock size={16} /> Thêm giờ nhắc
                </button>
              </>
            )}
          </div>
        </div>

        {/* CẢNH BÁO & NHẮC NHỞ */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-2 px-1">CẢNH BÁO & NHẮC NHỞ</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {ALERT_TYPES.map(({ key, label, desc, icon: IconComp }, i) => (
              <div key={key} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}><IconComp size={18} style={{ color: PURPLE }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-500">{desc}</p>
                </div>
                <Toggle on={settings[key]} onClick={() => updateSettings({ ...settings, [key]: !settings[key] })} />
              </div>
            ))}
          </div>
        </div>

        {/* NHẮC TRƯỚC (NGÀY) */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-2 px-1">NHẮC TRƯỚC (NGÀY)</p>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map(day => {
                const active = settings.reminderDays.includes(day);
                return (
                  <button key={day}
                    onClick={() => {
                      const next = active ? settings.reminderDays.filter(d => d !== day) : [...settings.reminderDays, day].sort((a, b) => a - b);
                      if (next.length > 0) updateSettings({ ...settings, reminderDays: next });
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
                    style={active ? { backgroundColor: PURPLE, color: '#fff', borderColor: PURPLE } : { color: '#6B7280', borderColor: '#E5E7EB' }}>
                    {day} ngày
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 px-1">Lưu ý: cấu hình được lưu trên thiết bị. Thông báo đẩy trên trình duyệt web có thể chưa được hỗ trợ đầy đủ.</p>
        <div className="h-4" />
      </div>
    </div>
  );
}
