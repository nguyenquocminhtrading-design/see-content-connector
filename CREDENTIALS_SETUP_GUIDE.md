# 🔑 HƯỚNG DẪN LẤY CREDENTIALS — SEE Content Connector

> Hướng dẫn từng bước lấy **toàn bộ ID/Token** cho Facebook · Instagram · LinkedIn · TikTok
> để điền vào file `.env` của dự án. Làm theo đúng thứ tự: **Meta (FB+IG) → TikTok → LinkedIn**.

---

## 📋 Tổng quan: Bạn sẽ lấy được gì?

| # | Nền tảng | Biến trong `.env` | Lấy ở đâu |
|---|----------|-------------------|-----------|
| 1 | Facebook | `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` | developers.facebook.com |
| 2 | Instagram | `INSTAGRAM_BUSINESS_ACCOUNT_ID` (dùng chung Meta App) | Graph API Explorer |
| 3 | TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | developers.tiktok.com |
| 4 | LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ORGANIZATION_URN` | linkedin.com/developers |

> 💡 **Chi phí: 0 đồng.** Tất cả developer account đều miễn phí. Chỉ cần có sẵn:
> - 1 tài khoản Facebook cá nhân (đã xác thực)
> - 1 Facebook Page cho doanh nghiệp (tạo miễn phí nếu chưa có)
> - Instagram đang ở chế độ **Professional (Business/Creator)** và **đã liên kết với Page**
> - Tài khoản LinkedIn cá nhân + 1 Company Page (tạo miễn phí)
> - Tài khoản TikTok

---

# 1️⃣ FACEBOOK (Meta) — `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`

## Bước 1.1 — Đăng ký Meta Developer Account

1. Truy cập **https://developers.facebook.com**
2. Đăng nhập bằng tài khoản Facebook cá nhân của bạn
3. Góc phải trên → **Get Started** (nếu chưa từng đăng ký)
4. Chọn loại tài khoản: **Business** → điền tên, email → xác nhận email xác minh
5. Xác minh danh tính bằng **số điện thoại** (bắt buộc để dùng Graph API):
   - Vào **https://developers.facebook.com/settings?tab=mobile** → Add phone number → nhập mã OTP

## Bước 1.2 — Tạo App

1. Vào **https://developers.facebook.com/apps**
2. Nhấn **Create App**
3. Chọn Use case: **Manage everything in your Page** (hoặc "Business" nếu menu khác) → **Next**
4. Điền:
   - **App name:** `SEE Content Connector`
   - **App contact email:** email của bạn
   - **Business Account:** chọn business của bạn (hoặc skip)
5. Nhấn **Create App** → nhập mật khẩu Facebook để xác nhận

## Bước 1.3 — Lấy `META_APP_ID` và `META_APP_SECRET`

1. Trong dashboard app, vào menu trái: **App settings → Basic**
2. Copy **App ID** → đây chính là `META_APP_ID`
3. Nhấn **Show** cạnh **App Secret** (nhập lại mật khẩu) → copy → `META_APP_SECRET`
4. Kéo xuống, điền:
   - **Privacy Policy URL** (bắt buộc để switch sang Live — có thể dùng tạm URL GitHub Pages của bạn)
   - **App Domain:** `localhost` (khi dev)
5. Nhấn **Save Changes**

> ⚠️ **Bảo mật:** Không đưa App Secret vào git. File `.env` đã được `.gitignore` loại trừ.

## Bước 1.4 — Thêm vai trò Tester (quan trọng cho chế độ Development)

App ở chế độ **Development** chỉ hoạt động với người dùng có vai trò trong app:

1. Menu trái: **App roles → Roles**
2. Nhấn **Add People** → nhập ID/email Facebook của chính bạn
3. Vai trò: **Admin** (bạn) hoặc **Tester** (người khác muốn test)
4. Người được thêm phải **chấp nhận lời mời** từ mục Apps và Pages trong Settings cá nhân của họ

## Bước 1.5 — Lấy `META_PAGE_ID`

**Cách A — từ URL Page (nhanh nhất):**
1. Mở Facebook Page của bạn
2. Vào **Settings → Page transparency** (hoặc tab **About/ Giới thiệu**)
3. Cuối trang có dòng **Page ID** → copy

**Cách B — qua Graph API Explorer (làm luôn ở Bước 1.6):**
1. Mở **https://developers.facebook.com/tools/explorer/**
2. Ở ô **Access Token**, chọn app của bạn → **Generate Access Token** → tick quyền `pages_show_list`, `pages_read_engagement`
3. Dán request: `GET /me/accounts`
4. Trong JSON trả về, copy `"id"` của Page → `META_PAGE_ID`

## Bước 1.6 — Lấy `META_PAGE_ACCESS_TOKEN` (token dài hạn)

> Đây là bước quan trọng nhất. Quy trình: **User token → Page token → Extended Page token (60 ngày) → System User token (không hết hạn, cần Business Portfolio)**.

**Cách A — qua Graph API Explorer (đơn giản, token 60 ngày):**

1. Mở **https://developers.facebook.com/tools/explorer/**
2. Chọn app `SEE Content Connector`
3. **Generate Access Token**, tick các quyền:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_manage_insights`
4. Trong ô request nhập: `me/accounts?fields=access_token` → **Submit**
5. JSON trả về chứa `access_token` của Page — token này là **Page token** (đã rất lâu hạn khi app ở Live mode; Development mode: 60 ngày)
6. Copy nó vào `META_PAGE_ACCESS_TOKEN`

**Mở rộng thành token 60 ngày rõ ràng (nếu cần):**
```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={META_APP_ID}
  &client_secret={META_APP_SECRET}
  &fb_exchange_token={user_token_buoc_3}
```
→ Lấy `access_token` trả về (long-lived user token ~60 ngày), rồi gọi lại `/{META_PAGE_ID}?fields=access_token` với token đó để có **Page token dài hạn**.

**Cách B — System User token không bao giờ hết hạn (khuyến nghị cho production):**
1. Tạo **Business Portfolio** tại **https://business.facebook.com** (miễn phí) nếu chưa có
2. Vào **Business Settings → Users → System users** → **Add**
   - Tên: `SEE Connector Bot`, vai trò: **Admin**
3. Trong trang System User vừa tạo → **Generate new token**
   - Chọn app `SEE Content Connector`
   - Expiration: **Never**
   - Permissions: tick đủ 5 quyền ở trên
4. Copy token → `META_PAGE_ACCESS_TOKEN`
5. Gán Page cho System User: **Business Settings → Accounts → Pages** → chọn Page → **Add People** → chọn `SEE Connector Bot` → bật **Manage Page**

**Kiểm tra token sống khỏe:**
```
GET https://graph.facebook.com/v19.0/me?access_token={META_PAGE_ACCESS_TOKEN}
→ trả về {"name":"Tên Page","id":"..."} là OK
```

## Bước 1.7 — Điền vào `.env`

```env
META_APP_ID=123456789012345
META_APP_SECRET=abc123def456...
META_PAGE_ID=987654321098765
META_PAGE_ACCESS_TOKEN=EAAG...(token rất dài)
```

---

# 2️⃣ INSTAGRAM — `INSTAGRAM_BUSINESS_ACCOUNT_ID`

> Instagram **dùng chung** Meta App ở Bước 1 (Graph API). Không cần tạo app riêng.

## Bước 2.1 — Chuyển Instagram sang tài khoản Professional (nếu chưa)

1. Mở app Instagram → **Settings → Account type and tools**
2. **Switch to professional account** → chọn **Business** (hoặc Creator)
3. Điền thông tin danh mục → xong

## Bước 2.2 — Liên kết Instagram với Facebook Page

1. Mở Facebook Page của bạn → **Settings → Linked accounts** (hoặc **Instagram**)
2. **Connect account** → đăng nhập Instagram
3. Kiểm tra: vào **Page → Instagram tab** thấy feed IG hiện lên là OK

> ⚠️ Nếu đã từng liên kết với Page khác, phải ngắt kết nối cũ trước.

## Bước 2.3 — Lấy `INSTAGRAM_BUSINESS_ACCOUNT_ID`

1. Mở lại **Graph API Explorer** (https://developers.facebook.com/tools/explorer/)
2. Generate token với quyền `instagram_basic`, `instagram_manage_insights`, `pages_show_list`
3. Gọi request:
   ```
   GET /{META_PAGE_ID}?fields=instagram_business_account
   ```
   (thay `META_PAGE_ID` bằng ID lấy ở Bước 1.5)
4. JSON trả về:
   ```json
   {"instagram_business_account": {"id": "17841400000000000"}}
   ```
5. Copy `17841400000000000` → `INSTAGRAM_BUSINESS_ACCOUNT_ID`

**Kiểm tra:**
```
GET https://graph.facebook.com/v19.0/{INSTAGRAM_BUSINESS_ACCOUNT_ID}
  ?fields=username,followers_count,media_count
  &access_token={META_PAGE_ACCESS_TOKEN}
```

## Bước 2.4 — Điền vào `.env`

```env
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400000000000
```

---

# 3️⃣ TIKTOK — `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

## Bước 3.1 — Đăng ký TikTok for Developers

1. Truy cập **https://developers.tiktok.com**
2. Đăng nhập bằng tài khoản TikTok → **Manage apps** (góc phải trên → **Connect**)
3. Hoàn tất hồ sơ developer: tên, email, xác minh email

## Bước 3.2 — Tạo App

1. **Manage apps → Connect a new app**
2. Điền:
   - **App name:** `SEE Content Connector`
   - **Category:** Business / Marketing
   - **Description:** mô tả ngắn về dashboard nội bộ
3. Upload icon (bất kỳ logo 512×512)
4. Đồng ý điều khoản → **Create**

## Bước 3.3 — Lấy `TIKTOK_CLIENT_KEY` và `TIKTOK_CLIENT_SECRET`

1. Trong trang app vừa tạo → tab **Basic information**
2. Copy **Client Key** → `TIKTOK_CLIENT_KEY`
3. Nhấn **Show** ở **Client Secret** → copy → `TIKTOK_CLIENT_SECRET`

## Bước 3.4 — Cấu hình Redirect URI & Scopes

1. Tab **Basic information** → mục **Redirect URI** → thêm:
   ```
   http://localhost:4000/api/auth/tiktok/callback
   ```
   (đúng nguyên văn, kể cả `http` — TikTok cho phép localhost khi dev)
2. Tab **Products** → **Add products** → chọn **Content Posting API** và **Display API**
3. Với **Display API** → cấu hình scopes: `user.info.basic`, `video.list`, `video.insights`
4. Submit để xin duyệt scopes (xem mục ⏳ bên dưới)

## Bước 3.5 — Sandbox mode (test ngay không cần chờ duyệt)

App mới nằm ở **Sandbox** — chỉ login được bằng tài khoản bạn thêm vào sandbox:

1. Tab **Sandbox** (trong app) → **Add members** → thêm chính TikTok username của bạn
2. Khi OAuth flow, đăng nhập đúng tài khoản đó là lấy được token và pull video list
3. Backend của dự án chạy OAuth đầy đủ: mở `http://localhost:3001/connections` → **Connect tiktok**

## Bước 3.6 — Điền vào `.env`

```env
TIKTOK_CLIENT_KEY=sbawxxxxxxxxxxxxxxx
TIKTOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
TIKTOK_REDIRECT_URI=http://localhost:4000/api/auth/tiktok/callback
```

---

# 4️⃣ LINKEDIN — `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ORGANIZATION_URN`

## Bước 4.1 — Chuẩn bị Company Page

Cần 1 LinkedIn Company Page (tạo miễn phí):
1. LinkedIn → **For Business** (góc phải trên) → **Create a Company Page** (https://www.linkedin.com/company/setup/new/)
2. Điền tên công ty (vd: `SEE`), website, ngành nghề → Create
3. Bạn tự động là **Super Admin** của page

## Bước 4.2 — Tạo App

1. Truy cập **https://www.linkedin.com/developers/apps**
2. **Create app** — điền:
   - **App name:** `SEE Content Connector`
   - **LinkedIn Page:** chọn Company Page ở Bước 4.1 (bắt buộc)
   - **App description:** mô tả ngắn
   - Tick đồng ý điều khoản → **Create app**
3. Xác minh email app trong tab **Settings** nếu được yêu cầu

## Bước 4.3 — Lấy `LINKEDIN_CLIENT_ID` và `LINKEDIN_CLIENT_SECRET`

1. Vào tab **Auth** của app
2. Copy **Client ID** → `LINKEDIN_CLIENT_ID`
3. Nhấn biểu tượng mắt ở **Client secret** → copy → `LINKEDIN_CLIENT_SECRET`

## Bước 4.4 — Cấu hình Redirect URI

1. Vẫn ở tab **Auth** → mục **OAuth 2.0 settings → Redirect URLs**
2. Thêm:
   ```
   http://localhost:4000/api/auth/linkedin/callback
   ```
3. **Save**

## Bước 4.5 — Xin quyền API (Products)

1. Tab **Products**
2. Request 2 sản phẩm (miễn phí, duyệt tự động phần lớn):
   - **Community Management API** (để đọc/đăng bài lên Page) → tick → Submit
   - **Share on LinkedIn** (đăng bài cá nhân, nếu cần)
3. Đợi duyệt — thường **vài phút đến vài ngày**. Khi được duyệt, scopes `r_organization_social`, `w_organization_social` khả dụng.

## Bước 4.6 — Lấy `LINKEDIN_ORGANIZATION_URN`

**Cách A — từ URL Company Page (nhanh):**
1. Mở Company Page → nhìn URL:
   ```
   https://www.linkedin.com/company/1234567/admin/
                              ↑ đây là ID
   ```
2. URN = `urn:li:organization:1234567`

**Cách B — qua API (sau khi có token):**
1. Lấy access token qua OAuth flow của dashboard (`/connections` → Connect linkedin)
2. Gọi:
   ```
   GET https://api.linkedin.com/v2/organizationAcl?q=roleAssignee
   Authorization: Bearer {token}
   X-Restli-Protocol-Version: 2.0.0
   ```
3. JSON trả về chứa `organization: urn:li:organization:1234567`

## Bước 4.7 — Điền vào `.env`

```env
LINKEDIN_CLIENT_ID=86xxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxx
LINKEDIN_ORGANIZATION_URN=urn:li:organization:1234567
LINKEDIN_REDIRECT_URI=http://localhost:4000/api/auth/linkedin/callback
```

---

# 5️⃣ HOÀN TẤT — Chạy thử toàn bộ

## Bước 5.1 — Tạo file `.env`

```powershell
Copy-Item .env.example .env
notepad .env   # điền các giá trị đã lấy ở trên
```

## Bước 5.2 — Khởi động

```powershell
# Terminal 1 — backend (port 4000)
npm run dev:backend

# Terminal 2 — frontend (port 3001)
npm run dev:frontend
```

## Bước 5.3 — Kiểm tra

| Việc | Cách kiểm tra |
|------|---------------|
| Backend sống | mở http://localhost:4000/api/health → `"status":"ok"` |
| Chế độ DB | `"mode":"postgresql"` nếu đang chạy docker postgres, `"demo"` nếu không |
| Kết nối nền tảng | mở http://localhost:3001/connections → bấm **Connect {platform}** |
| OAuth flow | trình duyệt redirect tới platform → approve → về `/connections?connected=...` |
| Data sync | bấm **Sync now** ở Dashboard hoặc đợi cron 15 phút |
| Xuất báo cáo | http://localhost:4000/api/export/report.csv?range=30 |

---

# ⏳ LƯU Ý VỀ APP REVIEW (quan trọng)

| Platform | Development (ngay lập tức) | Production (cần review) |
|----------|---------------------------|--------------------------|
| **Meta (FB/IG)** | Hoạt động với Admin/Tester/Developer của app; data thật | Switch app sang **Live** + Privacy Policy URL; một số quyền nâng cao cần screencast duyệt |
| **TikTok** | Sandbox: chỉ member bạn thêm vào | Submit app audit (scopes `video.list`, `video.insights`) — duyệt trong vài ngày |
| **LinkedIn** | Community Management API duyệt tự động | Nếu cần `w_organization_social` mở rộng → submit review, 1–2 tuần |

> 💡 Với dashboard nội bộ team SEE, chạy ở **Development mode** là đủ — mọi người thêm vai trò Tester là dùng được, không cần chờ review.

---

# 🛠️ TROUBLESHOOTING

| Lỗi | Nguyên nhân & cách sửa |
|-----|------------------------|
| `(#10) Application does not have permission for this action` | Chưa thêm role cho user, hoặc app chưa switch Live với quyền đó. Kiểm tra Bước 1.4 |
| `Error validating access token` | Token hết hạn → generate lại (Bước 1.6), hoặc dùng System User token (Never expire) |
| Instagram trả về rỗng | IG chưa phải Professional account hoặc chưa link với Page → Bước 2.1–2.2 |
| TikTok `scope not authorized` | App đang sandbox → thêm tài khoản TikTok của bạn vào Sandbox members (Bước 3.5) |
| LinkedIn `403 field not visible` | Chưa được duyệt Community Management API → chờ hoặc kiểm tra tab Products |
| `redirect_uri mismatch` | URI trong `.env` phải **khớp ký tự** với URI khai báo trên developer console (kể cả dấu `/` cuối) |
| Backend báo `credentials are not configured` | File `.env` chưa có/chưa điền → copy từ `.env.example`, restart backend |

---

*Tài liệu tạo kèm SEE Content Connector v1.0 — 18/10/2026*
