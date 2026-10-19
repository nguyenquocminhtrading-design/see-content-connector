// Deterministic demo dataset — powers the whole API when PostgreSQL is not
// available, so every dashboard feature can be verified end-to-end with 0 setup.
let data = null;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 14;

function hasRealCredentials() {
  const metaToken = process.env.META_PAGE_ACCESS_TOKEN;
  const tiktokKey = process.env.TIKTOK_CLIENT_KEY;
  const linkedinId = process.env.LINKEDIN_CLIENT_ID;
  return Boolean(
    (metaToken && !metaToken.startsWith('your_')) ||
    (tiktokKey && !tiktokKey.startsWith('your_')) ||
    (linkedinId && !linkedinId.startsWith('your_'))
  );
}

function build() {
  const rnd = mulberry32(20261018);
  const now = Date.now();
  const day = 86400000;

  const fbConnected = Boolean(process.env.META_PAGE_ACCESS_TOKEN);
  const igConnected = Boolean(fbConnected || (process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID.trim()));
  const liConnected = Boolean(process.env.LINKEDIN_CLIENT_ID && !process.env.LINKEDIN_CLIENT_ID.startsWith('your_'));
  const ttConnected = true;

  const connections = [
    { id: 'c-facebook', platform: 'facebook', status: fbConnected ? 'connected' : 'disconnected', tokenExpiresAt: new Date(now + 60 * day).toISOString(), createdAt: new Date().toISOString() },
    { id: 'c-instagram', platform: 'instagram', status: igConnected ? 'connected' : 'disconnected', tokenExpiresAt: new Date(now + 60 * day).toISOString(), createdAt: new Date().toISOString() },
    { id: 'c-linkedin', platform: 'linkedin', status: liConnected ? 'connected' : 'disconnected', tokenExpiresAt: null, createdAt: new Date().toISOString() },
    { id: 'c-tiktok', platform: 'tiktok', status: ttConnected ? 'connected' : 'disconnected', tokenExpiresAt: new Date(now + 90 * day).toISOString(), createdAt: new Date().toISOString() },
  ];

  // No sample/mock assets — only real synced assets from platforms
  const assets = [];
  const alerts = [];

  return { connections, assets, alerts };
}

function getDemo() {
  if (!data) data = build();
  return data;
}

// Simulates a 15-minute sync tick: metrics grow, synced_at refreshes.
function tickDemo() {
  const d = getDemo();
  const rnd = Math.random;
  for (const a of d.assets) {
    if (!['published', 'live'].includes(a.status)) continue;
    a.metrics.reach += Math.round(a.metrics.reach * 0.004 * (0.5 + rnd()));
    a.metrics.impressions += Math.round(a.metrics.impressions * 0.004 * (0.5 + rnd()));
    a.metrics.likes += Math.round(rnd() * 12);
    a.metrics.comments += Math.round(rnd() * 3);
    a.metrics.shares += Math.round(rnd() * 4);
    a.syncedAt = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const point = a.history.find((h) => h.date === today);
    if (point) Object.assign(point, a.metrics);
  }
}

function upsertAssetDemo(asset) {
  const d = getDemo();
  const existingIndex = d.assets.findIndex(
    (a) => a.platform === asset.platform && a.platformPostId === asset.platformPostId
  );
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (existingIndex >= 0) {
    const existing = d.assets[existingIndex];
    d.assets[existingIndex] = {
      ...existing,
      title: asset.title || existing.title,
      thumbnailUrl: asset.thumbnailUrl || existing.thumbnailUrl,
      status: asset.status || existing.status,
      type: asset.type || existing.type,
      publishedAt: asset.publishedAt || existing.publishedAt,
      syncedAt: now,
      metrics: asset.metrics || existing.metrics,
    };
  } else {
    const metrics = asset.metrics || {
      reach: Math.floor(100 + Math.random() * 500),
      impressions: Math.floor(150 + Math.random() * 800),
      likes: Math.floor(10 + Math.random() * 50),
      comments: Math.floor(1 + Math.random() * 10),
      shares: Math.floor(1 + Math.random() * 5),
    };
    d.assets.unshift({
      id: `a-${asset.platform}-${asset.platformPostId}`,
      connectionId: `c-${asset.platform}`,
      platform: asset.platform,
      platformPostId: asset.platformPostId,
      type: asset.type || 'photo',
      title: asset.title,
      thumbnailUrl: asset.thumbnailUrl,
      status: asset.status || 'published',
      isFlagged: false,
      completionRate: asset.type === 'video' || asset.type === 'reel' ? 0.65 : null,
      thumbnailStatus: 'ok',
      publishedAt: asset.publishedAt || now,
      syncedAt: now,
      metrics,
      history: [{ date: today, ...metrics }],
    });
  }
}

function resetDemo() {
  data = build();
  return data;
}

module.exports = { getDemo, resetDemo, tickDemo, upsertAssetDemo, DAYS };
