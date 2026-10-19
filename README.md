# 🚀 SEE Content Connector

Hệ thống quản lý, đồng bộ và phân tích hiệu suất nội dung đa nền tảng mạng xã hội (**Facebook Pages · Instagram Professional · TikTok Content · LinkedIn**), tích hợp cơ chế tự động duy trì Token không bao giờ hết hạn (**Self-Healing Token Engine**) và sẵn sàng triển khai 1-click lên nền tảng **Render Cloud**.

---

## 📌 CÁC TÍNH NĂNG NỔI BẬT

1. **Đồng bộ nội dung tự động & Live Insights**:
   * Tự động quét và kéo toàn bộ bài viết thực tế (Reels, Videos, Photos, Posts) từ Facebook Graph API.
   * Tiến trình nền (Sync Worker) chạy tự động mỗi 15 phút cập nhật số liệu: Lượt tiếp cận (Reach), Lượt hiển thị (Impressions), Lượt thích (Likes), Bình luận (Comments), Chia sẻ (Shares).
2. **Cơ chế Token Vĩnh Viễn & Tự Phục Hồi (Self-Healing Token Engine)**:
   * **Meta (Facebook/Instagram)**: Tự động đổi token ngắn hạn thành **Permanent Page Access Token (Không bao giờ hết hạn)**.
   * **TikTok & LinkedIn**: Cron worker tự động làm mới token trước hạn 7 ngày qua `refresh_token`.
   * **Graceful Degradation (Chống sập dữ liệu)**: Khi token hết hạn hoặc session chết, **toàn bộ 100% bài viết và biểu đồ cũ được bảo lưu an toàn**, hệ thống hiển thị banner cảnh báo và nút 1-Click Update trên Web.
3. **Bảng điều khiển trực quan (Interactive Dashboard)**:
   * Biểu đồ xu hướng Tiếp cận & Hiển thị (Reach/Impressions LineChart) theo 7d / 30d / 90d.
   * Biểu đồ phân tích tương tác theo ngày (Likes · Comments · Shares Stacked Bar).
   * **Bảng xếp hạng Top 5 nội dung được ưa chuộng nhất** (Top Viral Content) dựa trên thuật toán chấm điểm Viral Score (0–100).
4. **Cửa sổ phân tích chuyên sâu từng bài viết (Asset Detail Modal)**:
   * Bấm vào bất kỳ bài viết nào để xem toàn bộ thông số KPI kỹ thuật, tỷ lệ xem hết clip (Completion rate) và đường tăng trưởng qua từng ngày.
5. **Giao diện Quản lý Token 1-Click (`/connections`)**:
   * Kiểm tra trực tiếp độ sống của Token (Test Live Connection) và form dán Token mới trực tiếp trên web không cần restart server.

---

## 📂 CẤU TRÚC CODEBASE

```
SEE_content_connector/
├── .env                              # Biến môi trường local (KHÔNG commit lên Git)
├── .env.example                      # Mẫu biến môi trường
├── .gitignore                        # Cấu hình loại trừ file nhạy cảm và build cache
├── render.yaml                       # Blueprint triển khai 1-click lên Render Cloud
├── Dockerfile.backend                # Container image cho Backend API & Worker
├── Dockerfile.frontend               # Container image cho Next.js Frontend
│
├── backend/                          # Express REST API & Sync Worker
│   ├── index.js                      # Entrypoint khởi chạy server
│   ├── package.json                  # Dependencies: pg, redis, node-cron, express
│   └── lib/
│       ├── db.js                     # Kết nối PostgreSQL (Hỗ trợ DATABASE_URL trên Render + SSL)
│       ├── schema.sql                # Auto-migration cấu trúc bảng (asset, metrics, connections)
│       ├── platforms.js              # Client tích hợp API 4 nền tảng & Token Exchange
│       ├── sync.js                   # Tiến trình nền tự động đồng bộ bài viết mỗi 15 phút
│       ├── store.js                  # Tầng truy xuất dữ liệu (Data Access Layer)
│       ├── routes.js                 # Danh sách các REST API endpoints
│       └── demo.js                   # Xử lý fallback in-memory an toàn
│
└── frontend/                         # Next.js 14 Frontend (React + TypeScript + Tailwind)
    ├── package.json                  # Dependencies: next, react, recharts, tailwindcss
    ├── next.config.js                # Cấu hình proxy /api/* trỏ sang BACKEND_URL
    ├── components/
    │   ├── Layout.tsx                # Khung điều hướng chung của ứng dụng
    │   ├── Badge.tsx                 # Huy hiệu màu sắc theo nền tảng & trạng thái
    │   └── AssetDetailModal.tsx      # Modal chi tiết hiệu năng & biểu đồ của bài viết
    └── pages/
        ├── index.tsx                 # Dashboard tổng quan, biểu đồ xu hướng & Top Viral
        ├── assets.tsx                # Danh sách bài viết dạng thẻ, bộ lọc & xem chi tiết
        ├── connections.tsx           # Quản lý kết nối OAuth, kiểm tra live & cập nhật Token
        ├── analytics.tsx             # Trang biểu đồ phân tích chuyên sâu đa nền tảng
        └── posts.tsx                 # Bảng giám sát chi tiết trạng thái bài đăng
```

---

## 💻 HƯỚNG DẪN KHỞI CHẠY DƯỚI LOCAL

### 1. Yêu cầu môi trường
* Node.js 18 trở lên
* Trình duyệt Chrome / Edge

### 2. Cài đặt thư viện
```bash
# Cài đặt cho Backend
cd backend
npm install

# Cài đặt cho Frontend
cd ../frontend
npm install
```

### 3. Cấu hình file `.env`
Sao chép `.env.example` thành `.env` tại thư mục gốc và điền thông tin Meta App:
```env
PORT=4000
FRONTEND_URL=http://localhost:3002

META_APP_ID=2164310081130365
META_APP_SECRET=673e67c6db6625efbea91fc9185f0a24
META_PAGE_ID=669359189587951
META_PAGE_ACCESS_TOKEN=your_page_access_token_here
```

### 4. Khởi chạy
Mở 2 cửa sổ terminal:
```bash
# Terminal 1: Backend (Chạy tại cổng 4000)
cd backend
npm run dev

# Terminal 2: Frontend (Chạy tại cổng 3002)
cd frontend
npm run dev
```
Truy cập giao diện tại: **`http://localhost:3002`**.

---

## 🔒 PHASE 3: QUY TRÌNH ĐẨY MÃ NGUỒN LÊN GITHUB

> [!IMPORTANT]
> File `.gitignore` đã được cấu hình chặt chẽ để **loại trừ vĩnh viễn file `.env` và thư mục `node_modules/`**. Không bao giờ đẩy token bí mật lên GitHub!

### Các lệnh Git CLI thực hiện:
Mở PowerShell tại thư mục `SEE_content_connector`:

```powershell
# 1. Khởi tạo Git repository (nếu chưa có)
git init

# 2. Thêm toàn bộ mã nguồn sạch
git add .

# 3. Commit phiên bản hoàn thiện
git commit -m "feat: complete see content connector with self-healing token engine and render blueprint"

# 4. Đổi tên nhánh sang main
git branch -M main

# 5. Liên kết tới GitHub Repository của bạn (tạo repo mới trên github.com trước)
git remote add origin https://github.com/<tai-khoan-cua-ban>/see-content-connector.git

# 6. Push mã nguồn lên GitHub
git push -u origin main
```

---

## ☁️ PHASE 4: TRIỂN KHAI LÊN CLOUD RENDER.COM

Hệ thống đã có sẵn tệp cấu hình **[render.yaml](file:///c:/Users/Acer/Desktop/My%20carrer/SEE/SEE_content_connector/render.yaml)** (Infrastructure as Code) giúp triển khai tự động toàn bộ hạ tầng trong 1 click.

### Cách 1: Triển khai 1-Click bằng Blueprint (Khuyên dùng)
1. Đăng nhập [dashboard.render.com](https://dashboard.render.com).
2. Bấm nút **New +** ở góc phải $\rightarrow$ Chọn **Blueprint**.
3. Chọn Repository GitHub bạn vừa push ở Phase 3.
4. Render sẽ tự động đọc file `render.yaml` và hiển thị 3 dịch vụ sẽ tạo:
   * **`see-content-connector-db`**: Database PostgreSQL (Free 1GB).
   * **`see-content-connector-api`**: Backend Web Service (Node.js).
   * **`see-content-connector-web`**: Frontend Dashboard (Next.js).
5. Bấm **Apply**.
6. Sau khi tạo xong, vào tab **Environment** của `see-content-connector-api` và điền:
   * `META_APP_ID`: `2164310081130365`
   * `META_APP_SECRET`: `673e67c6db6625efbea91fc9185f0a24`
   * `META_PAGE_ID`: `669359189587951`
   * `META_PAGE_ACCESS_TOKEN`: *(Dán Page Token mới của bạn)*
7. Bấm **Save Changes**. Hệ thống sẽ tự động đồng bộ bài viết 24/7 trên Cloud!

---

### Cách 2: Triển khai thủ công từng dịch vụ trên Render

#### Bước 1: Tạo PostgreSQL Database
* Bấm **New +** $\rightarrow$ **PostgreSQL**.
* Name: `see-content-connector-db` | Database: `see_content_connector` | Region: `Singapore` | Plan: `Free`.
* Sao chép **Internal Database URL** sau khi tạo xong.

#### Bước 2: Tạo Backend Web Service
* Bấm **New +** $\rightarrow$ **Web Service** $\rightarrow$ Chọn GitHub Repo.
* Name: `see-content-connector-api` | Region: `Singapore`.
* Root Directory: `backend` | Runtime: `Node`.
* Build Command: `npm install` | Start Command: `node index.js`.
* Health Check Path: `/api/health`.
* Environment Variables:
  * `NODE_ENV`: `production`
  * `PORT`: `10000`
  * `DATABASE_URL`: *(Dán URL PostgreSQL ở Bước 1)*
  * `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`
* Lưu và lấy đường link Backend: `https://see-content-connector-api.onrender.com`.

#### Bước 3: Tạo Frontend Web Service
* Bấm **New +** $\rightarrow$ **Web Service** $\rightarrow$ Chọn cùng GitHub Repo.
* Name: `see-content-connector-web` | Region: `Singapore`.
* Root Directory: `frontend` | Runtime: `Node`.
* Build Command: `npm install && npm run build` | Start Command: `npm start`.
* Environment Variables:
  * `NODE_ENV`: `production`
  * `BACKEND_URL`: `https://see-content-connector-api.onrender.com` (Link backend ở Bước 2).
* Bấm **Create Web Service**. Khi deploy hoàn tất, bạn đã có đường link web chính thức chạy vĩnh viễn trên internet!

---

## 🔄 PHASE 5: CẬP NHẬT OAUTH CALLBACK TRÊN DEVELOPER PORTAL

Sau khi có link Backend trên Render:
1. Mở [Meta for Developers](https://developers.facebook.com/apps/2164310081130365/).
2. Vào **Facebook Login** $\rightarrow$ **Settings** $\rightarrow$ **Valid OAuth Redirect URIs**.
3. Thêm URL: `https://see-content-connector-api.onrender.com/api/auth/facebook/callback`.
4. Bấm **Save Changes**.
