const LABELS = {
  views: ['lượt xem', 'views'],
  viewers: ['người xem', 'viewers'],
  engagements: ['lượt tương tác', 'engagement', 'engagements'],
  netFollowers: ['số người theo dõi thực', 'net followers'],
  impressions: ['lượt hiển thị', 'impressions'],
  comments: ['bình luận', 'comments'],
  reach: ['lượt phân phối', 'lượt tiếp cận', 'reach'],
  watchTimeSeconds: ['thời gian xem', 'watch time'],
  averageWatchTimeSeconds: ['thời gian xem trung bình', 'average watch time'],
  views3Seconds: ['lượt xem trong tối thiểu 3 giây', '3-second views', 'views 3 seconds'],
  views60Seconds: ['lượt xem trong tối thiểu 1 phút', '1-minute views', 'views 1 minute'],
};

function parseMetric(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\u2011/g, '-');
  if (!raw || raw === '--' || /^n\/?a$/i.test(raw)) return null;
  const time = raw.match(/(?:(\d+)\s*giờ\s*)?(?:(\d+)\s*phút\s*)?(?:(\d+(?:[.,]\d+)?)\s*giây)?/i);
  if (time && time[0].trim() === raw && (time[1] || time[2] || time[3])) {
    return (Number(time[1] || 0) * 3600) + (Number(time[2] || 0) * 60) + Number(String(time[3] || 0).replace(',', '.'));
  }
  const compact = raw.replace(/\s/g, '');
  if (/^[\d.,]+[KMB]$/i.test(compact)) {
    const suffix = compact.slice(-1).toUpperCase();
    const number = Number(compact.slice(0, -1).replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    return Math.round(number * ({ K: 1e3, M: 1e6, B: 1e9 }[suffix]));
  }
  const number = Number(compact.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeRow(input) {
  const output = { platform: 'facebook', source: 'meta_business_suite_scraper' };
  for (const [key, aliases] of Object.entries(LABELS)) {
    const found = Object.keys(input || {}).find((name) => aliases.some((alias) => name.toLowerCase().trim().includes(alias)));
    output[key] = found ? parseMetric(input[found]) : null;
  }
  output.platformPostId = input.platformPostId || input.postId || null;
  output.recordedAt = input.recordedAt || new Date().toISOString();
  return output;
}

module.exports = { LABELS, parseMetric, normalizeRow };
