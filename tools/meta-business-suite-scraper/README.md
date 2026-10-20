# Meta Business Suite scraper

Chạy local, không commit `.profile` hoặc `output.json`.

```powershell
npm install
npx playwright install chromium
npm run login
npm run scrape
```

Scraper không nhận password, không đọc access token và không vượt CAPTCHA/checkpoint. Người dùng đăng nhập thủ công trong cửa sổ Chromium.

Sau khi có `output.json`, gửi phần `rows` tới `POST /api/import/meta-business-suite` với header `x-import-secret`.
