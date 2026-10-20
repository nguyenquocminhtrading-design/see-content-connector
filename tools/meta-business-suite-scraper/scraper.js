const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { normalizeRow } = require('./normalize');

const ROOT = __dirname;
const PROFILE = path.join(ROOT, '.profile');
const OUTPUT = path.join(ROOT, 'output.json');
const BUSINESS_SUITE_URL = process.env.META_BUSINESS_SUITE_URL || 'https://business.facebook.com/latest/content/all';

async function login() {
  const browser = await chromium.launchPersistentContext(PROFILE, { headless: false });
  const page = await browser.newPage();
  await page.goto(BUSINESS_SUITE_URL, { waitUntil: 'domcontentloaded' });
  console.log('Đăng nhập Business Suite thủ công, xử lý 2FA nếu có, rồi nhấn Enter trong terminal.');
  await new Promise((resolve) => process.stdin.once('data', resolve));
  await browser.close();
}

async function scrape() {
  const browser = await chromium.launchPersistentContext(PROFILE, { headless: false });
  const page = await browser.newPage();
  await page.goto(BUSINESS_SUITE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const table = await page.locator('[role="table"]').first();
  const extracted = await table.evaluate((node) => {
    const headers = [...node.querySelectorAll('[role="columnheader"]')].map((el) => (el.innerText || '').trim());
    const rows = [...node.querySelectorAll('[role="row"]')].slice(1).map((row) => {
      const cells = [...row.querySelectorAll('[role="gridcell"], [role="cell"]')];
      const values = Object.fromEntries(cells.map((cell, index) => [headers[index] || `column${index}`, (cell.innerText || '').trim()]));
      const links = [...row.querySelectorAll('a')].map((a) => a.href).filter(Boolean);
      return { values, links };
    });
    return { headers, rows };
  });
  const normalized = extracted.rows.map((row) => normalizeRow({
    ...row.values,
    platformPostId: (row.links.find((url) => /facebook\.com/.test(url)) || '').match(/(\d+_\d+)/)?.[1] || null,
  }));
  if (!extracted.headers.length) throw new Error('Không tìm thấy header bảng Business Suite');
  fs.writeFileSync(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), rows: normalized }, null, 2));
  console.log(`Đã ghi ${normalized.length} dòng vào ${OUTPUT}`);
  await browser.close();
}

const command = process.argv[2];
if (command === 'login') login().catch((error) => { console.error(error.message); process.exitCode = 1; });
else if (command === 'scrape') scrape().catch((error) => { console.error(error.message); process.exitCode = 1; });
else console.error('Dùng: npm run login hoặc npm run scrape');
