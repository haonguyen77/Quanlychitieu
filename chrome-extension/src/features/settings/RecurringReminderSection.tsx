import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

const RECURRING_KEY = 'pdp_recurring_reminders';

interface RecurringReminder {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  time: string;
  enabled: boolean;
}

function loadReminders(): RecurringReminder[] {
  try {
    const saved = localStorage.getItem(RECURRING_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* */ }
  return [];
}

function saveReminders(list: RecurringReminder[]) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
  // Also send to background with the expense reminder config for rescheduling
  try {
    const reminderConfig = localStorage.getItem('pdp_expense_reminders');
    const config = reminderConfig ? JSON.parse(reminderConfig) : null;
    chrome.runtime?.sendMessage?.({ type: 'RESCHEDULE_REMINDERS', config });
  } catch { /* */ }
}

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function RecurringReminderSection() {
  const [reminders, setReminders] = useState<RecurringReminder[]>(loadReminders);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [newDay, setNewDay] = useState(10);
  const [newDayOfWeek, setNewDayOfWeek] = useState(1);
  const [newTime, setNewTime] = useState('08:00');

  const update = (list: RecurringReminder[]) => { setReminders(list); saveReminders(list); };

  const toggle = (id: string) => {
    update(reminders.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const remove = (id: string) => {
    update(reminders.filter((r) => r.id !== id));
  };

  const add = () => {
    if (!newTitle.trim()) return;
    const item: RecurringReminder = {
      id: `rec_${Date.now()}`,
      title: newTitle.trim(),
      frequency: newFreq,
      dayOfMonth: newFreq === 'monthly' ? newDay : undefined,
      dayOfWeek: newFreq === 'weekly' ? newDayOfWeek : undefined,
      time: newTime,
      enabled: true,
    };
    update([...reminders, item]);
    setNewTitle('');
    setAdding(false);
  };

  const freqLabel = (r: RecurringReminder) => {
    if (r.frequency === 'daily') return `Hàng ngày ${r.time}`;
    if (r.frequency === 'weekly') return `${DAYS[r.dayOfWeek ?? 0]} hàng tuần ${r.time}`;
    return `Ngày ${r.dayOfMonth} hàng tháng ${r.time}`;
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Nhắc nhở định kỳ</h2>
        <button onClick={() => setAdding(!adding)} className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          {adding ? 'Đóng' : '+ Thêm'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="space-y-2 mb-3 p-3 rounded-lg border border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/50">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="VD: Đóng tiền nước" className="input-field text-sm w-full" autoFocus />
          <div className="flex gap-2 items-center">
            <select value={newFreq} onChange={(e) => setNewFreq(e.target.value as any)}
              className="input-field text-xs py-1 px-2">
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
            </select>
            {newFreq === 'monthly' && (
              <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}
                className="input-field text-xs py-1 px-2">
                {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
              </select>
            )}
            {newFreq === 'weekly' && (
              <select value={newDayOfWeek} onChange={(e) => setNewDayOfWeek(Number(e.target.value))}
                className="input-field text-xs py-1 px-2">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            )}
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
              className="input-field text-xs py-1 px-2 w-20" />
            <button onClick={add} className="btn-primary text-xs px-3">Thêm</button>
          </div>
        </div>
      )}

      {/* List */}
      {reminders.length === 0 && !adding && (
        <p className="text-xs text-[var(--color-text-secondary)]">Chưa có nhắc nhở. VD: Ngày 10 hàng tháng — Đóng tiền nước</p>
      )}
      <div className="space-y-1">
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)]">
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--color-text)]">{r.title}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] ml-2">{freqLabel(r)}</span>
            </div>
            <button onClick={() => toggle(r.id)}
              className={`px-2 py-0.5 text-[10px] rounded-full ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {r.enabled ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => remove(r.id)} className="p-1 text-gray-400 hover:text-red-500">
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
