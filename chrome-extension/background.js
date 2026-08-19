// Background service worker for Chrome Extension
// Handles: icon click, Google OAuth, and EXPENSE REMINDERS

const REMINDER_CONFIG_KEY = 'pdp_expense_reminders';
const REMINDER_FIRED_KEY = 'pdp_reminder_fired'; // Track which reminders fired today

// ═══════════════════════════════════════════════════════════════════════════════
// ICON CLICK → Open app in new tab
// ═══════════════════════════════════════════════════════════════════════════════

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER (Auth tokens + Reminder management)
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_AUTH_TOKEN') {
    chrome.identity.getAuthToken({ interactive: message.interactive }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
    return true;
  }

  if (message.type === 'REMOVE_AUTH_TOKEN') {
    chrome.identity.removeCachedAuthToken({ token: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Reminder: re-schedule after config change
  if (message.type === 'RESCHEDULE_REMINDERS') {
    scheduleReminders();
    sendResponse({ success: true });
    return true;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function getDefaultConfig() {
  return {
    enabled: true,
    skipIfAlreadyEntered: true,
    reminders: [
      { id: 'rem_default_1', time: '12:00', enabled: true },
      { id: 'rem_default_2', time: '21:00', enabled: true },
    ],
  };
}

function loadConfig() {
  try {
    const saved = localStorage.getItem(REMINDER_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* */ }
  return getDefaultConfig();
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function hasFiredToday(reminderId) {
  try {
    const fired = JSON.parse(localStorage.getItem(REMINDER_FIRED_KEY) || '{}');
    const today = getTodayKey();
    return fired[today]?.includes(reminderId) || false;
  } catch { return false; }
}

function markFired(reminderId) {
  try {
    const fired = JSON.parse(localStorage.getItem(REMINDER_FIRED_KEY) || '{}');
    const today = getTodayKey();
    if (!fired[today]) fired[today] = [];
    if (!fired[today].includes(reminderId)) fired[today].push(reminderId);
    // Clean old days (keep only today)
    const cleaned = { [today]: fired[today] };
    localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify(cleaned));
  } catch { /* */ }
}

async function scheduleReminders() {
  // Clear all existing alarms
  await chrome.alarms.clearAll();

  const config = loadConfig();
  if (!config.enabled) return;

  const now = new Date();
  const todayStr = getTodayKey();

  for (const reminder of config.reminders) {
    if (!reminder.enabled) continue;

    const [hours, minutes] = reminder.time.split(':').map(Number);
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);

    // If time already passed today, schedule for tomorrow
    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }

    const alarmName = `reminder_${reminder.id}`;
    chrome.alarms.create(alarmName, {
      when: alarmTime.getTime(),
      periodInMinutes: 24 * 60, // Repeat daily
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALARM HANDLER — fires notification
// ═══════════════════════════════════════════════════════════════════════════════

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('reminder_')) return;

  const reminderId = alarm.name.replace('reminder_', '');
  const config = loadConfig();

  // Check global enabled
  if (!config.enabled) return;

  // Check this reminder still enabled
  const reminder = config.reminders.find((r) => r.id === reminderId);
  if (!reminder || !reminder.enabled) return;

  // Check not already fired today (prevent duplicates)
  if (hasFiredToday(reminderId)) return;

  // Check "skip if already entered today"
  if (config.skipIfAlreadyEntered) {
    const hasEnteredToday = await checkHasEnteredToday();
    if (hasEnteredToday) return;
  }

  // Fire notification
  chrome.notifications.create(`expense_reminder_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '💰 Nhắc nhập chi tiêu',
    message: 'Hôm nay bạn đã nhập chi tiêu chưa?',
    priority: 2,
    requireInteraction: true,
  });

  markFired(reminderId);
});

// Check if user has entered expense today
async function checkHasEnteredToday() {
  // Read from IndexedDB via chrome.storage or open IndexedDB directly
  // For simplicity, use chrome.storage.local as bridge
  try {
    const result = await chrome.storage.local.get('lastExpenseDate');
    const today = getTodayKey();
    return result.lastExpenseDate === today;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — open app
// ═══════════════════════════════════════════════════════════════════════════════

chrome.notifications.onClicked.addListener((_notificationId) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP — schedule reminders on install/update/startup
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default config if not exists
  if (!localStorage.getItem(REMINDER_CONFIG_KEY)) {
    localStorage.setItem(REMINDER_CONFIG_KEY, JSON.stringify(getDefaultConfig()));
  }
  scheduleReminders();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleReminders();
});
