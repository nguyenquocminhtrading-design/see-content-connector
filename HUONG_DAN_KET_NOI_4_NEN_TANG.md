# 📘 HƯỚNG DẪN CHI TIẾT STEP-BY-STEP KẾT NỐI 4 NỀN TẢNG
### (Facebook · Instagram · TikTok · LinkedIn) — SEE Content Connector

> Tài liệu hướng dẫn thao tác thực tế từ A đến Z: Tạo tài khoản Developer, lấy API Credentials, cấu hình Redirect URL, điền file `.env` và xác thực OAuth 2.0 trực tiếp trên giao diện Web UI.

---

## 📑 MỤC LỤC
1. [Tổng quan & Bảng thông số cài đặt](#1-tổng-quan--bảng-thông-số-cài-đặt)
2. [Bước 0: Chuẩn bị file `.env`](#2-bước-0-chuẩn-bị-file-env)
3. [Nền tảng 1: Facebook (Meta Graph API)](#3-nền-tảng-1-facebook-meta-graph-api)
4. [Nền tảng 2: Instagram (Instagram Business API)](#4-nền-tảng-2-instagram-business-api)
5. [Nền tảng 3: TikTok (TikTok Content & Display API)](#5-nền-tảng-3-tiktok-content--display-api)
6. [Nền tảng 4: LinkedIn (LinkedIn REST API)](#6-nền-tảng-4-linkedin-rest-api)
7. [Khởi động & Thao tác kết nối trên Web UI](#7-khởi-động--thao-tác-kết-nối-trên-web-ui)
8. [Bảng kiểm tra & Khắc phục lỗi thường gặp (Troubleshooting)](#8-bảng-kiểm-tra--khắc-phục-lỗi-thường-gặp)

---

## 1. TỔNG QUAN & BẢNG THÔNG SỐ CÀI ĐẶT

### 1.1. Cổng hoạt động của hệ thống (Local Ports)
* **Backend API Server**: Chạy tại cổng `http://localhost:4000` (xử lý OAuth callback và API dữ liệu).
* **Frontend Web UI**: Chạy tại cổng `http://localhost:3002` (giao diện quản lý kết nối và dashboard).

### 1.2. Bảng tham chiếu biến môi trường & Redirect URI

| Nền tảng | Biến cần điền trong `.env` | Redirect URI chính xác cần khai báo trên Developer Console | Nơi đăng ký / tạo App |
| :--- | :--- | :--- | :--- |
| **Facebook** | `META_APP_ID`<br>`META_APP_SECRET`<br>`META_PAGE_ID`<br>`META_PAGE_ACCESS_TOKEN` | `http://localhost:4000/api/auth/facebook/callback` | [developers.facebook.com](https://developers.facebook.com) |
| **Instagram** | `INSTAGRAM_BUSINESS_ACCOUNT_ID`<br>*(Dùng chung META_APP_ID & SECRET)* | `http://localhost:4000/api/auth/instagram/callback` | Dùng chung Meta App của Facebook |
| **TikTok** | `TIKTOK_CLIENT_KEY`<br>`TIKTOK_CLIENT_SECRET`<br>`TIKTOK_REDIRECT_URI` | `http://localhost:4000/api/auth/tiktok/callback` | [developers.tiktok.com](https://developers.tiktok.com) |
| **LinkedIn** | `LINKEDIN_CLIENT_ID`<br>`LINKEDIN_CLIENT_SECRET`<br>`LINKEDIN_ORGANIZATION_URN`<br>`LINKEDIN_REDIRECT_URI` | `http://localhost:4000/api/auth/linkedin/callback` | [linkedin.com/developers](https://www.linkedin.com/developers/apps) |

---

## 2. BƯỚC 0: CHUẨN BỊ FILE `.ENV`

1. Tại thư mục gốc của dự án `SEE_content_connector`, mở terminal (hoặc File Explorer) và sao chép file `.env.example` thành `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Mở file `.env` bằng VS Code hoặc Notepad để sẵn sàng dán các mã khóa được hướng dẫn ở các bước bên dưới.

---

## 3. NỀN TẢNG 1: FACEBOOK (META GRAPH API)

### Bước 1.1 — Đăng ký tài khoản Meta Developer
1. Mở trình duyệt và truy cập: [https://developers.facebook.com](https://developers.facebook.com).
2. Đăng nhập bằng tài khoản Facebook của bạn.
3. Nếu chưa từng tạo tài khoản Developer, bấm **Get Started** (hoặc **Bắt đầu**) ở góc trên bên phải → chọn loại tài khoản **Business/Doanh nghiệp** → Xác nhận số điện thoại và email.

### Bước 1.2 — Tạo App Meta
1. Vào trang quản lý ứng dụng: [https://developers.facebook.com/apps](https://developers.facebook.com/apps).
2. Nhấn nút **Create App** (Tạo ứng dụng).
3. Tại bước chọn Use Case: Chọn **Manage everything in your Page** (hoặc **Other** → **Business** tùy giao diện mới/cũ của Meta) → Nhấn **Next**.
4. Điền thông tin:
   * **App name**: `SEE Content Connector`
   * **App contact email**: Email của bạn.
   * **Business portfolio**: Chọn Business của bạn hoặc bỏ qua (tùy chọn).
5. Bấm **Create App** → Nhập mật khẩu Facebook nếu được yêu cầu.

### Bước 1.3 — Lấy `META_APP_ID` & `META_APP_SECRET`
1. Tại thanh điều hướng bên trái, chọn **App settings** (Cài đặt ứng dụng) → **Basic** (Cơ bản).
2. Copy chuỗi tại ô **App ID** → Dán vào biến `META_APP_ID` trong file `.env`.
3. Tại dòng **App Secret** (Khóa bí mật), bấm nút **Show** (Hiển thị) → Copy chuỗi này → Dán vào biến `META_APP_SECRET` trong file `.env`.
4. Kéo xuống dưới phần thông tin cơ bản:
   * **App Domains**: Nhập `localhost`.
   * **Privacy Policy URL**: Nhập tạm URL (ví dụ: `http://localhost:3002/privacy` hoặc link GitHub repo).
   * Bấm **Save Changes** (Lưu thay đổi).

### Bước 1.4 — Thêm Quyền & Redirect URI
1. Ở menu bên trái, tìm mục **Use cases** hoặc **Add product** → Thêm **Facebook Login for Business**.
2. Vào **Facebook Login** → **Settings** (Cài đặt):
   * Tại ô **Valid OAuth Redirect URIs**, dán chính xác:
     ```
     http://localhost:4000/api/auth/facebook/callback
     http://localhost:4000/api/auth/instagram/callback
     ```
   * Bấm **Save Changes**.
3. Vào menu **App roles** (Vai trò) → **Roles**:
   * Đảm bảo tài khoản Facebook cá nhân của bạn đang có vai trò **Administrator** (Quản trị viên).

### Bước 1.5 — Lấy `META_PAGE_ID` (ID Fanpage Facebook)
1. Mở trang Fanpage Facebook bạn quản trị.
2. Vào tab **Giới thiệu (About)** hoặc **Settings → Page Transparency**.
3. Tìm dòng **Page ID (ID trang)**: Dãy số gồm 15-16 chữ số.
4. Dán dãy số này vào biến `META_PAGE_ID` trong file `.env`.

### Bước 1.6 — Lấy `META_PAGE_ACCESS_TOKEN` (Token truy cập dài hạn)
1. Truy cập công cụ **Graph API Explorer**: [https://developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/).
2. Ô **Meta App**: Chọn app `SEE Content Connector` vừa tạo.
3. Ô **User or Page**: Bấm chọn **Get Page Access Token** (Lấy token trang) → Chọn Fanpage của bạn.
4. Cột **Permissions**, chọn/gõ thêm các quyền sau:
   * `pages_show_list`
   * `pages_read_engagement`
   * `pages_manage_posts`
   * `instagram_basic`
   * `instagram_manage_insights`
5. Nhấn **Generate Access Token** và bấm đồng ý cấp quyền trên cửa sổ popup của Facebook.
6. Copy chuỗi Token bắt đầu bằng `EAA...` dán vào biến `META_PAGE_ACCESS_TOKEN` trong file `.env`.

---

## 4. NỀN TẢNG 2: INSTAGRAM (INSTAGRAM BUSINESS API)

> 💡 **Lưu ý quan trọng**: Instagram kết nối trực tiếp thông qua Fanpage Facebook và chung Meta App ở Bước 3. Không cần đăng ký App mới!

### Bước 2.1 — Chuyển Instagram sang tài khoản Chuyên nghiệp (Professional Account)
1. Mở ứng dụng Instagram trên điện thoại của bạn.
2. Vào **Cài đặt & Quyền riêng tư (Settings and privacy)** → **Loại tài khoản & công cụ (Account type and tools)**.
3. Chọn **Chuyển sang tài khoản chuyên nghiệp (Switch to professional account)** → Chọn loại **Doanh nghiệp (Business)** hoặc **Người sáng tạo nội dung (Creator)**.

### Bước 2.2 — Liên kết Instagram với Fanpage Facebook
1. Truy cập Facebook trên máy tính → Chuyển sang quyền quản trị Fanpage của bạn.
2. Vào **Cài đặt (Settings)** → **Tài khoản đã liên kết (Linked Accounts)** → Chọn **Instagram**.
3. Bấm **Kết nối tài khoản (Connect account)** → Đăng nhập tài khoản Instagram của bạn và chọn cấp quyền truy cập tin nhắn/dữ liệu.
4. Kiểm tra lại: Trạng thái hiển thị *"Đã kết nối"* là thành công.

### Bước 2.3 — Lấy `INSTAGRAM_BUSINESS_ACCOUNT_ID`
1. Quay lại trang **Graph API Explorer**: [https://developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/).
2. Trong thanh nhập lệnh API (Method `GET`), nhập cú pháp:
   ```
   me/accounts?fields=name,id,instagram_business_account
   ```
   *(Hoặc `{META_PAGE_ID}?fields=instagram_business_account`)*.
3. Nhấn nút **Submit**.
4. Bạn sẽ nhận được kết quả dạng JSON:
   ```json
   {
     "data": [
       {
         "name": "Tên Fanpage của bạn",
         "id": "123456789012345",
         "instagram_business_account": {
           "id": "17841400000000000"
         }
       }
     ]
   }
   ```
5. Copy dãy số trong `instagram_business_account.id` (ví dụ `17841400000000000`) dán vào biến `INSTAGRAM_BUSINESS_ACCOUNT_ID` trong `.env`.

---

## 5. NỀN TẢNG 3: TIKTOK (TIKTOK CONTENT & DISPLAY API)

### Bước 3.1 — Đăng ký TikTok for Developers
1. Truy cập: [https://developers.tiktok.com](https://developers.tiktok.com).
2. Đăng nhập bằng tài khoản TikTok của bạn.
3. Chọn **Manage apps** (hoặc truy cập [developers.tiktok.com/app](https://developers.tiktok.com/app)).

### Bước 3.2 — Tạo App mới
1. Nhấn nút **Connect a new app**.
2. Điền thông tin ứng dụng:
   * **App Name**: `SEE Content Connector`
   * **Category**: Chọn `Business / Marketing` hoặc `Tools`
   * **Description**: Quản lý và tổng hợp bài viết nội bộ cho studio
   * **App Icon**: Tải lên 1 ảnh logo vuông (512x512 px)
3. Nhấn **Create** để hoàn tất tạo ứng dụng.

### Bước 3.3 — Lấy `TIKTOK_CLIENT_KEY` & `TIKTOK_CLIENT_SECRET`
1. Trong dashboard của App, vào tab **Basic information**.
2. Copy chuỗi tại ô **Client Key** → Dán vào `TIKTOK_CLIENT_KEY` trong `.env`.
3. Tại ô **Client Secret**, bấm biểu tượng con mắt / **Show** → Copy mã → Dán vào `TIKTOK_CLIENT_SECRET` trong `.env`.

### Bước 3.4 — Cấu hình Redirect URI
1. Vẫn trong tab **Basic information**, cuộn xuống phần **Redirect URI**.
2. Bấm **Add URI** và nhập chính xác:
   ```
   http://localhost:4000/api/auth/tiktok/callback
   ```
3. Đảm bảo biến trong `.env` cũng có giá trị tương ứng:
   ```env
   TIKTOK_REDIRECT_URI=http://localhost:4000/api/auth/tiktok/callback
   ```

### Bước 3.5 — Bật Scopes & Thêm tài khoản Test vào Sandbox
1. Vào tab **Products** → Nhấn **Add products**:
   * Thêm **Content Posting API** và **Display API**.
2. Tại mục Scopes, kích hoạt các quyền:
   * `user.info.basic` (Thông tin cơ bản)
   * `video.list` (Danh sách video đã đăng)
   * `video.insights` (Chỉ số xem, like, bình luận)
3. **Thêm tài khoản vào Sandbox (Quan trọng để test ngay mà không cần đợi duyệt App)**:
   * Vào tab **Sandbox** ở thanh menu.
   * Bấm **Add members** → Nhập chính xác `@username` tài khoản TikTok của bạn.
   * Giờ đây bạn có thể kết nối ngay lập tức!

---

## 6. NỀN TẢNG 4: LINKEDIN (LINKEDIN REST API)

### Bước 4.1 — Chuẩn bị LinkedIn Company Page
1. Truy cập LinkedIn và kiểm tra xem bạn đã có Trang công ty (Company Page) chưa: [https://www.linkedin.com/company/setup/new/](https://www.linkedin.com/company/setup/new/).
2. Nếu chưa có, tạo một trang miễn phí (ví dụ: `SEE Media / Studio`).
3. Đảm bảo tài khoản LinkedIn cá nhân của bạn là **Super Admin** của Trang.

### Bước 4.2 — Tạo App trên LinkedIn Developer Portal
1. Truy cập: [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps).
2. Nhấn nút **Create app**.
3. Điền các trường:
   * **App name**: `SEE Content Connector`
   * **LinkedIn Page**: Gõ tên Company Page đã chuẩn bị ở Bước 4.1 để liên kết.
   * **Privacy policy URL**: Nhập link tạm (ví dụ: `http://localhost:3002/privacy`).
   * **App logo**: Tải lên 1 ảnh logo vuông.
4. Đánh dấu tick đồng ý với điều khoản → Bấm **Create app**.
5. Bấm nút **Verify** nếu có thông báo xác minh Company Page (LinkedIn sẽ gửi một thông báo xác nhận tới Trang quản trị của bạn, bấm Approve).

### Bước 4.3 — Lấy `LINKEDIN_CLIENT_ID` & `LINKEDIN_CLIENT_SECRET`
1. Vào tab **Auth** của ứng dụng.
2. Tại mục **Application credentials**:
   * Copy **Client ID** → Dán vào `LINKEDIN_CLIENT_ID` trong `.env`.
   * Bấm biểu tượng con mắt tại **Primary Client Secret** → Copy → Dán vào `LINKEDIN_CLIENT_SECRET` trong `.env`.

### Bước 4.4 — Cài đặt OAuth 2.0 Redirect URL
1. Vẫn trong tab **Auth**, kéo xuống phần **OAuth 2.0 settings**.
2. Tại mục **Authorized redirect URLs for your app**, bấm biểu tượng dấu bút chì / **Add redirect URL**.
3. Nhập chính xác:
   ```
   http://localhost:4000/api/auth/linkedin/callback
   ```
4. Bấm **Update** (Lưu).
5. Đảm bảo trong `.env` có dòng:
   ```env
   LINKEDIN_REDIRECT_URI=http://localhost:4000/api/auth/linkedin/callback
   ```

### Bước 4.5 — Bật API Products (Cấp quyền)
1. Chuyển sang tab **Products** của ứng dụng.
2. Tìm sản phẩm **Community Management API** → Bấm **Request access** và bấm đồng ý điều khoản.
   *(Sản phẩm này cấp các quyền `r_organization_social` và `w_organization_social` để đọc và đăng bài)*.

### Bước 4.6 — Lấy `LINKEDIN_ORGANIZATION_URN`
1. Mở trang quản trị LinkedIn Company Page của bạn trên trình duyệt.
2. Nhìn lên thanh địa chỉ (URL) của trình duyệt:
   ```
   https://www.linkedin.com/company/12345678/admin/dashboard/
                                    ^^^^^^^^ (Đây chính là Organization ID)
   ```
3. Lấy dãy số đó và ghép theo định dạng URN:
   ```env
   LINKEDIN_ORGANIZATION_URN=urn:li:organization:12345678
   ```
   *(Thay `12345678` bằng ID thực tế của bạn)*.

---

## 7. KHỞI ĐỘNG & THAO TÁC KẾT NỐI TRÊN WEB UI

Sau khi đã hoàn tất việc điền các thông số vào file `.env`, tiến hành chạy ứng dụng và kích hoạt kết nối OAuth.

### 7.1. File `.env` mẫu hoàn chỉnh sau khi điền
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3002
ENCRYPTION_KEY=my_secure_encryption_key_32_characters_123

# Facebook & Instagram
META_APP_ID=123456789012345
META_APP_SECRET=abcdef0123456789abcdef0123456789
META_PAGE_ID=987654321098765
META_PAGE_ACCESS_TOKEN=EAAG...long_access_token...
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400000000000

# TikTok
TIKTOK_CLIENT_KEY=sbaw12345678abcdef
TIKTOK_CLIENT_SECRET=abcdef1234567890abcdef1234567890
TIKTOK_REDIRECT_URI=http://localhost:4000/api/auth/tiktok/callback

# LinkedIn
LINKEDIN_CLIENT_ID=86abcdef123456
LINKEDIN_CLIENT_SECRET=abcdef1234567890
LINKEDIN_ORGANIZATION_URN=urn:li:organization:12345678
LINKEDIN_REDIRECT_URI=http://localhost:4000/api/auth/linkedin/callback

SYNC_INTERVAL_MINUTES=15
```

### 7.2. Khởi động Backend & Frontend
Mở 2 cửa sổ terminal tại thư mục gốc `SEE_content_connector`:

* **Terminal 1 (Backend - Cổng 4000):**
  ```powershell
  npm run dev:backend
  ```
  *Chờ thông báo: `[server] SEE Content Connector backend running on port 4000`*

* **Terminal 2 (Frontend - Cổng 3002):**
  ```powershell
  npm run dev:frontend
  ```
  *Chờ thông báo: `Ready in ... http://localhost:3002`*

### 7.3. Thực hiện kết nối qua giao diện Web
1. Mở trình duyệt web và truy cập vào trang kết nối:
   👉 **[http://localhost:3002/connections](http://localhost:3002/connections)**
2. Bạn sẽ thấy danh sách 4 nền tảng: **Facebook**, **Instagram**, **TikTok**, **LinkedIn**.
3. Bấm nút **Connect** bên cạnh từng nền tảng:
   * Trình duyệt sẽ chuyển hướng đến màn hình xác thực chính thức của mạng xã hội tương ứng.
   * Đăng nhập và bấm **Cho phép / Approve / Authorize**.
   * Sau khi hoàn tất, hệ thống sẽ tự động chuyển hướng quay lại trang `http://localhost:3002/connections?connected={platform}`.
   * Thẻ nền tảng sẽ đổi sang trạng thái **Connected (Màu xanh lá)** kèm thời gian hết hạn token.
4. Chuyển sang trang chủ **Dashboard** (`http://localhost:3002`):
   * Bấm nút **Sync now** ở góc trên bên phải để kích hoạt việc kéo các bài viết mới nhất từ 4 kênh về máy.
   * Kiểm tra số liệu tại các trang **/assets**, **/posts** và **/analytics**.

---

## 8. BẢNG KIỂM TRA & KHẮC PHỤC LỖI THƯỜNG GẶP

| Triệu chứng / Thông báo lỗi | Nguyên nhân khả dĩ | Cách khắc phục xử lý |
| :--- | :--- | :--- |
| **`credentials are not configured`** khi bấm Connect | File `.env` chưa có thông tin hoặc Backend chưa nhận được file `.env` mới | Kiểm tra xem đã copy file `.env.example` thành `.env` chưa. Khởi động lại terminal Backend (`Ctrl + C` rồi chạy lại `npm run dev:backend`). |
| **`redirect_uri mismatch`** hoặc **`Invalid redirect_uri`** | Redirect URI khai báo trên Developer Console không khớp với Backend | Kiểm tra đúng từng ký tự: `http://localhost:4000/api/auth/{platform}/callback` (chú ý port `4000`, giao thức `http`, không có khoảng trắng thừa hay dấu gạch chéo `/` ở cuối). |
| **TikTok: `Scope not authorized`** | App trên TikTok vẫn ở chế độ Sandbox và tài khoản chưa được phân quyền | Vào TikTok Developer → App của bạn → Tab **Sandbox** → Bấm **Add member** → Nhập username TikTok của bạn rồi thử lại. |
| **Instagram: Không lấy được bài viết hoặc ID rỗng** | Tài khoản IG chưa liên kết với Facebook Fanpage hoặc là tài khoản Personal | Mở Facebook Page → Cài đặt → Tài khoản đã liên kết → Kết nối lại tài khoản Instagram (phải là Professional / Business account). |
| **Facebook: `(#10) Application does not have permission`** | App ở chế độ Development và tài khoản của bạn chưa có vai trò Admin/Tester | Vào Meta Developer → App roles → Roles → Đảm bảo Facebook UID của bạn có vai trò Admin hoặc Developer. |
| **LinkedIn: `403 Access Denied`** | Chưa đăng ký gói Community Management API | Vào LinkedIn Developers → App của bạn → Tab **Products** → Bấm Request Access cho **Community Management API**. |
| **Token hết hạn (`Token expired`)** | Token OAuth ngắn hạn đã hết hạn sau vài ngày | Vào lại `/connections` và bấm **Connect** lại để làm mới token, hoặc sử dụng System User token vĩnh viễn đối với Meta. |
