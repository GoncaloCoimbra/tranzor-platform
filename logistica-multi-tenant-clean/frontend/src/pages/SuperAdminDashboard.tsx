import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Button, Input, Badge, Alert } from '../components/common';

// --- Font Injection ------------------------------------------------------------
const injectFonts = () => {
  if (document.getElementById('ls-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ls-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

// --- Design Tokens -------------------------------------------------------------
const ds = {
  bg:            '#07090f',
  bgCard:        '#0d1117',
  bgInput:       '#0a0e17',
  border:        '#1a2234',
  accent:        '#dc2626',
  textPrimary:   '#f0f4ff',
  textSecondary: '#7a8fa8',
  textMuted:     '#3a4d63',
  success:       '#34d399',
  warning:       '#f59e0b',
  danger:        '#f87171',
  purple:        '#a78bfa',
  orange:        '#fb923c',
};

// --- Types ---------------------------------------------------------------------
interface GlobalStats {
  totalCompanies: number;
  totalUsers: number;
  totalProducts: number;
  totalSuppliers: number;
  totalVehicles: number;
  topCompanies: Array<{
    id: string;
    name: string;
    _count: { users: number; products: number; suppliers: number };
  }>;
}

// --- Sub-components ------------------------------------------------------------
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div
    className={`rounded-2xl ${className}`}
    style={{ background: ds.bgCard, border: `1px solid ${ds.border}`, ...style }}
  >
    {children}
  </div>
);

// --- Main Component ------------------------------------------------------------
const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GlobalStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalSuppliers: 0,
    totalVehicles: 0,
    topCompanies: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    injectFonts();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/superadmin/stats');
      setStats(response.data);
    } catch (err: any) {
      const msg =
        err.response?.status === 404
          ? 'Endpoint /superadmin/stats not found in backend.'
          : err.response?.data?.message || err.message || 'Error loading system statistics';
      setError(typeof msg === 'string' ? msg : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // -- Loading --
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: ds.bg, fontFamily: "'Outfit', sans-serif" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: `${ds.accent} transparent transparent transparent` }} />
          <p className="text-sm" style={{ color: ds.textMuted }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // -- Metric cards config --
  const metricCards = [
    {
      label: 'Companies',
      value: stats.totalCompanies,
      color: ds.purple,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      ),
    },
    {
      label: 'Users',
      value: stats.totalUsers,
      color: ds.accent,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      ),
    },
    {
      label: 'Products',
      value: stats.totalProducts,
      color: ds.success,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      ),
    },
    {
      label: 'Suppliers',
      value: stats.totalSuppliers,
      color: ds.orange,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
      ),
    },
    {
      label: 'Vehicles',
      value: stats.totalVehicles,
      color: ds.warning,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1"/>
        </svg>
      ),
    },
  ];

  // -- Quick actions --
  const quickActions = [
    {
      title:    'Company Management',
      subtitle: 'Create, edit, and manage all companies in the system',
      color:    ds.accent,
      path:     '/companies',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      ),
    },
    {
      title:    'User Management',
      subtitle: 'Manage users from all companies in the system',
      color:    ds.purple,
      path:     '/users',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: ds.bg, minHeight: '100vh' }}>

      {/* -- Page Header -- */}
      <div style={{ background: ds.bgCard, borderBottom: `1px solid ${ds.border}` }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${ds.accent}18`, border: `1px solid ${ds.accent}30` }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: ds.accent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: ds.textPrimary }}>
                Super Admin
              </h1>
            </div>
            <p className="text-sm" style={{ color: ds.textMuted }}>
              Global system management multi-tenant
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/companies')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: ds.bgCard, border: `1px solid ${ds.border}`, color: ds.textSecondary }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${ds.accent}50`;
                (e.currentTarget as HTMLElement).style.color = ds.textPrimary;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = ds.border;
                (e.currentTarget as HTMLElement).style.color = ds.textSecondary;
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              Manage Companies
            </button>
            <button
              onClick={() => navigate('/users')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: ds.accent, color: '#fff' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              Manage Users
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* -- Warning banner -- */}
        {error && (
          <div
            className="flex items-start gap-4 p-4 rounded-2xl"
            style={{ background: `${ds.warning}0a`, border: `1px solid ${ds.warning}30` }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${ds.warning}18` }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: ds.warning }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: ds.warning }}>
                System Warning
              </p>
              <p className="text-sm" style={{ color: ds.textSecondary }}>{error}</p>
              <button
                onClick={loadStats}
                className="text-xs font-semibold mt-2 transition-colors"
                style={{ color: ds.warning }}
              >
                Try again ?
              </button>
            </div>
          </div>
        )}

        {/* -- Metric Cards -- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {metricCards.map((m, i) => (
            <Card key={i} className="p-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}
              >
                <span style={{ color: m.color }} className="w-5 h-5 block">{m.icon}</span>
              </div>
              <p
                className="text-3xl font-bold mb-1"
                style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}
              >
                {m.value.toLocaleString('en-US')}
              </p>
              <p className="text-xs" style={{ color: ds.textMuted }}>{m.label}</p>
            </Card>
          ))}
        </div>

        {/* -- Top 5 Companies -- */}
        <Card style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm" style={{ color: ds.textPrimary }}>
                Top 5 Companies
              </h3>
              <p className="text-xs mt-0.5" style={{ color: ds.textMuted }}>
                By activity volume
              </p>
            </div>
            <button
              onClick={() => navigate('/companies')}
              className="text-xs font-semibold transition-colors"
              style={{ color: ds.accent }}
            >
              View all ?
            </button>
          </div>

          {stats.topCompanies.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ color: ds.textMuted }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <p className="text-sm mb-3" style={{ color: ds.textMuted }}>
                {error ? 'Could not load companies' : 'No companies registered'}
              </p>
              <button onClick={() => navigate('/companies')}
                className="text-xs font-semibold" style={{ color: ds.accent }}>
                Add company ?
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topCompanies.map((company, i) => (
                <div
                  key={company.id}
                  className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer"
                  style={{ border: '1px solid transparent' }}
                  onClick={() => navigate('/companies')}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = ds.bg;
                    (e.currentTarget as HTMLElement).style.borderColor = ds.border;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }}
                >
                  {/* Rank */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: `${ds.purple}18`,
                      color: ds.purple,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate mb-1.5" style={{ color: ds.textPrimary }}>
                      {company.name}
                    </p>
                    <div className="flex items-center gap-4">
                      {[
                        { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>, label: `${company._count.users} users` },
                        { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>, label: `${company._count.products} products` },
                        { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>, label: `${company._count.suppliers} suppliers` },
                      ].map((s, si) => (
                        <span key={si} className="flex items-center gap-1 text-xs" style={{ color: ds.textMuted }}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">{s.icon}</svg>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Product badge */}
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: `${ds.purple}18`,
                      color: ds.purple,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {company._count.products}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* -- Quick Actions -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map(a => (
            <div
              key={a.path}
              className="rounded-2xl p-6 transition-all duration-200"
              style={{
                background: `${a.color}08`,
                border: `1px solid ${a.color}25`,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${a.color}50`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = `${a.color}25`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}
                >
                  <span style={{ color: a.color }} className="w-6 h-6 block">{a.icon}</span>
                </div>
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: ds.textPrimary }}>{a.title}</h3>
              <p className="text-sm mb-5" style={{ color: ds.textSecondary }}>{a.subtitle}</p>
              <button
                onClick={() => navigate(a.path)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: a.color, color: '#fff' }}
              >
                Access Management ?
              </button>
            </div>
          ))}
        </div>

        {/* -- Footer status -- */}
        <div
          className="flex items-center justify-between py-4 text-xs"
          style={{ borderTop: `1px solid ${ds.border}`, color: ds.textMuted }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ color: ds.success }} />
            <span style={{ color: ds.success }}>System running</span>
          </div>
          <span>Last update: {new Date().toLocaleDateString('en-US')}</span>
        </div>

      </div>
    </div>
  );
};

export default SuperAdminDashboard;


