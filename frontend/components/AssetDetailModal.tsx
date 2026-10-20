import React from 'react';
import Badge from './Badge';
import { PLATFORM_COLORS, STATUS_COLORS, fmt, fmtDate, getMetric, formatMetricValue, hasMetricValue } from '../lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

interface AssetDetailModalProps {
  asset: any | null;
  onClose: () => void;
}

export default function AssetDetailModal({ asset, onClose }: AssetDetailModalProps) {
  if (!asset) return null;

  const reachValue = getMetric(asset, 'reach');
  const impressionsValue = getMetric(asset, 'impressions');
  const likesValue = getMetric(asset, 'likes');
  const commentsValue = getMetric(asset, 'comments');
  const sharesValue = getMetric(asset, 'shares');
  const viewsValue = getMetric(asset, 'views');
  const viewersValue = getMetric(asset, 'viewers');
  const engagementsValue = getMetric(asset, 'engagements');
  const followersValue = getMetric(asset, 'netFollowers');
  const watchTimeValue = getMetric(asset, 'watchTimeSeconds');
  const averageWatchTimeValue = getMetric(asset, 'averageWatchTimeSeconds');
  const views3SecondsValue = getMetric(asset, 'views3Seconds');
  const views60SecondsValue = getMetric(asset, 'views60Seconds');
  const reach = hasMetricValue(reachValue) ? Number(reachValue) : null;
  const likes = hasMetricValue(likesValue) ? Number(likesValue) : null;
  const comments = hasMetricValue(commentsValue) ? Number(commentsValue) : null;
  const shares = hasMetricValue(sharesValue) ? Number(sharesValue) : null;
  const hasEngagementData = [likesValue, commentsValue, sharesValue].some((v) => v !== null && v !== undefined && v !== '');
  const totalEngagement = hasMetricValue(engagementsValue)
    ? Number(engagementsValue)
    : (hasEngagementData ? [likes, comments, shares].filter((v): v is number => v !== null).reduce((sum, v) => sum + v, 0) : null);
  const engagementIsEstimated = !hasMetricValue(engagementsValue) && hasEngagementData;
  const engRate = reach !== null && reach > 0 && totalEngagement != null ? ((totalEngagement / reach) * 100).toFixed(2) : null;
  const completionRate = asset.completionRate != null ? Math.round(asset.completionRate * 100) : null;

  // Calculate Popularity / Viral Score (0-100)
  let popularityScore = 0;
  if (reach !== null && reach > 0) {
    const rawRate = ((totalEngagement || 0) / reach) * 100;
    const rateScore = Math.min(rawRate * 10, 50); // up to 50 pts for engagement rate
    const volumeScore = Math.min((reach / 50000) * 30, 30); // up to 30 pts for raw reach
    const shareBonus = Math.min(((shares * 5) / (totalEngagement || 1)) * 20, 20); // up to 20 pts for viral sharing
    popularityScore = Math.min(Math.round(rateScore + volumeScore + shareBonus), 99);
  } else if (asset.status === 'published') {
    popularityScore = 35;
  }

  let tier = {
    label: 'Cần tối ưu thêm',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: '💤',
    desc: 'Bài viết có lượng tương tác còn thấp so với trung bình kênh. Nên thử nghiệm lại khung giờ đăng bài hoặc thumbnail bắt mắt hơn.'
  };

  if (popularityScore >= 75 || Number(engRate || 0) >= 6) {
    tier = {
      label: 'Siêu thịnh hành (Viral Content)',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: '🔥',
      desc: 'Nội dung đang được người xem đặc biệt ưu chuộng! Tỷ lệ lưu, chia sẻ và tương tác vượt trội. Khuyên khích sản xuất nội dung nối tiếp (Part 2) hoặc phân phối lại.'
    };
  } else if (popularityScore >= 50 || Number(engRate || 0) >= 3.5) {
    tier = {
      label: 'Đang được quan tâm cao (High Traction)',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: '🚀',
      desc: 'Nội dung duy trì đà tăng trưởng tương tác rất tốt. Giữ chân người xem ổn định và có lượng comment phản hồi tích cực.'
    };
  } else if (popularityScore >= 30) {
    tier = {
      label: 'Hiệu quả ổn định (Steady Performer)',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: '⭐',
      desc: 'Hiệu suất đạt mức trung bình tốt của kênh, thông số phân phối đều đặn giữa các chỉ số reach và likes.'
    };
  }

  const breakdownData = [
    ...(hasMetricValue(likesValue) ? [{ name: 'Lượt thích (Likes)', count: likesValue, fill: '#ec4899' }] : []),
    ...(hasMetricValue(commentsValue) ? [{ name: 'Bình luận (Comments)', count: commentsValue, fill: '#f59e0b' }] : []),
    ...(hasMetricValue(sharesValue) ? [{ name: 'Chia sẻ (Shares)', count: sharesValue, fill: '#10b981' }] : []),
  ];

  const historyData = asset.history || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-gray-100 animate-fadeIn">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Badge label={asset.platform} colorMap={PLATFORM_COLORS} />
            <Badge label={asset.status} colorMap={STATUS_COLORS} />
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 px-2 py-0.5 bg-gray-100 rounded">
              {asset.type}
            </span>
            {asset.isFlagged && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                ⚠ Cảnh báo vi phạm
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center font-bold text-lg transition"
            title="Đóng modal"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Main Info Hero */}
          <div className="flex flex-col md:flex-row gap-5 items-start">
            <div className="w-full md:w-56 h-36 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative border border-gray-200">
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  Không có thumbnail
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold text-gray-900 leading-snug">{asset.title}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">{asset.content || asset.title || 'N/A'}</p>
              <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>📅 Đăng lúc: <strong>{fmtDate(asset.publishedAt)}</strong></span>
                <span>🔄 Đồng bộ lúc: <strong>{fmtDate(asset.syncedAt)}</strong></span>
                <span>🆔 ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{asset.platformPostId || asset.id}</code></span>
              </div>

              {/* Popularity Evaluation Banner */}
              <div className={`mt-3 p-3.5 rounded-xl border ${tier.color} flex items-start gap-3`}>
                <span className="text-2xl">{tier.icon}</span>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{tier.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/80 rounded-full border border-current">
                      Độ ưu chuộng: {popularityScore}/100
                    </span>
                  </div>
                  <p className="mt-1 opacity-90 leading-relaxed">{tier.desc}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Lượt tiếp cận</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">{formatMetricValue(reachValue)}</p>
              <p className="text-[10px] text-gray-400">Reach</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Lượt hiển thị</p>
              <p className="text-xl font-bold text-purple-600 mt-0.5">{formatMetricValue(impressionsValue)}</p>
              <p className="text-[10px] text-gray-400">Impressions</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Tổng tương tác</p>
              <p className="text-xl font-bold text-pink-600 mt-0.5">{formatMetricValue(totalEngagement)}</p>
              <p className="text-[10px] text-gray-400">{engagementIsEstimated ? 'Engagements · Tạm tính' : 'Engagements'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">Tỷ lệ tương tác</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{engRate == null ? 'N/A' : `${engRate}%`}</p>
              <p className="text-[10px] text-gray-400">Engagement rate</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 uppercase font-medium">Xem hết clip</p>
              <p className="text-xl font-bold text-indigo-600 mt-0.5">
                {completionRate != null ? `${completionRate}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">Completion rate</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              ['Lượt xem', viewsValue],
              ['Người xem', viewersValue],
              ['Lượt tương tác', engagementsValue],
              ['Theo dõi thực', followersValue],
              ['Thời gian xem', watchTimeValue],
              ['Xem trung bình', averageWatchTimeValue],
              ['Xem tối thiểu 3 giây', views3SecondsValue],
              ['Xem tối thiểu 1 phút', views60SecondsValue],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{formatMetricValue(value as any)}</p>
              </div>
            ))}
          </div>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Trend Line */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-between">
                <span>Diễn biến theo ngày</span>
                <span className="text-[11px] text-gray-400">Reach & Impressions</span>
              </h3>
              <div className="h-52">
                {historyData.length === 0 || !historyData.some((row: any) => hasMetricValue(row.reach) || hasMetricValue(row.impressions) || hasMetricValue(row.viewers)) ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center px-4">
                    Meta chưa trả dữ liệu phân phối cho bài viết này
                  </div>
                ) : <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: any) => formatMetricValue(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {historyData.some((row: any) => hasMetricValue(row.reach)) && <Line type="monotone" dataKey="reach" name="Reach" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />}
                    {historyData.some((row: any) => hasMetricValue(row.impressions)) && <Line type="monotone" dataKey="impressions" name="Impressions" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />}
                    {historyData.some((row: any) => hasMetricValue(row.viewers)) && <Line type="monotone" dataKey="viewers" name="Viewers" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />}
                  </LineChart>
                </ResponsiveContainer>}
              </div>
            </div>

            {/* Engagement Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-between">
                <span>Chi tiết tương tác</span>
                <span className="text-[11px] text-gray-400">Likes · Comments · Shares</span>
              </h3>
              <div className="h-52">
                {breakdownData.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-gray-400">Chưa có dữ liệu tương tác thật</div> : <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="count" name="Số lượng" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Asset synced: {fmtDate(asset.syncedAt)}</span>
              <span>Metrics recorded: {fmtDate(asset.metricsRecordedAt || asset.metrics?.recordedAt)}</span>
              <span>Source: {asset.metricsSource || asset.metrics?.metricsSource || 'N/A'}</span>
              <span>Available: {asset.metricsAvailable == null ? '—' : asset.metricsAvailable ? 'Yes' : 'No'}</span>
              {asset.metricsPartial && <span className="text-amber-600">Partial metrics</span>}
            </div>
            {asset.metricsError && <p className="mt-1 text-rose-600">Metrics warning: {asset.metricsError}</p>}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <a
              href={`/api/videos/${asset.id}/health`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            >
              🔍 Xem dữ liệu chẩn đoán kỹ thuật (Health JSON) →
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
