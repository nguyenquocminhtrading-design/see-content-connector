import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import AssetDetailModal from '../components/AssetDetailModal';
import { apiGet, apiSend, PLATFORM_COLORS, SEVERITY_COLORS, fmt, fmtDate } from '../lib/api';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [analyticsSeries, setAnalyticsSeries] = useState<any[]>([]);
  const [topAssets, setTopAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [chartRange, setChartRange] = useState<string>('30');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Dashboard Overview
  useEffect(() => {
    Promise.all([
      apiGet('/api/dashboard'),
      apiGet('/api/assets'),
    ])
      .then(([dashData, assetsData]) => {
        setData(dashData);

        // Compute Top 5 most popular/performing assets
        const assets = assetsData.assets || [];
        const evaluated = assets
          .filter((a: any) => a.metrics && (a.status === 'published' || a.status === 'live'))
          .map((a: any) => {
            const reach = Number(a.metrics?.reach || 0);
            const likes = Number(a.metrics?.likes || 0);
            const comments = Number(a.metrics?.comments || 0);
            const shares = Number(a.metrics?.shares || 0);
            const totalEng = likes + comments + shares;
            const engRate = reach > 0 ? (totalEng / reach) * 100 : 0;
            const viralScore = Math.min(Math.round(engRate * 8 + (reach / 1000) * 1.5 + shares * 0.8), 99);
            return {
              ...a,
              totalEng,
              engRateFormatted: engRate.toFixed(2),
              viralScore: Math.max(viralScore, 35),
            };
          })
          .sort((a: any, b: any) => b.viralScore - a.viralScore)
          .slice(0, 5);

        setTopAssets(evaluated);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load Analytics trends based on range
  useEffect(() => {
    apiGet(`/api/analytics?range=${chartRange}`)
      .then((res) => setAnalyticsSeries(res.series || []))
      .catch(() => {});
  }, [chartRange]);

  const cards = data ? [
    { label: 'Tổng số Asset', value: data.totals.assets, tone: 'text-gray-900', hint: 'Toàn bộ nội dung' },
    { label: 'Đã xuất bản', value: data.totals.published, tone: 'text-emerald-600', hint: 'Đang hoạt động' },
    { label: 'Lên lịch sẵn', value: data.totals.scheduled, tone: 'text-blue-600', hint: 'Chờ phân phối' },
    { label: 'Lỗi / Bị gỡ', value: data.totals.failed, tone: 'text-rose-600', hint: 'Cần xử lý ngay' },
    { label: 'Cảnh báo vi phạm', value: data.totals.flagged, tone: 'text-amber-600', hint: 'Policy flagged' },
  ] : [];

  return (
    <Layout
      title="Bảng điều khiển kết nối nội dung"
      subtitle="Theo dõi hiệu năng nội dung đa nền tảng — Facebook · Instagram · LinkedIn · TikTok"
      actions={
        <>
          <button
            onClick={async () => {
              await apiSend('/api/sync/run', 'POST').catch(() => {});
              location.reload();
            }}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition shadow-sm flex items-center gap-1.5"
          >
            🔄 Đồng bộ ngay
          </button>
          <a
            href={`/api/export/report.csv?range=${chartRange}`}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition shadow-sm"
          >
            📥 Xuất CSV
          </a>
        </>
      }
    >
      {loading && <p className="text-gray-500 py-16 text-center animate-pulse">Đang tải dữ liệu bảng điều khiển…</p>}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg mb-6">
          <p className="font-semibold">Không thể kết nối đến máy chủ Backend</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-sm mt-2 text-gray-600">Khởi động backend bằng lệnh: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">npm run dev:backend</code></p>
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Expired Token Reconnect Banner (Graceful Degradation Alert) */}
          {data.byPlatform.some((p: any) => p.status === 'expired') && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Phát hiện phiên kết nối mạng xã hội đã hết hạn ({data.byPlatform.filter((p: any) => p.status === 'expired').map((p: any) => p.platform).join(', ')})
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Dữ liệu bài viết và báo cáo cũ vẫn được bảo lưu an toàn. Vui lòng cấp lại Token để tiếp tục đồng bộ các bài viết mới.
                  </p>
                </div>
              </div>
              <Link
                href="/connections"
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap transition shadow"
              >
                🔑 Cập nhật Token 1-Click →
              </Link>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{c.label}</p>
                <p className={`text-2xl font-black mt-1.5 ${c.tone}`}>{fmt(c.value)}</p>
                <p className="text-[11px] text-gray-400 mt-1">{c.hint}</p>
              </div>
            ))}
          </div>

          {/* Top Most Popular Content Ranking Widget */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🔥 Top nội dung được ưa chuộng nhất</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    Đánh giá theo tương tác & lượt tiếp cận
                  </span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Bấm vào từng bài viết để xem phân tích chi tiết hiệu năng và đánh giá viral</p>
              </div>
              <Link href="/assets" className="text-sm font-semibold text-blue-600 hover:underline">
                Xem tất cả asset →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topAssets.map((asset, idx) => {
                const badgeRank = idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-700';
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="relative bg-gray-50 hover:bg-white rounded-xl border border-gray-200 hover:border-blue-400 p-3 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail & Rank */}
                      <div className="relative h-28 bg-gray-200 rounded-lg overflow-hidden mb-2.5">
                        {asset.thumbnailUrl ? (
                          <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No preview</div>
                        )}
                        <span className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow ${badgeRank}`}>
                          #{idx + 1}
                        </span>
                        <div className="absolute top-2 right-2">
                          <Badge label={asset.platform} colorMap={PLATFORM_COLORS} />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600 transition leading-snug">
                        {asset.title}
                      </h3>
                    </div>

                    {/* Stats pill */}
                    <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Reach</p>
                        <p className="font-bold text-gray-800">{fmt(asset.metrics?.reach)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase">Tỷ lệ tương tác</p>
                        <p className="font-bold text-emerald-600">{asset.engRateFormatted}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {topAssets.length === 0 && (
                <div className="col-span-5 text-center py-8 text-gray-400 text-sm">
                  Chưa có dữ liệu bài viết xuất bản để xếp hạng.
                </div>
              )}
            </div>
          </section>

          {/* Interactive Performance Charts Section */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Biểu đồ phân tích hiệu suất tổng hợp</h2>
                <p className="text-xs text-gray-500 mt-0.5">Theo dõi xu hướng tiếp cận, lượt hiển thị và mức độ tương tác</p>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
                {[
                  { value: '7', label: '7 ngày' },
                  { value: '30', label: '30 ngày' },
                  { value: '90', label: '90 ngày' },
                ].map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setChartRange(r.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${chartRange === r.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reach & Impressions Trend */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Lượt tiếp cận & Hiển thị (Reach / Impressions)</h3>
                  <span className="text-xs text-gray-400">Đơn vị: lượt</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                      <Tooltip formatter={(v: any) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="reach" name="Reach (Tiếp cận)" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="impressions" name="Impressions (Hiển thị)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Engagement Breakdown Over Time */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Chi tiết tương tác theo ngày (Likes · Comments · Shares)</h3>
                  <span className="text-xs text-gray-400">Đơn vị: tương tác</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                      <Tooltip formatter={(v: any) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="likes" name="Likes" fill="#ec4899" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="comments" name="Comments" fill="#f59e0b" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="shares" name="Shares" fill="#10b981" stackId="a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Platform comparison */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Tổng quan theo nền tảng (30 ngày)</h2>
              <Link href="/connections" className="text-sm font-semibold text-blue-600 hover:underline">
                Quản lý kết nối nền tảng →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Nền tảng</th>
                    <th className="px-4 py-3 text-center">Trạng thái bài đăng</th>
                    <th className="px-4 py-3 text-right">Số bài (Posts)</th>
                    <th className="px-4 py-3 text-right">Tiếp cận (Reach)</th>
                    <th className="px-4 py-3 text-right">Hiển thị (Impressions)</th>
                    <th className="px-4 py-3 text-right">Tương tác</th>
                    <th className="px-4 py-3 text-right">Tỷ lệ tương tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byPlatform.map((p: any) => {
                    const isConnected = p.status === 'connected';
                    return (
                      <tr key={p.platform} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Badge label={p.platform} colorMap={PLATFORM_COLORS} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {p.posts > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Đang hoạt động ({p.posts} bài)
                            </span>
                          ) : isConnected ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Đã kết nối — Chưa có bài đăng
                            </span>
                          ) : (
                            <Link
                              href="/connections"
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50 font-medium transition"
                            >
                              Chưa kết nối →
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium">{p.posts > 0 ? p.posts : 0}</td>
                        <td className="px-4 py-3.5 text-right font-medium">{p.posts > 0 ? fmt(p.reach) : '—'}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{p.posts > 0 ? fmt(p.impressions) : '—'}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{p.posts > 0 ? fmt(p.engagement) : '—'}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">{p.posts > 0 ? `${p.engagementRate}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent alerts */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Cảnh báo & Hoạt động gần đây</h2>
              <Link href="/connections" className="text-sm font-semibold text-blue-600 hover:underline">
                Xem thiết lập kênh →
              </Link>
            </div>
            <div className="space-y-2">
              {data.recentAlerts.map((a: any) => (
                <div key={a.id} className={`bg-white rounded-lg border p-3.5 flex items-start gap-3 ${a.isRead ? 'border-gray-200' : 'border-amber-300 bg-amber-50/30'}`}>
                  <Badge label={a.severity} colorMap={SEVERITY_COLORS} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 font-medium">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.type} · {fmtDate(a.createdAt)}</p>
                  </div>
                  {!a.isRead && <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" title="Chưa đọc" />}
                </div>
              ))}
              {data.recentAlerts.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center text-sm text-emerald-800">
                  ✅ Tất cả các kênh đều hoạt động ổn định. Không có cảnh báo hay vi phạm chính sách.
                </div>
              )}
            </div>
          </section>

          {/* Asset Detail Modal */}
          <AssetDetailModal
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
          />
        </div>
      )}
    </Layout>
  );
}
