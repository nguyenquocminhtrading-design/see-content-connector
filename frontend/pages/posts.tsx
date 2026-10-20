import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import { apiGet, PLATFORM_COLORS, STATUS_COLORS, fmtMetric, fmtDate, formatMetricValue, formatDuration, getAvailableSeries } from '../lib/api';

export default function Posts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filters, setFilters] = useState({ platform: '', status: '', from: '', to: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const data = await apiGet(`/api/posts?${qs}`);
      setPosts(data.posts);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const metricColumns = [
    { key: 'reach', label: 'Reach', format: (v: any) => formatMetricValue(v) },
    { key: 'impressions', label: 'Impressions', format: (v: any) => formatMetricValue(v) },
    { key: 'views', label: 'Views', format: (v: any) => formatMetricValue(v) },
    { key: 'viewers', label: 'Viewers', format: (v: any) => formatMetricValue(v) },
    { key: 'engagements', label: 'Engagements', format: (v: any) => formatMetricValue(v) },
    { key: 'likes', label: 'Likes', format: (v: any) => formatMetricValue(v) },
    { key: 'comments', label: 'Comments', format: (v: any) => formatMetricValue(v) },
    { key: 'shares', label: 'Shares', format: (v: any) => formatMetricValue(v) },
    { key: 'netFollowers', label: 'Net followers', format: (v: any) => formatMetricValue(v) },
    { key: 'watchTimeSeconds', label: 'Watch time', format: (v: any) => formatDuration(v) },
    { key: 'averageWatchTimeSeconds', label: 'Avg watch time', format: (v: any) => formatDuration(v) },
    { key: 'views3Seconds', label: 'Views 3s', format: (v: any) => formatMetricValue(v) },
    { key: 'views60Seconds', label: 'Views 1m', format: (v: any) => formatMetricValue(v) },
  ];
  const visibleMetricKeys = getAvailableSeries(posts, metricColumns.map((column) => column.key));
  const visibleMetricColumns = metricColumns.filter((column) => visibleMetricKeys.includes(column.key));

  return (
    <Layout
      title="Post Status Monitor"
      subtitle="Published / Scheduled / Draft / Failed / Removed — with per-post metrics"
    >
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-6 gap-3">
        <input value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Search…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <select value={filters.platform} onChange={(e) => set('platform', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All platforms</option>
          {['facebook', 'instagram', 'linkedin', 'tiktok'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All statuses</option>
          {['published', 'scheduled', 'draft', 'failed', 'removed', 'live'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <button onClick={load} className="px-3 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700">Apply</button>
      </div>

      {loading && <p className="text-gray-500 py-12 text-center">Loading posts…</p>}
      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Published</th>
                {visibleMetricColumns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-right whitespace-nowrap">{column.label}</th>
                ))}
                <th className="px-4 py-3 text-left">Metrics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Badge label={p.platform} colorMap={PLATFORM_COLORS} /></td>
                  <td className="px-4 py-3 text-gray-900 max-w-[260px] truncate">
                    {p.title} {p.isFlagged && <span className="text-orange-500">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.type}</td>
                  <td className="px-4 py-3"><Badge label={p.status} colorMap={STATUS_COLORS} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.publishedAt)}</td>
                  {visibleMetricColumns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-right whitespace-nowrap">
                      {column.format(p[column.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span className={`text-xs font-medium ${p.metricsPartial ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {p.metricsPartial ? 'Partial' : p.metricsAvailable ? 'Available' : 'N/A'}
                    </span>
                    {p.metricsSource && <div className="text-[10px] text-gray-400">{p.metricsSource === 'meta_business_suite_scraper' ? 'Business Suite' : p.metricsSource}</div>}
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={6 + visibleMetricColumns.length} className="px-4 py-10 text-center text-gray-500">No posts match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
