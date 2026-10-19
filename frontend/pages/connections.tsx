import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import { apiGet, apiSend, PLATFORM_COLORS, fmtDate } from '../lib/api';

const PLATFORM_META: Record<string, { connect: string; scopes: string; label: string; tokenPlaceholder: string }> = {
  facebook: {
    label: 'Facebook Page',
    connect: '/api/auth/facebook/start',
    scopes: 'pages_read_engagement, pages_manage_posts, instagram_basic',
    tokenPlaceholder: 'Dán Page Access Token hoặc User Token từ Meta Graph API Explorer...',
  },
  instagram: {
    label: 'Instagram Professional',
    connect: '/api/auth/instagram/start',
    scopes: 'instagram_content_publish, instagram_manage_comments, instagram_manage_insights',
    tokenPlaceholder: 'Dán Meta Token (Dùng chung với Facebook Page token)...',
  },
  linkedin: {
    label: 'LinkedIn Community',
    connect: '/api/auth/linkedin/start',
    scopes: 'r_organization_social, w_organization_social',
    tokenPlaceholder: 'Dán OAuth Access Token từ LinkedIn Developer Portal...',
  },
  tiktok: {
    label: 'TikTok Content',
    connect: '/api/auth/tiktok/start',
    scopes: 'video.list, video.insights, user.info.basic',
    tokenPlaceholder: 'Dán TikTok Access Token...',
  },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  connected: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: '🟢 Đã kết nối' },
  expired: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: '🟠 Phiên hết hạn (Cần cấp lại)' },
  error: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: '🔴 Lỗi kết nối' },
  disconnected: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: '⚪ Chưa kết nối' },
};

export default function Connections() {
  const [connections, setConnections] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  
  // Quick Update Token Modal state
  const [activeModalPlatform, setActiveModalPlatform] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualPageId, setManualPageId] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/connections');
      setConnections(data.connections || []);
    } catch { /* backend down */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) setNotice({ text: `✅ Đã kết nối thành công kênh ${params.get('connected')}.`, type: 'success' });
    if (params.get('error')) setNotice({ text: `⚠️ Lỗi OAuth: ${params.get('error')}`, type: 'error' });
  }, [load]);

  const startConnect = async (platform: string) => {
    try {
      const res = await fetch(`${PLATFORM_META[platform].connect}?json=true`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          text: `⚠️ ${body.error}. ${body.howTo || ''} ${body.envKeys ? `Biến môi trường cần: ${body.envKeys.join(', ')}` : ''}`,
          type: 'error'
        });
        return;
      }
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      window.location.href = PLATFORM_META[platform].connect;
    } catch (e: any) {
      setNotice({ text: `⚠️ Không thể kết nối backend: ${e.message}`, type: 'error' });
    }
  };

  const testConnection = async (platform: string) => {
    setTestingPlatform(platform);
    try {
      const res = await apiSend(`/api/connections/${platform}/test`, 'POST');
      const t = res.test || {};
      if (t.ok) {
        setTestResults((prev) => ({
          ...prev,
          [platform]: { ok: true, message: `Hợp lệ: ${t.name || t.username || 'Kết nối sẵn sàng'}` },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [platform]: { ok: false, message: `Thất bại: ${t.message || 'Token không hợp lệ'}` },
        }));
      }
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [platform]: { ok: false, message: e.message || 'Lỗi kiểm tra' },
      }));
    } finally {
      setTestingPlatform(null);
    }
  };

  const submitManualToken = async () => {
    if (!activeModalPlatform || !manualToken.trim()) return;
    setSubmittingToken(true);
    try {
      const res = await apiSend(`/api/connections/${activeModalPlatform}/token`, 'POST', {
        token: manualToken.trim(),
        pageId: manualPageId.trim() || undefined,
      });

      if (res.ok) {
        setNotice({ text: `🎉 ${res.message}`, type: 'success' });
        setActiveModalPlatform(null);
        setManualToken('');
        setManualPageId('');
        load();
      } else {
        setNotice({ text: `⚠️ ${res.error || 'Cập nhật token không thành công'}`, type: 'error' });
      }
    } catch (e: any) {
      setNotice({ text: `⚠️ Lỗi lưu token: ${e.message}`, type: 'error' });
    } finally {
      setSubmittingToken(false);
    }
  };

  const disconnect = async (id: string, platform: string) => {
    if (!window.confirm(`Bạn có chắc muốn ngắt kết nối kênh ${platform}?`)) return;
    await apiSend(`/api/connections/${id}`, 'DELETE').catch(() => {});
    load();
  };

  const allPlatforms = ['facebook', 'instagram', 'tiktok', 'linkedin'];
  const byPlatform = Object.fromEntries(connections.map((c) => [c.platform, c]));

  return (
    <Layout
      title="Trung tâm kết nối mạng xã hội"
      subtitle="Quản lý OAuth 2.0 & Hệ thống tự động làm mới Token (Self-Healing Token Engine)"
    >
      {notice && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start justify-between text-sm shadow-sm ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className="font-medium">{notice.text}</div>
          <button onClick={() => setNotice(null)} className="font-bold text-lg leading-none ml-4 hover:opacity-70">×</button>
        </div>
      )}

      {loading && <p className="text-gray-500 py-16 text-center animate-pulse">Đang tải danh sách kết nối…</p>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allPlatforms.map((p) => {
            const c = byPlatform[p];
            const meta = PLATFORM_META[p];
            const statusKey = c?.status || 'disconnected';
            const statusConf = STATUS_CONFIG[statusKey] || STATUS_CONFIG.disconnected;
            const connected = c && c.status === 'connected';
            const testResult = testResults[p];

            return (
              <div
                key={p}
                className={`bg-white rounded-2xl border p-6 transition shadow-sm hover:shadow-md flex flex-col justify-between ${connected ? 'border-gray-200' : 'border-dashed border-gray-300'}`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge label={p} colorMap={PLATFORM_COLORS} />
                      <h3 className="text-lg font-bold text-gray-900 mt-2">
                        {meta.label}
                      </h3>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${statusConf.bg} ${statusConf.text}`}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Scopes & Expiry Info */}
                  <div className="mt-4 text-xs text-gray-600 space-y-1.5 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <p className="line-clamp-1"><span className="text-gray-400 font-medium">Quyền hạn (Scopes):</span> {meta.scopes}</p>
                    {c?.tokenExpiresAt ? (
                      <p>
                        <span className="text-gray-400 font-medium">Hạn sử dụng Token:</span>{' '}
                        <strong>{fmtDate(c.tokenExpiresAt)}</strong>
                        {new Date(c.tokenExpiresAt) < new Date(Date.now() + 7 * 86400000) && (
                          <span className="text-rose-600 font-bold ml-1 animate-pulse">(Sắp hết hạn)</span>
                        )}
                      </p>
                    ) : connected ? (
                      <p className="text-emerald-700 font-semibold">
                        ✨ Token vĩnh viễn (Never-expiring Page Token) — Tự động duy trì không cần refresh
                      </p>
                    ) : null}
                    {c?.createdAt && (
                      <p><span className="text-gray-400 font-medium">Kết nối lúc:</span> {fmtDate(c.createdAt)}</p>
                    )}
                  </div>

                  {/* Live Test Result Badge */}
                  {testResult && (
                    <div className={`mt-3 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${testResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                      <span>{testResult.ok ? '✅' : '❌'}</span>
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2 items-center">
                  {/* Quick Token Update Button */}
                  <button
                    onClick={() => {
                      setActiveModalPlatform(p);
                      setManualToken('');
                    }}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
                  >
                    🔑 Cập nhật Token 1-Click
                  </button>

                  {/* Live Test Button */}
                  <button
                    onClick={() => testConnection(p)}
                    disabled={testingPlatform === p}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition"
                  >
                    {testingPlatform === p ? 'Đang kiểm tra…' : '🔍 Kiểm tra kết nối'}
                  </button>

                  {/* OAuth Connect */}
                  {!connected && (
                    <button
                      onClick={() => startConnect(p)}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition"
                    >
                      Đăng nhập OAuth
                    </button>
                  )}

                  {/* Disconnect */}
                  {c && (
                    <button
                      onClick={() => disconnect(c.id, p)}
                      className="px-2.5 py-2 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 ml-auto transition"
                    >
                      Ngắt kết nối
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Token Update Modal */}
      {activeModalPlatform && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <span>Cập nhật Token cho {PLATFORM_META[activeModalPlatform]?.label}</span>
              </h3>
              <button
                onClick={() => setActiveModalPlatform(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {activeModalPlatform === 'facebook' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
                  <p className="font-bold">💡 Tự động đổi sang Token Vĩnh Viễn:</p>
                  <p>Hệ thống sẽ tự động gọi Meta Graph API để đổi Token bạn dán thành <strong>Never-expiring Page Token</strong>, giúp kênh chạy liên tục không bao giờ bị hết hạn phiên.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Mã Access Token mới:
                </label>
                <textarea
                  rows={4}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder={PLATFORM_META[activeModalPlatform]?.tokenPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {activeModalPlatform === 'facebook' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Meta Page ID (Tùy chọn nếu muốn chỉ định chính xác Page):
                  </label>
                  <input
                    type="text"
                    value={manualPageId}
                    onChange={(e) => setManualPageId(e.target.value)}
                    placeholder="Mặc định lấy từ META_PAGE_ID trong .env"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setActiveModalPlatform(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  onClick={submitManualToken}
                  disabled={submittingToken || !manualToken.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow"
                >
                  {submittingToken ? 'Đang xác thực & Lưu…' : 'Lưu & Kiểm tra kết nối ngay'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide Card */}
      <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-sm text-gray-600 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-2">📋 Hướng dẫn lấy Token không hết hạn cho Facebook / Instagram</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600">
          <li>Truy cập <a className="text-blue-600 font-semibold underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Meta Graph API Explorer</a>.</li>
          <li>Chọn Meta App của bạn tại mục <b>Meta App</b>.</li>
          <li>Tại mục <b>User or Page</b>, chọn đúng Facebook Page của bạn và cấp quyền <code className="bg-gray-100 px-1 py-0.5 rounded">pages_read_engagement</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">pages_manage_posts</code>.</li>
          <li>Bấm <b>Generate Access Token</b> rồi bấm <b>"🔑 Cập nhật Token 1-Click"</b> ở trên để dán vào. Hệ thống sẽ tự động chuyển thành Token vĩnh viễn!</li>
        </ol>
      </div>
    </Layout>
  );
}
