import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { apiGet, PLATFORM_COLORS, fmt, formatMetricValue } from '../lib/api';
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
                  <Line type="monotone" dataKey="reach" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="comments" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="shares" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
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
