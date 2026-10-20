import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { apiGet, PLATFORM_COLORS, fmt, formatMetricValue, getAvailableSeries } from '../lib/api';
import Badge from '../components/Badge';

const COLORS = ['#2563eb', '#ec4899', '#6366f1', '#111827'];

export default function Analytics() {
  const [range, setRange] = useState('7');
  const [series, setSeries] = useState<any[]>([]);
  const [compare, setCompare] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      apiGet(`/api/analytics?range=${range}`),
      apiGet(`/api/analytics/compare?range=${Math.max(Number(range), 30)}`),
    ])
      .then(([a, b]) => { setSeries(a.series); setCompare(b.platforms); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const distributionSeries = getAvailableSeries(series, ['reach', 'impressions', 'viewers']);
  const videoSeries = getAvailableSeries(series, ['views', 'views3Seconds', 'views60Seconds']);
  const engagementSeries = getAvailableSeries(series, ['likes', 'comments', 'shares', 'engagements']);
  const hasDistributionData = distributionSeries.length > 0;
  const hasVideoData = videoSeries.length > 0;

  return (
    <Layout
      title="Analytics & Alerts"
      subtitle="Engagement trends and cross-platform comparison"
      actions={
        <a href={`/api/export/report.csv?range=${range}`}
          className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">
          Export CSV
        </a>
      }
    >
      <div className="flex gap-2 mb-6">
        {[['1', '24h'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']].map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${range === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 py-12 text-center">Loading analytics…</p>}
      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="space-y-8">
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement over time</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(v: any) => formatMetricValue(v)} />
                  <Legend />
                  {distributionSeries.includes('reach') && <Line type="monotone" dataKey="reach" name="Reach" stroke="#2563eb" strokeWidth={2} dot={false} />}
                  {distributionSeries.includes('impressions') && <Line type="monotone" dataKey="impressions" name="Impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} />}
                  {engagementSeries.includes('likes') && <Line type="monotone" dataKey="likes" name="Likes" stroke="#ec4899" strokeWidth={2} dot={false} />}
                  {engagementSeries.includes('comments') && <Line type="monotone" dataKey="comments" name="Comments" stroke="#f59e0b" strokeWidth={2} dot={false} />}
                  {engagementSeries.includes('shares') && <Line type="monotone" dataKey="shares" name="Shares" stroke="#10b981" strokeWidth={2} dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân phối bài viết</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {hasDistributionData ? <BarChart data={series} barCategoryGap="18%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: any) => formatMetricValue(v)} />
                    <Legend />
                    {distributionSeries.includes('reach') && <Bar dataKey="reach" name="Reach" fill="#2563eb" barSize={14} />}
                    {distributionSeries.includes('impressions') && <Bar dataKey="impressions" name="Impressions" fill="#8b5cf6" barSize={14} />}
                    {distributionSeries.includes('viewers') && <Bar dataKey="viewers" name="Viewers" fill="#06b6d4" barSize={14} />}
                  </BarChart> : <div className="h-full flex items-center justify-center text-sm text-gray-400">Chưa có dữ liệu phân phối thật từ nền tảng</div>}
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Hiệu suất video</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {hasVideoData ? <BarChart data={series} barCategoryGap="18%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: any) => formatMetricValue(v)} />
                    <Legend />
                    {videoSeries.includes('views') && <Bar dataKey="views" name="Views" fill="#4f46e5" barSize={14} />}
                    {videoSeries.includes('views3Seconds') && <Bar dataKey="views3Seconds" name="Views 3s" fill="#f59e0b" barSize={14} />}
                    {videoSeries.includes('views60Seconds') && <Bar dataKey="views60Seconds" name="Views 1m" fill="#ef4444" barSize={14} />}
                  </BarChart> : <div className="h-full flex items-center justify-center text-sm text-gray-400">Chưa có dữ liệu video thật từ nền tảng</div>}
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cross-platform comparison</h2>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(v: any) => formatMetricValue(v)} />
                  <Legend />
                  <Bar dataKey="reach" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="impressions" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="engagement" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Platform</th>
                    <th className="px-4 py-2 text-right">Posts</th>
                    <th className="px-4 py-2 text-right">Reach</th>
                    <th className="px-4 py-2 text-right">Impressions</th>
                    <th className="px-4 py-2 text-right">Engagement</th>
                    <th className="px-4 py-2 text-right">Eng. rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {compare.map((p: any) => (
                    <tr key={p.platform}>
                      <td className="px-4 py-2"><Badge label={p.platform} colorMap={PLATFORM_COLORS} /></td>
                      <td className="px-4 py-2 text-right">{p.posts}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatMetricValue(p.reach)}</td>
                      <td className="px-4 py-2 text-right">{formatMetricValue(p.impressions)}</td>
                      <td className="px-4 py-2 text-right">{formatMetricValue(p.engagement)}</td>
                      <td className="px-4 py-2 text-right">{p.engagementRate === null || p.engagementRate === undefined ? 'N/A' : `${p.engagementRate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
