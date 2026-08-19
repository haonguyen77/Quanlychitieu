/**
 * Mobile Data Mapper — Shared utility for resolving display info from data.
 * All Mobile screens MUST use this mapper instead of inline logic.
 * Source of truth: Android models + finance.json structure.
 */

import type { FinanceData, DataRecord, ModuleDefinition, CategoryDefinition, Account } from '@/types';
import { getCategoryIconInfo, getAccountIconInfo, getModuleIconInfo, getModuleColor, BENEFICIARY_OPTIONS } from './mobileIconMap';

export interface DisplayInfo {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// ─── Category Display ─────────────────────────────────────────────────────────

export function getCategoryDisplay(categoryId: string | undefined | null, data: FinanceData | null): DisplayInfo {
  if (!categoryId || !data) return { label: 'Không phân loại', icon: 'more-horizontal', color: '#9E9E9E', bgColor: '#F5F5F5' };
  for (const mod of data.modules) {
    const cat = mod.categories?.find(c => c.id === categoryId);
    if (cat) {
      const iconInfo = getCategoryIconInfo(cat.icon);
      return { label: cat.name, icon: iconInfo.icon, color: cat.color || iconInfo.color, bgColor: iconInfo.bgColor };
    }
  }
  return { label: 'Không phân loại', icon: 'more-horizontal', color: '#9E9E9E', bgColor: '#F5F5F5' };
}

// ─── Account/Payment Display ──────────────────────────────────────────────────

export function getAccountDisplay(accountId: string | undefined | null, data: FinanceData | null): DisplayInfo {
  if (!accountId || !data) return { label: 'Chưa chọn', icon: 'wallet', color: '#2196F3', bgColor: '#E3F2FD' };
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
