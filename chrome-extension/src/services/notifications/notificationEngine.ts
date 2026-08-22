/**
 * NotificationEngine — Computed notification system.
 * Generates notifications from FinanceData without modifying it.
 * No sync, no encryption, no finance.json changes.
 * Notifications are ephemeral — computed each time data loads.
 */

import type { FinanceData } from '@/types';

export interface AppNotification {
  id: string;           // stable: type_moduleId_date (prevents duplicates)
  type: 'credit_card' | 'rent' | 'warranty' | 'recurring' | 'budget';
  moduleId?: string;
  title: string;
  message: string;
  date: string;         // ISO date the notification refers to
  daysLeft: number;     // days until the event
  priority: 'high' | 'medium' | 'low';
  icon: string;         // emoji
}

export interface NotificationSettings {
  creditCard: boolean;
  rent: boolean;
  warranty: boolean;
  recurring: boolean;
  budget: boolean;
  reminderDays: number[];
}

const DEFAULT_SETTINGS: NotificationSettings = {
  creditCard: true,
  rent: true,
  warranty: true,
  recurring: true,
  budget: true,
  reminderDays: [1, 3, 7],
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem('pdp_notification_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* */ }
  return DEFAULT_SETTINGS;
}

export function saveNotificationSettings(s: NotificationSettings): void {
  try { localStorage.setItem('pdp_notification_settings', JSON.stringify(s)); } catch { /* */ }
}

/**
 * Generate all notifications from current finance data.
 * Pure function — no side effects, no data mutation.
 */
export function generateNotifications(data: FinanceData | null): AppNotification[] {
  if (!data) return [];
  const settings = getNotificationSettings();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notifications: AppNotification[] = [];

  if (settings.creditCard) notifications.push(...generateCreditCardReminders(data, today, settings.reminderDays));
  if (settings.rent) notifications.push(...generateRentReminders(data, today, settings.reminderDays));
  if (settings.warranty) notifications.push(...generateWarrantyReminders(data, today));
  if (settings.recurring) notifications.push(...generateRecurringReminders(data, today, settings.reminderDays));
  if (settings.budget) notifications.push(...generateBudgetAlerts(data, today));

  return notifications.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ─── Credit Card ──────────────────────────────────────────────────────────────

function generateCreditCardReminders(data: FinanceData, today: Date, days: number[]): AppNotification[] {
  const results: AppNotification[] = [];
  const cards = data.records.filter(r => r.moduleId === 'mod_creditcard' && !r.isDeleted);

  for (const card of cards) {
    const name = getVal(card, 'card_name') || 'Thẻ';
    const last4 = getVal(card, 'last4');
    const stmtDay = parseInt(getVal(card, 'statement_day') || '0', 10);
    const dueDays = parseInt(getVal(card, 'payment_due_day') || '0', 10);
    if (!stmtDay || !dueDays) continue;

    // Calculate next due date: statement_day + payment_due_days
    const now = today;
    let dueDate = new Date(now.getFullYear(), now.getMonth(), stmtDay + dueDays);
    if (dueDate < now) dueDate = new Date(now.getFullYear(), now.getMonth() + 1, stmtDay + dueDays);

    const daysLeft = Math.round((dueDate.getTime() - now.getTime()) / 86400000);
    const label = last4 ? `${name} (*${last4})` : name;
    const dateStr = fmtDate(dueDate);

    for (const d of days) {
      if (daysLeft <= d && daysLeft >= 0) {
        results.push({
          id: `credit_due_${card.id}_${dateStr.replace(/\//g, '')}`,
          type: 'credit_card',
          moduleId: card.id,
          title: '💳 Sắp đến hạn thanh toán',
          message: `Thẻ ${label} — Còn ${daysLeft} ngày (${dateStr})`,
          date: dueDate.toISOString().slice(0, 10),
          daysLeft,
          priority: daysLeft <= 1 ? 'high' : daysLeft <= 3 ? 'medium' : 'low',
          icon: '💳',
        });
        break; // only one notification per card
      }
    }
  }
  return results;
}

// ─── Nhà trọ ──────────────────────────────────────────────────────────────────

function generateRentReminders(data: FinanceData, today: Date, days: number[]): AppNotification[] {
  const results: AppNotification[] = [];
  const rentals = data.records.filter(r => r.moduleId === 'mod_nhatro' && !r.isDeleted);

  // Get unique rent_due_day values (deduplicate by day)
  const seenDays = new Set<number>();
  for (const r of rentals) {
    const dueDay = parseInt(getVal(r, 'rent_due_day') || '0', 10);
    if (!dueDay || dueDay < 1 || dueDay > 31 || seenDays.has(dueDay)) continue;
    seenDays.add(dueDay);

    let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueDate < today) dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);

    const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const dateStr = fmtDate(dueDate);

    for (const d of days) {
      if (daysLeft <= d && daysLeft >= 0) {
        results.push({
          id: `rent_due_${dueDay}_${today.getFullYear()}${String(dueDate.getMonth() + 1).padStart(2, '0')}`,
          type: 'rent',
          title: '🏠 Sắp đến ngày đóng tiền nhà',
          message: `Ngày ${dueDay} — Còn ${daysLeft} ngày (${dateStr})`,
          date: dueDate.toISOString().slice(0, 10),
          daysLeft,
          priority: daysLeft <= 1 ? 'high' : daysLeft <= 3 ? 'medium' : 'low',
          icon: '🏠',
        });
        break;
      }
    }
  }
  return results;
}

// ─── Warranty ─────────────────────────────────────────────────────────────────

function generateWarrantyReminders(data: FinanceData, today: Date): AppNotification[] {
  const results: AppNotification[] = [];
  const thresholds = [30, 15, 7]; // days before expiry

  for (const r of data.records) {
    if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
    const warrantyDate = getVal(r, 'warranty_date');
    if (!warrantyDate) continue;

    const expiry = new Date(warrantyDate + 'T00:00:00');
    if (isNaN(expiry.getTime()) || expiry < today) continue;

    const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);
    const title = getVal(r, 'title') || 'Sản phẩm';

    for (const d of thresholds) {
      if (daysLeft <= d) {
        results.push({
          id: `warranty_${r.id}_${warrantyDate}`,
          type: 'warranty',
          moduleId: r.id,
          title: '🔧 Sắp hết hạn bảo hành',
          message: `${title} — Còn ${daysLeft} ngày (${fmtDate(expiry)})`,
          date: warrantyDate,
          daysLeft,
          priority: daysLeft <= 7 ? 'high' : daysLeft <= 15 ? 'medium' : 'low',
          icon: '🔧',
        });
        break;
      }
    }
  }
  return results;
}

// ─── Recurring Transaction ────────────────────────────────────────────────────

function generateRecurringReminders(data: FinanceData, today: Date, days: number[]): AppNotification[] {
  const results: AppNotification[] = [];
  const recurring = data.recurringTransactions || [];

  for (const rt of recurring) {
    if (!rt.isActive || !rt.nextRunDate) continue;
    const nextDate = new Date(rt.nextRunDate + 'T00:00:00');
    if (isNaN(nextDate.getTime()) || nextDate < today) continue;

    const daysLeft = Math.round((nextDate.getTime() - today.getTime()) / 86400000);
    const title = Object.entries(rt.values).find(([k]) => k.endsWith('_title'))?.[1] as string || 'Giao dịch';
    const amount = Object.entries(rt.values).find(([k]) => k.endsWith('_amount'))?.[1];
    const amtStr = amount ? ` — ${Number(amount).toLocaleString('vi-VN')}₫` : '';

    for (const d of days) {
      if (daysLeft <= d && daysLeft >= 0) {
        results.push({
          id: `recurring_${rt.id}_${rt.nextRunDate}`,
          type: 'recurring',
          title: '🔁 Sắp đến giao dịch định kỳ',
          message: `${title}${amtStr} — Còn ${daysLeft} ngày (${fmtDate(nextDate)})`,
          date: rt.nextRunDate,
          daysLeft,
          priority: daysLeft <= 1 ? 'high' : daysLeft <= 3 ? 'medium' : 'low',
          icon: '🔁',
        });
        break;
      }
    }
  }
  return results;
}

// ─── Budget Alert ─────────────────────────────────────────────────────────────

function generateBudgetAlerts(data: FinanceData, today: Date): AppNotification[] {
  const results: AppNotification[] = [];
  const budgets = data.budgets || [];
  if (budgets.length === 0) return results;

  // Calculate spending per category this month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const spentByCategory = new Map<string, number>();
  for (const r of data.records) {
    if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
    const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
    const d = dateKey ? String(r.values[dateKey] ?? '') : '';
    if (d < monthStart || d > monthEnd) continue;
    const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
    if (typeKey && String(r.values[typeKey]) !== '0') continue; // only expenses
    const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
    const amt = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
    const catId = r.categoryId || '__other';
    spentByCategory.set(catId, (spentByCategory.get(catId) ?? 0) + amt);
  }

  for (const b of budgets) {
    if (!b.isActive || !b.monthlyLimit) continue;
    const spent = spentByCategory.get(b.categoryId) ?? 0;
    const pct = (spent / b.monthlyLimit) * 100;

    // Find category name
    const mod = data.modules.find(m => m.id === 'mod_chitieu');
    const cat = mod?.categories?.find(c => c.id === b.categoryId);
    const catName = cat?.name || 'Danh mục';
    const monthLabel = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    let notification: AppNotification | null = null;
    if (pct >= 100) {
      notification = {
        id: `budget_${b.categoryId}_${monthLabel.replace('/', '')}`,
        type: 'budget', title: '🚨 Đã vượt ngân sách',
        message: `${catName}: ${Math.round(pct)}% (${fmtMoney(spent)} / ${fmtMoney(b.monthlyLimit)})`,
        date: today.toISOString().slice(0, 10), daysLeft: 0, priority: 'high', icon: '🚨',
      };
    } else if (pct >= 90) {
      notification = {
        id: `budget_${b.categoryId}_${monthLabel.replace('/', '')}`,
        type: 'budget', title: '⚠️ Sắp vượt ngân sách',
        message: `${catName}: ${Math.round(pct)}% (${fmtMoney(spent)} / ${fmtMoney(b.monthlyLimit)})`,
        date: today.toISOString().slice(0, 10), daysLeft: 0, priority: 'high', icon: '⚠️',
      };
    } else if (pct >= 80) {
      notification = {
        id: `budget_${b.categoryId}_${monthLabel.replace('/', '')}`,
        type: 'budget', title: '⚠️ Gần đạt ngân sách',
        message: `${catName}: ${Math.round(pct)}% (${fmtMoney(spent)} / ${fmtMoney(b.monthlyLimit)})`,
        date: today.toISOString().slice(0, 10), daysLeft: 0, priority: 'medium', icon: '⚠️',
      };
    }
    if (notification) results.push(notification);
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVal(record: { values: Record<string, unknown> }, suffix: string): string {
  const key = Object.keys(record.values).find(k => k.endsWith(`_${suffix}`));
  return key ? String(record.values[key] ?? '') : '';
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}
