# Chrome Extension - Kế hoạch phát triển

## Tổng quan

Chrome Extension "Quản lý chi tiêu" - Desktop client đồng bộ với Android App qua Google Drive.
Nền tảng quản lý dữ liệu cá nhân Metadata-Driven, có khả năng mở rộng 10-20 năm.

---

## Phase 1 - Kiến trúc & Nền tảng ✅

- [x] Khởi tạo project: Vite + React + TypeScript + Tailwind + Manifest V3
- [x] Thiết kế schema metadata-driven (finance.json)
- [x] Clean Architecture: types, core, services, features, shared
- [x] Google OAuth + Google Drive API service
- [x] IndexedDB offline cache
- [x] Sync Engine (pull/push/debounce)
- [x] Dynamic Form Engine (18+ field types)
- [x] Dynamic Table Engine (sort/filter/paginate)
- [x] Icon system (Lucide React)
- [x] Theme system (Light/Dark + CSS variables)

---

## Phase 2 - Core UI & Chi tiêu Module ✅

- [x] Mở tab mới (không popup)
- [x] Sidebar responsive với menu động
- [x] Dashboard tổng quan
- [x] Settings (theme, sync, backup)
- [x] Module Chi tiêu: CRUD đầy đủ
- [x] Danh mục động với icons có màu
- [x] Auto-login (không cần login screen mỗi lần mở)
- [x] Date filter: Tuần / Tháng / Năm / Tất cả + Custom
- [x] Lưu preference date filter
- [x] Tìm kiếm toàn bộ
- [x] Tổng thu / chi / số dư
- [x] Suggest tên giao dịch từ lịch sử
- [x] Suggest số tiền (horizontal + Tab)
- [x] Default: Loại=Chi, Tài khoản=Tiền mặt
- [x] Form 2 cột cho field ngắn
- [x] Upload hình ảnh, Tags
- [x] Liên kết Module (Shopee/Vàng/Nhà trọ)
- [x] Bảng hiển thị: Danh mục + Module + Ghi chú column
- [x] Table fallback khi fieldId mismatch
- [x] Auto-capitalize tên giao dịch

---

## Phase 3 - Modules khác ✅

- [x] Shopee: Virtual columns giống Chi tiêu
- [x] Vàng: Mua (xanh) / Bán (đỏ), Số lượng chỉ, Giá/chỉ auto
- [x] Nhà trọ: Tháng auto, Người thuê, Số tiền
- [x] Cross-module value resolution + Edit prefill from Chi tiêu
- [x] Thẻ tín dụng: Dashboard (card xanh lá, hạn mức, dư nợ, %)
- [x] Thẻ tín dụng: Dynamic accounts (tên thẻ trong dropdown)
- [x] Thẻ tín dụng: Edit/Delete giao dịch
- [x] Ghi chú column cho tất cả modules

---

## Phase 4 - Dashboard & Biểu đồ ✅

- [x] Bộ lọc thời gian: Tuần / Tháng / Năm
- [x] Biểu đồ tròn (donut) chi theo danh mục
- [x] Biểu đồ cột thu chi theo năm (12 tháng)
- [x] Module cards với record count
- [x] Summary stats (Tổng chi, thu, số dư, bản ghi)

---

## Phase 5 - Báo cáo & Xuất dữ liệu ✅

- [x] Export JSON backup
- [x] Import JSON
- [x] Export Excel (CSV) với UTF-8 BOM

---

## Phase 6 - UX Nâng cao (ĐANG LÀM)

### 6.1 - Time Filter hoàn chỉnh ✅
- [x] Tất cả modules: nút Tuần/Tháng/Năm/Tất cả + input chọn ngày custom
- [x] Dashboard: custom date inputs bên cạnh preset buttons
- [x] Thẻ tín dụng: Tuần/Tháng/Năm + date inputs
- [x] Chi tiêu mặc định: Tháng hiện tại
- [x] Vàng, Nhà trọ mặc định: Năm hiện tại

### 6.2 - Keyboard Shortcuts ✅
- [x] Phím tắt nhập chi tiêu (Ctrl+N hoặc N khi không focus input)
- [x] Ctrl+Enter để lưu chi tiêu/edit
- [x] Escape để đóng form
- [x] Phím tắt chọn danh mục (1-9 cho top 9 danh mục)
- [x] Tài khoản: nhấn ký tự đầu tên để chọn (V→Vp, M→Momo...)
- [x] Tab navigate trong date field (browser native đã hỗ trợ)
- [x] Delete/Backspace để xóa record đã chọn

### 6.3 - Multi-select & Batch Operations ✅
- [x] Checkbox chọn nhiều dòng (Shift+click range, Ctrl+click individual)
- [x] Batch delete nhiều records
- [x] Batch edit 1 field (ví dụ đổi Tài khoản cho tất cả đã chọn)
- [x] Toolbar hiện khi có selection (x selected | Edit | Delete)

### 6.4 - Context Menu (Right-click) ✅
- [x] Right-click record → Clone (tạo bản copy)
- [x] Right-click → Edit, Delete, Copy

### 6.5 - Suggest cải tiến ✅
- [x] Tên GD: ưu tiên từ bắt đầu (B → Be, Ba, Bích trước)
- [x] Mũi tên ↑↓ di chuyển trong suggest list
- [x] Tab chọn item trong suggest (nhiều lần Tab = next item)
- [x] Enter chọn item đang highlight
- [x] Số tiền: 195 → suggest 19,500 trước, rồi 195,000, 1,950,000
- [x] Tên GD + Tài khoản: cái hay chọn nhất hiện đầu tiên (frequency sort)

### 6.6 - Form Reorder & New Fields ✅
- [x] Di chuyển Liên kết Module xuống dưới Danh mục
- [x] Đổi vị trí: Ngày trước Loại (để dễ nhập)
- [x] Thêm field: Người thụ hưởng (ba, mẹ, vợ, con, anh, chị...)
- [x] Thêm field: Ngày bảo hành
- [ ] Thêm field: Số lượng (bật cột số chỉ vàng)
- [x] Tài khoản thêm: TP Bank, VP Bank, ZaloPay

### 6.7 - Column Filters (giống Excel) ✅
- [x] Cột Tên GD: filter dropdown nhập text để lọc
- [x] Cột Ngày: filter chọn ngày/khoảng ngày
- [x] Cột Danh mục: filter dropdown chọn danh mục
- [x] Cột Module: filter dropdown chọn module
- [x] Filter indicator (badge số filter đang active)

### 6.8 - Dashboard cải tiến ✅
- [x] Custom date inputs cho Dashboard
- [x] Hover biểu đồ tròn: hiện số tiền + % (tooltip)
- [x] Pie chart legend: "Di chuyển – 2.000.000đ – 41%"
- [x] Biểu đồ cột: hiện số tiền khi hover
- [x] So sánh tháng này vs tháng trước (tăng/giảm %)
- [ ] Highlight danh mục tăng/giảm nhiều nhất

---

## Phase 7 - Module Management & Metadata ✅

- [x] UI thêm/sửa/xóa Module
- [x] UI thêm/sửa/xóa Field cho mỗi module
- [x] UI quản lý Danh mục (thêm/sửa/xóa/đổi icon/color)
- [x] UI quản lý Menu (thêm/sửa/xóa/sắp xếp)
- [ ] Dropdown options: thêm/sửa/xóa/đổi màu
- [ ] Cấu hình bảng (ẩn/hiện cột, đổi thứ tự)

---

## Phase 8 - Đồng bộ Google Drive ✅

- [x] Đăng nhập Google OAuth thực
- [x] Tự động sync khi có thay đổi (debounce 3s)
- [x] Pull khi mở app
- [x] Conflict detection (last-write-wins)
- [x] Hiển thị trạng thái sync
- [ ] Upload ảnh lên Google Drive
- [ ] Lịch sử sync

---

## Phase 9 - Export/Import nâng cao ✅

- [x] Export Excel multi-sheet: Chi tiêu, Shopee, Vàng, Nhà trọ, Thẻ TD, Rượu
- [x] Import từ Excel/CSV
- [x] Import từ Android App SQLite backup (JSON merge)
- [x] Mã hóa dữ liệu file JSON (AES-GCM encryption với password)

---

## Phase 10 - Hoàn thiện ✅

- [x] Thùng rác (xem/khôi phục đã xóa/xóa vĩnh viễn)
- [x] Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- [x] Giao dịch định kỳ (auto-create on startup)
- [x] Ngân sách (Budget) - progress bar per category
- [x] Nhật ký hoạt động (max 100 entries)
- [x] Thẻ tín dụng: Nhắc nhở thanh toán
- [x] Responsive cho nhiều kích thước
- [x] Performance: pagination (20/50/100 per page)
- [x] PWA support (service worker + web manifest)
- [x] Rượu: Module riêng (sản phẩm, đơn hàng, kho, khách hàng)
- [x] Thẻ tín dụng: Trả góp (tracking + debt summary)

---

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| State | Zustand |
| Style | Tailwind CSS |
| Icons | Lucide React |
| Charts | SVG custom (no lib) |
| Offline | IndexedDB (idb) |
| Sync | Google Drive API |
| Auth | Chrome Identity API |
| Extension | Manifest V3 |

---

## Nguyên tắc

1. **Metadata-Driven**: Mọi module, field, form, table đều từ cấu hình JSON
2. **Offline-First**: IndexedDB là primary storage, Drive là sync
3. **Không Hardcode**: Thêm module/field không cần sửa code
4. **Clean Architecture**: types → core → services → features → shared
5. **SOLID**: Single responsibility, mỗi component 1 nhiệm vụ
6. **Keyboard-First**: Mọi thao tác đều có phím tắt
7. **Performance**: Lazy load, virtual scroll cho data lớn
