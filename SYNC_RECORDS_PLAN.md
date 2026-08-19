# BÁO CÁO TRƯỚC KHI CODE: sync_records Architecture

## A. Schema sync_records

```sql
CREATE TABLE sync_records (
  id TEXT PRIMARY KEY,              -- UUID (giữ nguyên từ EXT)
  module_id TEXT NOT NULL,          -- mod_chitieu, mod_shopee, mod_vang, mod_nhatro, mod_creditcard, mod_ruou, mod_ruou_products, mod_ruou_customers, mod_ruou_inventory
  category_id TEXT,                 -- Reference to category (nullable)
  values_json TEXT NOT NULL,        -- JSON string: {"mod_vang_type":"buy","mod_vang_gold_type":"SJC",...}
  tags_json TEXT,                   -- JSON array: ["tag1","tag2"]
  images_json TEXT,                 -- JSON array: ["img_id1","img_id2"]
  is_deleted INTEGER DEFAULT 0,    -- 0=active, 1=deleted
  deleted_at TEXT,                  -- ISO timestamp khi xóa
  created_at TEXT NOT NULL,         -- ISO timestamp, set 1 lần
  updated_at TEXT NOT NULL          -- ISO timestamp, chỉ đổi khi DATA thay đổi
);

CREATE INDEX idx_sync_records_module ON sync_records (module_id);
CREATE INDEX idx_sync_records_deleted ON sync_records (is_deleted);
CREATE INDEX idx_sync_records_updated ON sync_records (updated_at);
```

---

## B. Mapping transactions → DataRecord.values

Khi migrate record cũ từ bảng `transactions` sang `sync_records`:

| transactions column | DataRecord field | values key (dùng module_id làm prefix) |
|--------------------|-----------------|----------------------------------------|
| id | id | — |
| module_id | module_id | — |
| category_id | category_id | — |
| title | — | `{module_id}_title` |
| amount | — | `{module_id}_amount` |
| type | — | `{module_id}_type` (toString: "0" hoặc "1") |
| date | — | `{module_id}_date` |
| note | — | `{module_id}_note` |
| account_id | — | `{module_id}_account` (reverse map: acc_cash→cash, acc_bank→bank, acc_cc_X→credit_card_X) |
| beneficiary | — | `{module_id}_beneficiary` |
| quantity | — | `{module_id}_quantity` (chỉ nếu != 1) |
| warranty_months | — | `{module_id}_warranty_months` |
| warranty_date | — | `{module_id}_warranty_date` |
| tags | tags_json | — (split comma → JSON array) |
| images | images_json | — (split comma → JSON array) |
| is_deleted | is_deleted | — |
| deleted_at | deleted_at | — |
| created_at | created_at | — |
| updated_at | updated_at | — |

**Lưu ý quan trọng**: Record với `module_id = 'mod_vang'` mà đã bị flatten (chỉ có title+amount) → migrate AS-IS với `mod_vang_title` + `mod_vang_amount`. KHÔNG đoán gold_type/quantity. Đây là legacy data.

---

## C. Mapping từng module

### mod_chitieu (Chi tiêu)
| EXT field | values key | Ghi chú |
|-----------|-----------|---------|
| title | mod_chitieu_title | ✅ App có (title column) |
| amount | mod_chitieu_amount | ✅ App có (amount column) |
| type | mod_chitieu_type | ✅ App có (type column, "0"/"1") |
| date | mod_chitieu_date | ✅ App có (date column) |
| account | mod_chitieu_account | ✅ App có (account_id → reverse map) |
| beneficiary | mod_chitieu_beneficiary | ✅ App có (beneficiary column) |
| quantity | mod_chitieu_quantity | ✅ App có |
| warranty_months | mod_chitieu_warranty_months | ✅ App có |
| warranty_date | mod_chitieu_warranty_date | ✅ App có |
| note | mod_chitieu_note | ✅ App có |
| tags | record.tags | ✅ App có (tags column) |
| images | record.images | ✅ App có (images column) |

### mod_shopee
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| order_name | mod_shopee_order_name | ⚠️ Map vào title |
| amount | mod_shopee_amount | ✅ amount |
| date | mod_shopee_date | ✅ date |
| status | mod_shopee_status | ❌ KHÔNG có column riêng — MẤT khi flatten |
| category | mod_shopee_category | ❌ KHÔNG map — dùng category_id nhưng khác semantic |
| note | mod_shopee_note | ✅ note |

### mod_vang
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| type | mod_vang_type | ❌ MẤT (flatten thành title text) |
| gold_type | mod_vang_gold_type | ❌ MẤT |
| quantity | mod_vang_quantity | ❌ MẤT |
| price_per_unit | mod_vang_price_per_unit | ❌ MẤT |
| total_amount | mod_vang_total_amount | ⚠️ Map vào amount |
| date | mod_vang_date | ✅ date |
| note | mod_vang_note | ✅ note |

### mod_nhatro
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| room_name | mod_nhatro_room_name | ❌ MẤT (flatten thành title) |
| tenant_name | mod_nhatro_tenant_name | ❌ MẤT |
| month | mod_nhatro_month | ⚠️ Map vào date |
| rent_amount | mod_nhatro_rent_amount | ❌ MẤT |
| electricity | mod_nhatro_electricity | ❌ MẤT |
| water | mod_nhatro_water | ❌ MẤT |
| internet | mod_nhatro_internet | ❌ MẤT |
| total | mod_nhatro_total | ⚠️ Map vào amount |
| status | mod_nhatro_status | ❌ MẤT |
| note | mod_nhatro_note | ✅ note |

### mod_creditcard
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| card_name | mod_creditcard_card_name | ✅ credit_cards.name |
| bank_name | mod_creditcard_bank_name | ✅ credit_cards.bank_name |
| last4 | mod_creditcard_last4 | ✅ credit_cards.last4 |
| credit_limit | mod_creditcard_credit_limit | ✅ credit_cards.credit_limit |
| statement_day | mod_creditcard_statement_day | ✅ credit_cards.statement_day |
| payment_due_day | mod_creditcard_payment_due_day | ✅ credit_cards.payment_due_days |
| is_installment | mod_creditcard_is_installment | ❌ KHÔNG có column |
| installment_months | mod_creditcard_installment_months | ❌ KHÔNG có column |
| installment_amount | mod_creditcard_installment_amount | ❌ KHÔNG có column |
| installment_start_date | mod_creditcard_installment_start_date | ❌ KHÔNG có column |
| installment_remaining | mod_creditcard_installment_remaining | ❌ KHÔNG có column |
| note | mod_creditcard_note | ✅ credit_cards.note |

### mod_ruou (đơn hàng)
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| order_date | mod_ruou_order_date | ✅ wine_sales_orders.date |
| customer_name | mod_ruou_customer_name | ✅ wine_sales_orders.customer_name |
| customer_phone | mod_ruou_customer_phone | ✅ |
| customer_address | mod_ruou_customer_address | ✅ |
| customer_district | mod_ruou_customer_district | ✅ |
| customer_city | mod_ruou_customer_city | ✅ |
| product_sku | mod_ruou_product_sku | ✅ (via order items) |
| product_name | mod_ruou_product_name | ✅ |
| color | mod_ruou_color | ✅ |
| quantity | mod_ruou_quantity | ✅ |
| price | mod_ruou_price | ✅ |
| glasses | mod_ruou_glasses | ✅ |
| boxes | mod_ruou_boxes | ✅ |
| ship_fee | mod_ruou_ship_fee | ✅ wine_sales_orders.shipping_fee |
| total_amount | mod_ruou_total_amount | ✅ wine_sales_orders.total_amount |
| product_lines | mod_ruou_product_lines | ✅ (denormalized → order items) |
| note1 | mod_ruou_note1 | ✅ wine_sales_orders.note1 |
| note2 | mod_ruou_note2 | ✅ wine_sales_orders.note2 |
| images | record.images | ✅ wine_sales_orders.images |

### mod_ruou_products
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| product_name | mod_ruou_products_product_name | ✅ wine_products.name |
| sku | mod_ruou_products_sku | ✅ wine_products.sku |
| short_name | mod_ruou_products_short_name | ✅ wine_products.short_name |
| volume_ml | mod_ruou_products_volume_ml | ✅ wine_products.volume_ml |
| wine_type | mod_ruou_products_wine_type | ✅ wine_products.wine_type |
| bottle_type | mod_ruou_products_bottle_type | ✅ wine_products.bottle_type |
| note | mod_ruou_products_note | ✅ wine_products.note |

### mod_ruou_customers
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| full_name | mod_ruou_customers_full_name | ✅ wine_customers.name |
| phone | mod_ruou_customers_phone | ✅ |
| address | mod_ruou_customers_address | ✅ |
| district | mod_ruou_customers_district | ✅ |
| city | mod_ruou_customers_city | ✅ |
| total_orders | mod_ruou_customers_total_orders | ✅ |
| last_order_date | mod_ruou_customers_last_order_date | ✅ |
| note | mod_ruou_customers_note | ✅ wine_customers.note |

### mod_ruou_inventory
| EXT field | values key | App hiện tại |
|-----------|-----------|--------------|
| sku | mod_ruou_inventory_sku | ✅ (via variant lookup) |
| product_name | mod_ruou_inventory_product_name | ✅ |
| color | mod_ruou_inventory_color | ✅ |
| wine_type | mod_ruou_inventory_wine_type | ✅ |
| bottle_type | mod_ruou_inventory_bottle_type | ✅ |
| stock | mod_ruou_inventory_stock | ✅ |

---

## D. Migration Strategy

### Phase 1: Tạo sync_records table (DB version 9)
1. CREATE TABLE sync_records
2. KHÔNG xóa bảng transactions
3. KHÔNG thay đổi UI

### Phase 2: Migrate data cũ → sync_records
1. Đọc TẤT CẢ records từ `transactions`
2. Với mỗi record: tạo values_json dựa trên module_id prefix
3. INSERT vào sync_records
4. Đọc TẤT CẢ records từ `wine_sales_orders` → tạo sync_records (mod_ruou)
5. Đọc TẤT CẢ records từ `wine_products` → tạo sync_records (mod_ruou_products)
6. Đọc TẤT CẢ records từ `wine_customers` → tạo sync_records (mod_ruou_customers)
7. Đọc TẤT CẢ records từ `credit_cards` → tạo sync_records (mod_creditcard)

### Phase 3: Đổi Sync import/export
1. `SyncMapper.importFromJson()` → INSERT/UPSERT vào sync_records (giữ nguyên values)
2. `SyncExporter.exportToJson()` → đọc từ sync_records, output DataRecord JSON
3. Giữ domain table updates (wine_*, credit_cards) SAU khi sync_records đã lưu

### Phase 4: Test round-trip
1. EXT tạo record → sync → App sync_records có đúng
2. App export → EXT nhận đúng
3. Sync lần 2: không duplicate, không mất field

### Phase 5: (Tương lai) Đổi UI
- Module screens đọc từ sync_records thay vì transactions
- Hoặc giữ domain tables như cache, populate từ sync_records

---

## E. Fields EXT có mà App hiện THIẾU (trong bảng typed)

| Module | Field | Ghi chú |
|--------|-------|---------|
| mod_shopee | status | Trạng thái đơn hàng |
| mod_shopee | category | Phân loại đơn |
| mod_vang | type (buy/sell) | Mất khi flatten |
| mod_vang | gold_type | Mất khi flatten |
| mod_vang | quantity | Mất khi flatten |
| mod_vang | price_per_unit | Mất khi flatten |
| mod_nhatro | room_name | Mất khi flatten |
| mod_nhatro | tenant_name | Mất khi flatten |
| mod_nhatro | electricity | Mất khi flatten |
| mod_nhatro | water | Mất khi flatten |
| mod_nhatro | internet | Mất khi flatten |
| mod_nhatro | status | Mất khi flatten |
| mod_creditcard | is_installment | Không có column |
| mod_creditcard | installment_months | Không có column |
| mod_creditcard | installment_amount | Không có column |
| mod_creditcard | installment_start_date | Không có column |
| mod_creditcard | installment_remaining | Không có column |

**Với sync_records approach**: TẤT CẢ fields trên sẽ được giữ nguyên trong `values_json`. Không cần tạo column riêng.

---

## F. Fields App có mà EXT chưa có

| Module | App field | Ở đâu | Đề xuất |
|--------|-----------|-------|---------|
| Chi tiêu | event | transactions.event | Thêm mod_chitieu_event vào EXT nếu cần |
| Chi tiêu | store | transactions.store | Thêm mod_chitieu_store vào EXT nếu cần |
| Nhà trọ | electricity_old | rental_monthly_bills | Local-only (chi tiết điện) |
| Nhà trọ | electricity_new | rental_monthly_bills | Local-only |
| Nhà trọ | electricity_price | rental_monthly_bills | Local-only |
| Nhà trọ | other_amount | rental_monthly_bills | Local-only |
| Nhà trọ | paid_date | rental_monthly_bills | Thêm mod_nhatro_paid_date nếu cần sync |
| Vàng | unit (chi/lượng/gram) | gold_transactions.unit | Thêm mod_vang_unit vào EXT nếu cần |

**Quyết định**: Những fields local-only (điện old/new/price) KHÔNG cần sync. Fields cần sync (event, store, unit) → thêm vào EXT data contract.

---

## G. Cách migrate dữ liệu Wine

Wine domain tables GIỮU NGUYÊN. Thêm bước:

1. Đọc `wine_sales_orders` + items → tạo sync_records (mod_ruou) với values_json chứa đầy đủ mod_ruou_* fields
2. Đọc `wine_products` → tạo sync_records (mod_ruou_products)
3. Đọc `wine_customers` → tạo sync_records (mod_ruou_customers)
4. Inventory snapshot → tạo sync_records (mod_ruou_inventory) với stock hiện tại

Khi import từ EXT:
- Đầu tiên UPSERT vào sync_records (canonical)
- Sau đó populate wine domain tables từ sync_records data

Khi App tạo đơn hàng mới (local):
- Lưu vào wine domain tables (như hiện tại)
- ĐỒNG THỜI tạo sync_records entry tương ứng

---

## H. Cách migrate dữ liệu Vàng/Nhà trọ/Shopee

### Records từ bảng `transactions`:

```
Với mỗi record trong transactions WHERE module_id IN ('mod_vang', 'mod_nhatro', 'mod_shopee'):

1. Tạo values_json:
   - mod_vang: { "mod_vang_title": title, "mod_vang_amount": amount, "mod_vang_type": (type==1?"sell":"buy"), "mod_vang_date": date, "mod_vang_note": note }
   - mod_nhatro: { "mod_nhatro_title": title, "mod_nhatro_total": amount, "mod_nhatro_month": date, "mod_nhatro_note": note }
   - mod_shopee: { "mod_shopee_order_name": title, "mod_shopee_amount": amount, "mod_shopee_date": date, "mod_shopee_note": note }

2. INSERT INTO sync_records
```

**Đây là legacy data** — sẽ thiếu fields chi tiết (gold_type, room_name, etc.) vì đã bị flatten trước đó.

---

## I. Cách recover record cũ bị flatten

**Chiến lược**: Khi user nhấn "Đồng bộ ngay":
1. Download Google Drive finance.json
2. Finance.json có DataRecords NGUYÊN GỐC từ EXT (với đầy đủ fields)
3. UPSERT vào sync_records bằng UUID + updatedAt comparison
4. Records gốc từ EXT (có đầy đủ mod_vang_gold_type, etc.) sẽ **GHI ĐÈ** bản legacy flatten (vì EXT updatedAt >= App updatedAt)

**Kết quả**: Sau lần sync đầu tiên với sync_records mới, dữ liệu sẽ được RECOVER từ Google Drive/EXT.

**Điều kiện**: Google Drive vẫn còn bản gốc EXT (chưa bị App ghi đè bằng bản flatten). Nếu App đã export bản flatten lên Drive → EXT đã merge → data gốc có thể đã bị thay đổi.

---

## J. Rollback Strategy

1. Bảng `transactions` KHÔNG bị xóa — vẫn có đầy đủ data cũ
2. Bảng wine domain tables KHÔNG bị sửa đổi
3. Nếu sync_records có vấn đề → đổi import/export trở lại dùng transactions (revert code)
4. sync_records có thể DROP mà không ảnh hưởng functionality hiện tại
5. UI tiếp tục đọc từ domain tables/transactions trong giai đoạn đầu

**Worst case**: DROP TABLE sync_records, revert code. App trở về trạng thái hiện tại.

---

## TỔNG KẾT

| Aspect | Decision |
|--------|----------|
| Canonical sync storage | sync_records (values_json giữ nguyên EXT format) |
| Import | EXT DataRecord → sync_records (nguyên) → domain tables (populate) |
| Export | sync_records → DataRecord JSON → Google Drive |
| transactions table | GIỮ (backup + UI hiện tại tiếp tục hoạt động) |
| Wine domain tables | GIỮ (sync_records ↔ domain tables 2 chiều) |
| gold_transactions | GIỮ (local-only, không sync) |
| rental tables | GIỮ (local-only, không sync) |
| Migration | 1 lần: transactions + domain → sync_records |
| UUID | Giữ nguyên mọi nơi |
| Round-trip | EXT → App → EXT: values_json không mất field |
| UI refactor | CHƯA — giai đoạn sau |
