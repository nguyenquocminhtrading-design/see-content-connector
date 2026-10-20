const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const store = require('./store');

const DEFAULT_DIR = path.resolve(__dirname, '../../excel');
const importedFileVersions = new Map();

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(value); value = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value); value = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else value += ch;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\u2011/g, '-');
  if (!raw || raw === '--' || /^n\/?a$/i.test(raw)) return null;
  const duration = raw.match(/(?:(\d+)\s*giờ\s*)?(?:(\d+)\s*phút\s*)?(?:(\d+(?:[.,]\d+)?)\s*giây)?/i);
  if (duration && duration[0].trim() === raw && (duration[1] || duration[2] || duration[3])) {
    return Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(String(duration[3] || 0).replace(',', '.'));
  }
  const compact = raw.replace(/\s/g, '');
  const suffix = compact.slice(-1).toUpperCase();
  if (['K', 'M', 'B'].includes(suffix)) {
    const n = Number(compact.slice(0, -1).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * ({ K: 1e3, M: 1e6, B: 1e9 }[suffix])) : null;
  }
  const n = Number(compact.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeRow(headers, cells, pageId) {
  const row = Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), cells[index] ?? '']));
  const shortId = String(row['id bài viết'] || '').trim();
  if (!shortId) return { error: 'missing_post_id' };
  const platformPostId = shortId.includes('_') ? shortId : `${pageId}_${shortId}`;
  return {
    platformPostId,
    metrics: {
      reach: parseNumber(row['lượt phân phối']),
      impressions: parseNumber(row['lượt hiển thị']),
      engagements: parseNumber(row['lượt tương tác']),
      comments: parseNumber(row['bình luận']),
      netFollowers: parseNumber(row['số người theo dõi thực']),
      likes: parseNumber(row['cảm xúc']),
      shares: parseNumber(row['lượt chia sẻ']),
      watchTimeSeconds: parseNumber(row['số giây xem']),
      averageWatchTimeSeconds: parseNumber(row['số giây xem trung bình']),
      viewers: parseNumber(row['người xem']),
      views: parseNumber(row['lượt xem']),
      views3Seconds: null,
      views60Seconds: null,
      metricsPartial: false,
    },
  };
}

async function importBusinessSuiteFolder({ directory = process.env.BUSINESS_SUITE_IMPORT_DIR || DEFAULT_DIR, pageId = process.env.META_PAGE_ID } = {}) {
  if (!pageId) return { ok: false, skipped: true, reason: 'META_PAGE_ID is not configured' };
  if (!fs.existsSync(directory)) return { ok: true, skipped: true, directory, files: [] };
  const files = fs.readdirSync(directory).filter((name) => /\.(csv|xlsx?|xls)$/i.test(name));
  if (!files.length) return { ok: true, skipped: true, directory, files: [] };
  const results = { ok: true, directory, files: [], imported: 0, matched: 0, unmatched: 0, errors: [] };
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    const version = `${stat.size}:${stat.mtimeMs}`;
    if (importedFileVersions.get(fullPath) === version) continue;
    results.files.push(file);
    let rows;
    if (/\.csv$/i.test(file)) {
      rows = parseCsv(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
    } else {
      const workbook = XLSX.readFile(fullPath, { cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    }
    if (!rows.length) continue;
    const headers = rows[0];
    for (let index = 1; index < rows.length; index += 1) {
      const normalized = normalizeRow(headers, rows[index], pageId);
      if (normalized.error) { results.errors.push({ file, row: index + 1, reason: normalized.error }); continue; }
      try {
        const stored = await store.importBusinessSuiteMetrics({ platformPostId: normalized.platformPostId, metrics: normalized.metrics, recordedAt: new Date().toISOString() });
        results.imported += 1;
        if (stored.matched) results.matched += 1;
        else { results.unmatched += 1; results.errors.push({ file, row: index + 1, postId: normalized.platformPostId, reason: 'asset_not_found' }); }
      } catch (error) { results.errors.push({ file, row: index + 1, postId: normalized.platformPostId, reason: error.message }); }
    }
    importedFileVersions.set(fullPath, version);
  }
  results.ok = results.errors.length === 0;
  return results;
}

module.exports = { importBusinessSuiteFolder, parseCsv, parseNumber };
