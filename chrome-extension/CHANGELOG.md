# Changelog - Wine Module

## 2026-08-04 (v2)

### Đơn hàng - Form tạo đơn
- Layout: Đơn giá + Số lượng = 1 hàng. Màu + Ly + Hộp = 1 hàng
- Suggest tiền: nhập 300 → suggest 300,000₫ (không suggest 30,000 nữa)
- Tên SP: hiển thị TẤT CẢ kết quả, sắp xếp theo SKU prefix trước
- Nút "Sao chép" (bên cạnh + Thêm SP) để thêm SP tương tự khác màu
- Nhiều SP lưu thành 1 đơn duy nhất (không tách đơn)
- Bảng đơn hàng: hiển thị multi-line cho đơn nhiều SP

### Module Khách hàng
- Thêm nút "Thêm KH" (Alt+N)
- Thêm nút Sửa (edit) mỗi hàng
- Form thêm/sửa: Họ tên, SĐT, Địa chỉ, Quận, TP, Ghi chú

### Module Sản phẩm
- Phím tắt Alt+N thêm SP mới
- Đổi label: "Tên" → "Tên đầy đủ", "Viết tắt" → "Tên ngắn"
- Giãn cách cột SKU (80px) và Tên ngắn (100px) hợp lý hơn

### Module Kho (Inventory) - Thiết kế lại hoàn toàn
- 4 thẻ trạng thái: Tổng tồn (xanh dương), Còn hàng (xanh lá), Sắp hết (cam), Hết hàng (đỏ)
- Click vào thẻ để filter sản phẩm theo trạng thái
- Thanh tìm kiếm + bộ lọc: Loại rượu, Loại chai, Màu
- Cột mới: SKU, Tên SP, Loại rượu, Dung tích, Màu, Tồn kho, Đơn vị, Trạng thái, Thanh mức tồn
- Thanh progress bar màu thể hiện mức tồn kho trực quan
- Nhập kho: form mới với ô tìm SKU/tên SP, chọn xong hiện SL + Màu. Nút "+ Thêm SP"
- Nút tải Template CSV mẫu
- Nút Log xem lịch sử nhập kho
- Phím tắt Alt+N mở dialog nhập kho

## 2026-08-03

### Sản phẩm (Products)
- Bỏ cột Giá bán & Tồn kho
- Đổi tên: "Loại" → "Loại rượu", "Chai" → "Loại chai"
- Dropdown Loại rượu: Gạo, Nếp, Đậu xanh, Vang nếp, ĐTHT
- Pre-populate 30 sản phẩm mặc định

### Kho (Inventory)
- Module mới `mod_ruou_inventory`
- Cột: SKU, Sản phẩm, Màu, Loại rượu, Loại chai, Tồn kho, Trạng thái
- Trạng thái: Còn hàng (xanh), Sắp hết (cam), Hết hàng (đỏ)
- Nhập kho: chọn SP + chọn Màu (chai sứ) → auto-gen SKU đầy đủ
- Import Excel: đọc CSV (SKU, Số lượng), cộng vào stock hiện có
- Mã màu chai sứ: DL, DEN, HONG, TRANG, XN, XR, XBB

### Dashboard (Báo cáo)
- Chọn tháng/năm cụ thể
- Top 5 SP tồn nhiều nhất / ít nhất
- Filter tồn kho theo loại rượu, loại chai

### Migration
- Tự động cập nhật dữ liệu cũ: thêm 30 SP, sửa wine_type options, thêm module Kho
