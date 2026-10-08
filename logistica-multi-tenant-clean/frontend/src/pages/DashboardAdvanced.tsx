import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../api/api';
import DashboardFilters, { FilterState } from '../components/DashboardFilters';
import { Button, Input, Badge, Alert } from '../components/common';
import { statusLabels, statusColors } from '../theme.config';

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
  bg:       '#07090f',
  bgCard:   '#0d1117',
  bgCardHover: '#111820',
  bgInput:  '#0a0e17',
  border:   '#1a2234',
  borderHover: '#253248',
  accent:   '#dc2626',
  accentGlow: 'rgba(79,133,246,0.15)',
  textPrimary:   '#f0f4ff',
  textSecondary: '#7a8fa8',
  textMuted:     '#3a4d63',
  success: '#34d399',
  warning: '#f59e0b',
  danger:  '#f87171',
  purple:  '#a78bfa',
  orange:  '#fb923c',
};

// --- Types ---------------------------------------------------------------------
interface DashboardStats {
  period: string;
  customDateRange: { startDate: Date; endDate: Date } | null;
  appliedFilters: { supplierId: string | null; hasDateRange: boolean };
  availableSuppliers: Array<{ id: string; name: string; productCount: number }>;
  totalProducts: number;
  productsByStatus: Array<{ status: string; count: number }>;
  recentMovements: number;
  movementsByDay: Array<{ data: string; count: number }>;
  productsCreatedByDay: Array<{ data: string; count: number }>;
  deliveredByDay: Array<{ data: string; count: number }>;
  summary: { received: number; inAnalysis: number; inStorage: number; delivered: number; rejected: number };
  percentages: { received: string; inStorage: string; delivered: string; rejected: string };
  topSuppliers: Array<{ id: string; name: string; productCount: number }>;
  transportStats: { total: number; active: number; completed: number };
  vehicleStats: { total: number };
  rejectionRateBySupplier: Array<{
    supplierId: string; supplierName: string;
    totalProducts: number; rejectedProducts: number; rejectionRate: number;
  }>;
  avgTimeInStatus: Array<{ status: string; avgHours: number }>;
  trends: { products: string; deliveries: string };
}

// --- Sub-components ------------------------------------------------------------

/** Card container */
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div
    className={`rounded-2xl transition-all duration-200 ${className}`}
    style={{ background: ds.bgCard, border: `1px solid ${ds.border}`, ...style }}
  >
    {children}
  </div>
);

/** Section title inside cards */
const CardHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }> = ({ icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${ds.accent}18`, border: `1px solid ${ds.accent}30` }}>
        <span style={{ color: ds.accent }} className="w-4 h-4 block">{icon}</span>
      </div>
      <div>
        <h3 className="font-semibold text-sm" style={{ color: ds.textPrimary }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: ds.textMuted }}>{subtitle}</p>}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

/** Trend indicator */
const Trend: React.FC<{ value: string }> = ({ value }) => {
  const n = parseFloat(value);
  const positive = n >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: positive ? `${ds.success}18` : `${ds.danger}18`,
        color: positive ? ds.success : ds.danger,
      }}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        {positive
          ? <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
          : <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        }
      </svg>
      {Math.abs(n)}%
    </span>
  );
};

/** Dark-themed chart tooltip */
const DarkTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs shadow-2xl"
      style={{ background: '#111822', border: `1px solid ${ds.border}`, minWidth: 120 }}>
      <p className="font-semibold mb-2" style={{ color: ds.textPrimary }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center justify-between gap-3" style={{ color: ds.textSecondary }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-bold" style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}>
            {entry.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// --- Main Component ------------------------------------------------------------
const DashboardAdvanced: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    period: '30d', supplierId: null, startDate: null, endDate: null, useCustomDate: false,
  });

  const loadStats = useCallback(async (filters: FilterState) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.useCustomDate && filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate);
        params.append('endDate', filters.endDate);
      } else {
        params.append('period', filters.period);
      }
      if (filters.supplierId) params.append('supplierId', filters.supplierId);
      const response = await api.get(`/dashboard/stats?${params.toString()}`);
      setStats(response.data);
      setCurrentFilters(filters);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    injectFonts();
    loadStats(currentFilters);
  }, [currentFilters, loadStats]);

  const handleFilterChange = (filters: FilterState) => loadStats(filters);

  const handleExportReport = () => {
    if (!stats) return;
    const filterInfo = [];
    if (stats.appliedFilters.supplierId) {
      const s = stats.availableSuppliers.find(s => s.id === stats.appliedFilters.supplierId);
      filterInfo.push(['Supplier Filtrado', s?.name || 'N/A']);
    }
    if (stats.customDateRange) {
      filterInfo.push(['Custom Period',
        `${new Date(stats.customDateRange.startDate).toLocaleDateString('en-GB')} - ${new Date(stats.customDateRange.endDate).toLocaleDateString('en-GB')}`]);
    } else {
      filterInfo.push(['Period', stats.period]);
    }
    const csvContent = [
      ['Performance Report - Tranzor Logística'],
      ['Export Date', new Date().toLocaleDateString('en-GB')],
      [''], ['APPLIED FILTERS'], ...filterInfo,
      [''], ['GENERAL SUMMARY'],
      ['Total Products', stats.totalProducts],
      ['Received', stats.summary.received],
      ['In Analysis', stats.summary.inAnalysis],
      ['In Storage', stats.summary.inStorage],
      ['Delivered', stats.summary.delivered],
      ['Rejected', stats.summary.rejected],
      [''], ['TRENDS'],
      ['Products vs Previous Period', `${stats.trends.products}%`],
      ['Deliveries vs Previous Period', `${stats.trends.deliveries}%`],
      [''], ['TOP SUPPLIERS'],
      ['Position', 'Name', 'Products', 'Percentage'],
      ...stats.topSuppliers.map((s, i) => {
        const pct = stats.totalProducts > 0 ? ((s.productCount / stats.totalProducts) * 100).toFixed(1) : '0';
        return [`#${i + 1}`, s.name, s.productCount, `${pct}%`];
      }),
      [''], ['REJECTION RATE BY SUPPLIER'],
      ['Supplier', 'Total Products', 'Rejected', 'Rate (%)'],
      ...stats.rejectionRateBySupplier.map(r => [r.supplierName, r.totalProducts, r.rejectedProducts, r.rejectionRate]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPeriodLabel = () => {
    if (!stats) return '';
    if (stats.customDateRange) {
      return `${new Date(stats.customDateRange.startDate).toLocaleDateString('en-GB')} - ${new Date(stats.customDateRange.endDate).toLocaleDateString('en-GB')}`;
    }
    const labels: Record<string, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '1y': 'Last year' };
    return labels[stats.period] || stats.period;
  };

  // -- Loading --
  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: ds.bg, fontFamily: "'Outfit', sans-serif" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: `${ds.accent} transparent transparent transparent` }} />
          <p className="text-sm" style={{ color: ds.textMuted }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: ds.bg }}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ds.danger }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p style={{ color: ds.textSecondary }}>Error loading statistics</p>
        </div>
      </div>
    );
  }

  const pieData = stats.productsByStatus.map(item => ({
    name: statusLabels.product[item.status] || item.status,
    value: item.count,
    color: statusColors.product[item.status] || '#6B7280',
  }));

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  const timelineData = stats.movementsByDay.map((m) => ({
    data: formatDate(m.data),
    Movimentos: m.count,
    Entradas: stats.productsCreatedByDay.find((p) => p.data === m.data)?.count || 0,
    "Saidas": stats.deliveredByDay.find((d) => d.data === m.data)?.count || 0,
  }));

  // -- Icons reused --
  const iconBox     = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>;
  const iconStorage = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>;
  const iconCheck   = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  const iconActivity= <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>;

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: ds.bg, minHeight: '100vh' }}>

      {/* -- Sticky Header -- */}
      <div
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{ background: `${ds.bg}e8`, borderBottom: `1px solid ${ds.border}` }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold" style={{ color: ds.textPrimary }}>Dashboard</h1>
              <p className="text-xs" style={{ color: ds.textMuted }}>{getPeriodLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200"
              style={{ background: ds.bgCard, border: `1px solid ${ds.border}`, color: ds.textSecondary }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Exportar
            </button>
            <button
              onClick={() => loadStats(currentFilters)}
              disabled={loading}
              className="p-2 rounded-xl transition-all duration-200"
              style={{ background: ds.bgCard, border: `1px solid ${ds.border}` }}
              title="Update"
            >
              <svg className={`w-4 h-4 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ds.accent }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* -- Filters -- */}
        <DashboardFilters
          availableSuppliers={stats.availableSuppliers}
          onFilterChange={handleFilterChange}
          loading={loading}
        />

        {/* -- Metric Cards -- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: iconBox,      label: 'Total Products',  value: stats.totalProducts,       trend: stats.trends.products,    color: ds.accent },
            { icon: iconStorage,  label: 'In Storage',        value: stats.summary.inStorage,   pct: stats.percentages.inStorage, color: ds.purple },
            { icon: iconCheck,    label: 'Delivered',          value: stats.summary.delivered,   trend: stats.trends.deliveries,  color: ds.success },
            { icon: iconActivity, label: 'Movements',      value: stats.recentMovements,     period: true,                    color: ds.orange },
          ].map((m, i) => (
            <Card key={i} className="p-5 group" style={{ cursor: 'default' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                  <span style={{ color: m.color }} className="w-4 h-4 block">{m.icon}</span>
                </div>
                {m.trend && <Trend value={m.trend} />}
                {m.pct && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${m.color}18`, color: m.color }}>
                    {m.pct}%
                  </span>
                )}
                {m.period && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${ds.border}`, color: ds.textMuted }}>
                    period
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold mb-1"
                style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}>
                {m.value.toLocaleString('en-GB')}
              </p>
              <p className="text-xs" style={{ color: ds.textMuted }}>{m.label}</p>
            </Card>
          ))}
        </div>

        {/* -- Quick Actions -- */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ds.textMuted }}>
              Quick actions
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'New Product',  sub: 'Add product',    path: '/products/ new',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/> },
              { label: 'Suppliers',     sub: 'Manage suppliers',     path: '/fornecedores',   icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/> },
              { label: 'Vehicles',     sub: 'Manage fleet',        path: '/veiculos',       icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></> },
              { label: 'Transports',  sub: 'Manage shipments',      path: '/transports',    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/> },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group"
                style={{ background: ds.bg, border: `1px solid ${ds.border}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ds.accent}50`; (e.currentTarget as HTMLElement).style.background = `${ds.accent}08`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ds.border; (e.currentTarget as HTMLElement).style.background = ds.bg; }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${ds.accent}18` }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: ds.accent }}>
                    {a.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: ds.textPrimary }}>{a.label}</p>
                  <p className="text-xs" style={{ color: ds.textMuted }}>{a.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* -- Timeline Chart -- */}
        <Card style={{ padding: '1.5rem' }}>
          <CardHeader
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>}
            title="Actividade ao Longo do Time"
            subtitle="Evolution of movements, inflows and outflows"
          />
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={timelineData}>
              <defs>
                {[
                  { id: 'mv', color: ds.accent },
                  { id: 'en', color: ds.success },
                  { id: 'sa', color: ds.orange },
                ].map(g => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={g.color} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={g.color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ds.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: ds.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: ds.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                formatter={v => <span style={{ color: ds.textSecondary }}>{v}</span>}
              />
              <Area type="monotone" dataKey="Movimentos" stroke={ds.accent}   fill="url(#mv)" strokeWidth={2} />
              <Area type="monotone" dataKey="Entradas"   stroke={ds.success}  fill="url(#en)" strokeWidth={2} />
              <Area type="monotone" dataKey="Outflows"     stroke={ds.orange}   fill="url(#sa)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* -- Pie + Avg Time -- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card style={{ padding: '1.5rem' }}>
            <CardHeader
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>}
              title="Distribution by Status"
              subtitle="Product percentage by status"
            />
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  formatter={(v, e: any) => (
                    <span style={{ color: ds.textSecondary, fontSize: 11 }}>
                      {v} <span style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}>({e.payload.value})</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card style={{ padding: '1.5rem' }}>
            <CardHeader
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              title="Average Time by Status"
              subtitle="Average duration in each phase (hours)"
            />
            {stats.avgTimeInStatus.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm" style={{ color: ds.textMuted }}>No data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.avgTimeInStatus.map(item => {
                  const maxH = Math.max(...stats.avgTimeInStatus.map(a => a.avgHours));
                  const pct  = Math.min((item.avgHours / maxH) * 100, 100);
                  return (
                    <div key={item.status}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium" style={{ color: ds.textSecondary }}>
                          {statusLabels.product[item.status] || item.status}
                        </span>
                        <span className="text-xs font-bold" style={{ fontFamily: "'DM Mono', monospace", color: ds.accent }}>
                          {item.avgHours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: ds.border }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ds.accent}, ${ds.purple})` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* -- Rejection Rate -- */}
        {stats.rejectionRateBySupplier.length > 0 && (
          <Card style={{ padding: '1.5rem' }}>
            <CardHeader
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
              title="Rejection Rate by Supplier"
              subtitle="Suppliers with highest rejection rate"
            />
            <div className="space-y-3">
              {stats.rejectionRateBySupplier.map((s, i) => {
                const rateColor = s.rejectionRate > 10 ? ds.danger : s.rejectionRate > 5 ? ds.warning : ds.success;
                return (
                  <div
                    key={s.supplierId}
                    className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200"
                    style={{ background: ds.bg, border: `1px solid ${ds.border}` }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${rateColor}18`, color: rateColor, fontFamily: "'DM Mono', monospace" }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold truncate" style={{ color: ds.textPrimary }}>{s.supplierName}</p>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3"
                          style={{ background: `${rateColor}18`, color: rateColor, fontFamily: "'DM Mono', monospace" }}
                        >
                          {s.rejectionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs" style={{ color: ds.textMuted }}>{s.totalProducts} products</span>
                        <span style={{ color: ds.border }}>•</span>
                        <span className="text-xs" style={{ color: ds.danger }}>{s.rejectedProducts} rejected</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: ds.border }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(s.rejectionRate, 100)}%`, background: rateColor }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* -- Transport + Vehicles -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card style={{ padding: '1.5rem' }}>
            <CardHeader
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
              title="Transportes"
              subtitle="Shipments overview"
            />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total',      value: stats.transportStats.total,     color: ds.accent },
                { label: 'Ativos',     value: stats.transportStats.active,    color: ds.success },
                { label: 'Completed', value: stats.transportStats.completed, color: ds.textMuted },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: ds.bg, border: `1px solid ${ds.border}` }}>
                  <p className="text-2xl font-bold mb-1" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>
                    {s.value}
                  </p>
                  <p className="text-xs" style={{ color: ds.textMuted }}>{s.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: '1.5rem' }}>
            <CardHeader
              icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>}
              title="Vehicles"
              subtitle="Frota registada"
            />
            <div className="flex items-center justify-center h-[calc(100%-80px)]">
              <div className="text-center">
                <p className="text-6xl font-bold" style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}>
                  {stats.vehicleStats.total}
                </p>
                <p className="text-sm mt-2" style={{ color: ds.textMuted }}>vehicles registered</p>
              </div>
            </div>
          </Card>
        </div>

        {/* -- Top Suppliers -- */}
        <Card style={{ padding: '1.5rem' }}>
          <CardHeader
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
            title="Top 5 Suppliers"
            subtitle="By volume of products supplied"
            action={
              <button onClick={() => navigate('/fornecedores')}
                className="text-xs font-semibold transition-colors"
                style={{ color: ds.accent }}>
                Ver todos ?
              </button>
            }
          />
          <div className="space-y-2">
            {stats.topSuppliers.map((s, i) => {
              const pct = stats.totalProducts > 0 ? (s.productCount / stats.totalProducts) * 100 : 0;
              const rankColors = [ds.warning, ds.textSecondary, '#cd7f32', ds.textMuted, ds.textMuted];
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200"
                  style={{ background: 'transparent', border: `1px solid transparent` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = ds.bg; (e.currentTarget as HTMLElement).style.borderColor = ds.border; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  <span className="text-sm font-bold w-6 text-right flex-shrink-0"
                    style={{ color: rankColors[i] || ds.textMuted, fontFamily: "'DM Mono', monospace" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold truncate" style={{ color: ds.textPrimary }}>{s.name}</p>
                      <span className="text-sm font-bold flex-shrink-0 ml-3"
                        style={{ color: ds.textPrimary, fontFamily: "'DM Mono', monospace" }}>
                        {s.productCount}
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: ds.border }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ds.accent}80, ${ds.accent})` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* -- Summary Bar -- */}
        <div
          className="rounded-2xl p-6"
          style={{ background: ds.bgCard, border: `1px solid ${ds.border}` }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: ds.textMuted }}>
            Period Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Recebidos',      value: stats.summary.received,  pct: stats.percentages.received,  color: ds.accent },
              { label: 'Em Análise',     value: stats.summary.inAnalysis,                                  color: ds.warning },
              { label: 'Armazenados',    value: stats.summary.inStorage, pct: stats.percentages.inStorage, color: ds.purple },
              { label: 'Delivered',      value: stats.summary.delivered, pct: stats.percentages.delivered, color: ds.success },
              { label: 'Rejected',       value: stats.summary.rejected,  pct: stats.percentages.rejected,  color: ds.danger  },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold mb-1" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>
                  {s.value}
                </p>
                <p className="text-xs mb-1" style={{ color: ds.textMuted }}>{s.label}</p>
                {s.pct && (
                  <p className="text-xs font-semibold" style={{ color: s.color }}>{s.pct}%</p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardAdvanced;
