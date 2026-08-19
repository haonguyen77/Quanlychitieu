# Wine Module - Chi tiết yêu cầu

## Dashboard (Báo cáo)
- [ ] Thêm ô chọn tháng/năm cụ thể (input month/year)
- [ ] Liệt kê 5 SP tồn nhiều nhất
- [ ] Liệt kê 5 SP tồn ít nhất
- [ ] Tồn kho tổng quan: filter theo loại rượu, loại chai

## Đơn hàng
- [ ] Fix layout: SĐT, Địa chỉ, Quận, TP mỗi field 1 hàng riêng (hoặc 2 cột)
- [ ] Fix: Ly, Hộp, Đơn giá, Ship không xóa được số 0
- [ ] Đơn giá + Phí ship có suggest giá tiền (MoneyInputWithSuggest)

## Khách hàng
- [ ] Thêm nút "Thêm khách hàng" thủ công
- [ ] Khách hàng lấy tự động từ đơn hàng HOẶC nhập tay

## Sản phẩm
- [ ] Bỏ cột: Giá bán, Tồn kho
- [ ] Sửa tên: "Loại" → "Loại rượu", "Chai" → "Loại chai"
- [ ] Loại rượu dropdown: Gạo, Nếp, Đậu xanh, Vang nếp, ĐTHT
- [ ] Pre-populate 30 sản phẩm (bảng đã cung cấp)

## Kho (Inventory)
- [ ] Cột: SKU, Sản phẩm, Màu, Loại rượu, Loại chai, Tồn kho, Trạng thái
- [ ] Nút "Nhập kho" (manual)
- [ ] Nút "Import Excel" (file excel với số lượng, cộng vào stock hiện có)
- [ ] Trạng thái: Còn hàng (xanh), Sắp hết (cam), Hết hàng (đỏ)
- [ ] Chai sứ có MÀU → sinh SKU đầy đủ (VD: HL350-DL)
- [ ] Mã màu cấu hình: DL, DEN, HONG, TRANG, XN, XR, XBB
- [ ] Khi chọn màu → auto sinh SKU đầy đủ = base_sku + "-" + mã_màu

## Cài đặt
- [ ] Export CSV: 1 file 3 sheet (Đơn hàng, Khách hàng, Kho)
- [ ] Bỏ 2 nút CSV riêng lẻ
- [ ] Export/Import Google Sheets (3 sheets)
- [ ] Google Drive: tạo thư mục riêng, không lưu trực tiếp
- [ ] Cấu hình mã màu chai sứ (thêm/sửa/xóa)
- [ ] Cấu hình ngưỡng cảnh báo kho

## Danh sách sản phẩm mặc định (30 items)
| SKU | Tên | Viết tắt | Dung tích | Loại rượu | Loại chai |
|-----|-----|----------|-----------|-----------|-----------|
| G2-1L | Rượu bàu đá gạo loại 2 - 1L | Gạo L2 1L | 1000 | Gạo | PET |
| G2-2L | Rượu bàu đá gạo loại 2 - 2L | Gạo L2 2L | 2000 | Gạo | PET |
| G2-5L | Rượu bàu đá gạo loại 2 - 5L | Gạo L2 5L | 5000 | Gạo | PET |
| G-500 | Rượu bàu đá gạo 500ml | Gạo 500ml | 500 | Gạo | PET |
| G-1L | Rượu bàu đá gạo 1L | Gạo 1L | 1000 | Gạo | PET |
| G-2L | Rượu bàu đá gạo 2L | Gạo 2L | 2000 | Gạo | PET |
| G-5L | Rượu bàu đá gạo 5L | Gạo 5L | 5000 | Gạo | PET |
| N-500 | Rượu bàu đá nếp 500ml | Nếp 500ml | 500 | Nếp | PET |
| N-1L | Rượu bàu đá nếp 1L | Nếp 1L | 1000 | Nếp | PET |
| N-2L | Rượu bàu đá nếp 2L | Nếp 2L | 2000 | Nếp | PET |
| N-5L | Rượu bàu đá nếp 5L | Nếp 5L | 5000 | Nếp | PET |
| DX-500 | Rượu bàu đá đậu xanh 500ml | Đậu xanh 500ml | 500 | Đậu xanh | PET |
| DX-1L | Rượu bàu đá đậu xanh 1L | Đậu xanh 1L | 1000 | Đậu xanh | PET |
| DX-2L | Rượu bàu đá đậu xanh 2L | Đậu xanh 2L | 2000 | Đậu xanh | PET |
| DX-5L | Rượu bàu đá đậu xanh 5L | Đậu xanh 5L | 5000 | Đậu xanh | PET |
| HL350 | Chai sứ Hồ Lô 350ml | Hồ Lô 350ml | 350 | Gạo | Sứ |
| RN350 | Chai sứ Rồng nhỏ 350ml | Rồng nhỏ 350ml | 350 | Gạo | Sứ |
| 3B650 | Chai sứ Ba Bầu 650ml | Ba Bầu 650ml | 650 | Gạo | Sứ |
| LP650 | Chai sứ Long Phụng 650ml | Long Phụng 650ml | 650 | Gạo | Sứ |
| VR650 | Chai sứ Vòi Rót 650ml | Vòi Rót 650ml | 650 | Gạo | Sứ |
| C650 | Chum 650ml | Chum 650ml | 650 | Gạo | Sứ |
| HL650 | Hồ Lô 650ml | Hồ Lô 650ml | 650 | Gạo | Sứ |
| TC700 | Thuyền Chim 700ml | Thuyền Chim 700ml | 700 | Gạo | Sứ |
| TL1L | Thuyền Lớn 1L | Thuyền Lớn 1L | 1000 | Gạo | Sứ |
| CS25L | Chai sứ 2.5L | Chai sứ 2.5L | 2500 | Gạo | Sứ |
| VN300 | Vang nếp 300ml | Vang nếp 300ml | 300 | Vang nếp | Thuỷ tinh |
| VN500 | Vang nếp 500ml | Vang nếp 500ml | 500 | Vang nếp | Thuỷ tinh |
| VN750 | Vang nếp 750ml | Vang nếp 750ml | 750 | Vang nếp | Thuỷ tinh |
| DXTT500 | Đậu xanh thủy tinh 500ml | ĐX Thủy tinh 500 | 500 | Đậu xanh | Thuỷ tinh |
| DTHT500-T | Đông trùng hạ thảo 500ml - Tròn | ĐTHT Tròn | 500 | ĐTHT | Thuỷ tinh |
| DTHT500-D | Đông trùng hạ thảo 500ml - Dẹp | ĐTHT Dẹp | 500 | ĐTHT | Thuỷ tinh |

## Mã màu chai sứ
| Mã | Tên |
|----|-----|
| DL | Da lươn |
| DEN | Đen |
| HONG | Hồng |
| TRANG | Trắng |
| XN | Xanh ngọc |
| XR | Xanh rêu |
| XBB | Xanh bút bi |

## Logic SKU đầy đủ cho chai sứ
- Base SKU + "-" + Mã màu
- VD: HL350-DL, HL350-DEN, RN350-HONG
- Khi nhập kho chai sứ: chọn SP + chọn Màu → SKU đầy đủ auto-gen
- Khi tạo đơn hàng: suggest cả SKU base và SKU đầy đủ
