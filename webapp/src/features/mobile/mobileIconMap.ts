/**
 * Mobile Icon System — Maps Android Flutter Material Icons to Lucide React equivalents.
 * Source of truth: lib/utils/icon_helper.dart, lib/utils/transaction_styles.dart,
 * lib/screens/transactions/add_transaction_screen.dart (_getCatIcon, _getAccountIcon, _getModuleIcon)
 *
 * Android Material Icon → Lucide equivalent
 */

// ─── Category Icons (from _getCatIcon in add_transaction_screen.dart) ─────────
// Android: Icons.restaurant, Icons.directions_car, Icons.shopping_bag, Icons.favorite,
//          Icons.movie, Icons.receipt, Icons.school, Icons.home, Icons.card_giftcard,
//          Icons.account_balance_wallet, Icons.trending_up, Icons.coffee, Icons.more_horiz
export const CATEGORY_ICONS: Record<string, { icon: string; color: string; bgColor: string }> = {
  food:          { icon: 'utensils',       color: '#FF9800', bgColor: '#FFF3E0' },
  coffee:        { icon: 'coffee',         color: '#795548', bgColor: '#EFEBE9' },
  transport:     { icon: 'car',            color: '#2196F3', bgColor: '#E3F2FD' },
  shopping:      { icon: 'shopping-bag',   color: '#E91E63', bgColor: '#FCE4EC' },
  health:        { icon: 'heart',          color: '#F44336', bgColor: '#FFEBEE' },
  entertainment: { icon: 'film',           color: '#9C27B0', bgColor: '#F3E5F5' },
  bill:          { icon: 'receipt',        color: '#607D8B', bgColor: '#ECEFF1' },
  education:     { icon: 'graduation-cap', color: '#3F51B5', bgColor: '#E8EAF6' },
  rent:          { icon: 'home',           color: '#009688', bgColor: '#E0F2F1' },
  home:          { icon: 'home',           color: '#009688', bgColor: '#E0F2F1' },
  gift:          { icon: 'gift',           color: '#FF9800', bgColor: '#FFF3E0' },
  salary:        { icon: 'wallet',         color: '#4CAF50', bgColor: '#E8F5E9' },
  income:        { icon: 'trending-up',    color: '#00BCD4', bgColor: '#E0F7FA' },
  investment:    { icon: 'trending-up',    color: '#00BCD4', bgColor: '#E0F7FA' },
  phone:         { icon: 'smartphone',     color: '#673AB7', bgColor: '#EDE7F6' },
  internet:      { icon: 'wifi',           color: '#03A9F4', bgColor: '#E1F5FE' },
  electric:      { icon: 'zap',            color: '#FFC107', bgColor: '#FFF8E1' },
  water:         { icon: 'droplet',        color: '#03A9F4', bgColor: '#E1F5FE' },
  clothing:      { icon: 'shirt',          color: '#795548', bgColor: '#EFEBE9' },
  beauty:        { icon: 'sparkles',       color: '#E91E63', bgColor: '#FCE4EC' },
  pet:           { icon: 'paw-print',      color: '#8D6E63', bgColor: '#EFEBE9' },
  travel:        { icon: 'plane',          color: '#00BCD4', bgColor: '#E0F7FA' },
  sport:         { icon: 'dumbbell',       color: '#4CAF50', bgColor: '#E8F5E9' },
  other:         { icon: 'more-horizontal',color: '#9E9E9E', bgColor: '#F5F5F5' },
};

// ─── Account/Payment Method Icons (from _getAccountIcon) ──────────────────────
// Android: Icons.payments, Icons.credit_card, Icons.account_balance, Icons.phone_android, Icons.account_balance_wallet
export const ACCOUNT_ICONS: Record<string, { icon: string; color: string; bgColor: string }> = {
  cash:          { icon: 'banknote',    color: '#4CAF50', bgColor: '#E8F5E9' },
  card:          { icon: 'credit-card', color: '#1A237E', bgColor: '#E8EAF6' },
  credit_card:   { icon: 'credit-card', color: '#1A237E', bgColor: '#E8EAF6' },
  'credit-card': { icon: 'credit-card', color: '#1A237E', bgColor: '#E8EAF6' },
  bank:          { icon: 'landmark',    color: '#1B5E20', bgColor: '#E8F5E9' },
  momo:          { icon: 'smartphone',  color: '#D81B60', bgColor: '#FCE4EC' },
  wallet:        { icon: 'wallet',      color: '#2196F3', bgColor: '#E3F2FD' },
};

// ─── Module Icons (from TransactionStyles.moduleIcon + moduleColor) ───────────
// Android: Icons.receipt_long, Icons.shopping_cart, Icons.diamond, Icons.home, Icons.credit_card, Icons.liquor
export const MODULE_ICONS: Record<string, { icon: string; color: string; bgColor: string }> = {
  expense:  { icon: 'receipt',        color: '#1264F5', bgColor: '#E3F2FD' },
  shopee:   { icon: 'shopping-cart',  color: '#FF5722', bgColor: '#FBE9E7' },
  gold:     { icon: 'gem',            color: '#FFC107', bgColor: '#FFF8E1' },
  rent:     { icon: 'home',           color: '#4CAF50', bgColor: '#E8F5E9' },
  card:     { icon: 'credit-card',    color: '#1A237E', bgColor: '#E8EAF6' },
  other:    { icon: 'grape',          color: '#9C27B0', bgColor: '#F3E5F5' },  // Rượu uses 'other' icon key but is purple
};

// Module colors by ID (from TransactionStyles.moduleColor)
export const MODULE_COLORS: Record<string, string> = {
  mod_chitieu:    '#1264F5',
  mod_shopee:     '#FF5722',
  mod_vang:       '#FFC107',
  mod_nhatro:     '#4CAF50',
  mod_ruou:       '#9C27B0',
  mod_creditcard: '#1A237E',
};

// ─── Navigation Icons (from home_screen.dart _buildBottomNavBar) ──────────────
// Android: bar_chart, receipt_long, add, category, settings
export const NAV_ICONS = {
  dashboard:  { icon: 'bar-chart-3',   activeIcon: 'bar-chart-3' },
  expense:    { icon: 'receipt',        activeIcon: 'receipt' },
  add:        { icon: 'plus',           activeIcon: 'plus' },
  modules:    { icon: 'layout-grid',    activeIcon: 'layout-grid' },
  settings:   { icon: 'settings',       activeIcon: 'settings' },
} as const;

// Navigation colors
export const NAV_COLORS = {
  active: '#1264F5',     // navyBlue from Android
  inactive: '#9E9E9E',  // grey
  fab: '#1264F5',        // navyBlue
} as const;

// ─── Beneficiary Options (hardcoded in Android add_transaction_screen.dart line 1149) ──
export const BENEFICIARY_OPTIONS = ['Ba', 'Mẹ', 'Vợ', 'Con', 'Anh', 'Chị', 'Chồng', 'Mình'];

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getCategoryIconInfo(iconName?: string | null) {
  if (!iconName) return CATEGORY_ICONS.other;
  return CATEGORY_ICONS[iconName] || CATEGORY_ICONS.other;
}

export function getAccountIconInfo(iconName?: string | null) {
  if (!iconName) return ACCOUNT_ICONS.wallet;
  return ACCOUNT_ICONS[iconName] || ACCOUNT_ICONS.wallet;
}

export function getModuleIconInfo(iconName?: string | null) {
  if (!iconName) return MODULE_ICONS.expense;
  return MODULE_ICONS[iconName] || MODULE_ICONS.expense;
}

export function getModuleColor(moduleId?: string | null): string {
  if (!moduleId) return '#9E9E9E';
  return MODULE_COLORS[moduleId] || '#9E9E9E';
}
