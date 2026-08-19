# SO SÁNH CẤU TRÚC DATA: EXT vs APP vs GOOGLE DRIVE

## 1. CẤU TRÚC EXT (Chrome Extension)

### DataRecord (mỗi record trong records[])
```json
{
  "id": "uuid-xxx",           // UUID duy nhất
  "moduleId": "mod_vang",     // ID module: mod_chitieu, mod_shopee, mod_vang, mod_nhatro, mod_creditcard, mod_ruou, mod_ruou_products, mod_ruou_customers, mod_ruou_inventory
  "categoryId": "cat_xxx",    // (optional) ID danh mục
  "values": {                  // Map key-value, key = {moduleId}_{fieldName}
    "mod_vang_type": "buy",
    "mod_vang_gold_type": "SJC",
    "mod_vang_quantity": 3,
    ...
  },
  "tags": [],
  "images": [],
  "isDeleted": false,
  "deletedAt": null,
  "createdAt": "2026-08-07T10:00:00.000Z",
  "updatedAt": "2026-08-07T10:00:00.000Z"
}
```

### Module Fields (values map keys)

#### mod_chitieu
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_chitieu_title | Tên giao dịch | string |
| mod_chitieu_amount | Số tiền | number |
| mod_chitieu_type | "0"=Chi, "1"=Thu | string |
| mod_chitieu_date | Ngày (YYYY-MM-DD) | string |
| mod_chitieu_account | Phương thức TT (cash/bank/momo/tpbank/vpbank/zalopay/credit_card/credit_card_{id}) | string |
| mod_chitieu_beneficiary | Người nhận (ba/me/vo/con/anh/chi/chong/banthan) | string |
| mod_chitieu_quantity | Số lượng | number |
| mod_chitieu_warranty_months | Tháng bảo hành | number |
| mod_chitieu_warranty_date | Ngày hết BH | string |
| mod_chitieu_note | Ghi chú | string |

#### mod_shopee
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_shopee_order_name | Tên đơn hàng | string |
| mod_shopee_amount | Số tiền | number |
| mod_shopee_date | Ngày đặt | string |
| mod_shopee_status | Trạng thái (ordered/shipping/received/returned) | string |
| mod_shopee_category | Phân loại (clothing/electronics/household/food/other) | string |
| mod_shopee_note | Ghi chú | string |

#### mod_vang
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_vang_type | Loại GD (buy/sell) | string |
| mod_vang_gold_type | Loại vàng (SJC/PNJ/9999) | string |
| mod_vang_quantity | Số lượng (chỉ) | number |
| mod_vang_price_per_unit | Giá/chỉ | number |
| mod_vang_total_amount | Tổng tiền | number |
| mod_vang_date | Ngày | string |
| mod_vang_note | Ghi chú | string |

#### mod_nhatro
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_nhatro_room_name | Phòng | string |
| mod_nhatro_tenant_name | Người thuê | string |
| mod_nhatro_month | Tháng (YYYY-MM-DD) | string |
| mod_nhatro_rent_amount | Tiền phòng | number |
| mod_nhatro_electricity | Tiền điện | number |
| mod_nhatro_water | Tiền nước | number |
| mod_nhatro_internet | Internet | number |
| mod_nhatro_total | Tổng | number |
| mod_nhatro_status | Trạng thái (unpaid/paid/late) | string |
| mod_nhatro_note | Ghi chú | string |

#### mod_creditcard (thẻ metadata, không phải giao dịch)
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_creditcard_card_name | Tên thẻ | string |
| mod_creditcard_bank_name | Ngân hàng | string |
| mod_creditcard_last4 | 4 số cuối | string |
| mod_creditcard_credit_limit | Hạn mức | number |
| mod_creditcard_statement_day | Ngày sao kê | number |
| mod_creditcard_payment_due_day | Ngày thanh toán | number |
| mod_creditcard_is_installment | Trả góp (0/1) | string |
| mod_creditcard_installment_months | Số tháng | number |
| mod_creditcard_installment_amount | Tiền/tháng | number |
| mod_creditcard_installment_remaining | Còn lại | number |
| mod_creditcard_note | Ghi chú | string |

#### mod_ruou (đơn hàng rượu)
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_ruou_order_date | Ngày đặt | string |
| mod_ruou_customer_name | Khách hàng | string |
| mod_ruou_customer_phone | SĐT | string |
| mod_ruou_customer_address | Địa chỉ | string |
| mod_ruou_customer_district | Quận/Huyện | string |
| mod_ruou_customer_city | Tỉnh/TP | string |
| mod_ruou_product_sku | Mã SP | string |
| mod_ruou_product_name | Tên SP | string |
| mod_ruou_color | Màu | string |
| mod_ruou_quantity | SL | number |
| mod_ruou_price | Đơn giá | number |
| mod_ruou_glasses | Ly | number |
| mod_ruou_boxes | Hộp | number |
| mod_ruou_ship_fee | Phí ship | number |
| mod_ruou_total_amount | Tổng tiền | number |
| mod_ruou_product_lines | JSON array (multi-product) | string |
| mod_ruou_note1 | Ghi chú 1 | string |
| mod_ruou_note2 | Ghi chú 2 | string |

#### mod_ruou_products (sản phẩm rượu)
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_ruou_products_product_name | Tên SP | string |
| mod_ruou_products_sku | Mã SKU | string |
| mod_ruou_products_short_name | Viết tắt | string |
| mod_ruou_products_volume_ml | Dung tích (ml) | number |
| mod_ruou_products_wine_type | Loại rượu (gao/nep/dauxanh/vangnep/dtht/gao loai 2) | string |
| mod_ruou_products_bottle_type | Loại chai (pet/su/thuytinh) | string |
| mod_ruou_products_note | Ghi chú | string |

#### mod_ruou_customers (khách hàng rượu)
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_ruou_customers_full_name | Họ tên | string |
| mod_ruou_customers_phone | SĐT | string |
| mod_ruou_customers_address | Địa chỉ | string |
| mod_ruou_customers_district | Quận/Huyện | string |
| mod_ruou_customers_city | Tỉnh/TP | string |
| mod_ruou_customers_total_orders | Tổng đơn | number |
| mod_ruou_customers_last_order_date | Đơn cuối | string |
| mod_ruou_customers_note | Ghi chú | string |

#### mod_ruou_inventory (tồn kho)
| Key | Ý nghĩa | Type |
|-----|----------|------|
| mod_ruou_inventory_sku | SKU | string |
| mod_ruou_inventory_product_name | Sản phẩm | string |
| mod_ruou_inventory_color | Màu | string |
| mod_ruou_inventory_wine_type | Loại rượu | string |
| mod_ruou_inventory_bottle_type | Loại chai | string |
| mod_ruou_inventory_stock | Tồn kho | number |

---

## 2. CẤU TRÚC APP (Flutter SQLite)

### Bảng `transactions` (dùng cho Chi tiêu, Shopee, Vàng, Nhà trọ)
| Column | Type | Nullable | Mô tả |
|--------|------|----------|--------|
| id | TEXT PK | NO | UUID |
| type | INTEGER | NO | 0=Chi, 1=Thu |
| amount | REAL | NO | Số tiền |
| title | TEXT | NO | Tên giao dịch |
| note | TEXT | YES | Ghi chú |
| category_id | TEXT FK→categories | YES | ID danh mục |
| account_id | TEXT FK→accounts | YES | ID tài khoản |
| **module_id** | TEXT FK→modules | YES | **mod_chitieu / mod_shopee / mod_vang / mod_nhatro** |
| date | TEXT | NO | Ngày (YYYY-MM-DD) |
| tags | TEXT | YES | Comma-separated |
| images | TEXT | YES | Comma-separated |
| is_deleted | INTEGER | DEFAULT 0 | 0=active, 1=deleted |
| deleted_at | TEXT | YES | Timestamp xóa |
| sync_status | TEXT | DEFAULT 'synced' | |
| device_id | TEXT | YES | |
| created_at | TEXT | NO | ISO timestamp |
| updated_at | TEXT | NO | ISO timestamp |
| beneficiary | TEXT | YES | Người nhận (text) |
| quantity | INTEGER | DEFAULT 1 | Số lượng |
| warranty_months | INTEGER | YES | Tháng BH |
| warranty_date | TEXT | YES | Ngày hết BH |
| event | TEXT | YES | Sự kiện |
| store | TEXT | YES | Cửa hàng |

### Bảng `credit_cards`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| bank_name | TEXT | YES |
| last4 | TEXT | YES |
| credit_limit | REAL | DEFAULT 0 |
| statement_day | INTEGER | DEFAULT 20 |
| payment_due_days | INTEGER | DEFAULT 10 |
| alert_days | INTEGER | DEFAULT 3 |
| note | TEXT | YES |
| is_active | INTEGER | DEFAULT 1 |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `wine_customers`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| phone | TEXT | YES |
| address | TEXT | YES |
| district | TEXT | YES |
| city | TEXT | YES |
| note | TEXT | YES |
| total_orders | INTEGER | DEFAULT 0 |
| last_order_date | TEXT | YES |
| is_active | INTEGER | DEFAULT 1 |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `wine_products`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| sku | TEXT | NO |
| name | TEXT | NO |
| short_name | TEXT | YES |
| volume_ml | INTEGER | YES |
| wine_type | TEXT | YES |
| bottle_type | TEXT | YES |
| images | TEXT | YES |
| note | TEXT | YES |
| is_active | INTEGER | DEFAULT 1 |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `wine_sales_orders`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| date | TEXT | NO |
| customer_id | TEXT FK | YES |
| customer_name | TEXT | YES |
| customer_phone | TEXT | YES |
| customer_address | TEXT | YES |
| customer_district | TEXT | YES |
| customer_city | TEXT | YES |
| shipping_fee | REAL | DEFAULT 0 |
| total_amount | REAL | DEFAULT 0 |
| note1 | TEXT | YES |
| note2 | TEXT | YES |
| images | TEXT | YES |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `wine_sales_order_items`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| sales_order_id | TEXT FK | NO |
| product_variant_id | TEXT FK | NO |
| quantity | INTEGER | DEFAULT 0 |
| price | REAL | DEFAULT 0 |
| has_glass | INTEGER | DEFAULT 0 |
| has_box | INTEGER | DEFAULT 0 |
| note | TEXT | YES |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |

### Bảng `wine_stock_in`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| date | TEXT | NO |
| note | TEXT | YES |
| images | TEXT | YES |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `wine_stock_in_items`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| stock_in_id | TEXT FK | NO |
| product_variant_id | TEXT FK | NO |
| quantity | INTEGER | DEFAULT 0 |
| remaining_quantity | INTEGER | DEFAULT 0 |
| note | TEXT | YES |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |

### Bảng `gold_transactions` (bảng riêng, KHÔNG dùng cho sync)
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| type | TEXT | NO (buy/sell) |
| gold_type | TEXT | NO (SJC/PNJ/9999) |
| unit | TEXT | NO (chi/luong/gram) |
| quantity | REAL | NO |
| price_per_unit | REAL | NO |
| total_amount | REAL | NO |
| date | TEXT | NO |
| note | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `rental_rooms`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| rent_amount | REAL | DEFAULT 0 |
| note | TEXT | YES |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `rental_monthly_bills`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| room_id | TEXT FK | NO |
| tenant_id | TEXT FK | YES |
| year | INTEGER | NO |
| month | INTEGER | NO |
| rent_amount | REAL | DEFAULT 0 |
| electricity_old | INTEGER | DEFAULT 0 |
| electricity_new | INTEGER | DEFAULT 0 |
| electricity_price | REAL | DEFAULT 3500 |
| electricity_amount | REAL | DEFAULT 0 |
| water_amount | REAL | DEFAULT 0 |
| internet_amount | REAL | DEFAULT 0 |
| other_amount | REAL | DEFAULT 0 |
| other_note | TEXT | YES |
| total_amount | REAL | DEFAULT 0 |
| payment_status | TEXT | DEFAULT 'unpaid' |
| paid_date | TEXT | YES |
| note | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `accounts`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| icon | TEXT | DEFAULT 'wallet' |
| color | TEXT | DEFAULT '#2196F3' |
| initial_balance | REAL | DEFAULT 0 |
| current_balance | REAL | DEFAULT 0 |
| include_in_total | INTEGER | DEFAULT 1 |
| is_active | INTEGER | DEFAULT 1 |
| sort_order | INTEGER | DEFAULT 0 |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `categories`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| icon | TEXT | DEFAULT 'other' |
| color | TEXT | DEFAULT '#2196F3' |
| parent_id | TEXT FK (self) | YES |
| type | INTEGER | NO (0=Chi, 1=Thu) |
| sort_order | INTEGER | DEFAULT 0 |
| is_active | INTEGER | DEFAULT 1 |
| sync_status | TEXT | DEFAULT 'synced' |
| device_id | TEXT | YES |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

### Bảng `modules`
| Column | Type | Nullable |
|--------|------|----------|
| id | TEXT PK | NO |
| name | TEXT | NO |
| icon | TEXT | DEFAULT 'other' |
| color | TEXT | DEFAULT '#2196F3' |
| sort_order | INTEGER | DEFAULT 0 |
| is_default | INTEGER | DEFAULT 0 |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NO |
| updated_at | TEXT | NO |

Default modules: mod_chitieu, mod_shopee, mod_vang, mod_nhatro, mod_ruou, mod_creditcard

---

## 3. IMPORT MAPPING (EXT → App: sync_mapper.dart)

### Route records theo moduleId:
| EXT moduleId | App destination | Method |
|--------------|-----------------|--------|
| mod_chitieu | `transactions` (module_id='mod_chitieu') | _importTransaction |
| mod_shopee | `transactions` (module_id='mod_shopee') | _importTransaction |
| mod_vang | `transactions` (module_id='mod_vang') | _importTransaction |
| mod_nhatro | `transactions` (module_id='mod_nhatro') | _importTransaction |
| mod_creditcard | `credit_cards` | _importCreditCard |
| mod_ruou | `wine_sales_orders` + `wine_sales_order_items` | _importWineOrder |
| mod_ruou_products | `wine_products` | _importWineProduct |
| mod_ruou_customers | `wine_customers` | _importWineCustomer |
| mod_ruou_inventory | `wine_stock_in` + `wine_stock_in_items` | _importInventorySnapshots |

### _importTransaction field mapping:
| EXT values key | App transactions column | Ghi chú |
|----------------|------------------------|---------|
| {prefix}title / (tổng hợp) | title | mod_vang tổng hợp từ type+gold_type+qty |
| {prefix}amount / total_amount | amount | |
| {prefix}type | type (0/1) | |
| {prefix}date | date | |
| {prefix}note | note | |
| {prefix}account | account_id | Qua _mapAccountValue() |
| rec.categoryId | category_id | |
| rec.moduleId | **module_id** | **PHẢI = moduleId gốc từ EXT** |
| {prefix}beneficiary | beneficiary | |
| {prefix}quantity | quantity | |
| {prefix}warranty_months | warranty_months | |
| {prefix}warranty_date | warranty_date | |

---

## 4. EXPORT MAPPING (App → EXT: sync_exporter.dart)

### _exportTransactions:
| App transactions column | EXT values key | Ghi chú |
|-------------------------|----------------|---------|
| title | {moduleId}_title | moduleId từ module_id column |
| amount | {moduleId}_amount | |
| type | {moduleId}_type | "0" hoặc "1" |
| date | {moduleId}_date | |
| note | {moduleId}_note | |
| account_id | {moduleId}_account | Qua _reverseMapAccount() |
| beneficiary | {moduleId}_beneficiary | |
| quantity | {moduleId}_quantity | |
| warranty_months | {moduleId}_warranty_months | |
| warranty_date | {moduleId}_warranty_date | |

**⚠️ VẤN ĐỀ EXPORT cho mod_vang:**
- Khi import: App lấy `mod_vang_gold_type`, `mod_vang_quantity`, `mod_vang_price_per_unit` → tổng hợp thành `title` = "Mua SJC 3chỉ", `amount` = tổng tiền
- Khi export: App tạo `mod_vang_title` = "Mua SJC 3chỉ", `mod_vang_amount` = tổng tiền
- **NHƯNG EXT không có field `mod_vang_title`!** EXT có `mod_vang_gold_type`, `mod_vang_quantity`, `mod_vang_price_per_unit`
- → Sau sync lần 2, EXT merge nhận được record có `mod_vang_title` thay vì original fields

**⚠️ VẤN ĐỀ EXPORT cho mod_nhatro:**
- Tương tự: App tổng hợp thành `title` = "Phòng 1 - Nguyễn Văn A", `amount` = tổng
- EXT mong đợi `mod_nhatro_room_name`, `mod_nhatro_tenant_name`, `mod_nhatro_electricity`, etc.
- → Fields chi tiết bị mất sau round-trip

---

## 5. LỖI ĐÃ BIẾT

| # | Mô tả | Nguyên nhân |
|---|--------|-------------|
| 1 | Module Vàng/Shopee/Nhà trọ chuyển thành Chi tiêu | Cần xác nhận: module_id trong DB có đúng không? |
| 2 | Fields chi tiết Vàng bị mất (gold_type, qty, price) | App chỉ lưu title+amount, không lưu original values |
| 3 | Fields chi tiết Nhà trọ bị mất (điện, nước, internet) | App chỉ lưu title+amount |
| 4 | Export ngược lại tạo key sai (mod_vang_title thay vì mod_vang_gold_type) | sync_exporter dùng generic mapping cho mọi module |
| 5 | wine_customers UNIQUE crash (sync lần 2) | ĐÃ FIX - UPSERT |
| 6 | wine_sales_orders UNIQUE crash (sync lần 2) | ĐÃ FIX - UPSERT |
| 7 | Inventory duplicate | ĐÃ FIX - dedup check |
| 8 | wine_stock_in.updated_at NULL | ĐÃ FIX |
| 9 | FOREIGN KEY missing categories | ĐÃ FIX - auto-create |

---

## 6. UI QUERY (OPTION B)

| Module | Screen | Query |
|--------|--------|-------|
| Chi tiêu | ExpenseScreen | TransactionRepository (ALL) |
| Shopee | ShopeeHomeScreen | TransactionProvider.search(moduleId: 'mod_shopee') |
| Vàng | GoldHomeScreen | TransactionProvider.search(moduleId: 'mod_vang') |
| Nhà trọ | RentalHomeScreen | TransactionProvider.search(moduleId: 'mod_nhatro') |
| Thẻ TD | CreditCardScreen | credit_cards table + transactions WHERE account_id = 'acc_cc_{id}' |
| Rượu | WineOrderListScreen | wine_sales_orders via WineStockProvider |
