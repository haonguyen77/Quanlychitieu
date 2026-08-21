/**
 * NotificationBridge — Syncs computed notifications to chrome.storage.local
 * so the background service worker can fire chrome.notifications when popup is closed.
 *
 * Flow:
 * 1. Popup calls syncNotificationsToBackground(data) whenever data loads/changes
 * 2. This writes pending notifications to chrome.storage.local
 * 3. Background service worker reads them on alarm trigger and shows chrome.notifications
 * 4. Fired notification IDs are tracked to prevent duplicates
 */

import type { FinanceData } from '@/types';
import { generateNotifications, getNotificationSettings } from './notificationEngine';

const STORAGE_KEY = 'pdp_bg_notifications';
const SETTINGS_KEY = 'pdp_notification_settings_bg';

/**
 * Sync current notifications to chrome.storage.local for background access.
 * Call this after data loads or when notification settings change.
 */
export function syncNotificationsToBackground(data: FinanceData | null): void {
  try {
    if (!chrome?.storage?.local) return;

    const notifications = generateNotifications(data);
    const settings = getNotificationSettings();

    // Store minimal notification data for background
    const bgNotifications = notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      icon: n.icon,
      priority: n.priority,
      daysLeft: n.daysLeft,
      type: n.type,
    }));

    chrome.storage.local.set({
      [STORAGE_KEY]: bgNotifications,
      [SETTINGS_KEY]: settings,
      pdp_bg_last_sync: new Date().toISOString(),
    });
  } catch {
    // Silently fail — extension context might not be available
  }
}

/**
 * Tell background to setup/update the notification check alarm.
 */
export function setupBackgroundAlarm(): void {
  try {
    chrome?.runtime?.sendMessage?.({ type: 'SETUP_NOTIFICATION_ALARM' });
  } catch {
    // Silently fail
  }
}
