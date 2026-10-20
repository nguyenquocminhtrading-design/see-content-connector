// All REST API routes (Phases 1–3 of the Master Plan).
const express = require('express');
const store = require('./store');
const sync = require('./sync');
const platforms = require('./platforms');
const { cacheMiddleware } = require('./cache');
const { pool } = require('./db');

const router = express.Router();

/* ---------- health ---------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: store.demoMode() ? 'demo' : 'postgresql',
    cache: require('./cache').cacheMode(),
    sync: sync.status(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* ---------- dashboard ---------- */
router.get('/dashboard', cacheMiddleware('dash', 30), async (req, res, next) => {
  try { res.json(await store.dashboardSummary()); } catch (e) { next(e); }
});

/* ---------- assets ---------- */
router.get('/assets', async (req, res, next) => {
  try {
    const assets = await store.listAssets(req.query);
    res.json({ assets, count: assets.length });
  } catch (e) { next(e); }
});

router.get('/assets/:id', async (req, res, next) => {
  try {
    const asset = await store.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset });
  } catch (e) { next(e); }
});

/* ---------- posts monitor ---------- */
router.get('/posts', async (req, res, next) => {
  try {
    const posts = await store.listPosts(req.query);
    res.json({ posts, count: posts.length });
  } catch (e) { next(e); }
});

/* ---------- video health ---------- */
router.get('/videos/:id/health', async (req, res, next) => {
  try {
    const health = await store.videoHealth(req.params.id);
    if (!health) return res.status(404).json({ error: 'Video not found' });
    res.json(health);
  } catch (e) { next(e); }
});

/* ---------- thumbnails ---------- */
router.get('/thumbnails', cacheMiddleware('thumbs', 60), async (req, res, next) => {
  try {
    res.json({ thumbnails: await store.listThumbnails(req.query.platform) });
  } catch (e) { next(e); }
});

/* ---------- analytics (Phase 3) ---------- */
router.get('/analytics', cacheMiddleware('analytics', 60), async (req, res, next) => {
  try {
    const days = Number(req.query.range || req.query.days || 7);
    const series = await store.analytics({ days, platform: req.query.platform || null });
    res.json({ days, series });
  } catch (e) { next(e); }
});

router.get('/analytics/compare', cacheMiddleware('compare', 60), async (req, res, next) => {
  try {
    const days = Number(req.query.range || req.query.days || 30);
    res.json({ days, platforms: await store.compareAnalytics({ days }) });
  } catch (e) { next(e); }
});

/* ---------- alerts (Phase 3) ---------- */
router.get('/alerts', async (req, res, next) => {
  try {
    res.json({ alerts: await store.listAlerts({ limit: req.query.limit || 50, unreadOnly: req.query.unread === 'true' }) });
  } catch (e) { next(e); }
});

router.post('/alerts', async (req, res, next) => {
  try {
    const { type, severity, message } = req.body || {};
    if (!type || !message) return res.status(400).json({ error: 'type and message are required' });
    res.status(201).json({ alert: await store.createAlert({ type, severity, message }) });
  } catch (e) { next(e); }
});

router.patch('/alerts/:id/read', async (req, res, next) => {
  try {
    const alert = await store.markAlertRead(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (e) { next(e); }
});

/* ---------- connections hub (Phase 1 & Token Resilience) ---------- */
router.get('/connections', async (req, res, next) => {
  try { res.json({ connections: await store.listConnections() }); } catch (e) { next(e); }
});

router.post('/connections/:platform/token', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { token, pageId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token là bắt buộc' });

    let finalToken = token.trim();
    let expiresAt = null;
    let isPermanent = false;

    // For Facebook: auto-exchange to permanent Page Access Token
    if (platform === 'facebook') {
      const ex = await platforms.exchangeForPermanentPageToken(finalToken, pageId);
      finalToken = ex.access_token;
      expiresAt = ex.tokenExpiresAt;
      isPermanent = ex.isPermanent;
    }

    // Test connection live
    const test = await platforms.testConnectionLive(platform, finalToken);

    // Save to store / database
    const conn = await store.upsertConnection({
      platform,
      accessToken: finalToken,
      expiresAt,
      status: test.ok ? 'connected' : 'error',
    });

    // Trigger sync in background immediately to pull assets with new token
    if (test.ok) {
      setTimeout(() => { sync.runSyncNow(); }, 300);
    }

    res.json({
      ok: true,
      connection: conn,
      isPermanent,
      test,
      message: test.ok
        ? `Kết nối ${platform} thành công! ${isPermanent ? '(Token vĩnh viễn không hết hạn)' : ''}. Đang kéo bài viết mới…`
        : `Lưu token nhưng kiểm tra API trả về cảnh báo: ${test.message}`,
    });
  } catch (e) { next(e); }
});

router.post('/connections/:platform/test', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const conn = await store.getConnection(platform);
    if (!conn || !conn.access_token) {
      return res.status(400).json({ ok: false, error: `Chưa có Token cho nền tảng ${platform}` });
    }
    const test = await platforms.testConnectionLive(platform, conn.access_token);
    res.json({ ok: true, platform, test });
  } catch (e) { next(e); }
});

router.delete('/connections/:id', async (req, res, next) => {
  try {
    const ok = await store.deleteConnection(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Connection not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

/* ---------- OAuth 2.0 flows (Phase 1) ---------- */
router.get('/auth/:platform/start', (req, res) => {
  const platform = req.params.platform;
  if (!['facebook', 'instagram', 'linkedin', 'tiktok'].includes(platform)) {
    return res.status(404).json({ error: 'Unknown platform' });
  }
  if (!platforms.hasCredentials(platform)) {
    return res.status(400).json({
      error: `${platform} credentials are not configured`,
      howTo: 'Copy .env.example to .env at the project root and fill in the values for this platform, then restart the backend.',
      envKeys: {
        facebook: ['META_APP_ID', 'META_APP_SECRET'],
        instagram: ['META_APP_ID', 'META_APP_SECRET'],
        linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
        tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
      }[platform],
    });
  }
  const state = require('crypto').randomBytes(12).toString('hex');
  const url = platforms.authorizeUrl(platform, state);
  if (req.query.json === 'true' || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.json({ ok: true, url });
  }
  res.redirect(url);
});

router.get('/auth/:platform/callback', async (req, res) => {
  const platform = req.params.platform;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3002';
  try {
    if (req.query.error_description) throw new Error(req.query.error_description);
    const token = await platforms.exchangeCode(platform, req.query.code);
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    await store.upsertConnection({
      platform,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt,
      status: 'connected',
    });
    res.redirect(`${frontend}/connections?connected=${platform}`);
  } catch (e) {
    res.redirect(`${frontend}/connections?error=${encodeURIComponent(e.message)}`);
  }
});

/* ---------- manual sync + export (Phase 2/3) ---------- */
router.all('/sync/run', async (req, res, next) => {
  try { res.json({ result: await sync.runSyncNow() }); } catch (e) { next(e); }
});

router.get('/export/report.csv', async (req, res, next) => {
  try {
    const days = Number(req.query.range || 30);
    const rows = await store.exportRows({ days });
    const header = 'id,platform,type,title,status,published_at,reach,impressions,likes,comments,shares,completion_rate,flagged';
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((a) => [
      a.id, a.platform, a.type, a.title, a.status, a.publishedAt || '',
      a.metrics ? a.metrics.reach : 0,
      a.metrics ? a.metrics.impressions : 0,
      a.metrics ? a.metrics.likes : 0,
      a.metrics ? a.metrics.comments : 0,
      a.metrics ? a.metrics.shares : 0,
      a.completionRate ?? (a.metrics && a.metrics.completionRate) ?? '',
      a.isFlagged ? 'yes' : 'no',
    ].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="see-report-${days}d.csv"`);
    res.send([header, ...lines].join('\n'));
  } catch (e) { next(e); }
});

module.exports = router;
