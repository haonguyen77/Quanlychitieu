# Change Log

## v1.6.0 - 2026-08-16

### CRITICAL — Sync Schema Audit & Fix
- **App: _importWineCustomer UPSERT** — thay INSERT bằng UPSERT by UUID (fix UNIQUE constraint crash lần sync thứ 2)
- **App: _importWineOrder UPSERT** — thay INSERT bằng UPSERT by UUID (fix UNIQUE constraint crash lần sync thứ 2)
- **App: _importInventorySnapshots dedup** — check nếu đã import tồn kho EXT trước đó → skip (fix duplicate stock counts)
- **App: Auto-create FK references** — nếu category_id/account_id/module_id từ EXT chưa tồn tại local → tự tạo placeholder (fix FOREIGN KEY constraint)
- **App: wine_stock_in.updated_at** — thêm field bị thiếu trong INSERT (fix NOT NULL constraint)
- **Confirmed: Option B architecture** — Tất cả module (Chi tiêu, Shopee, Vàng, Nhà trọ) đọc từ bảng `transactions` filter theo `module_id`
- **Created: SYNC_DATA_CONTRACT.md** — tài liệu chuẩn cho data contract giữa App ↔ EXT ↔ Google Drive

### App — Settings Redesign
- Màn hình Cài đặt redesign (6 nhóm card: Dữ liệu, Module, Đồng bộ, Thông báo, Import/Export, Bảo mật)
- BeneficiariesScreen (Quản lý Người nhận): CRUD + search + toggle active
- ModuleProvider.toggleModule(id) convenience method
- Module OFF giữ nguyên trong Settings toggle, chỉ ẩn khỏi navigation
- Google Drive screen: phân biệt Đồng bộ (fullSync 2 chiều) vs Sao lưu (backup DB)
- Tự động khóa: thêm option 30 giây

### EXT
- Wine money suggest: thống nhất logic với Chi tiêu (1 digit ×10000, 2+ ×1000)
- Quản lý danh mục: cho phép sửa cả Mã và Tên (Màu sắc, Loại rượu, Loại chai)
- SKU products: thay toàn bộ 31 SKU cũ bằng 51 SKU mới + thêm loại "Gạo loại 2"

## v1.5.0 - 2026-08-15

### EXT
- **Wine money suggest**: thống nhất logic với Chi tiêu (1 chữ số ×10000, 2+ chữ số ×1000)

### App
- **Auto-refresh**: màn hình chi tiêu tự reload sau khi thêm/sửa giao dịch từ nút "+" (HomeScreen FAB)
- **Module icons**: hiển thị icon module (giỏ hàng/kim cương/nhà/thẻ tín dụng) thay vì tag text trên màn hình chi tiêu
- **Tổng tiền**: đổi màu từ xanh → đỏ trên group theo ngày
- **Credit card sync**: 
  - `_importCreditCard` dùng UPSERT by UUID (không còn lỗi duplicate)
  - Tự tạo account `acc_cc_{cardId}` khi import thẻ → giao dịch thẻ hiển thị đúng
  - `_mapAccountValue`: hỗ trợ `credit_card_{id}` → `acc_cc_{id}` (EXT→App)
  - `_reverseMapAccount`: hỗ trợ `acc_cc_{id}` → `credit_card_{id}` (App→EXT)
- **Payment methods/categories sync**: đã hoạt động qua UPSERT (`_upsertAccount`, `_upsertCategory`)

## v1.4.0 - 2026-08-15

### CRITICAL — Sync Engine Rewrite (UUID-based)
- **App: BỎ CLEAR ALL + reimport** → thay bằng UPSERT by UUID
  - UUID chưa tồn tại → INSERT mới
  - UUID đã tồn tại + remote mới hơn → UPDATE
  - UUID đã tồn tại + local mới hơn → giữ nguyên (không ghi đè)
  - isDeleted=true → soft delete local
- **App: Export bao gồm deleted records** (isDeleted=true) để propagate delete sang EXT
- **EXT: Bỏ setData() cleanup** — không tự ý sửa/xóa data khi set
- **Safety check**: không upload nếu merged < 50% remote records

### Removed
- Giao diện Sáng/Tối toggle (bỏ khỏi Cài đặt)

## v1.3.2 - 2026-08-15

### Added
- Requirements Log (`docs/requirements-log.md`) - lưu tất cả yêu cầu đã xác nhận, kiểm tra xung đột trước khi code
- Cài đặt → Quản lý Module: toggle ON/OFF cho workspace Chi tiêu và Rượu
- OFF = ẩn module khỏi navigation, dữ liệu giữ nguyên
- Import Excel đơn hàng Rượu: nhiều dòng cùng Ngày+KH → gộp thành 1 đơn với product_lines
- Import Excel tự thêm khách hàng (check SĐT trùng)

### Changed
- Rượu Export Excel: đơn hàng nhiều sản phẩm → export ĐẦY ĐỦ (1 row per product line)
- Rượu Google Drive: dùng CHUNG service/component với Chi tiêu (fullSync, login persist, hiển thị giống hệt)

### Fixed
- Export đơn hàng Rượu chỉ lấy sản phẩm đầu tiên → giờ lấy tất cả từ product_lines JSON

## v1.3.1 - 2026-08-15

### Added
- Quản lý → Fields: nút **T** (Thu gọn) cho phép chọn cột nào hiển thị khi Thu gọn
- Cấu hình Thu gọn lưu theo module (không còn hardcode)
- Rượu: Import Excel (.xlsx) với kết quả chi tiết từng dòng:
  - 100% thành công → hiện thông báo
  - Có lỗi → tự động download file `Import_Result_YYYY-MM-DD.xlsx` với 2 cột thêm: Import Status + Import Error
  - Mỗi dòng lỗi ghi rõ nguyên nhân (thiếu SKU, số lượng sai format, v.v.)
- Rượu: Quản lý danh mục (Màu sắc / Loại rượu / Loại chai) - thêm nút Sửa inline

### Changed
- Thẻ tín dụng: "Thêm mới" mở form GIỐNG HỆT Chi tiêu (module mod_chitieu), Tài khoản mặc định = thẻ đang chọn
- Thẻ tín dụng: "Thêm thẻ" / "Sửa thẻ" → mở CardFormDialog (chỉ: Tên thẻ, Ngân hàng, 4 số cuối, Hạn mức, Ngày sao kê, Ngày thanh toán, Ghi chú)
- Group mode: giữ cột Ngày trong header nhưng ẩn giá trị ngày trong rows (ngày đã hiện ở group header)
- Thu gọn: thêm cột Tài khoản
- Danh mục dùng chung: thêm nút Sửa (inline edit) cho Tài khoản/Danh mục/Người nhận
- Sync Google Drive hiển thị số giao dịch sau khi đồng bộ

### Fixed
- Xóa tính năng xem ảnh (chưa lưu file content, chỉ lưu filename)

## v1.3.0 - 2026-08-15

### Added
- Cấu hình danh mục dùng chung (Cài đặt → Tài khoản / Danh mục / Người nhận CRUD)
- Nút Group mode cho module Chi tiêu (nhóm giao dịch theo ngày)
- Suggest tên giao dịch từ lịch sử khi nhập
- Suggest số tiền thông minh (4→40,000, 12→12,000, 400→400,000)
- Cho phép số tiền = 0 hoặc để trống
- Nút Sửa/Xóa luôn hiển thị (không cần hover)
- Chế độ Thu gọn mặc định (chỉ Ngày, Tên GD, Số tiền, Loại, Danh mục, Module)
- Nút Previous/Next date range hỗ trợ chế độ Custom

### Changed
- Đổi label "Của" → "Người nhận" toàn bộ giao diện
- Sort giao dịch: Ngày giảm dần + createdAt giảm dần (mới nhất lên trên)
- Shopee: đổi "Tên đơn hàng" → "Tên giao dịch", "Ngày đặt" → "Ngày"
- Quản lý → Fields chỉ hiển thị fields đang visible trong bảng
- Header Chi tiêu mới: tổng Chi/Thu + Group toggle + time filter + search trong 1 bar

### Fixed
- Sync Engine: không ghi đè metadata/modules/settings EXT khi sync
- Initial Sync: EXT mới cài có thể pull data từ Drive (không còn lỗi "No local data")
- Date sort secondary: giao dịch cùng ngày sort theo createdAt (mới nhất đầu)

## v1.2.0 - 2026-08-11

### Added
- Module Rượu: Đơn hàng, Khách hàng, Kho, Sản phẩm, Báo cáo
- Sync 2 chiều App ↔ EXT qua Google Drive
- Dashboard với biểu đồ Chi/Thu theo tháng
- Warranty alert (cảnh báo hết hạn bảo hành)

### Fixed  
- FK error khi tạo đơn hàng rượu
- Sync mapper rewrite cho tất cả modules
