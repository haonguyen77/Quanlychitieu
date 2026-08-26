import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

const REMINDER_CONFIG_KEY = 'pdp_expense_reminders';

interface Reminder {
  id: string;
  time: string;
  enabled: boolean;
}

interface ReminderConfig {
  enabled: boolean;
  skipIfAlreadyEntered: boolean;
  reminders: Reminder[];
}

function getDefaultConfig(): ReminderConfig {
  return {
    enabled: true,
    skipIfAlreadyEntered: true,
    reminders: [
      { id: 'rem_default_1', time: '12:00', enabled: true },
      { id: 'rem_default_2', time: '21:00', enabled: true },
    ],
  };
}

function loadConfig(): ReminderConfig {
  try {
    const saved = localStorage.getItem(REMINDER_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* */ }
  return getDefaultConfig();
}

function saveConfig(config: ReminderConfig) {
  localStorage.setItem(REMINDER_CONFIG_KEY, JSON.stringify(config));
  // Web: reminders will use Web Notification API in Phase 5
}

export function ReminderSection({ embedded = false }: { embedded?: boolean } = {}) {
  const [config, setConfig] = useState<ReminderConfig>(loadConfig);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [newTime, setNewTime] = useState('');

  const update = (newConfig: ReminderConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const toggleGlobal = () => update({ ...config, enabled: !config.enabled });
  const toggleSkip = () => update({ ...config, skipIfAlreadyEntered: !config.skipIfAlreadyEntered });

  const toggleReminder = (id: string) => {
    update({ ...config, reminders: config.reminders.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r) });
  };

  const deleteReminder = (id: string) => {
    update({ ...config, reminders: config.reminders.filter((r) => r.id !== id) });
  };

  const startEdit = (r: Reminder) => { setEditingId(r.id); setEditingTime(r.time); };
  
  const saveEdit = () => {
    if (!editingTime || !editingId) return;
    // Check duplicate
    if (config.reminders.some((r) => r.id !== editingId && r.time === editingTime)) {
      alert('Khung giờ này đã tồn tại.');
      return;
    }
    update({ ...config, reminders: config.reminders.map((r) => r.id === editingId ? { ...r, time: editingTime } : r) });
    setEditingId(null);
  };

  const addReminder = () => {
    if (!newTime) return;
    if (config.reminders.some((r) => r.time === newTime)) {
      alert('Khung giờ này đã tồn tại.');
      return;
    }
    const id = `rem_${Date.now()}`;
    update({ ...config, reminders: [...config.reminders, { id, time: newTime, enabled: true }] });
    setNewTime('');
  };

  // Sort by time
  const sortedReminders = [...config.reminders].sort((a, b) => a.time.localeCompare(b.time));

  const toggleBtn = (
    <button
      onClick={toggleGlobal}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${config.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
    >
      {config.enabled ? 'ON' : 'OFF'}
    </button>
  );

  const body = (
    <div className={embedded ? 'pt-3' : ''}>
      {!embedded && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Nhắc nhập chi tiêu</h2>
          {toggleBtn}
        </div>
      )}
      {embedded && <div className="flex justify-end mb-2">{toggleBtn}</div>}

      {config.enabled && (
        <div className="space-y-3">
          {/* Skip if already entered */}
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={config.skipIfAlreadyEntered} onChange={toggleSkip} className="rounded" />
            Không nhắc nếu hôm nay đã nhập chi tiêu
          </label>

          {/* Reminder list */}
          <div className="space-y-1">
            {sortedReminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)]">
                {editingId === r.id ? (
                  <>
                    <input type="time" value={editingTime} onChange={(e) => setEditingTime(e.target.value)}
                      className="input-field text-sm py-1 px-2 w-24" autoFocus />
                    <button onClick={saveEdit} className="text-xs text-green-600 font-medium">Lưu</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Hủy</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-mono font-medium text-[var(--color-text)] flex-1">{r.time}</span>
                    <button onClick={() => toggleReminder(r.id)}
                      className={`px-2 py-0.5 text-[10px] rounded-full ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {r.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => startEdit(r)} className="p-1 text-gray-400 hover:text-blue-500"><Icon name="edit" size={12} /></button>
                    <button onClick={() => deleteReminder(r.id)} className="p-1 text-gray-400 hover:text-red-500"><Icon name="trash" size={12} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="flex items-center gap-2">
            <Icon name="clock" size={14} className="text-[var(--color-text-secondary)]" />
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
              className="input-field text-sm py-1.5 px-2 w-28" placeholder="--:--" />
            <button onClick={addReminder} disabled={!newTime}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${newTime ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              + Thêm giờ
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return body;
  return <section className="card p-5">{body}</section>;
}
