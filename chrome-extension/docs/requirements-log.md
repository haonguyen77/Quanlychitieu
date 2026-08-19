# Requirements Log — Yêu cầu đã xác nhận

> File này ghi lại TẤT CẢ yêu cầu đã được user xác nhận.
> Trước khi thay đổi bất kỳ logic/data/cấu trúc nào, PHẢI kiểm tra file này.
> Nếu có xung đột → DỪNG LẠI và hỏi user.

---

## Quy tắc bất biến

1. **Changelog là lịch sử bất biến** — không sửa/xóa entry cũ
2. **Module OFF ≠ xóa dữ liệu** — OFF chỉ ẩn module, dữ liệu giữ nguyên
3. **Sync dùng chung 1 file finance.json** — cả Chi tiêu + Rượu share cùng data
4. **Ảnh chỉ lưu filename** — không lưu file content (chưa refactor)
5. **UUID chung giữa App và EXT** — không tạo UUID riêng
6. **SYNC RULE — BẤT BIẾN, KHÔNG ĐƯỢC THAY ĐỔI KHI CHƯA CÓ SỰ ĐỒNG Ý CỦA USER:**
   - Đồng bộ theo UUID: merge = UNION tất cả UUID từ cả 2 bên
   - UUID chưa tồn tại → tạo mới
   - UUID đã tồn tại → so sánh updatedAt, lấy bản mới hơn
   - KHÔNG BAO GIỜ xóa record mà không có lý do (isDeleted flag)
   - XÓA = soft delete (isDeleted=true, updatedAt=now) → propagate sang bên kia
   - Record đã isDeleted=true KHÔNG BAO GIỜ được khôi phục tự động bởi sync
   - KHÔNG BAO GIỜ dùng CLEAR ALL + reimport
   - KHÔNG BAO GIỜ upload data có ít records hơn remote mà không kiểm tra

---

## Cấu trúc Module

| Workspace | Modules |
|-----------|---------|
| Quản lý chi tiêu | Chi tiêu, Shopee, Vàng, Nhà trọ, Thẻ tín dụng |
| Quản lý rượu | Đơn hàng, Khách hàng, Kho, Sản phẩm, Báo cáo |

---

## Yêu cầu đã xác nhận (theo thời gian)

### 2026-08-15

- **Sort giao dịch**: Ngày giảm dần + createdAt giảm dần (mới nhất lên trên)
- **Nút Sửa/Xóa**: luôn hiển thị, không dùng hover
- **Label "Của" → "Người nhận"**: chỉ đổi UI, không đổi key data (beneficiary)
- **Money suggest**: 1 digit × 10,000; 2+ digits × 1,000
- **Số tiền = 0**: cho phép để trống hoặc nhập 0, lưu thành 0
- **Thu gọn mặc định**: default compact mode ON
- **Compact columns**: cấu hình trong Quản lý → Fields (nút T)
- **Thẻ tín dụng**: "Thêm mới" = form giống Chi tiêu (Tài khoản mặc định = thẻ đang chọn)
- **Thẻ tín dụng**: "Thêm thẻ"/"Sửa thẻ" = CardFormDialog (chỉ: Tên, Ngân hàng, 4 số cuối, Hạn mức, Ngày sao kê, Ngày thanh toán, Ghi chú)
- **Group mode**: giữ cột Ngày header, ẩn giá trị ngày trong rows
- **Danh mục dùng chung**: CRUD (Thêm, Sửa, Xóa) cho Tài khoản/Danh mục/Người nhận
- **Import Excel Rượu**: trả kết quả per-row, auto-download file result nếu có lỗi
- **Import Excel**: tự thêm khách hàng (check SĐT, skip nếu đã tồn tại)
- **Module ON/OFF**: toggle workspace (Chi tiêu / Rượu), OFF = ẩn, không xóa data
- **Google Drive Rượu**: dùng CHUNG component/service với Chi tiêu (1 codebase)
- **Export đơn hàng Rượu**: 1 đơn nhiều SP → phải export ĐẦY ĐỦ tất cả SP

---

## Quy tắc khi thay đổi

Nếu yêu cầu mới XÂM PHẠM bất kỳ rule trên → PHẢI hỏi user trước khi code.
