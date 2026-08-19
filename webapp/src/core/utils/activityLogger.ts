import type { ActivityLog, FinanceData } from '@/types';

const MAX_LOG_ENTRIES = 100;

/**
 * Creates an activity log entry and adds it to the data.
 * Keeps max 100 entries (removes oldest when exceeded).
 */
export function addActivityLog(
  data: FinanceData,
  action: ActivityLog['action'],
  description: string,
  moduleId?: string,
  recordId?: string
): FinanceData {
  const entry: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    moduleId,
    recordId,
    description,
    timestamp: new Date().toISOString(),
  };

  const activityLog = [entry, ...(data.activityLog || [])].slice(0, MAX_LOG_ENTRIES);
  return { ...data, activityLog };
}
