// Data-access layer: every route talks to this module. Each function branches
// between PostgreSQL (real mode) and the in-memory demo dataset (demo mode).
const { isDbReady, q } = require('./db');
const demo = require('./demo');

function demoMode() {
  return !isDbReady();
}

/* ---------------- assets ---------------- */

async function listAssets({ platform, type, status, search, limit = 100, offset = 0 }) {
  if (demoMode()) {
    let rows = demo.getDemo().assets;
    if (platform) rows = rows.filter((a) => a.platform === platform);
    if (type) rows = rows.filter((a) => a.type === type);
    if (status) rows = rows.filter((a) => a.status === status);
    if (search) rows = rows.filter((a) => a.title.toLowerCase().includes(String(search).toLowerCase()));
    rows = [...rows].sort((a, b) => String(b.publishedAt || b.syncedAt).localeCompare(String(a.publishedAt || a.syncedAt)));
    return rows.slice(Number(offset), Number(offset) + Number(limit));
  }
  const params = [];
  const where = [];
  if (platform) { params.push(platform); where.push(`a.platform = $${params.length}`); }
  if (type) { params.push(type); where.push(`a.type = $${params.length}`); }
  if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`a.title ILIKE $${params.length}`); }
  params.push(limit); const lim = `$${params.length}`;
  params.push(offset); const off = `$${params.length}`;
  const sql = `
    SELECT a.*, m.reach, m.impressions, m.likes, m.comments, m.shares, m.completion_rate AS "completionRate",
           a.completion_rate AS "videoCompletionRate", a.published_at AS "publishedAt", a.synced_at AS "syncedAt",
           a.platform_post_id AS "platformPostId", a.thumbnail_url AS "thumbnailUrl", a.is_flagged AS "isFlagged"
    FROM asset a
    LEFT JOIN LATERAL (
      SELECT * FROM metrics WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1
    ) m ON true
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(a.published_at, a.synced_at) DESC
    LIMIT ${lim} OFFSET ${off}`;
  const { rows } = await q(sql, params);
  return rows;
}

async function getAsset(id) {
  if (demoMode()) {
    return demo.getDemo().assets.find((a) => a.id === id) || null;
  }
  const { rows } = await q(`SELECT a.*, a.published_at AS "publishedAt", a.synced_at AS "syncedAt",
      a.platform_post_id AS "platformPostId", a.thumbnail_url AS "thumbnailUrl", a.is_flagged AS "isFlagged",
      a.completion_rate AS "completionRate"
    FROM asset a WHERE a.id = $1`, [id]);
  if (!rows[0]) return null;
  const metrics = await q(`SELECT reach, impressions, likes, comments, shares, completion_rate AS "completionRate", recorded_at AS "recordedAt"
    FROM metrics WHERE asset_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [id]);
  const history = await q(`SELECT to_char(recorded_at,'YYYY-MM-DD') AS date, reach, impressions, likes, comments, shares
    FROM metrics WHERE asset_id = $1 ORDER BY recorded_at ASC`, [id]);
  return { ...rows[0], metrics: metrics.rows[0] || null, history: history.rows };
}

/* ---------------- posts monitor ---------------- */

async function listPosts({ platform, status, from, to, search, limit = 200 }) {
  if (demoMode()) {
    let rows = demo.getDemo().assets;
    if (platform) rows = rows.filter((a) => a.platform === platform);
    if (status) rows = rows.filter((a) => a.status === status);
    if (search) rows = rows.filter((a) => a.title.toLowerCase().includes(String(search).toLowerCase()));
    if (from) rows = rows.filter((a) => a.publishedAt && a.publishedAt >= from);
    if (to) rows = rows.filter((a) => a.publishedAt && a.publishedAt <= to);
    return rows.slice(0, Number(limit));
  }
  const params = [];
  const where = [];
  if (platform) { params.push(platform); where.push(`a.platform = $${params.length}`); }
  if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
  if (from) { params.push(from); where.push(`a.published_at >= $${params.length}`); }
  if (to) { params.push(to); where.push(`a.published_at <= $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`a.title ILIKE $${params.length}`); }
  params.push(limit);
  const sql = `
    SELECT a.id, a.platform, a.type, a.title, a.status, a.published_at AS "publishedAt",
           a.is_flagged AS "isFlagged", a.thumbnail_url AS "thumbnailUrl",
           m.reach, m.impressions, m.likes, m.comments, m.shares
    FROM asset a
    LEFT JOIN LATERAL (SELECT * FROM metrics WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1) m ON true
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.published_at DESC NULLS LAST LIMIT $${params.length}`;
  const { rows } = await q(sql, params);
  return rows;
}

/* ---------------- video health ---------------- */

async function videoHealth(id) {
  const a = await getAsset(id);
  if (!a) return null;
  const status = a.status;
  const processing = ['processing', 'error', 'failed'].includes(status);
  const health = status === 'live' || status === 'published'
    ? (a.isFlagged ? 'flagged' : 'healthy')
    : processing ? 'processing' : 'unknown';
  return {
    id: a.id, title: a.title, platform: a.platform, type: a.type, status,
    health,
    isFlagged: Boolean(a.isFlagged),
    thumbnailStatus: a.thumbnailStatus || (a.thumbnailUrl ? 'ok' : 'missing'),
    completionRate: a.metrics ? (a.metrics.completionRate ?? a.completionRate) : a.completionRate,
    metrics: a.metrics || null,
    lastSyncedAt: a.syncedAt,
  };
}

/* ---------------- thumbnails ---------------- */

async function listThumbnails(platform) {
  const rows = await listAssets({ platform, limit: 200 });
  return rows
    .filter((a) => a.thumbnailUrl)
    .map((a) => ({
      id: a.id, platform: a.platform, title: a.title,
      thumbnailUrl: a.thumbnailUrl, status: a.status,
      thumbnailStatus: a.thumbnailStatus || 'ok',
    }));
}

/* ---------------- analytics ---------------- */

async function analytics({ days = 7, platform }) {
  if (demoMode()) {
    const rows = demo.getDemo().assets.filter((a) => !platform || a.platform === platform);
    const byDate = new Map();
    for (const a of rows) {
      for (const h of a.history.slice(-Number(days))) {
        const cur = byDate.get(h.date) || { date: h.date, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0 };
        cur.reach += h.reach; cur.impressions += h.impressions; cur.likes += h.likes;
        cur.comments += h.comments; cur.shares += h.shares;
        byDate.set(h.date, cur);
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  const { rows } = await q(`
    SELECT to_char(m.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,
           COALESCE(SUM(m.reach),0) AS reach, COALESCE(SUM(m.impressions),0) AS impressions,
           COALESCE(SUM(m.likes),0) AS likes, COALESCE(SUM(m.comments),0) AS comments,
           COALESCE(SUM(m.shares),0) AS shares
    FROM metrics m JOIN asset a ON a.id = m.asset_id
    WHERE m.recorded_at >= now() - ($1 || ' days')::interval
      AND ($2::text IS NULL OR a.platform = $2)
    GROUP BY 1 ORDER BY 1`, [String(days), platform || null]);
  return rows;
}

async function compareAnalytics({ days = 30 }) {
  const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
  if (demoMode()) {
    const connections = demo.getDemo().connections;
    return platforms.map((p) => {
      const rows = demo.getDemo().assets.filter((a) => a.platform === p);
      const conn = connections.find((c) => c.platform === p);
      const totals = rows.reduce((acc, a) => {
        if (!a.metrics) return acc;
        acc.reach += Number(a.metrics.reach || 0);
        acc.impressions += Number(a.metrics.impressions || 0);
        acc.likes += Number(a.metrics.likes || 0);
        acc.comments += Number(a.metrics.comments || 0);
        acc.shares += Number(a.metrics.shares || 0);
        return acc;
      }, { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0 });
      const engagement = totals.likes + totals.comments + totals.shares;
      return {
        platform: p,
        posts: rows.length,
        status: conn ? conn.status : 'disconnected',
        ...totals,
        engagement,
        engagementRate: totals.reach ? Math.round((engagement / totals.reach) * 10000) / 100 : 0,
      };
    });
  }
  const { rows } = await q(`
    SELECT a.platform,
           COUNT(DISTINCT a.id) AS posts,
           COALESCE(SUM(m.reach),0) AS reach, COALESCE(SUM(m.impressions),0) AS impressions,
           COALESCE(SUM(m.likes),0) AS likes, COALESCE(SUM(m.comments),0) AS comments,
           COALESCE(SUM(m.shares),0) AS shares
    FROM asset a
    LEFT JOIN LATERAL (SELECT * FROM metrics WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1) m ON true
    WHERE a.published_at >= now() - ($1 || ' days')::interval
    GROUP BY a.platform`, [String(days)]);
  const conns = await listConnections();
  return platforms.map((p) => {
    const r = rows.find((x) => x.platform === p) || { platform: p, posts: 0, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0 };
    const conn = conns.find((c) => c.platform === p);
    const engagement = Number(r.likes) + Number(r.comments) + Number(r.shares);
    return {
      ...r,
      status: conn ? conn.status : 'disconnected',
      engagement,
      engagementRate: Number(r.reach) ? Math.round((engagement / Number(r.reach)) * 10000) / 100 : 0,
    };
  });
}

async function dashboardSummary() {
  const byPlatform = await compareAnalytics({ days: 30 });
  const assets = await listAssets({ limit: 1000 });
  const totals = {
    assets: assets.length,
    published: assets.filter((a) => a.status === 'published').length,
    scheduled: assets.filter((a) => a.status === 'scheduled').length,
    failed: assets.filter((a) => ['failed', 'error', 'removed'].includes(a.status)).length,
    flagged: assets.filter((a) => a.isFlagged).length,
  };
  const alerts = await listAlerts({ limit: 8 });
  return { totals, byPlatform, recentAlerts: alerts };
}

/* ---------------- alerts ---------------- */

async function listAlerts({ limit = 50, unreadOnly = false }) {
  if (demoMode()) {
    let rows = [...demo.getDemo().alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (unreadOnly) rows = rows.filter((a) => !a.isRead);
    return rows.slice(0, Number(limit));
  }
  const { rows } = await q(`SELECT id, type, severity, message, is_read AS "isRead", created_at AS "createdAt"
    FROM alert ${unreadOnly ? 'WHERE is_read = false' : ''} ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}

async function createAlert({ type, severity = 'medium', message, workspaceId = null }) {
  if (demoMode()) {
    const a = { id: `al-${Date.now()}`, type, severity, message, workspaceId, isRead: false, createdAt: new Date().toISOString() };
    demo.getDemo().alerts.unshift(a);
    return a;
  }
  const { rows } = await q(`INSERT INTO alert (workspace_id, type, severity, message) VALUES ($1,$2,$3,$4)
    RETURNING id, type, severity, message, is_read AS "isRead", created_at AS "createdAt"`,
    [workspaceId, type, severity, message]);
  return rows[0];
}

async function markAlertRead(id) {
  if (demoMode()) {
    const a = demo.getDemo().alerts.find((x) => x.id === id);
    if (a) a.isRead = true;
    return a || null;
  }
  const { rows } = await q(`UPDATE alert SET is_read = true WHERE id = $1
    RETURNING id, type, severity, message, is_read AS "isRead", created_at AS "createdAt"`, [id]);
  return rows[0] || null;
}

/* ---------------- connections ---------------- */

async function upsertAsset(asset) {
  if (demoMode()) {
    demo.upsertAssetDemo(asset);
    return;
  }
  await q(`
    INSERT INTO asset (connection_id, platform, platform_post_id, type, title, thumbnail_url, status, published_at, synced_at)
    VALUES ((SELECT id FROM platform_connection WHERE platform = $1), $1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (platform, platform_post_id) DO UPDATE SET
      title = EXCLUDED.title,
      thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, asset.thumbnail_url),
      status = EXCLUDED.status,
      synced_at = now()`,
    [asset.platform, asset.platformPostId, asset.type, asset.title, asset.thumbnailUrl, asset.status, asset.publishedAt]);
}

async function listConnections() {
  if (demoMode()) {
    return demo.getDemo().connections.map((c) => {
      const hasMetaToken = (c.platform === 'facebook' || c.platform === 'instagram') && Boolean(process.env.META_PAGE_ACCESS_TOKEN);
      const isConnected = c.status === 'connected' || hasMetaToken;
      return {
        ...c,
        hasToken: isConnected,
        status: isConnected ? 'connected' : c.status,
      };
    });
  }
  const { rows } = await q(`SELECT id, platform, status,
      token_expires_at AS "tokenExpiresAt", created_at AS "createdAt",
      (access_token IS NOT NULL) AS "hasToken"
    FROM platform_connection ORDER BY created_at DESC`);
  return rows;
}

async function upsertConnection({ platform, accessToken, refreshToken, expiresAt, status = 'connected' }) {
  if (demoMode()) {
    const list = demo.getDemo().connections;
    let c = list.find((x) => x.platform === platform);
    if (!c) { c = { id: `c-${platform}`, platform, createdAt: new Date().toISOString() }; list.push(c); }
    Object.assign(c, { status, tokenExpiresAt: expiresAt || null, access_token: accessToken, refresh_token: refreshToken });
    return c;
  }
  const { rows } = await q(`
    INSERT INTO platform_connection (platform, access_token, refresh_token, token_expires_at, status)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (platform) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, platform_connection.refresh_token),
      token_expires_at = EXCLUDED.token_expires_at,
      status = EXCLUDED.status
    RETURNING id, platform, status, token_expires_at AS "tokenExpiresAt"`,
    [platform, accessToken, refreshToken || null, expiresAt || null, status]);
  return rows[0];
}

async function getConnection(platform) {
  if (demoMode()) {
    const c = demo.getDemo().connections.find((x) => x.platform === platform);
    if (!c) return null;
    let token = c.access_token || (platform === 'facebook' || platform === 'instagram' ? process.env.META_PAGE_ACCESS_TOKEN : null);
    return { ...c, access_token: token };
  }
  const { rows } = await q(`SELECT * FROM platform_connection WHERE platform = $1`, [platform]);
  return rows[0] || null;
}

async function deleteConnection(id) {
  if (demoMode()) {
    const list = demo.getDemo().connections;
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }
  const { rowCount } = await q(`DELETE FROM platform_connection WHERE id = $1`, [id]);
  return rowCount > 0;
}

/* ---------------- export ---------------- */

async function exportRows({ days = 30 }) {
  const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString();
  const assets = await listAssets({ limit: 1000 });
  return assets.filter((a) => !a.publishedAt || a.publishedAt >= cutoff);
}

module.exports = {
  demoMode,
  listAssets, getAsset, listPosts, videoHealth, listThumbnails,
  analytics, compareAnalytics, dashboardSummary,
  listAlerts, createAlert, markAlertRead,
  listConnections, upsertConnection, getConnection, deleteConnection,
  upsertAsset,
  exportRows,
};
