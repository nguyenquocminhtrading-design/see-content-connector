// OAuth 2.0 configuration + thin API clients for the 4 platforms.
// Credentials come from the root .env (see .env.example) — the user fills them in.
// Env names follow .env.example: META_APP_ID, META_PAGE_ACCESS_TOKEN,
// TIKTOK_CLIENT_KEY, LINKEDIN_CLIENT_ID, etc.

const FB_API = 'https://graph.facebook.com/v19.0';
const crypto = require('crypto');

function tokenFingerprint(token) {
  return token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16) : null;
}

function baseRedirect(platform) {
  const explicit = {
    tiktok: process.env.TIKTOK_REDIRECT_URI,
    linkedin: process.env.LINKEDIN_REDIRECT_URI,
  }[platform];
  if (explicit) return explicit;
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/api/auth/${platform}/callback`;
}

function credentialsFor(platform) {
  switch (platform) {
    case 'facebook':
      return { id: process.env.META_APP_ID, secret: process.env.META_APP_SECRET };
    case 'instagram': // IG uses the Meta app (Graph API) with IG scopes
      return { id: process.env.META_APP_ID, secret: process.env.META_APP_SECRET };
    case 'linkedin':
      return { id: process.env.LINKEDIN_CLIENT_ID, secret: process.env.LINKEDIN_CLIENT_SECRET };
    case 'tiktok':
      return { id: process.env.TIKTOK_CLIENT_KEY, secret: process.env.TIKTOK_CLIENT_SECRET };
    default:
      return null;
  }
}

function hasCredentials(platform) {
  const c = credentialsFor(platform);
  return Boolean(c && c.id && c.secret && !String(c.id).startsWith('your_'));
}

function authorizeUrl(platform, state) {
  const c = credentialsFor(platform);
  const redirect = encodeURIComponent(baseRedirect(platform));
  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${c.id}&redirect_uri=${redirect}&state=${state}&scope=pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,pages_manage_posts,pages_manage_metadata,instagram_basic,instagram_manage_insights`;
    case 'instagram':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${c.id}&redirect_uri=${redirect}&state=${state}&scope=instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights`;
    case 'linkedin':
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${c.id}&redirect_uri=${redirect}&state=${state}&scope=r_organization_social,w_organization_social`;
    case 'tiktok':
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${c.id}&response_type=code&redirect_uri=${redirect}&state=${state}&scopes=user.info.basic,video.list,video.insights`;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

async function exchangeCode(platform, code) {
  const c = credentialsFor(platform);
  const redirect = baseRedirect(platform);
  let res;
  if (platform === 'facebook' || platform === 'instagram') {
    res = await fetch(`${FB_API}/oauth/access_token?client_id=${c.id}&client_secret=${c.secret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`);
  } else if (platform === 'linkedin') {
    res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: c.id, client_secret: c.secret }),
    });
  } else if (platform === 'tiktok') {
    res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: redirect }),
    });
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || `Token exchange failed (${res.status})`);
  return json; // { access_token, expires_in, refresh_token?, ... }
}

async function refreshConnection(platform, refreshToken) {
  const c = credentialsFor(platform);
  if (platform === 'facebook' || platform === 'instagram') {
    // Meta: long-lived Page token; refresh by re-exchange is app-level — kept simple here.
    const res = await fetch(`${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${c.id}&client_secret=${c.secret}&fb_exchange_token=${refreshToken}`);
    return res.json();
  }
  if (platform === 'tiktok') {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: c.id, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    return res.json();
  }
  throw new Error(`${platform} does not support token refresh — reconnect required`);
}

async function exchangeForPermanentPageToken(inputToken, pageId = process.env.META_PAGE_ID) {
  const c = credentialsFor('facebook');
  if (!c || !c.id || !c.secret) {
    return { access_token: inputToken, tokenExpiresAt: null, isPermanent: false };
  }

  try {
    // Step 1: Exchange user token for long-lived user token (60 days)
    const exchangeUrl = `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${c.id}&client_secret=${c.secret}&fb_exchange_token=${inputToken}`;
    const exRes = await fetch(exchangeUrl);
    const exJson = await exRes.json();
    const longLivedUserToken = exJson.access_token || inputToken;

    // Step 2: Fetch permanent Page Access Token using long-lived token
    if (pageId) {
      const pageRes = await fetch(`${FB_API}/${pageId}?fields=access_token,name&access_token=${longLivedUserToken}`);
      const pageJson = await pageRes.json();
      if (pageJson.access_token) {
        return {
          access_token: pageJson.access_token,
          pageName: pageJson.name,
          tokenExpiresAt: null, // Meta Page tokens derived from long-lived user tokens never expire
          isPermanent: true,
        };
      }
    }

    return {
      access_token: longLivedUserToken,
      tokenExpiresAt: exJson.expires_in ? new Date(Date.now() + exJson.expires_in * 1000).toISOString() : null,
      isPermanent: !exJson.expires_in,
    };
  } catch {
    return { access_token: inputToken, tokenExpiresAt: null, isPermanent: false };
  }
}

async function testConnectionLive(platform, token) {
  if (!token) return { ok: false, message: 'Chưa có Token truy cập.' };
  try {
    if (platform === 'facebook') {
      const pageId = process.env.META_PAGE_ID;
      if (!pageId) return { ok: false, message: 'META_PAGE_ID chưa được cấu hình.', reason: 'missing_page_id' };
      const pageRes = await fetch(`${FB_API}/${pageId}?fields=id,name,access_token&access_token=${token}`);
      const pageJson = await pageRes.json();
      if (pageJson.error) return classifyMetaError(pageJson.error, pageId, 'page_lookup', pageRes.status);
      if (String(pageJson.id) !== String(pageId)) {
        return { ok: false, message: 'Token không thuộc META_PAGE_ID đã cấu hình.', reason: 'wrong_page', id: pageJson.id };
      }

      const postsUrl = `${FB_API}/${pageId}/published_posts?fields=id,message,created_time&limit=1&access_token=${token}`;
      const postsRes = await fetch(postsUrl);
      const postsJson = await postsRes.json();
      if (postsJson.error) return classifyMetaError(postsJson.error, pageId, 'published_posts', postsRes.status);
      return { ok: true, name: pageJson.name || pageJson.id, id: pageJson.id, canReadPublishedPosts: true };
    }
    if (platform === 'instagram') {
      const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (!igId) {
        return { ok: true, message: 'Instagram liên kết qua Page Token của Meta' };
      }
      const res = await fetch(`${FB_API}/${igId}?fields=id,username&access_token=${token}`);
      const json = await res.json();
      if (json.error) return { ok: false, message: json.error.message };
      return { ok: true, username: json.username, id: json.id };
    }
    if (platform === 'tiktok') {
      const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.error && json.error.code !== 'ok') return { ok: false, message: json.error.message };
      return { ok: true, user: json.data?.user };
    }
    if (platform === 'linkedin') {
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, message: json.message || `Status ${res.status}` };
      return { ok: true, name: json.name };
    }
    return { ok: true, message: 'Kết nối hợp lệ' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function classifyMetaError(error, pageId, endpoint, status) {
  const code = Number(error?.code);
  const subcode = error?.error_subcode ?? error?.error_sub_code ?? null;
  let reason = 'meta_api_error';
  let message = error?.message || `Meta API error (${status})`;
  const metaMessage = message;
  if (code === 10 || /pages_read_engagement|Page Public Content Access/i.test(message)) {
    reason = 'missing_pages_read_engagement_or_public_content_access';
    message = 'Facebook token chưa có pages_read_engagement hoặc app chưa được cấp Page Public Content Access. Hãy tạo lại Page Access Token sau khi cấp quyền.';
  } else if (code === 190) {
    reason = 'expired_or_invalid_token';
  }
  console.warn(`[meta] page=${pageId} endpoint=${endpoint} status=${status} code=${code || 'unknown'} subcode=${subcode || 'none'} reason=${reason}`);
  return { ok: false, message, metaMessage, reason, code: code || null, subcode, endpoint, status };
}

async function debugFacebookMetricsProbe(token, pageId = process.env.META_PAGE_ID) {
  const result = { pageId, assetProbe: null, postId: null, fields: [] };
  if (!token || !pageId) return { ok: false, message: 'Thiếu Facebook token hoặc META_PAGE_ID.', ...result };
  const base = `${FB_API}/${pageId}`;
  const assetRes = await fetch(`${base}/published_posts?fields=id,message,created_time&limit=1&access_token=${token}`);
  const assetJson = await assetRes.json();
  result.assetProbe = {
    ok: !assetJson.error,
    status: assetRes.status,
    requestId: assetRes.headers.get('x-fb-trace-id') || assetRes.headers.get('x-fb-request-id') || null,
    count: Array.isArray(assetJson.data) ? assetJson.data.length : 0,
    error: assetJson.error ? classifyMetaError(assetJson.error, pageId, 'published_posts', assetRes.status) : null,
  };
  result.postId = assetJson.data?.[0]?.id || null;
  if (!result.postId) return { ok: result.assetProbe.ok, ...result };
  const probes = [
    { name: 'likes', fields: 'likes.summary(true)' },
    { name: 'comments', fields: 'comments.summary(true)' },
    { name: 'shares', fields: 'shares' },
    { name: 'all_metrics', fields: 'likes.summary(true),comments.summary(true),shares' },
  ];
  for (const probe of probes) {
    const res = await fetch(`${FB_API}/${encodeURIComponent(result.postId)}?fields=${encodeURIComponent(probe.fields)}&access_token=${token}`);
    const json = await res.json();
    result.fields.push({
      name: probe.name,
      fields: probe.fields,
      ok: !json.error,
      status: res.status,
      requestId: res.headers.get('x-fb-trace-id') || res.headers.get('x-fb-request-id') || null,
      returnedKeys: json.error ? [] : Object.keys(json),
      error: json.error ? classifyMetaError(json.error, result.postId, `post_metrics:${probe.name}`, res.status) : null,
    });
  }
  const insightsUrl = `${FB_API}/${encodeURIComponent(result.postId)}/insights?metric=post_impressions,post_reach,post_engaged_users,post_video_views&access_token=${token}`;
  const insightsRes = await fetch(insightsUrl);
  const insightsJson = await insightsRes.json();
  result.insights = {
    ok: !insightsJson.error,
    status: insightsRes.status,
    requestId: insightsRes.headers.get('x-fb-trace-id') || insightsRes.headers.get('x-fb-request-id') || null,
    returnedMetrics: insightsJson.error ? [] : (insightsJson.data || []).map((item) => item.name),
    error: insightsJson.error ? classifyMetaError(insightsJson.error, result.postId, 'post_insights', insightsRes.status) : null,
  };
  return { ok: result.assetProbe.ok && (result.fields.some((f) => f.ok) || result.insights.ok), ...result };
}

async function debugFacebookTokenMatrix(tokens, pageId, postId) {
  const matrix = {};
  for (const [name, token] of Object.entries(tokens)) {
    if (!token) {
      matrix[name] = { configured: false };
      continue;
    }
    const debug = await debugMetaToken(token, pageId);
    const probe = postId ? await debugFacebookMetricsProbe(token, pageId) : null;
    matrix[name] = {
      configured: true,
      fingerprint: tokenFingerprint(token),
      debug: debug.debug || null,
      page: debug.page || null,
      publishedPosts: debug.publishedPosts || null,
      probe,
    };
  }
  return { pageId, postId, tokens: matrix };
}

async function debugMetaToken(token, pageId = process.env.META_PAGE_ID) {
  if (!token) return { ok: false, message: 'Chưa có token.' };
  const c = credentialsFor('facebook');
  if (!c?.id || !c?.secret) return { ok: false, message: 'META_APP_ID/META_APP_SECRET chưa được cấu hình.' };
  const appToken = `${c.id}|${c.secret}`;
  const debugRes = await fetch(`${FB_API}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`);
  const debugJson = await debugRes.json();
  const d = debugJson.data || {};
  const safe = {
    isValid: Boolean(d.is_valid),
    appId: d.app_id || null,
    type: d.type || null,
    userId: d.user_id || null,
    expiresAt: d.expires_at || null,
    dataAccessExpiresAt: d.data_access_expiration_time || null,
    scopes: d.granular_scopes || d.scopes || [],
  };
  if (debugJson.error) return { ok: false, debug: safe, message: debugJson.error.message };
  const pageRes = pageId ? await fetch(`${FB_API}/${pageId}?fields=id,name,access_token&access_token=${token}`) : null;
  const pageJson = pageRes ? await pageRes.json() : null;
  const postsRes = pageId ? await fetch(`${FB_API}/${pageId}/published_posts?fields=id&limit=1&access_token=${token}`) : null;
  const postsJson = postsRes ? await postsRes.json() : null;
  return {
    ok: safe.isValid && !pageJson?.error && !postsJson?.error,
    debug: safe,
    page: pageJson?.error ? classifyMetaError(pageJson.error, pageId, 'page_lookup', pageRes.status) : { id: pageJson?.id, name: pageJson?.name },
    publishedPosts: postsJson?.error ? classifyMetaError(postsJson.error, pageId, 'published_posts', postsRes.status) : { readable: true, count: (postsJson?.data || []).length },
  };
}

// Pull latest posts + insights for a connection. Returns normalized assets.
async function fetchLatestAssets(connection) {
  const token = connection.access_token;
  const out = [];
  if (connection.platform === 'facebook') {
    const pageId = process.env.META_PAGE_ID;
    const targetId = (pageId && pageId.trim() && pageId !== 'your_page_id_here') ? pageId.trim() : 'me';

    // Thử các endpoint lấy bài viết theo thứ tự ưu tiên: published_posts -> feed -> posts
    const endpoints = targetId !== 'me' 
      ? [`${FB_API}/${targetId}/published_posts`, `${FB_API}/${targetId}/feed`, `${FB_API}/${targetId}/posts`]
      : [`${FB_API}/me/feed`, `${FB_API}/me/posts`];

    let json = null;
    let lastError = null;

    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ep}?fields=id,message,permalink_url,created_time,full_picture,shares&limit=25&access_token=${token}`);
        const data = await res.json();
        if (data && !data.error && Array.isArray(data.data)) {
          json = data;
          break;
        } else if (data && data.error) {
          lastError = data.error;
        }
      } catch (err) {
        lastError = { message: err.message };
      }
    }

    if (!json) {
      if (lastError && lastError.code === 190) {
        throw new Error(`Token Meta Page đã hết hạn (${lastError.message}). Vui lòng cập nhật META_PAGE_ACCESS_TOKEN mới.`);
      }
      throw new Error(lastError ? lastError.message : 'Không thể lấy bài viết từ Facebook Graph API');
    }
    for (const item of json.data || []) {
      const url = item.permalink_url || '';
      const isReel = url.includes('/reel/');
      const isVideo = url.includes('/video') || url.includes('/watch');
      out.push({
        platformPostId: item.id,
        type: isReel ? 'reel' : isVideo ? 'video' : 'photo',
        title: (item.message || 'Facebook Post').slice(0, 140),
        content: item.message || null,
        thumbnailUrl: item.full_picture || null,
        status: 'published',
        publishedAt: item.created_time || null,
        metrics: null,
      });
    }
  } else if (connection.platform === 'instagram') {
    let igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    if (!igAccountId || igAccountId === process.env.META_PAGE_ID) {
      try {
        const lookup = await fetch(`${FB_API}/${process.env.META_PAGE_ID || 'me'}?fields=instagram_business_account&access_token=${token}`).then((r) => r.json());
        igAccountId = lookup.instagram_business_account?.id || null;
      } catch {
        igAccountId = null;
      }
    }
    if (!igAccountId) {
      return [];
    }
    const fields = 'id,caption,permalink,timestamp,media_type,media_product_type,thumbnail_url,like_count,comments_count';
    const res = await fetch(`${FB_API}/${igAccountId}/media?fields=${fields}&limit=25`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.error) {
      return [];
    }
    for (const item of json.data || []) {
      out.push({
        platformPostId: item.id,
        type: String(item.media_product_type || item.media_type || 'photo').toLowerCase().replace('feed', 'photo'),
        title: (item.caption || 'Instagram Post').slice(0, 140),
        content: item.caption || null,
        thumbnailUrl: item.thumbnail_url || null,
        status: 'published',
        publishedAt: item.timestamp || null,
        metrics: {
          reach: null,
          impressions: null,
          likes: item.like_count ?? null,
          comments: item.comments_count ?? null,
          shares: null,
          views: null,
          completionRate: null,
        },
      });
    }
  } else if (connection.platform === 'linkedin') {
    const urn = process.env.LINKEDIN_ORGANIZATION_URN;
    const res = await fetch(`https://api.linkedin.com/rest/posts?author=${encodeURIComponent(urn)}&count=25`, {
      headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202401', 'X-Restli-Protocol-Version': '2.0.0' },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `LinkedIn API ${res.status}`);
    for (const item of json.elements || []) {
      let metrics = { reach: null, impressions: null, likes: null, comments: null, shares: null, views: null, completionRate: null };
      try {
        const actions = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(item.id)}`, {
          headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202401', 'X-Restli-Protocol-Version': '2.0.0' },
        });
        if (actions.ok) {
          const a = await actions.json();
          metrics.likes = a.likesSummary?.totalLikes ?? a.likesSummary?.aggregatedTotalLikes ?? null;
          metrics.comments = a.commentsSummary?.aggregatedTotalComments ?? a.commentsSummary?.totalComments ?? null;
          metrics.shares = a.sharesSummary?.totalShares ?? null;
        }
      } catch (err) {
        console.warn(`[metrics] linkedin ${item.id}: ${err.message}`);
      }
      out.push({
        platformPostId: item.id,
        type: 'text',
        title: ((item.commentary || 'LinkedIn post').slice(0, 140)),
        content: item.commentary || null,
        thumbnailUrl: null,
        status: item.lifecycleState === 'PUBLISHED' ? 'published' : 'draft',
        publishedAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        metrics,
      });
    }
  } else if (connection.platform === 'tiktok') {
    const res = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_url,create_time,status,view_count,like_count,comment_count,share_count', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: 0, max_count: 20 }),
    });
    const json = await res.json();
    if (json.error && json.error.code !== 'ok') throw new Error(json.error.message || 'TikTok API error');
    for (const v of (json.data && json.data.videos) || []) {
      out.push({
        platformPostId: v.id,
        type: 'video',
        title: v.title || 'TikTok video',
        content: v.title || null,
        thumbnailUrl: v.cover_url || null,
        status: 'published',
        publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
        metrics: {
          reach: null,
          impressions: null,
          likes: v.like_count ?? null,
          comments: v.comment_count ?? null,
          shares: v.share_count ?? null,
          views: v.view_count ?? null,
          completionRate: null,
        },
      });
    }
  }
  return out;
}

async function fetchFacebookPostMetrics(connection, postId) {
  const url = `${FB_API}/${encodeURIComponent(postId)}?fields=likes.summary(true),comments.summary(true),shares&access_token=${connection.access_token}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      return { ok: false, metrics: null, error: classifyMetaError(json.error, postId, 'post_metrics', res.status) };
    }
    return { ok: true, metrics: {
      reach: null,
      impressions: null,
      likes: json.likes?.summary?.total_count ?? null,
      comments: json.comments?.summary?.total_count ?? null,
      shares: json.shares?.count ?? null,
      views: null,
      completionRate: null,
      metricsAvailable: true,
      metricsError: null,
    } };
  } catch (err) {
    return { ok: false, metrics: null, error: { code: null, reason: 'network_error', message: err.message } };
  }
}

async function fetchFacebookPostInsights(connection, postId) {
  const metrics = 'post_impressions,post_reach,post_engaged_users,post_video_views';
  const url = `${FB_API}/${encodeURIComponent(postId)}/insights?metric=${metrics}&access_token=${connection.access_token}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) return { ok: false, metrics: null, error: classifyMetaError(json.error, postId, 'post_insights', res.status) };
    const values = {};
    for (const item of json.data || []) values[item.name] = item.values?.[0]?.value ?? item.value ?? null;
    return { ok: true, metrics: {
      reach: values.post_reach ?? null,
      impressions: values.post_impressions ?? null,
      engagedUsers: values.post_engaged_users ?? null,
      views: values.post_video_views ?? null,
    } };
  } catch (err) {
    return { ok: false, metrics: null, error: { code: null, reason: 'network_error', message: err.message } };
  }
}

module.exports = {
  hasCredentials,
  authorizeUrl,
  exchangeCode,
  refreshConnection,
  fetchLatestAssets,
  fetchFacebookPostMetrics,
  fetchFacebookPostInsights,
  debugFacebookMetricsProbe,
  debugFacebookTokenMatrix,
  tokenFingerprint,
  baseRedirect,
  exchangeForPermanentPageToken,
  debugMetaToken,
  testConnectionLive,
};
