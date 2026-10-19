// Data sync worker (Phase 2) + token-expiry monitor & auto-refresh (Phase 3).
// Runs every SYNC_INTERVAL_MINUTES (default 15). In demo mode it simulates a
// metrics tick so the dashboard visibly updates over time.
const cron = require('node-cron');
const store = require('./store');
const platforms = require('./platforms');
const { isDbReady } = require('./db');

let lastRun = null;
let lastResult = null;

async function runSyncNow() {
  lastRun = new Date().toISOString();
  try {
    if (!isDbReady()) {
      // Keep background mock metrics alive
      require('./demo').tickDemo();
    }

    const connections = await store.listConnections();
    let synced = 0;
    const errors = [];

    for (const c of connections) {
      if (!c.hasToken) continue;

      // Token expiry monitor: refresh when < 7 days left, alert when expiring.
      if (c.tokenExpiresAt) {
        const daysLeft = (new Date(c.tokenExpiresAt) - Date.now()) / 86400000;
        if (daysLeft < 0) {
          await store.upsertConnection({ platform: c.platform, status: 'expired', accessToken: null });
          await store.createAlert({ type: 'token_expired', severity: 'critical', message: `${c.platform} token expired — reconnect required.` });
          continue;
        }
        if (daysLeft < 7 && c.refreshToken && platforms.hasCredentials(c.platform)) {
          try {
            const refreshed = await platforms.refreshConnection(c.platform, c.refreshToken);
            if (refreshed.access_token) {
              await store.upsertConnection({
                platform: c.platform,
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token || c.refreshToken,
                expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null,
              });
            }
          } catch (e) {
            await store.createAlert({ type: 'token_refresh_failed', severity: 'high', message: `${c.platform} token refresh failed: ${e.message}` });
          }
        }
      }

      // Pull latest data for this connection.
      const full = await store.getConnection(c.platform);
      if (!full || !full.access_token) continue;
      try {
        const assets = await platforms.fetchLatestAssets(full);
        for (const a of assets) {
          await store.upsertAsset({ ...a, platform: c.platform });
        }
        synced += assets.length;
        await store.upsertConnection({ platform: c.platform, accessToken: full.access_token, refreshToken: full.refresh_token, expiresAt: full.tokenExpiresAt, status: 'connected' });
      } catch (e) {
        errors.push(`${c.platform}: ${e.message}`);
        const isExpired = e.message.includes('hết hạn') || e.message.includes('expired') || e.message.includes('190');
        const status = isExpired ? 'expired' : 'error';
        await store.upsertConnection({
          platform: c.platform,
          accessToken: full.access_token,
          refreshToken: full.refresh_token,
          expiresAt: full.tokenExpiresAt,
          status,
        });
        await store.createAlert({
          type: isExpired ? 'token_expired' : 'sync_error',
          severity: 'high',
          message: isExpired
            ? `Phiên làm việc của ${c.platform} đã hết hạn. Vui lòng bấm Cập nhật Token trong mục Connections. Dữ liệu cũ vẫn được bảo lưu an toàn.`
            : `Đồng bộ ${c.platform} gặp lỗi: ${e.message}`,
        });
      }
    }

    lastResult = { mode: isDbReady() ? 'postgresql' : 'demo', ok: errors.length === 0, synced, errors, at: lastRun };
    console.log(`[sync] done (${isDbReady() ? 'postgresql' : 'demo'}) — synced ${synced} assets, ${errors.length} errors`);
    return lastResult;
  } catch (err) {
    lastResult = { ok: false, error: err.message, at: lastRun };
    console.error('[sync] failed:', err.message);
    return lastResult;
  }
}

function startSyncWorker() {
  const minutes = Math.min(59, Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 15)));
  cron.schedule(`*/${minutes} * * * *`, () => { runSyncNow(); });
  console.log(`[sync] worker scheduled every ${minutes} minutes`);
  // Initial run shortly after boot so demo data/DB fills fast.
  setTimeout(() => { runSyncNow(); }, 1500);
}

function status() {
  return { lastRun, lastResult };
}

module.exports = { startSyncWorker, runSyncNow, status };
