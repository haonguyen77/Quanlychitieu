/**
 * Recurring Transaction Executor
 * 
 * Checks if any recurring transactions are due and creates actual records.
 * Called once when data is loaded / app starts.
 * 
 * RULES (from Android source):
 * - Only execute if isActive === true
 * - Only execute if nextRunDate <= today
 * - After execution: advance nextRunDate by frequency
 * - Do NOT create duplicate if already executed (check by comparing nextRunDate)
 * - Sync safety: modifies recurringTransactions[].nextRunDate (absolute state)
 *   and creates a new record (unique UUID) — no double-counting on sync
 */

import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import type { RecurringTransaction } from '@/types';

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Execute all due recurring transactions.
 * Returns number of transactions created.
 */
export function executeRecurringTransactions(): number {
  const { data } = useAppStore.getState();
  if (!data) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const recurring = data.recurringTransactions || [];
  let executed = 0;
  const updatedRecurring: RecurringTransaction[] = [];

  for (const rt of recurring) {
    if (!rt.isActive || !rt.nextRunDate) {
      updatedRecurring.push(rt);
      continue;
    }

    // Check if due (nextRunDate <= today)
    if (rt.nextRunDate <= today) {
      // Create the transaction record
      const values = { ...rt.values };
      // Update date to today (the actual execution date)
      const dateKey = Object.keys(values).find(k => k.endsWith('_date'));
      if (dateKey) values[dateKey] = today;

      useRecordStore.getState().addRecord(
        rt.moduleId,
        values,
        rt.categoryId || undefined,
        rt.linkedModuleId || undefined
      );

      // Advance nextRunDate
      const newNextDate = advanceDate(rt.nextRunDate, rt.frequency);
      updatedRecurring.push({ ...rt, nextRunDate: newNextDate });
      executed++;
    } else {
      updatedRecurring.push(rt);
    }
  }

  // Save updated recurring list if any were executed
  if (executed > 0) {
    useAppStore.getState().setData({
      ...data,
      recurringTransactions: updatedRecurring,
      lastModified: new Date().toISOString(),
    });
  }

  return executed;
}
