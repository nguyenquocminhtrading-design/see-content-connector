import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/posts', label: 'Posts' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/connections', label: 'Connections' },
];

export default function Layout({ children, title, subtitle, actions }: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-gray-900">SEE</span>
            <span className="text-xl font-light tracking-tight text-gray-500">Content Connector</span>
          </div>
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const active = n.href === '/' ? router.pathname === '/' : router.pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
