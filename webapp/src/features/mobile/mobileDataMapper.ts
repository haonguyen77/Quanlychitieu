/**
 * Mobile Data Mapper — Shared utility for resolving display info from data.
 * All Mobile screens MUST use this mapper instead of inline logic.
 * Source of truth: Android models + finance.json structure.
 */

import type { FinanceData, DataRecord, ModuleDefinition, CategoryDefinition, Account } from '@/types';
import { getAccountIconInfo, getModuleIconInfo, getModuleColor, BENEFICIARY_OPTIONS, CATEGORY_ICONS } from './mobileIconMap';
import { hasMobileIcon } from './MobileIcon';

export interface DisplayInfo {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// ─── Category Icon Resolution (shared by list + Add screen) ───────────────────
// Category icons come in TWO naming systems in synced data:
//   1. Semantic keys mapped in CATEGORY_ICONS (e.g. "food", "shopping", "health")
//   2. Direct Lucide/MobileIcon names (e.g. "utensils", "car", "shopping-bag", "heart")
// We resolve both; only fall back to "other" (dots) when neither matches.
function hexTint(hex?: string | null): string {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}1A` : '#F5F5F5';
}

export function resolveCategoryVisual(icon?: string | null, color?: string | null): { icon: string; color: string; bgColor: string } {
  const other = CATEGORY_ICONS.other;
  if (!icon) return { icon: other.icon, color: color || other.color, bgColor: color ? hexTint(color) : other.bgColor };
  const semantic = CATEGORY_ICONS[icon];
  if (semantic) return { icon: semantic.icon, color: color || semantic.color, bgColor: color ? hexTint(color) : semantic.bgColor };
  if (hasMobileIcon(icon)) { const c = color || '#607D8B'; return { icon, color: c, bgColor: hexTint(c) }; }
  return { icon: other.icon, color: color || other.color, bgColor: color ? hexTint(color) : other.bgColor };
}

// ─── Credit Card helpers ──────────────────────────────────────────────────────
export interface CreditCardInfo {
  id: string;
  name: string;
  bankName: string;
  last4: string;
  creditLimit: number;
  statementDay: number;   // day-of-month the statement closes
  paymentDueDays: number; // days after statement date payment is due
}

/**
 * Normalize a transaction's payment/account value to a credit-card id.
 * Handles all known formats so App/EXT/WebApp data all resolve to the same card:
 *   - "credit_card_<id>"  (EXT/finance.json transaction account)
 *   - "acc_cc_<id>"       (auto-created account id)
 * Returns null if the value is not a credit-card reference.
 */
export function resolveCreditCardIdFromAccount(account?: string | null): string | null {
  if (!account) return null;
  if (account.startsWith('credit_card_')) return account.slice('credit_card_'.length);
  if (account.startsWith('acc_cc_')) return account.slice('acc_cc_'.length);
  return null;
}

/** All credit cards, read from mod_creditcard records (the synced entity). */
export function getCreditCards(data: FinanceData | null): CreditCardInfo[] {
  if (!data) return [];
  return data.records
    .filter(r => r.moduleId === 'mod_creditcard' && !r.isDeleted)
    .map(r => {
      const stmt = parseInt(getRecordField(r, 'statement_day'), 10);
      const due = parseInt(getRecordField(r, 'payment_due_day'), 10);
      return {
        id: r.id,
        name: getRecordField(r, 'card_name') || 'Thẻ',
        bankName: getRecordField(r, 'bank_name'),
        last4: getRecordField(r, 'last4'),
        creditLimit: Number(getRecordField(r, 'credit_limit')) || 0,
        statementDay: Number.isFinite(stmt) && stmt >= 1 && stmt <= 31 ? stmt : 0,
        paymentDueDays: Number.isFinite(due) && due >= 0 && due <= 60 ? due : 0,
      };
    });
}

// ─── Category Display ─────────────────────────────────────────────────────────

export function getCategoryDisplay(categoryId: string | undefined | null, data: FinanceData | null): DisplayInfo {
  if (!categoryId || !data) return { label: 'Không phân loại', icon: 'more-horizontal', color: '#9E9E9E', bgColor: '#F5F5F5' };
  for (const mod of data.modules) {
    const cat = mod.categories?.find(c => c.id === categoryId);
    if (cat) {
      const v = resolveCategoryVisual(cat.icon, cat.color);
      return { label: cat.name, icon: v.icon, color: v.color, bgColor: v.bgColor };
    }
  }
  return { label: 'Không phân loại', icon: 'more-horizontal', color: '#9E9E9E', bgColor: '#F5F5F5' };
}

// ─── Account/Payment Display ──────────────────────────────────────────────────

export function getAccountDisplay(accountId: string | undefined | null, data: FinanceData | null): DisplayInfo {
  if (!accountId || !data) return { label: 'Chưa chọn', icon: 'wallet', color: '#2196F3', bgColor: '#E3F2FD' };
  // Credit-card payment values (credit_card_<id> / acc_cc_<id>) → resolve to the card.
  const ccId = resolveCreditCardIdFromAccount(accountId);
  if (ccId) {
    const card = getCreditCards(data).find(c => c.id === ccId);
    const label = card ? (card.last4 ? `${card.name} (*${card.last4})` : card.name) : 'Thẻ tín dụng';
    return { label, icon: 'credit-card', color: '#1A237E', bgColor: '#E8EAF6' };
  }
  // Try find by id first, then by icon/name for backward compat
  let account = data.accounts?.find(a => a.id === accountId);
  if (!account) account = data.accounts?.find(a => a.icon === accountId || a.name === accountId);
  if (account) {
    const iconInfo = getAccountIconInfo(account.icon);
    return { label: account.name, icon: iconInfo.icon, color: account.color || iconInfo.color, bgColor: iconInfo.bgColor };
  }
  // Fallback: try to resolve icon from the accountId string itself (e.g., "cash", "card")
  const iconInfo = getAccountIconInfo(accountId);
  return { label: accountId, icon: iconInfo.icon, color: iconInfo.color, bgColor: iconInfo.bgColor };
}

// ─── Module Display ───────────────────────────────────────────────────────────

export function getModuleDisplay(moduleId: string | undefined | null, data: FinanceData | null): DisplayInfo {
  if (!moduleId || !data) return { label: 'Chi tiêu', icon: 'receipt', color: '#1264F5', bgColor: '#E3F2FD' };
  const mod = data.modules.find(m => m.id === moduleId);
  if (mod) {
    const iconInfo = getModuleIconInfo(mod.icon);
    const color = getModuleColor(mod.id);
    return { label: mod.name, icon: iconInfo.icon, color, bgColor: iconInfo.bgColor };
  }
  return { label: moduleId, icon: 'receipt', color: '#1264F5', bgColor: '#E3F2FD' };
}

// ─── Record Field Extractor ───────────────────────────────────────────────────

export function getRecordField(record: DataRecord, suffix: string): string {
  const key = Object.keys(record.values).find(k => k.endsWith(`_${suffix}`));
  return key ? String(record.values[key] ?? '') : '';
}

// ─── Warranty Display ─────────────────────────────────────────────────────────

export function getWarrantyDisplay(record: DataRecord): { months: string; endDate: string } | null {
  const months = getRecordField(record, 'warranty_months');
  const endDate = getRecordField(record, 'warranty_end_date');
  if (!months && !endDate) return null;
  return { months: months || '', endDate: endDate || '' };
}

// ─── Beneficiary Options ──────────────────────────────────────────────────────

export function getBeneficiaryOptions(data: FinanceData | null): string[] {
  // Android hardcodes: ['Ba', 'Mẹ', 'Vợ', 'Con', 'Anh', 'Chị', 'Chồng', 'Mình']
  // Also check data for custom options
  const mod = data?.modules.find(m => m.id === 'mod_chitieu');
  const field = mod?.fields.find(f => f.fieldName === 'beneficiary');
  if (field?.options && field.options.length > 0) {
    return field.options.map(o => o.label || o.value);
  }
  return BENEFICIARY_OPTIONS;
}

// ─── Active Modules ───────────────────────────────────────────────────────────

export function getActiveModules(data: FinanceData | null): ModuleDefinition[] {
  if (!data) return [];
  return data.modules.filter(m => m.isActive && m.isVisible !== false);
}

// ─── Active Categories for expense/income ─────────────────────────────────────

export function getCategories(data: FinanceData | null, type: 0 | 1 = 0): CategoryDefinition[] {
  if (!data) return [];
  const mod = data.modules.find(m => m.id === 'mod_chitieu');
  if (!mod?.categories) return [];
  // Type 0 = expense, Type 1 = income
  // Android filters by matching category type if available
  return mod.categories.filter(c => c.isActive);
}

// ─── Active Accounts ──────────────────────────────────────────────────────────

export function getActiveAccounts(data: FinanceData | null): Account[] {
  if (!data) return [];
  return data.accounts?.filter(a => a.isActive) || [];
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

export function formatMoney(amount: number): string {
  return amount.toLocaleString('vi-VN') + '₫';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[d.getDay()]}, ${formatDate(dateStr)}`;
}
