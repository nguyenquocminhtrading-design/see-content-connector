# 🌐 HƯỚNG DẪN CHI TIẾT SETUP TRIỂN KHAI LÊN RENDER.COM (STEP-BY-STEP)

> **Dự án**: SEE Content Connector  
> **Kiến trúc**: PostgreSQL Managed Database + Node.js Express Backend & Sync Worker + Next.js 14 Frontend  
> **Cấu hình tự động**: Hỗ trợ Infrastructure as Code qua [`render.yaml`](file:///c:/Users/Acer/Desktop/My%20carrer/SEE/SEE_content_connector/render.yaml)

---

## 📑 MỤC LỤC
1. [Chuẩn bị trước khi triển khai (Prerequisites)](#1-chuẩn-bị-trước-khi-triển-khai)
2. [Cách 1: Triển khai 1-Click bằng Render Blueprint (Khuyên dùng)](#2-cách-1-triển-khai-1-click-bằng-render-blueprint-nhanh-nhất)
3. [Cách 2: Triển khai thủ công từng dịch vụ (Manual Step-by-Step)](#3-cách-2-triển-khai-thủ-công-từng-dịch-vụ-step-by-step)
   - [Phần A: Tạo PostgreSQL Database](#phần-a-tạo-postgresql-database)
   - [Phần B: Tạo Backend API & Sync Worker](#phần-b-tạo-backend-api--sync-worker-web-service)
   - [Phần C: Tạo Frontend Dashboard (Next.js)](#phần-c-tạo-frontend-dashboard-nextjs-web-service)
4. [Cập nhật Callback URL trên Facebook Developer Portal](#4-cập-nhật-callback-url-trên-facebook-developer-portal)
5. [Kiểm tra & Nghiệm thu hệ thống sau khi Deploy](#5-kiểm-tra--nghiệm-thu-hệ-thống-sau-khi-deploy)
6. [Mẹo vận hành cho gói Free Tier của Render (Chống ngủ đông)](#6-mẹo-vận-hành-cho-gói-free-tier-của-render-chống-ngủ-đông)

---

## 1. Chuẩn bị trước khi triển khai

### Bước 1.1: Đảm bảo code sạch & đẩy lên GitHub
1. Mở PowerShell tại thư mục dự án `SEE_content_connector`.
2. Kiểm tra file [`.gitignore`](file:///c:/Users/Acer/Desktop/My%20carrer/SEE/SEE_content_connector/.gitignore) đã chặn file `.env` và thư mục `node_modules`.
3. Chạy các lệnh Git để đẩy toàn bộ code lên GitHub:
   ```powershell
   git add .
   git commit -m "feat: ready for render cloud deployment"
   git branch -M main
   # Thay <tai-khoan-github> và <ten-repo> bằng repo của bạn
   git remote add origin https://github.com/<tai-khoan-github>/see-content-connector.git
   git push -u origin main
   ```

### Bước 1.2: Chuẩn bị sẵn các khóa API & Credentials
Hãy chuẩn bị sẵn các thông số sau (lấy từ Facebook Developer & Graph API Explorer):
- `META_APP_ID`: ID ứng dụng Meta (VD: `2164310081130365`)
- `META_APP_SECRET`: Khóa bí mật ứng dụng
- `META_PAGE_ID`: ID của Fanpage Facebook (VD: `669359189587951`)
- `META_PAGE_ACCESS_TOKEN`: Token của Trang (Page Access Token)

---

## 2. Cách 1: Triển khai 1-Click bằng Render Blueprint (Nhanh nhất)

Hệ thống đã chuẩn bị sẵn file [`render.yaml`](file:///c:/Users/Acer/Desktop/My%20carrer/SEE/SEE_content_connector/render.yaml). Render sẽ tự động dựng DB, Backend, Frontend và tự liên kết các biến môi trường giữa các dịch vụ.

### Bước 2.1: Kết nối Blueprint trên Render Dashboard
1. Truy cập: [https://dashboard.render.com](https://dashboard.render.com) và đăng nhập (bằng tài khoản GitHub).
2. Ở góc trên bên phải, bấm nút **New +** $\rightarrow$ Chọn **Blueprint**.
3. Chọn Repository GitHub `see-content-connector` vừa tạo.

### Bước 2.2: Kiểm tra các dịch vụ được tự động cấu hình
Render sẽ tự phân tích file `render.yaml` và hiển thị 3 tài nguyên:
- 🐘 **`see-content-connector-db`** (PostgreSQL - Free, Region Singapore)
- ⚙️ **`see-content-connector-api`** (Backend Node.js Web Service)
- 💻 **`see-content-connector-web`** (Frontend Next.js Web Service)

### Bước 2.3: Bấm Apply & Điền Credentials
1. Bấm **Apply**. Render sẽ bắt đầu khởi tạo cả 3 dịch vụ cùng lúc.
2. Khi Render tạo xong, vào trang chi tiết của service **`see-content-connector-api`**:
   - Chọn tab **Environment**.
   - Bổ sung giá trị cho các biến bảo mật:
     - `META_APP_ID`
     - `META_APP_SECRET`
     - `META_PAGE_ID`
     - `META_PAGE_ACCESS_TOKEN`
   - Bấm **Save Changes**. Backend sẽ tự khởi động lại và kết nối tự động.

---

## 3. Cách 2: Triển khai thủ công từng dịch vụ (Step-by-Step)

Nếu bạn muốn kiểm soát chi tiết từng dịch vụ hoặc không dùng Blueprint:

### Phần A: Tạo PostgreSQL Database

1. Trên Render Dashboard, bấm **New +** $\rightarrow$ chọn **PostgreSQL**.
2. Điền thông tin cấu hình:
   - **Name**: `see-content-connector-db`
   - **Database**: `see_content_connector`
   - **User**: `content_user`
   - **Region**: `Singapore` (khuyến nghị cho Việt Nam để tốc độ nhanh nhất)
   - **PostgreSQL Version**: Giữ mặc định (v16)
   - **Instance Type**: Chọn **Free**
3. Bấm **Create Database**.
4. Chờ 1–2 phút cho database khởi tạo xong.
5. Kéo xuống phần **Connections**, copy **Internal Database URL** (dạng `postgres://content_user:...@dpg-...-a/see_content_connector`).

---

### Phần B: Tạo Backend API & Sync Worker (Web Service)

1. Bấm **New +** $\rightarrow$ chọn **Web Service**.
2. Chọn repo GitHub `see-content-connector`.
3. Điền các thiết lập:
   - **Name**: `see-content-connector-api`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: `backend` *(Rất quan trọng!)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Chọn **Free**
4. Mở rộng phần **Advanced**:
   - **Health Check Path**: `/api/health`
5. Thêm các biến môi trường tại mục **Environment Variables**:
   | Key | Value | Ghi chú |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Bắt buộc |
   | `PORT` | `10000` | Cổng mặc định của Render |
   | `DATABASE_URL` | *(Dán Internal Database URL copy ở Phần A)* | Kết nối tới PostgreSQL |
   | `SYNC_INTERVAL_MINUTES` | `15` | Chu kỳ tự quét bài mới |
   | `META_APP_ID` | `2164310081130365` | ID ứng dụng Meta |
   | `META_APP_SECRET` | `673e67c6db6625efbea91fc9185f0a24` | Secret của Meta App |
   | `META_PAGE_ID` | `669359189587951` | ID Fanpage |
   | `META_PAGE_ACCESS_TOKEN` | *(Page Access Token của bạn)* | Token truy cập Fanpage |
6. Bấm **Create Web Service**.
7. Khi deploy thành công, copy URL của Backend (VD: `https://see-content-connector-api.onrender.com`).

---

### Phần C: Tạo Frontend Dashboard Next.js (Web Service)

1. Bấm **New +** $\rightarrow$ chọn **Web Service**.
2. Chọn cùng repo GitHub `see-content-connector`.
3. Điền các thiết lập:
   - **Name**: `see-content-connector-web`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: `frontend` *(Rất quan trọng!)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Chọn **Free**
4. Thêm các biến môi trường tại mục **Environment Variables**:
   | Key | Value | Ghi chú |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Bắt buộc |
   | `BACKEND_URL` | `https://see-content-connector-api.onrender.com` | Link Backend lấy từ Phần B |
5. Bấm **Create Web Service**.
6. Render sẽ tự động chạy build Next.js và cấp phát domain cho Frontend (VD: `https://see-content-connector-web.onrender.com`).

---

## 4. Cập nhật Callback URL trên Facebook Developer Portal

Để tính năng OAuth đăng nhập hoặc làm mới token hoạt động chuẩn xác từ Internet:

1. Đăng nhập [Meta for Developers](https://developers.facebook.com/apps/).
2. Chọn App của bạn (`SEE Content Connector`).
3. Ở menu bên trái, vào **Use cases** hoặc **Facebook Login** $\rightarrow$ **Settings**.
4. Tại mục **Valid OAuth Redirect URIs**, dán link callback của Backend Render:
   ```text
   https://see-content-connector-api.onrender.com/api/auth/facebook/callback
   ```
5. Bấm **Save Changes** ở góc dưới.

---

## 5. Kiểm tra & Nghiệm thu hệ thống sau khi Deploy

### Bước 5.1: Kiểm tra Backend Health Check
Mở trình duyệt truy cập:
`https://see-content-connector-api.onrender.com/api/health`

Kết quả trả về JSON thành công:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-10-20T...",
  "uptime": 120
}
```

### Bước 5.2: Kiểm tra dữ liệu bài viết
Truy cập:
`https://see-content-connector-api.onrender.com/api/assets`

Kiểm tra danh sách bài viết từ Facebook Page đã được tự động lưu vào PostgreSQL database.

### Bước 5.3: Truy cập Web Dashboard
Mở link Frontend: `https://see-content-connector-web.onrender.com`
- Kiểm tra các biểu đồ **Reach/Impressions Trend**.
- Kiểm tra danh sách bài viết tại trang **Assets** (`/assets`).
- Vào trang **Connections** (`/connections`) $\rightarrow$ Bấm nút **Test Live Connection** để xác thực kết nối Facebook Page đang hoạt động xanh (`healthy`).

---

## 6. Mẹo vận hành cho gói Free Tier của Render (Chống ngủ đông)

Gói Free của Render Web Service sẽ tự động **ngủ đông (Spin Down)** nếu không có yêu cầu truy cập trong vòng **15 phút**, và sẽ mất khoảng 30–50 giây để khởi động lại ở lần truy cập tiếp theo.

### Cách giữ hệ thống luôn thức 24/7 (Miễn phí):
1. Truy cập dịch vụ giám sát miễn phí [UptimeRobot](https://uptimerobot.com) hoặc [Cron-job.org](https://cron-job.org).
2. Tạo 1 monitor mới:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `SEE Backend Keep-Alive`
   - **URL**: `https://see-content-connector-api.onrender.com/api/health`
   - **Monitoring Interval**: Mỗi **10 phút** (Every 10 minutes)
3. Khi có request đều đặn mỗi 10 phút, Backend và tiến trình Cron Worker sẽ luôn thức để quét dữ liệu tự động mà không bị ngắt quãng.
