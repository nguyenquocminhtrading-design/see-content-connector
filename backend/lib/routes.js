// All REST API routes (Phases 1–3 of the Master Plan).
const express = require('express');
const store = require('./store');
const sync = require('./sync');
const platforms = require('./platforms');
const { cacheMiddleware } = require('./cache');
const { pool, dbStatus } = require('./db');
const { importBusinessSuiteFolder } = require('./businessSuiteImport');

const router = express.Router();

/* ---------- health ---------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: store.demoMode() ? 'demo' : 'postgresql',
    database: dbStatus(),
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

// Safe Meta token diagnostics: never returns the token itself.
router.get('/connections/facebook/debug-token', async (req, res, next) => {
  try {
    const conn = await store.getConnection('facebook');
    if (!conn?.access_token) return res.status(400).json({ ok: false, error: 'Chưa có Facebook token' });
    res.json(await platforms.debugMetaToken(conn.access_token, process.env.META_PAGE_ID));
  } catch (e) { next(e); }
});

// Probes asset access and each post-level metrics field independently.
router.get('/debug/facebook-metrics', async (req, res, next) => {
  try {
    const conn = await store.getConnection('facebook');
    if (!conn?.access_token) return res.status(400).json({ ok: false, error: 'Chưa có Facebook token' });
    const token = await platforms.debugMetaToken(conn.access_token, process.env.META_PAGE_ID);
    const probe = await platforms.debugFacebookMetricsProbe(conn.access_token, process.env.META_PAGE_ID);
    res.json({
      generatedAt: new Date().toISOString(),
      backend: { mode: store.demoMode() ? 'demo' : 'postgresql', pageId: process.env.META_PAGE_ID || null },
      token: { ok: token.ok, debug: token.debug, page: token.page, publishedPosts: token.publishedPosts },
      probe,
      interpretation: 'assetProbe.ok=true nhưng field metrics false nghĩa là app/token đọc được bài viết nhưng Meta đang chặn post-level metrics hoặc feature tương ứng.',
    });
  } catch (e) { next(e); }
});

// Local-only token comparison. Tokens are read from env/DB and never returned.
router.get('/debug/facebook-token-matrix', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Token matrix is disabled in production' });
    }
    const connection = await store.getConnection('facebook');
    const postId = req.query.postId || '669359189587951_122163353144873587';
    const matrix = await platforms.debugFacebookTokenMatrix({
      currentBackendToken: connection?.access_token,
      shortToken: process.env.META_SHORT_TOKEN,
      longToken: process.env.META_LONG_TOKEN,
      pageToken: process.env.META_PAGE_ACCESS_TOKEN,
    }, process.env.META_PAGE_ID, postId);
    const storage = await store.debugStorage('facebook');
    res.json({
      generatedAt: new Date().toISOString(),
      page: { id: process.env.META_PAGE_ID || null },
      matrix,
      database: {
        mode: storage.mode,
        connectionFingerprint: storage.connection?.tokenFingerprint || null,
        assets: storage.assets,
        metrics: storage.metrics,
      },
      instructions: 'Set META_SHORT_TOKEN and META_LONG_TOKEN locally, then compare the same post and endpoint results. Never commit these variables or return raw tokens.',
    });
  } catch (e) { next(e); }
});

// Pipeline diagnostics: token fingerprint only, DB counts and recent stored assets.
router.get('/debug/facebook-pipeline', async (req, res, next) => {
  try {
    const storage = await store.debugStorage('facebook');
    const connection = await store.getConnection('facebook');
    const live = connection?.access_token
      ? await platforms.testConnectionLive('facebook', connection.access_token)
      : { ok: false, message: 'No Facebook token in backend connection' };
    let assetFetch = { ok: false, count: 0 };
    let metricsFetch = { attempted: 0, succeeded: 0, failed: 0 };
    if (connection?.access_token) {
      const assets = await platforms.fetchLatestAssets({ ...connection, platform: 'facebook' });
      assetFetch = { ok: true, count: assets.length };
      metricsFetch.attempted = assets.length;
      for (const asset of assets.slice(0, 25)) {
        const metric = await platforms.fetchFacebookPostMetrics(connection, asset.platformPostId);
        if (metric.ok) metricsFetch.succeeded += 1;
        else metricsFetch.failed += 1;
      }
    }
    res.json({
      generatedAt: new Date().toISOString(),
      backend: { mode: store.demoMode() ? 'demo' : 'postgresql', nodeEnv: process.env.NODE_ENV || null, pageId: process.env.META_PAGE_ID || null },
      liveMeta: live,
      metricsProbe: connection?.access_token ? await platforms.debugFacebookMetricsProbe(connection.access_token, process.env.META_PAGE_ID) : null,
      assetFetch,
      metricsFetch,
      storage,
      frontendChecks: {
        assetsEndpoint: '/api/assets?platform=facebook&limit=5',
        postsEndpoint: '/api/posts?platform=facebook&limit=5',
        note: 'Nếu liveMeta ok nhưng storage.platformTotal = 0 thì lỗi ở sync/DB. Nếu storage có title nhưng UI trống thì kiểm tra frontend proxy/API response.'
      }
    });
  } catch (e) { next(e); }
});

// Safe platform diagnostics. Enabled only outside production unless explicitly allowed.
router.get('/debug/platform/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    if (!['linkedin', 'tiktok'].includes(platform)) return res.status(400).json({ error: 'Supported platforms: linkedin, tiktok' });
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return res.status(404).json({ error: 'Platform debug is disabled in production' });
    }
    const connection = await store.getConnection(platform);
    const probe = connection?.access_token ? await platforms.testConnectionLive(platform, connection.access_token) : { ok: false, reason: 'missing_token' };
    const storage = await store.debugStorage(platform);
    res.json({
      generatedAt: new Date().toISOString(),
      platform,
      mode: store.demoMode() ? 'demo' : 'postgresql',
      database: dbStatus(),
      connection: connection ? {
        status: connection.status,
        hasToken: Boolean(connection.access_token),
        tokenFingerprint: connection.access_token ? platforms.tokenFingerprint(connection.access_token) : null,
        expiresAt: connection.token_expires_at || connection.tokenExpiresAt || null,
      } : null,
      probe,
      storage,
    });
  } catch (e) { next(e); }
});

router.get('/debug/assets/:assetId/metrics', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return res.status(404).json({ error: 'Asset metrics debug is disabled in production' });
    }
    const asset = await store.getAsset(req.params.assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const connection = await store.getConnection(asset.platform);
    if (!connection?.access_token) return res.status(400).json({ error: 'Connection token is missing' });
    const result = { assetId: asset.id, platform: asset.platform, postId: asset.platformPostId, probes: {}, storedMetrics: asset.metrics || null, tokenFingerprint: platforms.tokenFingerprint(connection.access_token) };
    if (asset.platform === 'facebook') {
      const engagement = await platforms.fetchFacebookPostMetrics(connection, asset.platformPostId);
      const insights = await platforms.fetchFacebookPostInsights(connection, asset.platformPostId, asset.type);
      result.probes = {
        engagement: { ok: engagement.ok, returned: engagement.metrics ? ['likes', 'comments', 'shares'].filter((key) => engagement.metrics[key] !== null) : [], error: engagement.error || null },
        distribution: { ok: Boolean(Object.keys(insights.metrics?.probes || {}).some((x) => /impressions|reach|engaged/.test(x) && insights.metrics.probes[x].returned)), returned: insights.metrics?.probes || {}, errors: (insights.metrics?.insightErrors || []).filter((e) => /impressions|reach|engaged/.test(e.metric)) },
        video: { ok: Boolean(Object.keys(insights.metrics?.probes || {}).some((x) => x.includes('video') && insights.metrics.probes[x].returned)), returned: insights.metrics?.probes || {}, errors: (insights.metrics?.insightErrors || []).filter((e) => e.metric?.includes('video')) },
      };
    } else {
      const test = await platforms.testConnectionLive(asset.platform, connection.access_token);
      result.probes = { connection: test };
    }
    res.json(result);
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
    const test = await platforms.testConnectionLive(platform, token.access_token);
    await store.upsertConnection({
      platform,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt,
      status: test.ok ? 'connected' : (test.reason === 'expired' ? 'expired' : 'error'),
    });
    if (!test.ok) throw new Error(test.message || `Kết nối ${platform} chưa vượt qua kiểm tra API`);
    res.redirect(`${frontend}/connections?connected=${platform}`);
  } catch (e) {
    res.redirect(`${frontend}/connections?error=${encodeURIComponent(e.message)}`);
  }
});

/* ---------- manual sync + export (Phase 2/3) ---------- */
router.all('/sync/run', async (req, res, next) => {
  try { res.json({ result: await sync.runSyncNow() }); } catch (e) { next(e); }
});

/* ---------- Meta Business Suite import ---------- */
router.post('/import/meta-business-suite', async (req, res, next) => {
  try {
    const expectedSecret = process.env.META_BUSINESS_SUITE_IMPORT_SECRET;
    if (!expectedSecret || req.get('x-import-secret') !== expectedSecret) {
      return res.status(401).json({ ok: false, error: 'Invalid import secret' });
    }
    const { pageId, source, rows } = req.body || {};
    if (String(pageId || '') !== String(process.env.META_PAGE_ID || '')) {
      return res.status(400).json({ ok: false, error: 'Invalid pageId' });
    }
    if (source !== 'meta_business_suite_scraper' || !Array.isArray(rows)) {
      return res.status(400).json({ ok: false, error: 'Invalid import payload' });
    }
    const metricKeys = ['reach', 'impressions', 'likes', 'comments', 'shares', 'views', 'viewers', 'engagements', 'netFollowers', 'watchTimeSeconds', 'averageWatchTimeSeconds', 'views3Seconds', 'views60Seconds'];
    const errors = [];
    let imported = 0;
    let matched = 0;
    for (const [index, row] of rows.entries()) {
      const postId = String(row?.platformPostId || '').trim();
      if (!postId) { errors.push({ index, reason: 'missing_platform_post_id' }); continue; }
      const metrics = {};
      let hasValue = false;
      let invalid = false;
      for (const key of metricKeys) {
        if (row[key] === null || row[key] === undefined || row[key] === '' || row[key] === '--' || row[key] === 'N/A') {
          metrics[key] = null;
          continue;
        }
        const value = Number(row[key]);
        if (!Number.isFinite(value) || value < 0) { errors.push({ index, postId, field: key, reason: 'invalid_non_negative_number' }); invalid = true; break; }
        metrics[key] = value;
        hasValue = true;
      }
      if (invalid || !hasValue) continue;
      const result = await store.importBusinessSuiteMetrics({ platformPostId: postId, metrics, recordedAt: row.recordedAt });
      if (result.matched) { imported += 1; matched += 1; } else errors.push({ index, postId, reason: 'asset_not_found' });
    }
    res.json({ ok: errors.length === 0, imported, matched, unmatched: rows.length - matched, errors });
  } catch (e) { next(e); }
});

router.post('/import/meta-business-suite-folder', async (req, res, next) => {
  try {
    const expectedSecret = process.env.META_BUSINESS_SUITE_IMPORT_SECRET;
    if (!expectedSecret || req.get('x-import-secret') !== expectedSecret) {
      return res.status(401).json({ ok: false, error: 'Invalid import secret' });
    }
    res.json(await importBusinessSuiteFolder({ directory: req.body?.directory }));
  } catch (e) { next(e); }
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
