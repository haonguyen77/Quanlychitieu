# SYNC DATA CONTRACT — App ↔ Google Drive ↔ EXT

Version: 1.0.0
Last Updated: 2026-08-16

## 1. Architecture

```
EXT (Chrome Extension)
    ↕ finance.json (Google Drive)
App (Flutter Mobile)
```

Both sides read/write the SAME `finance.json` file on Google Drive.
Merge strategy: UUID-based UPSERT with `updatedAt` comparison.

## 2. Google Drive JSON Format

```json
{
  "version": "1.0.0",
  "lastModified": "ISO-8601",
  "deviceId": "chrome_xxx | android_xxx",
  "settings": { ... },
  "modules": [ ModuleDefinition[] ],
  "accounts": [ Account[] ],
  "records": [ DataRecord[] ],
  "dashboard": [],
  "reports": [],
  "menu": [],
  "metadata": { "totalRecords": N, "createdAt": "..." },
  "recurringTransactions": [],
  "budgets": [],
  "activityLog": []
}
```

## 3. DataRecord (Universal Record Format)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | YES | Global unique identifier — NEVER changes |
| moduleId | string | YES | Module this record belongs to |
| categoryId | string | NO | Reference to category |
| values | object | YES | Key-value map: `{moduleId}_{fieldName}` → value |
| tags | string[] | NO | Tags array |
| images | string[] | NO | Image references |
| isDeleted | boolean | YES | Soft delete flag |
| deletedAt | string | NO | ISO timestamp when deleted |
| createdAt | string | YES | ISO timestamp — set once, never changes |
| updatedAt | string | YES | ISO timestamp — updates on edit only |

## 4. Module Routing (App Import)

| moduleId | App Table | Import Method |
|----------|-----------|---------------|
| mod_chitieu | transactions | UPSERT by UUID |
| mod_shopee | transactions | UPSERT by UUID |
| mod_vang | transactions | UPSERT by UUID |
| mod_nhatro | transactions | UPSERT by UUID |
| mod_creditcard | credit_cards | UPSERT by UUID |
| mod_ruou | wine_sales_orders + wine_sales_order_items | UPSERT by UUID |
| mod_ruou_products | wine_products | UPSERT by SKU |
| mod_ruou_customers | wine_customers | UPSERT by UUID |
| mod_ruou_inventory | wine_stock_in + wine_stock_in_items | INSERT once (dedup by note) |

## 5. Module Fields

### mod_chitieu
| Key | Description |
|-----|-------------|
| mod_chitieu_title | Tên giao dịch |
| mod_chitieu_amount | Số tiền |
| mod_chitieu_type | "0"=Chi, "1"=Thu |
| mod_chitieu_date | Ngày (YYYY-MM-DD) |
| mod_chitieu_account | Phương thức thanh toán (cash/bank/momo/...) |
| mod_chitieu_beneficiary | Người nhận |
| mod_chitieu_quantity | Số lượng |
| mod_chitieu_warranty_months | Tháng bảo hành |
| mod_chitieu_warranty_date | Ngày hết bảo hành |
| mod_chitieu_note | Ghi chú |

### mod_shopee
| Key | Description |
|-----|-------------|
| mod_shopee_order_name | Tên đơn hàng |
| mod_shopee_amount | Số tiền |
| mod_shopee_date | Ngày đặt |
| mod_shopee_status | Trạng thái (ordered/shipping/received/returned) |
| mod_shopee_category | Phân loại |
| mod_shopee_note | Ghi chú |

### mod_vang
| Key | Description |
|-----|-------------|
| mod_vang_type | Loại GD (buy/sell) |
| mod_vang_gold_type | Loại vàng (SJC/PNJ/9999) |
| mod_vang_quantity | Số lượng (chỉ) |
| mod_vang_price_per_unit | Giá/chỉ |
| mod_vang_total_amount | Tổng tiền |
| mod_vang_date | Ngày |
| mod_vang_note | Ghi chú |

### mod_nhatro
| Key | Description |
|-----|-------------|
| mod_nhatro_room_name | Phòng |
| mod_nhatro_tenant_name | Người thuê |
| mod_nhatro_month | Tháng |
| mod_nhatro_rent_amount | Tiền phòng |
| mod_nhatro_electricity | Tiền điện |
| mod_nhatro_water | Tiền nước |
| mod_nhatro_internet | Internet |
| mod_nhatro_total | Tổng |
| mod_nhatro_status | Trạng thái (unpaid/paid/late) |
| mod_nhatro_note | Ghi chú |

### mod_creditcard
| Key | Description |
|-----|-------------|
| mod_creditcard_card_name | Tên thẻ |
| mod_creditcard_bank_name | Ngân hàng |
| mod_creditcard_last4 | 4 số cuối |
| mod_creditcard_credit_limit | Hạn mức |
| mod_creditcard_statement_day | Ngày sao kê |
| mod_creditcard_payment_due_day | Ngày thanh toán |
| mod_creditcard_note | Ghi chú |

### mod_ruou (Wine Orders)
| Key | Description |
|-----|-------------|
| mod_ruou_order_date | Ngày đặt |
| mod_ruou_customer_name | Khách hàng |
| mod_ruou_customer_phone | SĐT |
| mod_ruou_customer_address | Địa chỉ |
| mod_ruou_customer_district | Quận/Huyện |
| mod_ruou_customer_city | Tỉnh/TP |
| mod_ruou_product_sku | Mã SP |
| mod_ruou_product_name | Tên SP |
| mod_ruou_color | Màu |
| mod_ruou_quantity | SL |
| mod_ruou_price | Đơn giá |
| mod_ruou_glasses | Ly |
| mod_ruou_boxes | Hộp |
| mod_ruou_ship_fee | Phí ship |
| mod_ruou_total_amount | Tổng tiền |
| mod_ruou_product_lines | JSON array (multi-product) |
| mod_ruou_note1 | Ghi chú 1 |
| mod_ruou_note2 | Ghi chú 2 |

### mod_ruou_products
| Key | Description |
|-----|-------------|
| mod_ruou_products_product_name | Tên sản phẩm |
| mod_ruou_products_sku | Mã SKU |
| mod_ruou_products_short_name | Viết tắt |
| mod_ruou_products_volume_ml | Dung tích (ml) |
| mod_ruou_products_wine_type | Loại rượu |
| mod_ruou_products_bottle_type | Loại chai |

### mod_ruou_customers
| Key | Description |
|-----|-------------|
| mod_ruou_customers_full_name | Họ tên |
| mod_ruou_customers_phone | SĐT |
| mod_ruou_customers_address | Địa chỉ |
| mod_ruou_customers_district | Quận/Huyện |
| mod_ruou_customers_city | Tỉnh/TP |
| mod_ruou_customers_total_orders | Tổng đơn |
| mod_ruou_customers_last_order_date | Đơn cuối |

## 6. Sync Rules

### UUID
- UUID is the global identity of a record
- NEVER generate a new UUID for existing data
- UUID must be preserved through: export → upload → download → import → re-export

### UPSERT Logic
```
IF record UUID exists locally:
  IF remote updatedAt > local updatedAt:
    UPDATE local with remote data
  ELSE:
    KEEP local (local is newer)
ELSE:
  INSERT new record
```

### Soft Delete
- `isDeleted: true` means record is deleted
- Deleted records MUST be synced (propagate deletion to other side)
- App exports records with `is_deleted = 1` so EXT knows about deletions
- EXT exports records with `isDeleted: true` so App soft-deletes locally

### Safety Check
- If merged data has < 50% of remote records → ABORT upload
- If remote is empty but local has data → DO NOT delete local
- If sync error → DO NOT modify local database

### Timestamps
- `createdAt`: Set once when record is first created. NEVER changes.
- `updatedAt`: Changes ONLY when record data is actually modified by user.
- Import/sync does NOT change `updatedAt` (preserves original timestamp).

## 7. Accounts

| Field | Type | Required |
|-------|------|----------|
| id | string | YES |
| name | string | YES |
| icon | string | YES |
| color | string | YES |
| initialBalance | number | YES |
| currentBalance | number | YES |
| includeInTotal | boolean | YES |
| isActive | boolean | YES |
| sortOrder | number | YES |
| createdAt | string | YES |
| updatedAt | string | YES |

Account value mapping (EXT → App):
- `cash` → `acc_cash`
- `bank` → `acc_bank`
- `momo` → `acc_momo`
- `tpbank` → `acc_tpbank`
- `vpbank` → `acc_vpbank`
- `zalopay` → `acc_zalopay`
- `credit_card` → `acc_credit`
- `credit_card_{cardId}` → `acc_cc_{cardId}`

## 8. Categories

Stored under `modules[].categories[]` in Google Drive JSON.
Each category has: id, moduleId, name, icon, color, sortOrder, isActive, createdAt, updatedAt.

## 9. What App Does NOT Manage

These fields in finance.json are EXT-managed:
- settings
- dashboard
- reports
- menu
- metadata

App preserves them during merge (takes from remote).

## 10. Changelog Requirements

Any change to this data contract MUST:
1. Be documented here with version bump
2. Be approved by user before implementation
3. Maintain backward compatibility with existing data
4. Include migration plan for existing records
