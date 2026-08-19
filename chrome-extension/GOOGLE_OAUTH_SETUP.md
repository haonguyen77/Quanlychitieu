# Hướng dẫn cấu hình Google OAuth cho Chrome Extension

## Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Đặt tên: `Quan ly chi tieu` → **Create**

## Bước 2: Enable Google Drive API

1. Trong project vừa tạo, vào **APIs & Services** → **Library**
2. Tìm **"Google Drive API"** → Click → **Enable**
3. Tìm thêm **"Google People API"** → Click → **Enable** (cho user profile)

## Bước 3: Cấu hình OAuth Consent Screen

1. Vào **APIs & Services** → **OAuth consent screen**
2. Chọn **External** → **Create**
3. Điền:
   - App name: `Quản lý chi tiêu`
   - User support email: email của bạn
   - Developer contact: email của bạn
4. **Save and Continue**
5. Scopes: Add scopes → tìm và thêm:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
6. **Save and Continue** → Test users: thêm email của bạn → **Save**

## Bước 4: Tạo OAuth Client ID

1. Vào **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **OAuth client ID**
3. Application type: **Chrome Extension**
4. Name: `Quản lý chi tiêu Extension`
5. **Item ID**: Lấy từ `chrome://extensions` → ID của extension (dãy ký tự dài)
   - Nếu chưa có, load extension trước rồi quay lại đây
6. Click **Create**
7. Copy **Client ID** (dạng: `123456789-xxxx.apps.googleusercontent.com`)

## Bước 5: Cập nhật manifest.json

Mở file `chrome-extension/public/manifest.json` (hoặc `dist/manifest.json`):

```json
{
  "oauth2": {
    "client_id": "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  }
}
```

Thay `PASTE_YOUR_CLIENT_ID_HERE` bằng Client ID vừa copy.

## Bước 6: Reload Extension

1. Vào `chrome://extensions`
2. Click nút reload (🔄) trên extension
3. Mở extension → Cài đặt → **Đăng nhập Google Drive**
4. Popup Google sẽ hiện → Chọn tài khoản → Cho phép

## Lưu ý

- Extension phải được load từ folder `dist/` (không phải `src/`)
- Client ID phải khớp với Extension ID trong Chrome
- Nếu thay đổi Extension ID (unpack lại), cần update Client ID
- Test user phải được thêm vào OAuth consent screen (bước 3.6)
- Sau khi publish lên Chrome Web Store, Extension ID sẽ cố định

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `OAuth2 not granted or revoked` | Chưa add test user | Thêm email vào OAuth consent |
| `Invalid client_id` | Client ID sai | Kiểm tra lại bước 4-5 |
| `Extension ID mismatch` | Load extension từ folder khác | Tạo lại credential với ID mới |
| `Token expired` | Token hết hạn | Extension tự refresh, hoặc ngắt kết nối rồi đăng nhập lại |
