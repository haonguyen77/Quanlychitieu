// Background service worker for Chrome Extension
// Handles: extension icon click, OAuth, and daily expense reminders via chrome.alarms

// Open app in new tab when clicking the extension icon
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

// Listen for messages from the app
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

  // When reminder config changes, reschedule all alarms
  if (message.type === 'RESCHEDULE_REMINDERS') {
    // Config is passed directly in the message (since service worker can't access localStorage)
    if (message.config) {
      chrome.storage.local.set({ reminder_config: message.config }, () => {
        scheduleReminders(message.config);
      });
    } else {
      // Fallback: read from chrome.storage
      chrome.storage.local.get(['reminder_config'], (result) => {
        if (result.reminder_config) {
          scheduleReminders(result.reminder_config);
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // Legacy: SET_REMINDER for simple single-alarm
  if (message.type === 'SET_REMINDER') {
    const { enabled, hour, minute } = message;
    if (enabled) {
      createAlarmForTime('legacy_reminder', hour, minute);
    } else {
      chrome.alarms.clear('legacy_reminder');
    }
    sendResponse({ success: true });
    return true;
  }
});

// ─── Alarm Scheduling ────────────────────────────────────────────────────────

function scheduleReminders(config) {
  // Clear all existing reminder alarms
  chrome.alarms.getAll((alarms) => {
    for (const alarm of alarms) {
      if (alarm.name.startsWith('rem_')) {
        chrome.alarms.clear(alarm.name);
      }
    }

    // Schedule enabled reminders
    if (!config.enabled) return;
    const reminders = config.reminders || [];
    for (const rem of reminders) {
      if (!rem.enabled || !rem.time) continue;
      const [hour, minute] = rem.time.split(':').map(Number);
      createAlarmForTime(`rem_${rem.id}`, hour, minute);
    }
  });
}

function createAlarmForTime(name, hour, minute) {
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  const delayMinutes = Math.max(1, (target.getTime() - now.getTime()) / 60000);
  
  chrome.alarms.create(name, {
    delayInMinutes: delayMinutes,
    periodInMinutes: 24 * 60 // repeat every 24h
  });
}

// ─── Alarm Trigger → Notification ────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('rem_') && alarm.name !== 'legacy_reminder') return;

  // Check skip-if-already-entered
  chrome.storage.local.get(['reminder_config', 'last_expense_date'], (result) => {
    const config = result.reminder_config;
    const today = new Date().toISOString().slice(0, 10);
    
    if (config?.skipIfAlreadyEntered && result.last_expense_date === today) {
      return; // User already entered expense today
    }

    chrome.notifications.create(`notif_${alarm.name}_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/app_icon.png',
      title: 'Nhắc nhở chi tiêu',
      message: 'Bạn đã nhập chi tiêu hôm nay chưa? Hãy ghi lại ngay!',
      priority: 2,
      requireInteraction: true
    });
  });
});

// Handle notification click — open the extension
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  chrome.notifications.clear(notificationId);
});

// ─── On Install/Startup: restore alarms from storage ─────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  restoreAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  restoreAlarms();
});

function restoreAlarms() {
  chrome.storage.local.get(['reminder_config'], (result) => {
    if (result.reminder_config) {
      scheduleReminders(result.reminder_config);
    } else {
      // Default: remind at 20:00
      const defaultConfig = {
        enabled: true,
        skipIfAlreadyEntered: true,
        reminders: [
          { id: 'default_1', time: '20:00', enabled: true }
        ]
      };
      chrome.storage.local.set({ reminder_config: defaultConfig });
      scheduleReminders(defaultConfig);
    }
  });
}
