/**
 * =============================================================================
 * METADATA-DRIVEN DATA SCHEMA
 * =============================================================================
 * 
 * This is the core schema definition for the entire platform.
 * Everything is defined by metadata - no hardcoded modules, forms, or tables.
 * 
 * The finance.json file on Google Drive follows this exact structure.
 * Both Android App and Chrome Extension read/write the same format.
 * 
 * Design principles:
 * - Everything can be added, modified, removed, reordered without code changes
 * - Modules are defined by configuration, not by programming
 * - Fields are dynamic and support 18+ data types
 * - Categories, dropdowns, menus are all user-configurable
 * =============================================================================
 */

// ─── Field Types ────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'dropdown'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'image'
  | 'file'
  | 'link'
  | 'phone'
  | 'email'
  | 'money'
  | 'color'
  | 'rating'
  | 'tag'
  | 'textarea'
  | 'reference'; // Reference to another module's records

// ─── Core Metadata Types ────────────────────────────────────────────────────

export interface FieldOption {
  id: string;
  label: string;
  value: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FieldDefinition {
  id: string;
  moduleId: string;
  fieldName: string;        // internal key (snake_case)
  fieldLabel: string;       // display label
  fieldType: FieldType;
  sortOrder: number;
  isRequired: boolean;
  isVisible: boolean;       // shown in form
  isTableVisible: boolean;  // shown in table
  placeholder?: string;
  defaultValue?: string;
  description?: string;
  options?: FieldOption[];  // for dropdown, multiselect, radio
  validation?: FieldValidation;
  referenceModuleId?: string; // for 'reference' type
  config?: { [key: string]: unknown }; // extra field-type-specific config
  createdAt: string;
  updatedAt: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customMessage?: string;
}

// ─── Module Definition ──────────────────────────────────────────────────────

export interface ModuleDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  isVisible: boolean;
  fields: FieldDefinition[];
  categories?: CategoryDefinition[];
  tableConfig?: TableConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDefinition {
  id: string;
  moduleId: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: CategoryDefinition[];
  createdAt: string;
  updatedAt: string;
}

// ─── Table Configuration ────────────────────────────────────────────────────

export interface TableColumnConfig {
  fieldId: string;
  width?: number;
  isVisible: boolean;
  isCompactVisible?: boolean;
  sortOrder: number;
}

export interface TableConfig {
  columns: TableColumnConfig[];
  defaultSort?: { fieldId: string; direction: 'asc' | 'desc' };
  pageSize: number;
}

// ─── Records (Actual Data) ──────────────────────────────────────────────────

export interface DataRecord {
  id: string;
  moduleId: string;
  linkedModuleId?: string;   // If set, record also appears in this module's view
  categoryId?: string;
  values: RecordValues;      // fieldId -> value
  tags?: string[];
  images?: string[];         // Google Drive file IDs
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecordValues = { [fieldId: string]: RecordValue };
export type RecordValue = string | number | boolean | string[] | null;

// ─── Account (Financial) ────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  icon: string;
  color: string;
  initialBalance: number;
  currentBalance: number;
  includeInTotal: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard Configuration ────────────────────────────────────────────────

export interface DashboardCard {
  id: string;
  title: string;
  type: 'summary' | 'chart' | 'list' | 'custom';
  moduleId?: string;
  config: DashboardCardConfig;
  position: { x: number; y: number; w: number; h: number };
  isVisible: boolean;
  createdAt: string;
}

export interface DashboardCardConfig {
  chartType?: 'bar' | 'line' | 'pie' | 'area' | 'donut';
  dataSource?: string;       // moduleId
  groupByField?: string;     // fieldId to group
  valueField?: string;       // fieldId for values
  aggregation?: 'sum' | 'count' | 'average' | 'min' | 'max';
  filters?: FilterCondition[];
  dateRange?: 'today' | 'week' | 'month' | 'year' | 'custom';
  limit?: number;
}

export interface FilterCondition {
  fieldId: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'between';
  value: RecordValue;
  value2?: RecordValue; // for 'between'
}

// ─── Report Configuration ───────────────────────────────────────────────────

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  moduleId: string;
  columns: string[];          // fieldIds to include
  filters: FilterCondition[];
  sortBy?: { fieldId: string; direction: 'asc' | 'desc' };
  groupBy?: string;           // fieldId
  createdAt: string;
  updatedAt: string;
}

// ─── Menu Configuration ─────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  type: 'module' | 'dashboard' | 'report' | 'settings' | 'divider';
  targetId?: string;          // moduleId or reportId
  sortOrder: number;
  isVisible: boolean;
  children?: MenuItem[];
}

// ─── Wine Module Settings ────────────────────────────────────────────────────

export interface WineSettings {
  lowStockThreshold: number; // default 4
}

// ─── Gold Module Settings ────────────────────────────────────────────────────

export interface GoldSettings {
  /** How to get gold price: manual | url | auto */
  priceSource: 'manual' | 'url' | 'auto';
  /** Manual gold price (per chỉ, in VND) */
  manualPrice?: number;
  /** URL to scrape gold price from */
  priceUrl?: string;
  /** Last fetched/updated gold price */
  currentPrice?: number;
  /** ISO timestamp of last price update */
  lastPriceUpdate?: string;
}

// ─── App Settings ───────────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'vi' | 'en';
  currency: string;
  currencyLocale: string;
  dateFormat: string;
  firstDayOfWeek: 0 | 1;     // 0=Sunday, 1=Monday
  defaultModuleId?: string;
  warrantyAlertDays?: number; // Days before warranty expiry to show warning (default: 10)
  wineSettings?: WineSettings;
  goldSettings?: GoldSettings;
  rentalSettings?: { rentDueDate?: string; rentAlertDays?: number };
}

// ─── Recurring Transactions ─────────────────────────────────────────────────

export interface RecurringTransaction {
  id: string;
  moduleId: string;
  values: RecordValues;
  categoryId?: string;
  linkedModuleId?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextRunDate: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Budget ─────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  isActive: boolean;
}

// ─── Activity Log ───────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'sync';
  moduleId?: string;
  recordId?: string;
  description: string;
  timestamp: string;
}

// ─── Complete Data File (finance.json) ──────────────────────────────────────

export interface FinanceData {
  version: string;            // schema version for migrations
  lastModified: string;       // ISO timestamp
  deviceId: string;           // device that last modified
  settings: AppSettings;
  modules: ModuleDefinition[];
  accounts: Account[];
  records: DataRecord[];
  dashboard: DashboardCard[];
  reports: ReportDefinition[];
  menu: MenuItem[];
  metadata: AppMetadata;
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  activityLog: ActivityLog[];
  wineColorPalette?: WineColorOption[];  // synced wine color palette (source of truth)
}

export interface WineColorOption {
  code: string;
  label: string;
}

export interface AppMetadata {
  totalRecords: number;
  lastSyncAt?: string;
  createdAt: string;
}
