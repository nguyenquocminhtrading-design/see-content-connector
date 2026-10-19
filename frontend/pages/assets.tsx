import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import AssetDetailModal from '../components/AssetDetailModal';
import { apiGet, PLATFORM_COLORS, STATUS_COLORS, fmt, fmtDate } from '../lib/api';

export default function Assets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [filters, setFilters] = useState({ platform: '', type: '', status: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const data = await apiGet(`/api/assets?${qs}`);
      setAssets(data.assets);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <Layout
      title="Asset Overview"
      subtitle="All posts, clips and stories across the 4 platforms"
      actions={
        <button onClick={load} className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100">
          Refresh
        </button>
      }
    >
      {/* Filters (Phase 2: platform filter + search) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input value={filters.search} onChange={(e) => set('search', e.target.value)}
          placeholder="Search title…" className="col-span-2 md:col-span-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <select value={filters.platform} onChange={(e) => set('platform', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All platforms</option>
          {['facebook', 'instagram', 'linkedin', 'tiktok'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => set('type', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All types</option>
          {['video', 'reel', 'photo', 'carousel', 'story', 'text'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All statuses</option>
          {['published', 'scheduled', 'draft', 'failed', 'removed', 'processing', 'live', 'error'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <p className="text-gray-500 py-12 text-center">Loading assets…</p>}
      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {assets.map((a) => {
              const reach = Number(a.metrics?.reach || 0);
              const likes = Number(a.metrics?.likes || 0);
              const engRate = reach > 0 ? ((likes / reach) * 100).toFixed(1) : 0;
              const isViral = Number(engRate) > 5 || reach > 30000;

              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAsset(a)}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-400 transition cursor-pointer group flex flex-col"
                >
                  <div className="h-44 bg-gray-100 relative overflow-hidden">
                    {a.thumbnailUrl ? (
                      <img
                        src={a.thumbnailUrl}
                        alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        No thumbnail
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge label={a.platform} colorMap={PLATFORM_COLORS} />
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white px-2 py-0.5 rounded backdrop-blur">
                        {a.type}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 items-center">
                      {isViral && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold shadow animate-pulse">
                          🔥 Hot
                        </span>
                      )}
                      <Badge label={a.status} colorMap={STATUS_COLORS} />
                    </div>
                    {a.isFlagged && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-orange-500 text-white text-xs font-medium">
                        ⚠ flagged
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition">
                        {a.title}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div>
                          <p className="font-bold text-gray-900">{fmt(a.metrics?.reach)}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Reach</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{fmt(a.metrics?.likes)}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Likes</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {a.completionRate != null ? Math.round(a.completionRate * 100) + '%' : '—'}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase">Retention</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span>{fmtDate(a.publishedAt)}</span>
                      <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-1">
                        Chi tiết hiệu năng →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {assets.length === 0 && (
              <p className="text-gray-500 col-span-full text-center py-12">No assets match the filters.</p>
            )}
          </div>

          {/* Asset Performance Modal */}
          <AssetDetailModal
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
          />
        </>
      )}
    </Layout>
  );
}
