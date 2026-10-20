export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function apiSend<T = any>(path: string, method: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'tiktok'] as const;
export type Platform = typeof PLATFORMS[number];

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-800',
  instagram: 'bg-pink-100 text-pink-800',
  linkedin: 'bg-indigo-100 text-indigo-800',
  tiktok: 'bg-gray-900 text-white',
};

export const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  draft: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  removed: 'bg-red-100 text-red-800',
  processing: 'bg-purple-100 text-purple-800',
  live: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export function fmt(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'N/A';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return String(v);
}

export function fmtMetric(n: number | string | null | undefined, pending = false): string {
  if (pending) return '—';
  if (n === null || n === undefined || n === '') return 'N/A';
  return fmt(n);
}

export function getMetric(asset: any, key: string): number | string | null {
  return asset?.[key] ?? asset?.metrics?.[key] ?? null;
}

export function hasMetricValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function getAvailableSeries<T extends Record<string, any>>(rows: T[], keys: string[]): string[] {
  return keys.filter((key) => rows.some((row) => hasMetricValue(row?.[key])));
}

export function formatDuration(seconds: number | string | null | undefined): string {
  if (!hasMetricValue(seconds)) return 'N/A';
  const value = Number(seconds);
  if (!Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0 giây';
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours ? `${hours} giờ` : '', minutes ? `${minutes} phút` : '', secs ? `${secs} giây` : '']
    .filter(Boolean).join(' ');
}

export function formatMetricValue(value: number | string | null | undefined, pending = false): string {
  if (pending) return '—';
  if (value === null || value === undefined || value === '') return 'N/A';
  return fmt(value);
}

export function metricTooltip(value: number | string | null | undefined): string {
  return value === null || value === undefined || value === '' ? 'N/A' : fmt(value);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
