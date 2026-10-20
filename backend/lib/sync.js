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
    let syncedMetrics = 0;
    const metricErrors = [];
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
        console.log(`[sync][${c.platform}][assets] fetched=${assets.length}`);
        for (const a of assets) {
          await store.upsertAsset({ ...a, platform: c.platform });
          synced += 1;
        }
        console.log(`[sync][${c.platform}][assets] saved=${assets.length}`);

        let metricsAttempted = 0;
        let metricsSucceeded = 0;
        if (c.platform === 'facebook') {
          for (const a of assets) {
            metricsAttempted += 1;
            const engagement = await platforms.fetchFacebookPostMetrics(full, a.platformPostId);
            const insights = await platforms.fetchFacebookPostInsights(full, a.platformPostId, a.type);
            const merged = {
              reach: insights.metrics?.reach ?? null,
              impressions: insights.metrics?.impressions ?? null,
              viewers: insights.metrics?.viewers ?? null,
              engagements: insights.metrics?.engagements ?? null,
              likes: engagement.metrics?.likes ?? null,
              comments: engagement.metrics?.comments ?? null,
              shares: engagement.metrics?.shares ?? null,
              views: insights.metrics?.views ?? null,
              watchTimeSeconds: insights.metrics?.watchTimeSeconds ?? null,
              averageWatchTimeSeconds: insights.metrics?.averageWatchTimeSeconds ?? null,
              views3Seconds: insights.metrics?.views3Seconds ?? null,
              views60Seconds: insights.metrics?.views60Seconds ?? null,
              metricsAvailable: Boolean(engagement.ok || insights.ok),
              // `insights.ok` means that at least one insight metric worked;
              // it does not mean that every requested metric worked. Keep the
              // partial flag true whenever Meta rejected or failed any probe.
              metricsPartial: Boolean(
                insights.metrics?.metricsPartial ||
                (insights.metrics?.insightErrors || []).length > 0 ||
                !engagement.ok ||
                !insights.ok
              ),
              metricsError: [engagement.error?.message, insights.metrics?.metricsError].filter(Boolean).join(' | ') || null,
              platformErrorCode: engagement.error?.code || insights.error?.code || insights.metrics?.insightErrors?.[0]?.code || null,
              source: 'facebook_graph_api',
            };
            if (engagement.ok || insights.ok) {
              metricsSucceeded += 1;
              syncedMetrics += 1;
            } else {
              metricErrors.push({ platform: c.platform, postId: a.platformPostId, code: merged.platformErrorCode, reason: 'engagement_and_insights_failed', message: merged.metricsError });
            }
            if (!engagement.ok) metricErrors.push({ platform: c.platform, postId: a.platformPostId, code: engagement.error?.code || null, reason: 'engagement_failed', message: engagement.error?.message });
            if (!insights.ok) metricErrors.push({ platform: c.platform, postId: a.platformPostId, code: insights.error?.code || null, reason: 'insights_failed', message: insights.error?.message });
            for (const insightError of insights.metrics?.insightErrors || []) {
              metricErrors.push({ platform: c.platform, postId: a.platformPostId, metric: insightError.group, code: insightError.code, reason: insightError.reason, message: insightError.message });
            }
            const p = insights.metrics?.probes || {};
            console.warn(`[sync][facebook][${a.platformPostId}][engagement] likes=${engagement.metrics?.likes != null} comments=${engagement.metrics?.comments != null} shares=${engagement.metrics?.shares != null}`);
            console.warn(`[sync][facebook][${a.platformPostId}][distribution] reach=${p.post_reach?.ok === true && p.post_reach.returned} impressions=${p.post_impressions?.ok === true && p.post_impressions.returned} viewers=${p.post_impressions_unique?.ok === true && p.post_impressions_unique.returned}`);
            if (['video', 'reel'].includes(a.type)) console.warn(`[sync][facebook][${a.platformPostId}][video] views=${p.post_video_views?.ok === true && p.post_video_views.returned} watchTime=${p.post_video_view_time?.ok === true && p.post_video_view_time.returned} views3s=${p.post_video_views_3s?.ok === true && p.post_video_views_3s.returned} views60s=${p.post_video_views_60s?.ok === true && p.post_video_views_60s.returned}`);
            await store.upsertAsset({ ...a, platform: c.platform, metrics: merged });
          }
        } else {
          for (const a of assets) {
            const values = a.metrics ? [a.metrics.reach, a.metrics.impressions, a.metrics.likes, a.metrics.comments, a.metrics.shares, a.metrics.views] : [];
            if (values.some((v) => v !== null && v !== undefined)) { syncedMetrics += 1; metricsSucceeded += 1; }
            if (a.metrics?.metricsError) {
              metricErrors.push({ platform: c.platform, postId: a.platformPostId, reason: 'metrics_failed', message: a.metrics.metricsError });
            }
          }
        }
        console.log(`[sync][${c.platform}][metrics] attempted=${metricsAttempted || assets.length} succeeded=${metricsSucceeded} failed=${(metricsAttempted || assets.length) - metricsSucceeded}`);
        if (c.platform === 'facebook' && metricErrors.some((e) => e.platform === 'facebook')) {
          await store.createAlert({ type: 'facebook_metrics_sync_error', severity: 'medium', message: `Facebook assets đồng bộ thành công nhưng metrics lỗi ${metricErrors.filter((e) => e.platform === 'facebook').length}/${assets.length} bài.` });
        }
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
          type: isExpired ? 'token_expired' : (e.message.includes('pages_read_engagement') || e.message.includes('Page Public Content Access') || e.message.includes('(#10)') ? 'facebook_permission_error' : 'sync_error'),
          severity: 'high',
          message: isExpired
            ? `Phiên làm việc của ${c.platform} đã hết hạn. Vui lòng bấm Cập nhật Token trong mục Connections. Dữ liệu cũ vẫn được bảo lưu an toàn.`
            : (c.platform === 'facebook' && (e.message.includes('pages_read_engagement') || e.message.includes('Page Public Content Access') || e.message.includes('(#10)'))
              ? 'Facebook token chưa có pages_read_engagement hoặc app chưa được cấp Page Public Content Access. Hãy tạo lại Page Access Token sau khi cấp quyền.'
              : `Đồng bộ ${c.platform} gặp lỗi: ${e.message}`),
        });
      }
    }

    lastResult = { mode: isDbReady() ? 'postgresql' : 'demo', ok: errors.length === 0, synced, syncedAssets: synced, syncedMetrics, metricErrors, errors, at: lastRun };
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
