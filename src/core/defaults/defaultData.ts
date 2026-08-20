import { v4 as uuidv4 } from 'uuid';
import type { FinanceData, ModuleDefinition, FieldDefinition, CategoryDefinition, MenuItem, DataRecord } from '@/types';

/**
 * Creates the default finance.json structure with pre-configured modules
 * matching the existing Android app's data model.
 */
export function createDefaultFinanceData(): FinanceData {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    lastModified: now,
    deviceId: `web_${uuidv4().slice(0, 8)}`,
    settings: {
      theme: 'light',
      language: 'vi',
      currency: '₫',
      currencyLocale: 'vi-VN',
      dateFormat: 'dd/MM/yyyy',
      firstDayOfWeek: 1,
      defaultModuleId: 'mod_chitieu',
    },
    modules: getDefaultModules(now),
    accounts: getDefaultAccounts(now),
    records: getDefaultWineProducts(now),
    dashboard: [],
    reports: [],
    menu: getDefaultMenu(),
    metadata: {
      totalRecords: 30,
      createdAt: now,
    },
    recurringTransactions: [],
    budgets: [],
    activityLog: [],
  };
}

function getDefaultModules(now: string): ModuleDefinition[] {
  return [
    createExpenseModule(now),
    createShopeeModule(now),
    createGoldModule(now),
    createRentalModule(now),
    createCreditCardModule(now),
    createWineOrderModule(now),
    createWineProductsModule(now),
    createWineCustomersModule(now),
    createWineInventoryModule(now),
  ];
}

function createExpenseModule(now: string): ModuleDefinition {
  const moduleId = 'mod_chitieu';
  return {
    id: moduleId,
    name: 'Chi tiêu',
    icon: 'wallet',
    color: '#F44336',
    description: 'Quản lý thu chi hàng ngày',
    sortOrder: 0,
    isDefault: true,
    isActive: true,
    isVisible: true,
    fields: [
      createField(moduleId, 'title', 'Tên giao dịch', 'text', 0, true, true, now),
      createField(moduleId, 'amount', 'Số tiền', 'money', 1, true, true, now),
      createField(moduleId, 'type', 'Loại', 'dropdown', 2, true, true, now, [
        { id: 'opt_chi', label: 'Chi', value: '0', color: '#F44336', sortOrder: 0, isActive: true },
        { id: 'opt_thu', label: 'Thu', value: '1', color: '#4CAF50', sortOrder: 1, isActive: true },
      ]),
      createField(moduleId, 'date', 'Ngày', 'date', 3, true, true, now),
      createField(moduleId, 'account', 'Tài khoản', 'dropdown', 4, false, true, now, [
        { id: 'acc_cash', label: 'Tiền mặt', value: 'cash', color: '#4CAF50', sortOrder: 0, isActive: true },
        { id: 'acc_bank', label: 'Ngân hàng', value: 'bank', color: '#2196F3', sortOrder: 1, isActive: true },
        { id: 'acc_momo', label: 'MoMo', value: 'momo', color: '#D81B60', sortOrder: 2, isActive: true },
        { id: 'acc_tpbank', label: 'TP Bank', value: 'tpbank', color: '#7B1FA2', sortOrder: 3, isActive: true },
        { id: 'acc_vpbank', label: 'VP Bank', value: 'vpbank', color: '#00695C', sortOrder: 4, isActive: true },
        { id: 'acc_zalopay', label: 'ZaloPay', value: 'zalopay', color: '#0288D1', sortOrder: 5, isActive: true },
        { id: 'acc_credit', label: 'Thẻ tín dụng', value: 'credit_card', color: '#1A237E', sortOrder: 6, isActive: true },
      ]),
      createField(moduleId, 'beneficiary', 'Của', 'dropdown', 5, false, true, now, [
        { id: 'ben_ba', label: 'Ba', value: 'ba', color: '#3F51B5', sortOrder: 0, isActive: true },
        { id: 'ben_me', label: 'Mẹ', value: 'me', color: '#E91E63', sortOrder: 1, isActive: true },
        { id: 'ben_vo', label: 'Vợ', value: 'vo', color: '#FF5722', sortOrder: 2, isActive: true },
        { id: 'ben_con', label: 'Con', value: 'con', color: '#FF9800', sortOrder: 3, isActive: true },
        { id: 'ben_anh', label: 'Anh', value: 'anh', color: '#009688', sortOrder: 4, isActive: true },
        { id: 'ben_chi', label: 'Chị', value: 'chi', color: '#673AB7', sortOrder: 5, isActive: true },
        { id: 'ben_chong', label: 'Chồng', value: 'chong', color: '#795548', sortOrder: 6, isActive: true },
        { id: 'ben_banthan', label: 'Mình', value: 'banthan', color: '#607D8B', sortOrder: 7, isActive: true },
      ]),
      createField(moduleId, 'quantity', 'Số lượng', 'number', 6, false, true, now),
      createField(moduleId, 'warranty_months', 'Tháng bảo hành', 'number', 7, false, true, now),
      createField(moduleId, 'warranty_date', 'Ngày bảo hành', 'date', 8, false, true, now),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 9, false, false, now),
      createField(moduleId, 'tags', 'Tags', 'tag', 10, false, false, now),
      createField(moduleId, 'images', 'Hình ảnh', 'image', 11, false, false, now),
    ],
    categories: getExpenseCategories(moduleId, now),
    tableConfig: {
      columns: [
        { fieldId: 'mod_chitieu_date', isVisible: true, sortOrder: 0, width: 100 },
        { fieldId: 'mod_chitieu_title', isVisible: true, sortOrder: 1 },
        { fieldId: 'mod_chitieu_amount', isVisible: true, sortOrder: 2, width: 130 },
        { fieldId: 'mod_chitieu_type', isVisible: true, sortOrder: 3, width: 70 },
        { fieldId: 'mod_chitieu_account', isVisible: true, sortOrder: 4, width: 100 },
        { fieldId: 'mod_chitieu_beneficiary', isVisible: true, sortOrder: 5, width: 90 },
        { fieldId: 'mod_chitieu_quantity', isVisible: true, sortOrder: 6, width: 60 },
        { fieldId: 'mod_chitieu_warranty_months', isVisible: true, sortOrder: 7, width: 60 },
        { fieldId: 'mod_chitieu_warranty_date', isVisible: true, sortOrder: 8, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_chitieu_date', direction: 'desc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createShopeeModule(now: string): ModuleDefinition {
  const moduleId = 'mod_shopee';
  return {
    id: moduleId,
    name: 'Shopee',
    icon: 'shopping-cart',
    color: '#FF5722',
    description: 'Theo dõi đơn hàng Shopee',
    sortOrder: 1,
    isDefault: true,
    isActive: true,
    isVisible: true,
    fields: [
      createField(moduleId, 'order_name', 'Tên đơn hàng', 'text', 0, true, true, now),
      createField(moduleId, 'amount', 'Số tiền', 'money', 1, true, true, now),
      createField(moduleId, 'date', 'Ngày đặt', 'date', 2, true, true, now),
      createField(moduleId, 'status', 'Trạng thái', 'dropdown', 3, false, true, now, [
        { id: 'st_ordered', label: 'Đã đặt', value: 'ordered', color: '#FF9800', sortOrder: 0, isActive: true },
        { id: 'st_shipping', label: 'Đang giao', value: 'shipping', color: '#2196F3', sortOrder: 1, isActive: true },
        { id: 'st_received', label: 'Đã nhận', value: 'received', color: '#4CAF50', sortOrder: 2, isActive: true },
        { id: 'st_returned', label: 'Hoàn trả', value: 'returned', color: '#F44336', sortOrder: 3, isActive: true },
      ]),
      createField(moduleId, 'category', 'Phân loại', 'dropdown', 4, false, true, now, [
        { id: 'sc_clothing', label: 'Quần áo', value: 'clothing', sortOrder: 0, isActive: true },
        { id: 'sc_electronics', label: 'Điện tử', value: 'electronics', sortOrder: 1, isActive: true },
        { id: 'sc_household', label: 'Gia dụng', value: 'household', sortOrder: 2, isActive: true },
        { id: 'sc_food', label: 'Thực phẩm', value: 'food', sortOrder: 3, isActive: true },
        { id: 'sc_other', label: 'Khác', value: 'other', sortOrder: 4, isActive: true },
      ]),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 5, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_shopee_date', isVisible: true, sortOrder: 0, width: 100 },
        { fieldId: 'mod_shopee_order_name', isVisible: true, sortOrder: 1 },
        { fieldId: 'mod_shopee_amount', isVisible: true, sortOrder: 2, width: 120 },
        { fieldId: 'mod_shopee_status', isVisible: true, sortOrder: 3, width: 100 },
        { fieldId: 'mod_shopee_category', isVisible: true, sortOrder: 4, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_shopee_date', direction: 'desc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createGoldModule(now: string): ModuleDefinition {
  const moduleId = 'mod_vang';
  return {
    id: moduleId,
    name: 'Vàng',
    icon: 'gem',
    color: '#FFC107',
    description: 'Quản lý mua bán vàng',
    sortOrder: 2,
    isDefault: true,
    isActive: false,
    isVisible: true,
    fields: [
      createField(moduleId, 'type', 'Loại GD', 'dropdown', 0, true, true, now, [
        { id: 'gt_buy', label: 'Mua', value: 'buy', color: '#4CAF50', sortOrder: 0, isActive: true },
        { id: 'gt_sell', label: 'Bán', value: 'sell', color: '#F44336', sortOrder: 1, isActive: true },
      ]),
      createField(moduleId, 'gold_type', 'Loại vàng', 'dropdown', 1, true, true, now, [
        { id: 'gtype_sjc', label: 'SJC', value: 'SJC', sortOrder: 0, isActive: true },
        { id: 'gtype_pnj', label: 'PNJ', value: 'PNJ', sortOrder: 1, isActive: true },
        { id: 'gtype_9999', label: '9999', value: '9999', sortOrder: 2, isActive: true },
      ]),
      createField(moduleId, 'quantity', 'Số lượng (chỉ)', 'number', 2, true, true, now),
      createField(moduleId, 'price_per_unit', 'Giá/chỉ', 'money', 3, true, true, now),
      createField(moduleId, 'total_amount', 'Tổng tiền', 'money', 4, true, true, now),
      createField(moduleId, 'date', 'Ngày', 'date', 5, true, true, now),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 6, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_vang_date', isVisible: true, sortOrder: 0, width: 100 },
        { fieldId: 'mod_vang_type', isVisible: true, sortOrder: 1, width: 80 },
        { fieldId: 'mod_vang_gold_type', isVisible: true, sortOrder: 2, width: 80 },
        { fieldId: 'mod_vang_quantity', isVisible: true, sortOrder: 3, width: 100 },
        { fieldId: 'mod_vang_price_per_unit', isVisible: true, sortOrder: 4, width: 120 },
        { fieldId: 'mod_vang_total_amount', isVisible: true, sortOrder: 5, width: 120 },
      ],
      defaultSort: { fieldId: 'mod_vang_date', direction: 'desc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createRentalModule(now: string): ModuleDefinition {
  const moduleId = 'mod_nhatro';
  return {
    id: moduleId,
    name: 'Nhà trọ',
    icon: 'home',
    color: '#4CAF50',
    description: 'Quản lý nhà trọ, thu tiền hàng tháng',
    sortOrder: 3,
    isDefault: true,
    isActive: false,
    isVisible: true,
    fields: [
      createField(moduleId, 'room_name', 'Phòng', 'text', 0, true, true, now),
      createField(moduleId, 'tenant_name', 'Người thuê', 'text', 1, true, true, now),
      createField(moduleId, 'month', 'Tháng', 'date', 2, true, true, now),
      createField(moduleId, 'rent_amount', 'Tiền phòng', 'money', 3, true, true, now),
      createField(moduleId, 'electricity', 'Tiền điện', 'money', 4, false, true, now),
      createField(moduleId, 'water', 'Tiền nước', 'money', 5, false, true, now),
      createField(moduleId, 'internet', 'Internet', 'money', 6, false, true, now),
      createField(moduleId, 'total', 'Tổng', 'money', 7, true, true, now),
      createField(moduleId, 'status', 'Trạng thái', 'dropdown', 8, true, true, now, [
        { id: 'rs_unpaid', label: 'Chưa TT', value: 'unpaid', color: '#F44336', sortOrder: 0, isActive: true },
        { id: 'rs_paid', label: 'Đã TT', value: 'paid', color: '#4CAF50', sortOrder: 1, isActive: true },
        { id: 'rs_late', label: 'Trễ hạn', value: 'late', color: '#FF9800', sortOrder: 2, isActive: true },
      ]),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 9, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_nhatro_month', isVisible: true, sortOrder: 0, width: 100 },
        { fieldId: 'mod_nhatro_room_name', isVisible: true, sortOrder: 1, width: 80 },
        { fieldId: 'mod_nhatro_tenant_name', isVisible: true, sortOrder: 2 },
        { fieldId: 'mod_nhatro_total', isVisible: true, sortOrder: 3, width: 120 },
        { fieldId: 'mod_nhatro_status', isVisible: true, sortOrder: 4, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_nhatro_month', direction: 'desc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createCreditCardModule(now: string): ModuleDefinition {
  const moduleId = 'mod_creditcard';
  return {
    id: moduleId,
    name: 'Thẻ tín dụng',
    icon: 'credit-card',
    color: '#1A237E',
    description: 'Quản lý thẻ tín dụng, trả góp',
    sortOrder: 4,
    isDefault: true,
    isActive: true,
    isVisible: true,
    fields: [
      createField(moduleId, 'card_name', 'Tên thẻ', 'text', 0, true, true, now),
      createField(moduleId, 'bank_name', 'Ngân hàng', 'text', 1, false, true, now),
      createField(moduleId, 'last4', '4 số cuối', 'text', 2, false, true, now),
      createField(moduleId, 'credit_limit', 'Hạn mức', 'money', 3, false, true, now),
      createField(moduleId, 'statement_day', 'Ngày sao kê', 'number', 4, false, false, now),
      createField(moduleId, 'payment_due_day', 'Ngày thanh toán', 'number', 5, false, false, now),
      createField(moduleId, 'is_installment', 'Trả góp', 'dropdown', 6, false, true, now, [
        { id: 'inst_no', label: 'Không', value: '0', color: '#607D8B', sortOrder: 0, isActive: true },
        { id: 'inst_yes', label: 'Có', value: '1', color: '#FF9800', sortOrder: 1, isActive: true },
      ]),
      createField(moduleId, 'installment_months', 'Số tháng trả góp', 'number', 7, false, true, now),
      createField(moduleId, 'installment_amount', 'Số tiền mỗi tháng', 'money', 8, false, true, now),
      createField(moduleId, 'installment_start_date', 'Ngày bắt đầu trả góp', 'date', 9, false, true, now),
      createField(moduleId, 'installment_remaining', 'Số tháng còn lại', 'number', 10, false, true, now),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 11, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_creditcard_card_name', isVisible: true, sortOrder: 0 },
        { fieldId: 'mod_creditcard_bank_name', isVisible: true, sortOrder: 1, width: 120 },
        { fieldId: 'mod_creditcard_last4', isVisible: true, sortOrder: 2, width: 80 },
        { fieldId: 'mod_creditcard_credit_limit', isVisible: true, sortOrder: 3, width: 130 },
        { fieldId: 'mod_creditcard_is_installment', isVisible: true, sortOrder: 4, width: 80 },
        { fieldId: 'mod_creditcard_installment_amount', isVisible: true, sortOrder: 5, width: 130 },
        { fieldId: 'mod_creditcard_installment_remaining', isVisible: true, sortOrder: 6, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_creditcard_card_name', direction: 'asc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createWineOrderModule(now: string): ModuleDefinition {
  const moduleId = 'mod_ruou';
  return {
    id: moduleId,
    name: 'Rượu',
    icon: 'wine',
    color: '#9C27B0',
    description: 'Quản lý đơn hàng rượu',
    sortOrder: 5,
    isDefault: true,
    isActive: false,
    isVisible: true,
    fields: [
      createField(moduleId, 'order_date', 'Ngày đặt', 'date', 0, true, true, now),
      createField(moduleId, 'customer_name', 'Khách hàng', 'text', 1, true, true, now),
      createField(moduleId, 'customer_phone', 'SĐT', 'phone', 2, false, true, now),
      createField(moduleId, 'customer_address', 'Địa chỉ', 'text', 3, false, false, now),
      createField(moduleId, 'customer_district', 'Quận/Huyện', 'text', 4, false, false, now),
      createField(moduleId, 'customer_city', 'Tỉnh/TP', 'text', 5, false, false, now),
      createField(moduleId, 'product_sku', 'Mã SP', 'text', 6, false, true, now),
      createField(moduleId, 'product_name', 'Tên SP', 'text', 7, true, true, now),
      createField(moduleId, 'color', 'Màu', 'text', 8, false, true, now),
      createField(moduleId, 'quantity', 'SL', 'number', 9, true, true, now),
      createField(moduleId, 'price', 'Đơn giá', 'money', 10, true, true, now),
      createField(moduleId, 'glasses', 'Ly', 'number', 11, false, true, now),
      createField(moduleId, 'boxes', 'Hộp', 'number', 12, false, true, now),
      createField(moduleId, 'ship_fee', 'Phí ship', 'money', 13, false, true, now),
      createField(moduleId, 'total_amount', 'Tổng tiền', 'money', 14, true, true, now),
      createField(moduleId, 'note1', 'Ghi chú 1', 'textarea', 15, false, false, now),
      createField(moduleId, 'note2', 'Ghi chú 2', 'textarea', 16, false, false, now),
      createField(moduleId, 'images', 'Hình ảnh', 'image', 17, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_ruou_order_date', isVisible: true, sortOrder: 0, width: 100 },
        { fieldId: 'mod_ruou_customer_name', isVisible: true, sortOrder: 1, width: 120 },
        { fieldId: 'mod_ruou_product_name', isVisible: true, sortOrder: 2 },
        { fieldId: 'mod_ruou_color', isVisible: true, sortOrder: 3, width: 70 },
        { fieldId: 'mod_ruou_quantity', isVisible: true, sortOrder: 4, width: 50 },
        { fieldId: 'mod_ruou_price', isVisible: true, sortOrder: 5, width: 100 },
        { fieldId: 'mod_ruou_total_amount', isVisible: true, sortOrder: 6, width: 120 },
        { fieldId: 'mod_ruou_customer_phone', isVisible: true, sortOrder: 7, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_ruou_order_date', direction: 'desc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createWineProductsModule(now: string): ModuleDefinition {
  const moduleId = 'mod_ruou_products';
  return {
    id: moduleId,
    name: 'SP Rượu',
    icon: 'wine',
    color: '#7B1FA2',
    description: 'Danh sách sản phẩm rượu',
    sortOrder: 6,
    isDefault: true,
    isActive: false,
    isVisible: false,
    fields: [
      createField(moduleId, 'product_name', 'Tên sản phẩm', 'text', 0, true, true, now),
      createField(moduleId, 'sku', 'Mã SKU', 'text', 1, false, true, now),
      createField(moduleId, 'short_name', 'Viết tắt', 'text', 2, false, true, now),
      createField(moduleId, 'volume_ml', 'Dung tích (ml)', 'number', 3, false, true, now),
      createField(moduleId, 'wine_type', 'Loại rượu', 'dropdown', 4, false, true, now, [
        { id: 'wpt_gao', label: 'Gạo', value: 'gao', color: '#FF9800', sortOrder: 0, isActive: true },
        { id: 'wpt_gao2', label: 'Gạo loại 2', value: 'gao loai 2', color: '#FB8C00', sortOrder: 1, isActive: true },
        { id: 'wpt_nep', label: 'Nếp', value: 'nep', color: '#8BC34A', sortOrder: 2, isActive: true },
        { id: 'wpt_dauxanh', label: 'Đậu xanh', value: 'dauxanh', color: '#4CAF50', sortOrder: 3, isActive: true },
        { id: 'wpt_vangnep', label: 'Vang nếp', value: 'vangnep', color: '#9C27B0', sortOrder: 4, isActive: true },
        { id: 'wpt_dtht', label: 'ĐTHT', value: 'dtht', color: '#F44336', sortOrder: 5, isActive: true },
      ]),
      createField(moduleId, 'bottle_type', 'Loại chai', 'dropdown', 5, false, true, now, [
        { id: 'wbt_pet', label: 'PET', value: 'pet', color: '#4CAF50', sortOrder: 0, isActive: true },
        { id: 'wbt_su', label: 'Sứ', value: 'su', color: '#795548', sortOrder: 1, isActive: true },
        { id: 'wbt_thuytinh', label: 'Thuỷ tinh', value: 'thuytinh', color: '#03A9F4', sortOrder: 2, isActive: true },
      ]),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 6, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_ruou_products_sku', isVisible: true, sortOrder: 0, width: 80 },
        { fieldId: 'mod_ruou_products_product_name', isVisible: true, sortOrder: 1 },
        { fieldId: 'mod_ruou_products_short_name', isVisible: true, sortOrder: 2, width: 80 },
        { fieldId: 'mod_ruou_products_volume_ml', isVisible: true, sortOrder: 3, width: 80 },
        { fieldId: 'mod_ruou_products_wine_type', isVisible: true, sortOrder: 4, width: 90 },
        { fieldId: 'mod_ruou_products_bottle_type', isVisible: true, sortOrder: 5, width: 80 },
      ],
      defaultSort: { fieldId: 'mod_ruou_products_product_name', direction: 'asc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createWineCustomersModule(now: string): ModuleDefinition {
  const moduleId = 'mod_ruou_customers';
  return {
    id: moduleId,
    name: 'KH Rượu',
    icon: 'users',
    color: '#5C6BC0',
    description: 'Danh sách khách hàng rượu',
    sortOrder: 7,
    isDefault: true,
    isActive: false,
    isVisible: false,
    fields: [
      createField(moduleId, 'full_name', 'Họ tên', 'text', 0, true, true, now),
      createField(moduleId, 'phone', 'SĐT', 'phone', 1, false, true, now),
      createField(moduleId, 'address', 'Địa chỉ', 'text', 2, false, true, now),
      createField(moduleId, 'district', 'Quận/Huyện', 'text', 3, false, true, now),
      createField(moduleId, 'city', 'Tỉnh/TP', 'text', 4, false, true, now),
      createField(moduleId, 'total_orders', 'Tổng đơn', 'number', 5, false, true, now),
      createField(moduleId, 'last_order_date', 'Đơn cuối', 'date', 6, false, true, now),
      createField(moduleId, 'note', 'Ghi chú', 'textarea', 7, false, false, now),
    ],
    tableConfig: {
      columns: [
        { fieldId: 'mod_ruou_customers_full_name', isVisible: true, sortOrder: 0 },
        { fieldId: 'mod_ruou_customers_phone', isVisible: true, sortOrder: 1, width: 100 },
        { fieldId: 'mod_ruou_customers_address', isVisible: true, sortOrder: 2 },
        { fieldId: 'mod_ruou_customers_district', isVisible: true, sortOrder: 3, width: 100 },
        { fieldId: 'mod_ruou_customers_city', isVisible: true, sortOrder: 4, width: 80 },
        { fieldId: 'mod_ruou_customers_total_orders', isVisible: true, sortOrder: 5, width: 70 },
        { fieldId: 'mod_ruou_customers_last_order_date', isVisible: true, sortOrder: 6, width: 100 },
      ],
      defaultSort: { fieldId: 'mod_ruou_customers_full_name', direction: 'asc' },
      pageSize: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createWineInventoryModule(now: string): ModuleDefinition {
  const moduleId = 'mod_ruou_inventory';
  return {
    id: moduleId,
    name: 'Kho Rượu',
    icon: 'building',
    color: '#6A1B9A',
    description: 'Quản lý tồn kho rượu',
    sortOrder: 8,
    isDefault: true,
    isActive: false,
    isVisible: false,
    fields: [
      createField(moduleId, 'sku', 'SKU', 'text', 0, true, true, now),
      createField(moduleId, 'product_name', 'Sản phẩm', 'text', 1, true, true, now),
      createField(moduleId, 'color', 'Màu', 'text', 2, false, true, now),
      createField(moduleId, 'wine_type', 'Loại rượu', 'text', 3, false, true, now),
      createField(moduleId, 'bottle_type', 'Loại chai', 'text', 4, false, true, now),
      createField(moduleId, 'stock', 'Tồn kho', 'number', 5, true, true, now),
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
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function createField(
  moduleId: string,
  name: string,
  label: string,
  type: FieldDefinition['fieldType'],
  sortOrder: number,
  isRequired: boolean,
  isTableVisible: boolean,
  now: string,
  options?: FieldDefinition['options']
): FieldDefinition {
  return {
    id: `${moduleId}_${name}`,
    moduleId,
    fieldName: name,
    fieldLabel: label,
    fieldType: type,
    sortOrder,
    isRequired,
    isVisible: true,
    isTableVisible,
    options,
    createdAt: now,
    updatedAt: now,
  };
}

function getExpenseCategories(moduleId: string, now: string): CategoryDefinition[] {
  const categories = [
    { name: 'Ăn uống', icon: 'utensils', color: '#FF9800' },
    { name: 'Di chuyển', icon: 'car', color: '#2196F3' },
    { name: 'Mua sắm', icon: 'shopping-bag', color: '#E91E63' },
    { name: 'Hóa đơn', icon: 'file-text', color: '#FF5722' },
    { name: 'Giải trí', icon: 'film', color: '#9C27B0' },
    { name: 'Sức khỏe', icon: 'heart', color: '#4CAF50' },
    { name: 'Giáo dục', icon: 'book', color: '#3F51B5' },
    { name: 'Gia đình', icon: 'users', color: '#009688' },
    { name: 'Du lịch', icon: 'map', color: '#00BCD4' },
    { name: 'Khác', icon: 'more-horizontal', color: '#607D8B' },
  ];

  return categories.map((cat, index) => ({
    id: `cat_${moduleId}_${index}`,
    moduleId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    sortOrder: index,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}

function getDefaultAccounts(now: string) {
  return [
    {
      id: 'acc_cash',
      name: 'Tiền mặt',
      icon: 'wallet',
      color: '#4CAF50',
      initialBalance: 0,
      currentBalance: 0,
      includeInTotal: true,
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acc_bank',
      name: 'Ngân hàng',
      icon: 'building',
      color: '#2196F3',
      initialBalance: 0,
      currentBalance: 0,
      includeInTotal: true,
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acc_momo',
      name: 'MoMo',
      icon: 'smartphone',
      color: '#D81B60',
      initialBalance: 0,
      currentBalance: 0,
      includeInTotal: true,
      isActive: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getDefaultMenu(): MenuItem[] {
  return [
    { id: 'menu_dashboard', label: 'Dashboard', icon: 'layout-dashboard', type: 'dashboard', sortOrder: 0, isVisible: true },
    { id: 'menu_divider_1', label: '', icon: '', type: 'divider', sortOrder: 1, isVisible: true },
    { id: 'menu_chitieu', label: 'Chi tiêu', icon: 'wallet', type: 'module', targetId: 'mod_chitieu', sortOrder: 2, isVisible: true },
    { id: 'menu_shopee', label: 'Shopee', icon: 'shopping-cart', type: 'module', targetId: 'mod_shopee', sortOrder: 3, isVisible: true },
    { id: 'menu_vang', label: 'Vàng', icon: 'gem', type: 'module', targetId: 'mod_vang', sortOrder: 4, isVisible: true },
    { id: 'menu_nhatro', label: 'Nhà trọ', icon: 'home', type: 'module', targetId: 'mod_nhatro', sortOrder: 5, isVisible: true },
    { id: 'menu_creditcard', label: 'Thẻ tín dụng', icon: 'credit-card', type: 'module', targetId: 'mod_creditcard', sortOrder: 6, isVisible: true },
    { id: 'menu_divider_2', label: '', icon: '', type: 'divider', sortOrder: 7, isVisible: true },
    { id: 'menu_manager', label: 'Quản lý', icon: 'database', type: 'report', sortOrder: 8, isVisible: true },
    { id: 'menu_trash', label: 'Thùng rác', icon: 'trash-2', type: 'report', sortOrder: 9, isVisible: true },
    { id: 'menu_settings', label: 'Cài đặt', icon: 'settings', type: 'settings', sortOrder: 10, isVisible: true },
  ];
}

function getDefaultWineProducts(now: string): DataRecord[] {
  const products = [
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

  return products.map((p, index) => ({
    id: `default_product_${index}`,
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
  }));
}
