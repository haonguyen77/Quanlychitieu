import { create } from 'zustand';
import type { FinanceData, ModuleDefinition, MenuItem, AppSettings, FieldDefinition } from '@/types';
import { createDefaultFinanceData } from '@/core/defaults/defaultData';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { cryptoService } from '@/services/crypto/cryptoService';
import { syncService } from '@/services/sync/syncService';
import { driveService } from '@/services/drive/driveService';

interface AppState {
  // Data
  data: FinanceData | null;
  isLoading: boolean;
  error: string | null;

  // UI State
  theme: 'light' | 'dark';
  activeModuleId: string | null;
  activeView: 'module' | 'dashboard' | 'settings' | 'report' | 'trash';
  sidebarCollapsed: boolean;
  activeWorkspace: 'chitieu' | 'ruou';
  activeWineView: 'dashboard' | 'orders' | 'customers' | 'products' | 'inventory' | 'settings' | 'trash';

  // Auth
  isAuthenticated: boolean;
  userEmail: string | null;
  userAvatar: string | null;

  // Sync
  isSyncing: boolean;
  lastSyncAt: string | null;

  // Actions
  initializeApp: () => Promise<void>;
  setData: (data: FinanceData) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveModule: (moduleId: string) => void;
  setActiveView: (view: AppState['activeView']) => void;
  toggleSidebar: () => void;
  setActiveWorkspace: (ws: AppState['activeWorkspace']) => void;
  setActiveWineView: (view: AppState['activeWineView']) => void;
  setAuth: (email: string, avatar?: string) => void;
  clearAuth: () => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;

  // Data mutations
  updateModule: (module: ModuleDefinition) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateMenu: (menu: MenuItem[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  data: null,
  isLoading: true,
  error: null,
  theme: 'light',
  activeModuleId: null,
  activeView: 'dashboard',
  sidebarCollapsed: false,
  activeWorkspace: (localStorage.getItem('pdp_activeWorkspace') as 'chitieu' | 'ruou') || 'chitieu',
  activeWineView: (localStorage.getItem('pdp_activeWineView') as AppState['activeWineView']) || 'dashboard',
  isAuthenticated: false,
  userEmail: null,
  userAvatar: null,
  isSyncing: false,
  lastSyncAt: null,

  // Actions
  initializeApp: async () => {
    try {
      set({ isLoading: true, error: null });

      // Try to load from IndexedDB (offline-first). Key should already be loaded.
      let data: FinanceData | null;
      try {
        data = await indexedDBService.loadData();
      } catch (e) {
        if ((e as Error)?.message === 'DATA_LOCKED' || (e as Error)?.name === 'LockedError') {
          data = null;
        } else { throw e; }
      }

      if (!data) {
        // First time - create default data
        data = createDefaultFinanceData();
        await indexedDBService.saveData(data);
      }

      // Data migration: ensure Chi tiêu has new fields (for existing users)
      const chiTieu = data.modules.find((m) => m.id === 'mod_chitieu');
      if (chiTieu) {
        let migrated = false;
        const now = new Date().toISOString();
        const ensureField = (name: string, label: string, type: string, sortOrder: number, opts?: unknown[]) => {
          if (!chiTieu.fields.find((f) => f.fieldName === name)) {
            chiTieu.fields.push({
              id: `mod_chitieu_${name}`, moduleId: 'mod_chitieu', fieldName: name, fieldLabel: label,
              fieldType: type as FieldDefinition['fieldType'], sortOrder, isRequired: false, isVisible: true, isTableVisible: true,
              options: opts as FieldDefinition['options'], createdAt: now, updatedAt: now,
            });
            migrated = true;
          }
        };
        ensureField('beneficiary', 'Người nhận', 'dropdown', 5, [
          { id: 'ben_ba', label: 'Ba', value: 'ba', color: '#3F51B5', sortOrder: 0, isActive: true },
          { id: 'ben_me', label: 'Mẹ', value: 'me', color: '#E91E63', sortOrder: 1, isActive: true },
          { id: 'ben_vo', label: 'Vợ', value: 'vo', color: '#FF5722', sortOrder: 2, isActive: true },
          { id: 'ben_con', label: 'Con', value: 'con', color: '#FF9800', sortOrder: 3, isActive: true },
          { id: 'ben_anh', label: 'Anh', value: 'anh', color: '#009688', sortOrder: 4, isActive: true },
          { id: 'ben_chi', label: 'Chị', value: 'chi', color: '#673AB7', sortOrder: 5, isActive: true },
          { id: 'ben_chong', label: 'Chồng', value: 'chong', color: '#795548', sortOrder: 6, isActive: true },
          { id: 'ben_banthan', label: 'Mình', value: 'banthan', color: '#607D8B', sortOrder: 7, isActive: true },
        ]);
        // Force update beneficiary labels (fix "Của ba" → "Ba")
        const benField = chiTieu.fields.find((f) => f.fieldName === 'beneficiary');
        if (benField?.options) {
          const correctLabels: Record<string, string> = { ba: 'Ba', me: 'Mẹ', vo: 'Vợ', con: 'Con', anh: 'Anh', chi: 'Chị', chong: 'Chồng', banthan: 'Mình' };
          for (const opt of benField.options) {
            if (correctLabels[opt.value] && opt.label !== correctLabels[opt.value]) {
              opt.label = correctLabels[opt.value];
              migrated = true;
            }
          }
          // Add 'chong' option if missing
          if (!benField.options.find((o) => o.value === 'chong')) {
            benField.options.push({ id: 'ben_chong', label: 'Chồng', value: 'chong', color: '#795548', sortOrder: 6, isActive: true });
            migrated = true;
          }
          benField.fieldLabel = 'Người nhận';
        }
        ensureField('quantity', 'Số lượng', 'number', 6);
        ensureField('warranty_months', 'Tháng BH', 'number', 7);
        ensureField('warranty_date', 'Ngày hết hạn BH', 'date', 8);
        // Rename tags to Sự kiện and make it visible in table
        const tagsF = chiTieu.fields.find((f) => f.fieldName === 'tags');
        if (tagsF) {
          if (tagsF.fieldLabel !== 'Sự kiện') { tagsF.fieldLabel = 'Sự kiện'; tagsF.fieldType = 'text'; tagsF.isTableVisible = true; migrated = true; }
        }
        // Add tags to tableConfig if not present
        if (chiTieu.tableConfig?.columns && !chiTieu.tableConfig.columns.find((c) => c.fieldId === 'mod_chitieu_tags')) {
          chiTieu.tableConfig.columns.push({ fieldId: 'mod_chitieu_tags', isVisible: true, sortOrder: 9, width: 100 });
          migrated = true;
        }
        // Ensure account has new options
        const accField = chiTieu.fields.find((f) => f.fieldName === 'account');
        if (accField?.options) {
          const existingValues = accField.options.map((o) => o.value);
          if (!existingValues.includes('tpbank')) { accField.options.push({ id: 'acc_tpbank', label: 'TP Bank', value: 'tpbank', color: '#7B1FA2', sortOrder: 10, isActive: true }); migrated = true; }
          if (!existingValues.includes('vpbank')) { accField.options.push({ id: 'acc_vpbank', label: 'VP Bank', value: 'vpbank', color: '#00695C', sortOrder: 11, isActive: true }); migrated = true; }
          if (!existingValues.includes('zalopay')) { accField.options.push({ id: 'acc_zalopay', label: 'ZaloPay', value: 'zalopay', color: '#0288D1', sortOrder: 12, isActive: true }); migrated = true; }
        }
        // Ensure tableConfig has new columns
        if (chiTieu.tableConfig?.columns) {
          const existingColIds = chiTieu.tableConfig.columns.map((c) => c.fieldId);
          const newCols = [
            { fieldId: 'mod_chitieu_beneficiary', isVisible: true, sortOrder: 5, width: 90 },
            { fieldId: 'mod_chitieu_quantity', isVisible: true, sortOrder: 6, width: 60 },
            { fieldId: 'mod_chitieu_warranty_months', isVisible: true, sortOrder: 7, width: 60 },
            { fieldId: 'mod_chitieu_warranty_date', isVisible: true, sortOrder: 8, width: 100 },
          ];
          for (const col of newCols) {
            if (!existingColIds.includes(col.fieldId)) {
              chiTieu.tableConfig.columns.push(col);
              migrated = true;
            }
          }
        }
        if (migrated) {
          data = { ...data, modules: data.modules.map((m) => m.id === 'mod_chitieu' ? chiTieu : m), lastModified: now };
          await indexedDBService.saveData(data);
        }
      }

      // ─── Shopee & Credit Card: ensure same 12 fields as Chi tiêu ──────────
      {
        let sharedMigrated = false;
        const now = new Date().toISOString();
        const sharedFieldDefs: Array<{ name: string; label: string; type: string; sortOrder: number; isTableVisible: boolean; options?: unknown[] }> = [
          { name: 'date', label: 'Ngày', type: 'date', sortOrder: 0, isTableVisible: true },
          { name: 'title', label: 'Tên giao dịch', type: 'text', sortOrder: 1, isTableVisible: true },
          { name: 'amount', label: 'Số tiền', type: 'money', sortOrder: 2, isTableVisible: true },
          { name: 'type', label: 'Loại', type: 'dropdown', sortOrder: 3, isTableVisible: true, options: [
            { id: 'type_chi', label: 'Chi', value: '0', color: '#F44336', sortOrder: 0, isActive: true },
            { id: 'type_thu', label: 'Thu', value: '1', color: '#4CAF50', sortOrder: 1, isActive: true },
          ]},
          { name: 'account', label: 'Tài khoản', type: 'dropdown', sortOrder: 4, isTableVisible: true, options: [
            { id: 'acc_cash', label: 'Tiền mặt', value: 'cash', color: '#4CAF50', sortOrder: 0, isActive: true },
            { id: 'acc_bank', label: 'Ngân hàng', value: 'bank', color: '#1976D2', sortOrder: 1, isActive: true },
          ]},
          { name: 'beneficiary', label: 'Người nhận', type: 'dropdown', sortOrder: 5, isTableVisible: false, options: [
            { id: 'ben_ba', label: 'Ba', value: 'ba', sortOrder: 0, isActive: true },
            { id: 'ben_me', label: 'Mẹ', value: 'me', sortOrder: 1, isActive: true },
            { id: 'ben_vo', label: 'Vợ', value: 'vo', sortOrder: 2, isActive: true },
            { id: 'ben_con', label: 'Con', value: 'con', sortOrder: 3, isActive: true },
            { id: 'ben_banthan', label: 'Mình', value: 'banthan', sortOrder: 4, isActive: true },
          ]},
          { name: 'quantity', label: 'Số lượng', type: 'number', sortOrder: 6, isTableVisible: false },
          { name: 'warranty_months', label: 'Tháng BH', type: 'number', sortOrder: 7, isTableVisible: false },
          { name: 'warranty_date', label: 'Ngày hết hạn BH', type: 'date', sortOrder: 8, isTableVisible: false },
          { name: 'note', label: 'Ghi chú', type: 'textarea', sortOrder: 9, isTableVisible: true },
          { name: 'tags', label: 'Sự kiện', type: 'text', sortOrder: 10, isTableVisible: false },
          { name: 'images', label: 'Hình ảnh', type: 'image', sortOrder: 11, isTableVisible: false },
        ];

        for (const modId of ['mod_shopee', 'mod_creditcard']) {
          const mod = data.modules.find((m) => m.id === modId);
          if (!mod) continue;

          for (const def of sharedFieldDefs) {
            const exists = mod.fields.find((f) => f.fieldName === def.name);
            // Skip 'title' for Shopee if it already has 'order_name' (same purpose)
            if (def.name === 'title' && modId === 'mod_shopee' && mod.fields.find((f) => f.fieldName === 'order_name')) continue;
            // Skip fields that don't apply to Shopee
            if (modId === 'mod_shopee' && ['warranty_months', 'warranty_date', 'quantity'].includes(def.name)) continue;
            if (!exists) {
              // Add missing field with isTableVisible = false for extra fields
              mod.fields.push({
                id: `${modId}_${def.name}`,
                moduleId: modId,
                fieldName: def.name,
                fieldLabel: def.label,
                fieldType: def.type as FieldDefinition['fieldType'],
                sortOrder: mod.fields.length + def.sortOrder,
                isRequired: false,
                isVisible: true,
                isTableVisible: def.isTableVisible,
                options: def.options as FieldDefinition['options'],
                createdAt: now,
                updatedAt: now,
              });
              sharedMigrated = true;
            }
          }
        }

        if (sharedMigrated) {
          data = { ...data, lastModified: now };
          await indexedDBService.saveData(data);
        }

        // Cleanup: remove unwanted fields from Shopee that were added by old migration
        const shopee = data.modules.find((m) => m.id === 'mod_shopee');
        if (shopee) {
          const unwanted = ['warranty_months', 'warranty_date', 'quantity', 'title'];
          const before = shopee.fields.length;
          shopee.fields = shopee.fields.filter((f) => {
            if (unwanted.includes(f.fieldName) && f.fieldName !== 'order_name') return false;
            return true;
          });
          if (shopee.fields.length < before) {
            data = { ...data, modules: data.modules.map((m) => m.id === 'mod_shopee' ? shopee : m), lastModified: now };
            await indexedDBService.saveData(data);
          }
        }
      }

      // ─── Nhà trọ: add rent_due_day and rent_alert_days fields ─────────────
      {
        const nhaTro = data.modules.find((m) => m.id === 'mod_nhatro');
        if (nhaTro) {
          let migrated = false;
          const now = new Date().toISOString();
          const hasRentDueDay = nhaTro.fields.some((f) => f.fieldName === 'rent_due_day' || f.id === 'mod_nhatro_rent_due_day');
          const hasRentAlertDays = nhaTro.fields.some((f) => f.fieldName === 'rent_alert_days' || f.id === 'mod_nhatro_rent_alert_days');
          if (!hasRentDueDay) {
            nhaTro.fields.push({ id: 'mod_nhatro_rent_due_day', moduleId: 'mod_nhatro', fieldName: 'rent_due_day', fieldLabel: 'Ngày đóng tiền', fieldType: 'number', sortOrder: 10, isRequired: false, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now } as FieldDefinition);
            migrated = true;
          }
          if (!hasRentAlertDays) {
            nhaTro.fields.push({ id: 'mod_nhatro_rent_alert_days', moduleId: 'mod_nhatro', fieldName: 'rent_alert_days', fieldLabel: 'Cảnh báo trước (ngày)', fieldType: 'number', sortOrder: 11, isRequired: false, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now } as FieldDefinition);
            migrated = true;
          }
          if (migrated) {
            const updatedModules = data.modules.map((m) => m.id === 'mod_nhatro' ? { ...nhaTro } : m);
            data = { ...data, modules: updatedModules, lastModified: now };
            await indexedDBService.saveData(data);
          }
        }
      }

      // ─── Wine Module Migration ────────────────────────────────────────────
      {
        let wineMigrated = false;
        const now = new Date().toISOString();

        // 1. Update wine_type options in mod_ruou_products
        const wineProducts = data.modules.find((m) => m.id === 'mod_ruou_products');
        if (wineProducts) {
          const wineTypeField = wineProducts.fields.find((f) => f.fieldName === 'wine_type');
          if (wineTypeField) {
            const correctOptions = [
              { id: 'wpt_gao', label: 'Gạo', value: 'gao', color: '#FF9800', sortOrder: 0, isActive: true },
              { id: 'wpt_nep', label: 'Nếp', value: 'nep', color: '#8BC34A', sortOrder: 1, isActive: true },
              { id: 'wpt_dauxanh', label: 'Đậu xanh', value: 'dauxanh', color: '#4CAF50', sortOrder: 2, isActive: true },
              { id: 'wpt_vangnep', label: 'Vang nếp', value: 'vangnep', color: '#9C27B0', sortOrder: 3, isActive: true },
              { id: 'wpt_dtht', label: 'ĐTHT', value: 'dtht', color: '#F44336', sortOrder: 4, isActive: true },
            ];
            // Always force correct options
            const currentValues = (wineTypeField.options || []).map((o: { value: string }) => o.value).sort().join(',');
            const correctValues = correctOptions.map((o) => o.value).sort().join(',');
            if (currentValues !== correctValues) {
              wineTypeField.options = correctOptions as FieldDefinition['options'];
              wineTypeField.fieldLabel = 'Loại rượu';
              wineMigrated = true;
            }
          }
          // Remove stock and price fields if they exist
          const stockIdx = wineProducts.fields.findIndex((f) => f.fieldName === 'stock');
          if (stockIdx >= 0) { wineProducts.fields.splice(stockIdx, 1); wineMigrated = true; }
          const priceIdx = wineProducts.fields.findIndex((f) => f.fieldName === 'price');
          if (priceIdx >= 0) { wineProducts.fields.splice(priceIdx, 1); wineMigrated = true; }
          // Remove from tableConfig
          if (wineProducts.tableConfig?.columns) {
            const before = wineProducts.tableConfig.columns.length;
            wineProducts.tableConfig.columns = wineProducts.tableConfig.columns.filter(
              (c) => c.fieldId !== 'mod_ruou_products_stock' && c.fieldId !== 'mod_ruou_products_price'
            );
            if (wineProducts.tableConfig.columns.length !== before) wineMigrated = true;
          }
        }

        // 2. Add mod_ruou_inventory module if missing
        if (!data.modules.find((m) => m.id === 'mod_ruou_inventory')) {
          data.modules.push({
            id: 'mod_ruou_inventory',
            name: 'Kho Rượu',
            icon: 'building',
            color: '#6A1B9A',
            description: 'Quản lý tồn kho rượu',
            sortOrder: 8,
            isDefault: true,
            isActive: true,
            isVisible: false,
            fields: [
              { id: 'mod_ruou_inventory_sku', moduleId: 'mod_ruou_inventory', fieldName: 'sku', fieldLabel: 'SKU', fieldType: 'text', sortOrder: 0, isRequired: true, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
              { id: 'mod_ruou_inventory_product_name', moduleId: 'mod_ruou_inventory', fieldName: 'product_name', fieldLabel: 'Sản phẩm', fieldType: 'text', sortOrder: 1, isRequired: true, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
              { id: 'mod_ruou_inventory_color', moduleId: 'mod_ruou_inventory', fieldName: 'color', fieldLabel: 'Màu', fieldType: 'text', sortOrder: 2, isRequired: false, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
              { id: 'mod_ruou_inventory_wine_type', moduleId: 'mod_ruou_inventory', fieldName: 'wine_type', fieldLabel: 'Loại rượu', fieldType: 'text', sortOrder: 3, isRequired: false, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
              { id: 'mod_ruou_inventory_bottle_type', moduleId: 'mod_ruou_inventory', fieldName: 'bottle_type', fieldLabel: 'Loại chai', fieldType: 'text', sortOrder: 4, isRequired: false, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
              { id: 'mod_ruou_inventory_stock', moduleId: 'mod_ruou_inventory', fieldName: 'stock', fieldLabel: 'Tồn kho', fieldType: 'number', sortOrder: 5, isRequired: true, isVisible: true, isTableVisible: true, createdAt: now, updatedAt: now },
            ],
            tableConfig: {
              columns: [
                { fieldId: 'mod_ruou_inventory_sku', isVisible: true, sortOrder: 0, width: 90 },
                { fieldId: 'mod_ruou_inventory_product_name', isVisible: true, sortOrder: 1 },
                { fieldId: 'mod_ruou_inventory_color', isVisible: true, sortOrder: 2, width: 80 },
                { fieldId: 'mod_ruou_inventory_wine_type', isVisible: true, sortOrder: 3, width: 80 },
                { fieldId: 'mod_ruou_inventory_bottle_type', isVisible: true, sortOrder: 4, width: 80 },
                { fieldId: 'mod_ruou_inventory_stock', isVisible: true, sortOrder: 5, width: 70 },
              ],
              defaultSort: { fieldId: 'mod_ruou_inventory_product_name', direction: 'asc' },
              pageSize: 50,
            },
            createdAt: now,
            updatedAt: now,
          });
          wineMigrated = true;
        }

        // 3. Pre-populate 30 default products if not all present
        const existingProducts = data.records.filter((r) => r.moduleId === 'mod_ruou_products');
        const existingSkus = new Set(existingProducts.map((r) => String(r.values['mod_ruou_products_sku'] ?? '')));
        const defaultProducts = [
            { sku: 'G2-1L', name: 'Rượu bàu đá Gạo loại 2 - 1L', shortName: 'Gạo L2 1L', volume: 1000, wineType: 'gao loai 2', bottleType: 'pet' },
            { sku: 'G2-2L', name: 'Rượu bàu đá Gạo loại 2 - 2L', shortName: 'Gạo L2 2L', volume: 2000, wineType: 'gao loai 2', bottleType: 'pet' },
            { sku: 'G2-5L', name: 'Rượu bàu đá Gạo loại 2 - 5L', shortName: 'Gạo L2 5L', volume: 5000, wineType: 'gao loai 2', bottleType: 'pet' },
            { sku: 'G500', name: 'Rượu bàu đá Gạo 500ml', shortName: 'Gạo 500ml', volume: 500, wineType: 'gao', bottleType: 'pet' },
            { sku: 'G1L', name: 'Rượu bàu đá Gạo 1L', shortName: 'Gạo 1L', volume: 1000, wineType: 'gao', bottleType: 'pet' },
            { sku: 'G2L', name: 'Rượu bàu đá Gạo 2L', shortName: 'Gạo 2L', volume: 2000, wineType: 'gao', bottleType: 'pet' },
            { sku: 'G5L', name: 'Rượu bàu đá Gạo 5L', shortName: 'Gạo 5L', volume: 5000, wineType: 'gao', bottleType: 'pet' },
            { sku: 'N500', name: 'Rượu bàu đá Nếp 500ml', shortName: 'Nếp 500ml', volume: 500, wineType: 'nep', bottleType: 'pet' },
            { sku: 'N1L', name: 'Rượu bàu đá Nếp 1L', shortName: 'Nếp 1L', volume: 1000, wineType: 'nep', bottleType: 'pet' },
            { sku: 'N2L', name: 'Rượu bàu đá Nếp 2L', shortName: 'Nếp 2L', volume: 2000, wineType: 'nep', bottleType: 'pet' },
            { sku: 'N5L', name: 'Rượu bàu đá Nếp 5L', shortName: 'Nếp 5L', volume: 5000, wineType: 'nep', bottleType: 'pet' },
            { sku: 'DX500', name: 'Rượu bàu đá đậu xanh 500ml', shortName: 'Đậu xanh 500ml', volume: 500, wineType: 'dauxanh', bottleType: 'pet' },
            { sku: 'DX1L', name: 'Rượu bàu đá đậu xanh 1L', shortName: 'Đậu xanh 1L', volume: 1000, wineType: 'dauxanh', bottleType: 'pet' },
            { sku: 'DX2L', name: 'Rượu bàu đá đậu xanh 2L', shortName: 'Đậu xanh 2L', volume: 2000, wineType: 'dauxanh', bottleType: 'pet' },
            { sku: 'DX5L', name: 'Rượu bàu đá đậu xanh 5L', shortName: 'Đậu xanh 5L', volume: 5000, wineType: 'dauxanh', bottleType: 'pet' },
            { sku: 'HL350', name: 'Chai sứ Hồ Lô 350ml', shortName: 'Hồ Lô 350ml', volume: 350, wineType: 'gao', bottleType: 'su' },
            { sku: 'HL350-N', name: 'Chai sứ Hồ Lô 350ml - Nếp', shortName: 'Hồ Lô 350ml - N', volume: 350, wineType: 'nep', bottleType: 'su' },
            { sku: 'HL350-DX', name: 'Chai sứ Hồ Lô 350ml - Đậu xanh', shortName: 'Hồ Lô 350ml - DX', volume: 350, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'RN350', name: 'Chai sứ Rồng nhỏ 350ml', shortName: 'Rồng nhỏ 350ml', volume: 350, wineType: 'gao', bottleType: 'su' },
            { sku: 'RN350-N', name: 'Chai sứ Rồng nhỏ 350ml - Nếp', shortName: 'Rồng nhỏ 350ml - N', volume: 350, wineType: 'nep', bottleType: 'su' },
            { sku: 'RN350-DX', name: 'Chai sứ Rồng nhỏ 350ml - Đậu xanh', shortName: 'Rồng nhỏ 350ml - DX', volume: 350, wineType: 'dauxanh', bottleType: 'su' },
            { sku: '3B650', name: 'Chai sứ Ba Bầu 650ml', shortName: 'Ba Bầu 650ml', volume: 650, wineType: 'gao', bottleType: 'su' },
            { sku: '3B650-N', name: 'Chai sứ Ba Bầu 650ml - Nếp', shortName: 'Ba Bầu 650ml - N', volume: 650, wineType: 'nep', bottleType: 'su' },
            { sku: '3B650-DX', name: 'Chai sứ Ba Bầu 650ml - Đậu xanh', shortName: 'Ba Bầu 650ml - DX', volume: 650, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'LP650', name: 'Chai sứ Long Phụng 650ml', shortName: 'Long Phụng 650ml', volume: 650, wineType: 'gao', bottleType: 'su' },
            { sku: 'LP650-N', name: 'Chai sứ Long Phụng 650ml - Nếp', shortName: 'Long Phụng 650ml - N', volume: 650, wineType: 'nep', bottleType: 'su' },
            { sku: 'LP650-DX', name: 'Chai sứ Long Phụng 650ml - Đậu xanh', shortName: 'Long Phụng 650ml - DX', volume: 650, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'C650', name: 'Chum 650ml', shortName: 'Chum 650ml', volume: 650, wineType: 'gao', bottleType: 'su' },
            { sku: 'C650-N', name: 'Chum 650ml - Nếp', shortName: 'Chum 650ml - N', volume: 650, wineType: 'nep', bottleType: 'su' },
            { sku: 'C650-DX', name: 'Chum 650ml - Đậu xanh', shortName: 'Chum 650ml - DX', volume: 650, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'HL650', name: 'Hồ Lô 650ml', shortName: 'Hồ Lô 650ml', volume: 650, wineType: 'gao', bottleType: 'su' },
            { sku: 'HL650-N', name: 'Hồ Lô 650ml - Nếp', shortName: 'Hồ Lô 650ml - N', volume: 650, wineType: 'nep', bottleType: 'su' },
            { sku: 'HL650-DX', name: 'Hồ Lô 650ml - Đậu xanh', shortName: 'Hồ Lô 650ml - DX', volume: 650, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'VR650', name: 'Chai sứ Vòi Rót 650ml', shortName: 'Vòi Rót 650ml', volume: 650, wineType: 'gao', bottleType: 'su' },
            { sku: 'VR650-N', name: 'Chai sứ Vòi Rót 650ml - Nếp', shortName: 'Vòi Rót 650ml - N', volume: 650, wineType: 'nep', bottleType: 'su' },
            { sku: 'VR650-DX', name: 'Chai sứ Vòi Rót 650ml - Đậu xanh', shortName: 'Vòi Rót 650ml - DX', volume: 650, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'TC700', name: 'Thuyền Chim 700ml', shortName: 'Thuyền Chim 700ml', volume: 700, wineType: 'gao', bottleType: 'su' },
            { sku: 'TC700-N', name: 'Thuyền Chim 700ml - Nếp', shortName: 'Thuyền Chim 700ml - N', volume: 700, wineType: 'nep', bottleType: 'su' },
            { sku: 'TC700-DX', name: 'Thuyền Chim 700ml - Đậu xanh', shortName: 'Thuyền Chim 700ml - DX', volume: 700, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'TL1L', name: 'Thuyền Lớn 1L', shortName: 'Thuyền Lớn 1L', volume: 1000, wineType: 'gao', bottleType: 'su' },
            { sku: 'TL1L-N', name: 'Thuyền Lớn 1L - Nếp', shortName: 'Thuyền Lớn 1L - N', volume: 1000, wineType: 'nep', bottleType: 'su' },
            { sku: 'TL1L-DX', name: 'Thuyền Lớn 1L - Đậu xanh', shortName: 'Thuyền Lớn 1L - DX', volume: 1000, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'CS25L', name: 'Chai sứ 2.5L', shortName: 'Chai sứ 2.5L', volume: 2500, wineType: 'gao', bottleType: 'su' },
            { sku: 'CS25L-N', name: 'Chai sứ 2.5L - Nếp', shortName: 'Chai sứ 2.5L - N', volume: 2500, wineType: 'nep', bottleType: 'su' },
            { sku: 'CS25L-DX', name: 'Chai sứ 2.5L - Đậu xanh', shortName: 'Chai sứ 2.5L - DX', volume: 2500, wineType: 'dauxanh', bottleType: 'su' },
            { sku: 'DXTT500', name: 'Đậu xanh thủy tinh 500ml', shortName: 'ĐX Thủy tinh 500', volume: 500, wineType: 'dauxanh', bottleType: 'thuytinh' },
            { sku: 'DTHT-D', name: 'Đông trùng hạ thảo 500ml - Dẹp', shortName: 'ĐTHT Dẹp', volume: 500, wineType: 'dtht', bottleType: 'thuytinh' },
            { sku: 'DTHT-T', name: 'Đông trùng hạ thảo 500ml - Tròn', shortName: 'ĐTHT Tròn', volume: 500, wineType: 'dtht', bottleType: 'thuytinh' },
            { sku: 'VN300', name: 'Vang nếp 300ml', shortName: 'Vang nếp 300ml', volume: 300, wineType: 'vangnep', bottleType: 'thuytinh' },
            { sku: 'VN500', name: 'Vang nếp 500ml', shortName: 'Vang nếp 500ml', volume: 500, wineType: 'vangnep', bottleType: 'thuytinh' },
            { sku: 'VN750', name: 'Vang nếp 750ml', shortName: 'Vang nếp 750ml', volume: 750, wineType: 'vangnep', bottleType: 'thuytinh' },
        ];
        const missingProducts = defaultProducts.filter((p) => !existingSkus.has(p.sku));
        if (missingProducts.length > 0) {
          for (let i = 0; i < missingProducts.length; i++) {
            const p = missingProducts[i];
            data.records.push({
              id: `default_product_${Date.now()}_${i}`,
              moduleId: 'mod_ruou_products',
              values: {
                mod_ruou_products_product_name: p.name,
                mod_ruou_products_sku: p.sku,
                mod_ruou_products_short_name: p.shortName,
                mod_ruou_products_volume_ml: p.volume,
                mod_ruou_products_wine_type: p.wineType,
                mod_ruou_products_bottle_type: p.bottleType,
                mod_ruou_products_note: '',
              },
              tags: [],
              images: [],
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
          }
          data.metadata.totalRecords += missingProducts.length;
          wineMigrated = true;
        }

        if (wineMigrated) {
          data = { ...data, lastModified: now };
          await indexedDBService.saveData(data);
        }
      }

      // Apply theme from settings
      const theme = data.settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : data.settings.theme;

      // Process recurring transactions
      if (data && data.recurringTransactions && data.recurringTransactions.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        let hasNewRecords = false;
        const currentData = data;
        const updatedRecurring = currentData.recurringTransactions.map((rt) => {
          if (!rt.isActive || rt.nextRunDate > today) return rt;
          // Create record for this recurring transaction
          const newRecord = {
            id: crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            moduleId: rt.moduleId,
            linkedModuleId: rt.linkedModuleId,
            categoryId: rt.categoryId,
            values: { ...rt.values },
            tags: [] as string[],
            images: [] as string[],
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          currentData.records.push(newRecord);
          currentData.metadata.totalRecords += 1;
          hasNewRecords = true;
          // Calculate next run date
          const nextDate = new Date(rt.nextRunDate);
          switch (rt.frequency) {
            case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
            case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
          }
          return { ...rt, nextRunDate: nextDate.toISOString().slice(0, 10) };
        });
        if (hasNewRecords) {
          data = { ...currentData, recurringTransactions: updatedRecurring, lastModified: new Date().toISOString() };
          await indexedDBService.saveData(data);
        }
      }
      // Ensure new fields exist for existing data (migration)
      if (data && !data.recurringTransactions) data = { ...data, recurringTransactions: [] };
      if (data && !data.budgets) data = { ...data, budgets: [] };
      if (data && !data.activityLog) data = { ...data, activityLog: [] };

      // Check if user was previously logged in
      const savedEmail = localStorage.getItem('pdp_userEmail');
      const savedAvatar = localStorage.getItem('pdp_userAvatar');
      const savedModuleId = localStorage.getItem('pdp_activeModuleId');
      const savedView = localStorage.getItem('pdp_activeView') as AppState['activeView'] | null;

      set({
        data,
        isLoading: false,
        isAuthenticated: true, // Always start - no login gate
        userEmail: savedEmail || 'offline@local',
        userAvatar: savedAvatar || null,
        theme,
        activeModuleId: savedModuleId || data.settings.defaultModuleId || data.modules[0]?.id || null,
        activeView: savedView || 'dashboard',
      });

      // Background sync: attempt pull first (for fresh installs getting data from Drive)
      // Only push if we have meaningful local data (not default empty data)
      const isDefaultData = data.records.length === 0 && data.modules.length <= 5;
      if (isDefaultData && driveService.token) {
        syncService.pull().then((result) => {
          if (result.status === 'locked') return;
          if (result.status === 'success' && result.data) {
            set({ data: result.data, activeModuleId: result.data.settings?.defaultModuleId || result.data.modules[0]?.id || null });
          }
        }).catch(() => {});
      } else if (driveService.token) {
        syncService.fullSync().then((result) => {
          if (result.status === 'locked') return;
          if (result.status === 'success' && result.data) {
            set({ data: result.data, activeModuleId: result.data.settings?.defaultModuleId || result.data.modules[0]?.id || null });
          }
        }).catch(() => {});
      }
    } catch (error) {
      set({
        isLoading: false,
        isAuthenticated: true, // Still allow access even on error
        error: error instanceof Error ? error.message : 'Failed to initialize',
      });
    }
  },

  setData: (data) => {
    if (!data || !data.modules || !data.records) {
      console.error('[AppStore] setData rejected: data missing modules or records');
      return;
    }
    if (!data.settings) {
      data = { ...data, settings: { theme: 'light', language: 'vi', currency: '₫', currencyLocale: 'vi-VN', dateFormat: 'dd/MM/yyyy', firstDayOfWeek: 1, defaultModuleId: 'mod_chitieu' } as never };
    }
    set({ data });
    indexedDBService.saveData(data);
    syncService.schedulePush();
  },

  setTheme: (theme) => {
    set({ theme });
    const { data } = get();
    if (data) {
      const updatedData = {
        ...data,
        settings: { ...data.settings, theme },
        lastModified: new Date().toISOString(),
      };
      set({ data: updatedData });
      indexedDBService.saveData(updatedData);
    }
  },

  setActiveModule: (moduleId) => {
    set({ activeModuleId: moduleId, activeView: 'module' });
    localStorage.setItem('pdp_activeModuleId', moduleId);
    localStorage.setItem('pdp_activeView', 'module');
  },

  setActiveView: (view) => {
    set({ activeView: view });
    localStorage.setItem('pdp_activeView', view);
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setActiveWorkspace: (ws) => {
    set({ activeWorkspace: ws });
    localStorage.setItem('pdp_activeWorkspace', ws);
  },

  setActiveWineView: (view) => {
    set({ activeWineView: view });
    localStorage.setItem('pdp_activeWineView', view);
  },

  setAuth: (email, avatar) => {
    set({ isAuthenticated: true, userEmail: email, userAvatar: avatar || null });
    localStorage.setItem('pdp_userEmail', email);
    if (avatar) localStorage.setItem('pdp_userAvatar', avatar);
  },

  clearAuth: () => {
    set({ isAuthenticated: true, userEmail: 'offline@local', userAvatar: null });
    localStorage.removeItem('pdp_userEmail');
    localStorage.removeItem('pdp_userAvatar');
  },

  setSyncing: (syncing) => {
    set({ isSyncing: syncing });
    if (!syncing) {
      set({ lastSyncAt: new Date().toISOString() });
    }
  },

  setError: (error) => set({ error }),

  // Data mutations
  updateModule: (module) => {
    const { data } = get();
    if (!data) return;

    const modules = data.modules.map((m) => (m.id === module.id ? module : m));
    const updatedData = { ...data, modules, lastModified: new Date().toISOString() };
    set({ data: updatedData });
    indexedDBService.saveData(updatedData);
  },

  updateSettings: (settings) => {
    const { data } = get();
    if (!data) return;

    const updatedData = {
      ...data,
      settings: { ...data.settings, ...settings },
      lastModified: new Date().toISOString(),
    };
    set({ data: updatedData });
    indexedDBService.saveData(updatedData);
  },

  updateMenu: (menu) => {
    const { data } = get();
    if (!data) return;

    const updatedData = { ...data, menu, lastModified: new Date().toISOString() };
    set({ data: updatedData });
    indexedDBService.saveData(updatedData);
  },
}));
