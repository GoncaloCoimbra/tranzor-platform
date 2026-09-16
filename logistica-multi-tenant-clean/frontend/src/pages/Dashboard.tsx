import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Badge, Alert } from '../components/common';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { AxiosError } from 'axios';
import { useDashboardProductStats, useDashboardActivity } from '../hooks/useDashboard';
import { useRealtimeDashboard } from '../hooks/useRealtimeDashboard';
import { useSuppliers } from '../hooks/useSuppliers';
import { statusLabels, statusColors } from '../theme.config';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

// --- Types ------------------------------------------------------------------
interface DashboardStats {
  totalProducts: number;
  productsByStatus: Array<{ status: string; count: number }>;
  recentMovements: number;
  summary: {
    received: number;
    inAnalysis: number;
    inStorage: number;
    delivered: number;
    rejected: number;
  };
  percentages: {
    received: string;
    inStorage: string;
    delivered: string;
    rejected: string;
  };
  topSuppliers: Array<{ id: string; name: string; productCount: number }>;
}

// --- Palette (matches Tasks component) --------------------------------------
const PAL = {
  bg:          'bg-gradient-to-br from-slate-800 to-slate-900',
  bgSolid:     '#0f172a',
  card:        'bg-gradient-to-br from-slate-800 to-slate-900',
  border:      'border-red-500/30',
  borderHov:   'hover:border-red-500/60',
  amber:       '#d90429',
  amberDim:    'rgba(217,4,41,0.12)',
  amberBright: '#ff0a35',
  blue:        '#dc2626',
  emerald:     '#ffffff',
  red:         '#f87171',
  purple:      '#d90429',
  orange:      '#8a0118',
  tPrimary:    '#ffffff',
  tSecondary:  '#b0aaa7',
  tMuted:      '#6b6460',
};

// --- Bar colours keyed by category ------------------------------------------
const BAR_COLORS = [
  { fill: '#dc2626',  glow: 'rgba(59,130,246,0.35)' },
  { fill: '#ff0a35',  glow: 'rgba(255,10,53,0.35)' },
  { fill: '#8a0118',  glow: 'rgba(138,1,24,0.35)' },
  { fill: '#ffffff',  glow: 'rgba(255,255,255,0.25)' },
  { fill: '#f87171',  glow: 'rgba(248,113,113,0.35)' },
];

// --- Gradient defs injected into SVG ----------------------------------------
const BarGradientDefs: React.FC = () => (
  <defs>
    {BAR_COLORS.map((c, i) => (
      <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={c.fill} stopOpacity={1} />
        <stop offset="100%" stopColor={c.fill} stopOpacity={0.45} />
      </linearGradient>
    ))}
  </defs>
);

// --- Custom rounded bar shape ------------------------------------------------
const RoundedBar = (props: any) => {
  const { x, y, width, height, colorIndex } = props;
  if (!height || height <= 0) return null;
  const r = Math.min(6, width / 2);
  const fill = `url(#barGrad${colorIndex ?? 0})`;
  return (
    <g>
      {/* glow shadow */}
      <rect
        x={x + width * 0.15}
        y={y + 4}
        width={width * 0.7}
        height={height}
        rx={r}
        fill={BAR_COLORS[colorIndex ?? 0].glow}
        filter="blur(6px)"
      />
      {/* main bar */}
      <path
        d={`
          M ${x + r} ${y}
          H ${x + width - r}
          Q ${x + width} ${y} ${x + width} ${y + r}
          V ${y + height}
          H ${x}
          V ${y + r}
          Q ${x} ${y} ${x + r} ${y}
          Z
        `}
        fill={fill}
      />
    </g>
  );
};

// --- Custom Tooltip ----------------------------------------------------------
const AmberTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0d1117',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 130,
      }}
    >
      {label && (
        <p style={{ color: PAL.tSecondary, fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
          {label}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <p
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            color: PAL.tSecondary,
            fontSize: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color || entry.fill,
                display: 'inline-block',
              }}
            />
            {entry.name}
          </span>
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontWeight: 700,
              color: PAL.tPrimary,
            }}
          >
            {entry.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// --- Card --------------------------------------------------------------------
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`
      rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900
      border-2 border-amber-500/30 hover:border-amber-500/50
      transition-all hover:shadow-xl hover:shadow-amber-900/10 p-6
      ${className}
    `}
  >
    {children}
  </div>
);

// --- Expand Icon -------------------------------------------------------------
const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
    />
  </svg>
);

// ----------------------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------------------
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [calendarDate, setCalendarDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: stats, isLoading: loading, error, refetch: refetchStats } =
    useDashboardProductStats('30d', calendarDate || undefined, calendarDate || undefined);
  const { data: activity } = useDashboardActivity(10);
  const { data: suppliers }  = useSuppliers();

  useRealtimeDashboard(user?.companyId);

  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [allSuppliers, setAllSuppliers]             = useState<any[]>([]);
  const [expandedChart, setExpandedChart]           = useState<string | null>(null);

  // -- Export --
  const handleExportReport = () => {
    if (!stats) return;
    const csv = [
      ['Performance Report - Tranzor Logística'],
      ['Date', new Date().toLocaleDateString('en-US')],
      [''],
      ['GENERAL SUMMARY'],
      ['Total Products', stats.totalProducts],
      ['Received',       stats.summary.received],
      ['In Analysis',    stats.summary.inAnalysis],
      ['In Storage',     stats.summary.inStorage],
      ['Delivered',      stats.summary.delivered],
      ['Rejected',       stats.summary.rejected],
      [''],
      ['TOP 5 SUPPLIERS'],
      ['Position', 'Name', 'Products', '%'],
      ...stats.topSuppliers.map((s: any, i: number) => {
        const pct =
          stats.totalProducts > 0
            ? ((s.productCount / stats.totalProducts) * 100).toFixed(1)
            : '0';
        return [`#${i + 1}`, s.name, s.productCount, `${pct}%`];
      }),
    ]
      .map(r => r.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const loadAllSuppliers = () => {
    setAllSuppliers(suppliers || []);
    setShowSuppliersModal(true);
  };

  // -- Loading --
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: '#1e293b' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-slate-300 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // -- Error --
  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: '#1e293b' }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-900/30 border-2 border-red-500/50">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2 text-white">Error loading date</h2>
          <p className="text-sm mb-6 text-slate-300">
            {error instanceof AxiosError
              ? error.response?.data?.message || error.message
              : (error as any)?.message || 'Unknown error'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refetchStats()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-700 border border-amber-500/30 text-slate-300 hover:bg-slate-600 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- Chart date --
  const pieData = stats.productsByStatus.map((item: any) => ({
    name:  statusLabels.product[item.status] || item.status,
    value: item.count,
    color: statusColors.product[item.status] || '#6B7280',
  }));

  const barData = [
    { name: 'Received',   value: stats.summary.received,   colorIndex: 0 },
    { name: 'Under Analysis',  value: stats.summary.inAnalysis, colorIndex: 1 },
    { name: 'In Storage',     value: stats.summary.inStorage,  colorIndex: 2 },
    { name: 'Delivered',   value: stats.summary.delivered,  colorIndex: 3 },
    { name: 'Rejected',  value: stats.summary.rejected,   colorIndex: 4 },
  ];

  // -- Metric cards --
  const metricCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts,
      color: '#f59e0b',
      badge: stats.percentages.received !== '0' ? `${stats.percentages.received}% received` : null,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: 'In Storage',
      value: stats.summary.inStorage,
      color: '#a855f7',
      badge: stats.percentages.inStorage !== '0' ? `${stats.percentages.inStorage}% of total` : null,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      label: 'Delivered',
      value: stats.summary.delivered,
      color: '#34d399',
      badge: stats.percentages.delivered !== '0' ? `${stats.percentages.delivered}% do total` : null,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Movements (30d)',
      value: stats.recentMovements,
      color: '#dc2626',
      badge: 'last 30 days',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  const rankColors = ['#f59e0b', '#dc2626', '#34d399', '#a855f7', '#fb923c'];

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh', backgroundColor: '#1e293b', fontFamily: "'Outfit', sans-serif" }}>

      {/* -- Header ----------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-900 to-black border-b-2 border-amber-500/20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('dashboardTitle')}</h1>
            <p className="text-sm text-slate-300 mt-0.5">{t('dashboardSubtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period badge */}
            <div className="flex items-center rounded-xl bg-slate-800 border-2 border-amber-500/20 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setCalendarOpen((open) => !open);
                }}
                className="p-2 text-amber-400 hover:bg-amber-900/20 transition-all"
                title={t('selectDate')}
                aria-label={t('selectDate')}
              >
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              </button>
              <span className="px-3 py-2 text-sm text-slate-300" title={t('last30Days')}>
                {calendarDate || t('last30Days')}
              </span>
            </div>
            {calendarOpen && (
              <div className="absolute mt-14 right-40 z-30 rounded-xl bg-slate-900 border border-amber-500/30 p-4 shadow-2xl">
                <label className="block text-xs text-slate-300 mb-2" htmlFor="dashboard-date">
                  {t('selectDate')}
                </label>
                <input
                  id="dashboard-date"
                  type="date"
                  value={calendarDate}
                  onChange={(event) => {
                    setCalendarDate(event.target.value);
                    setCalendarOpen(false);
                  }}
                  className="rounded-lg bg-slate-800 border border-slate-600 text-white px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCalendarDate('');
                    setCalendarOpen(false);
                    refetchStats();
                  }}
                  className="block mt-3 text-xs text-amber-400 hover:text-amber-300"
                >
                  {t('last30Days')}
                </button>
              </div>
            )}
            {/* Refresh */}
            <button
              onClick={() => {
                setCalendarDate('');
                setCalendarOpen(false);
                refetchStats();
              }}
              title={t('last30Days')}
              aria-label={t('last30Days')}
              className="p-2 rounded-xl bg-slate-800 border-2 border-amber-500/20 hover:border-amber-500/50 transition-all"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Export */}
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg hover:shadow-amber-900/40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('exportReport')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* -- Metric Cards --------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((m, i) => (
            <div
              key={i}
              className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 hover:border-amber-500/60 p-5 transition-all hover:shadow-xl hover:shadow-amber-900/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${m.color}1a`, border: `1px solid ${m.color}40` }}
                >
                  <span className="w-5 h-5 block" style={{ color: m.color }}>{m.icon}</span>
                </div>
                {m.badge && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${m.color}18`, color: m.color }}
                  >
                    {m.badge}
                  </span>
                )}
              </div>
              <p
                className="text-3xl font-bold mb-1 text-white"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {m.value.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-slate-400">{m.label}</p>
            </div>
          ))}
        </div>

        {/* -- Charts --------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* -- Pie Chart -- */}
          <div
            className={`rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 hover:border-amber-500/50 p-6 transition-all hover:shadow-xl hover:shadow-amber-900/10 ${
              expandedChart === 'pie' ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
              <h3 className="font-semibold text-sm text-white">{t('distributionByStatus')}</h3>
              <p className="text-xs mt-0.5 text-slate-400">{t('productsByStatus')}</p>
              </div>
              <button
                onClick={() => setExpandedChart(expandedChart === 'pie' ? null : 'pie')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <ExpandIcon />
              </button>
            </div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={expandedChart === 'pie' ? 480 : 300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={expandedChart === 'pie' ? 110 : 70}
                    outerRadius={expandedChart === 'pie' ? 190 : 105}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<AmberTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    formatter={(v, e: any) => (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {v}{' '}
                        <span style={{ color: '#f0f4ff', fontFamily: "'DM Mono', monospace" }}>
                          ({e.payload.value})
                        </span>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <p className="text-sm">No date to display</p>
              </div>
            )}
          </div>

          {/* -- Bar Chart (beautiful) -- */}
          {expandedChart !== 'pie' && (
            <div
              className={`rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 hover:border-amber-500/50 p-6 transition-all hover:shadow-xl hover:shadow-amber-900/10 ${
                expandedChart === 'bar' ? 'lg:col-span-2' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-sm text-white">Summary by Category</h3>
                  <p className="text-xs mt-0.5 text-slate-400">Count by product status</p>
                </div>
                <button
                  onClick={() => setExpandedChart(expandedChart === 'bar' ? null : 'bar')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ExpandIcon />
                </button>
              </div>

              {/* Value labels above bars */}
              <ResponsiveContainer width="100%" height={expandedChart === 'bar' ? 480 : 300}>
                <BarChart
                  data={barData}
                  barCategoryGap="32%"
                  margin={{ top: 24, right: 8, left: -10, bottom: 0 }}
                >
                  {/* inject gradient defs */}
                  <BarGradientDefs />

                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(245,158,11,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<AmberTooltip />}
                    cursor={{ fill: 'rgba(245,158,11,0.05)', radius: 8 }}
                  />
                  <Bar
                    dataKey="value"
                    name="Products"
                    radius={[8, 8, 0, 0]}
                    shape={(props: any) => (
                      <RoundedBar {...props} colorIndex={props.colorIndex ?? barData.findIndex(d => d.name === props.name)} />
                    )}
                    label={{
                      position: 'top',
                      fill: '#94a3b8',
                      fontSize: 11,
                      fontFamily: 'DM Mono, monospace',
                      formatter: (v: any) => (Number(v) > 0 ? v : ''),
                    }}
                  >
                    {barData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={`url(#barGrad${entry.colorIndex})`}
                        // pass colorIndex via custom shape
                        {...({ colorIndex: entry.colorIndex } as any)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legend pills */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {barData.map((d, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `${BAR_COLORS[d.colorIndex].fill}15`,
                      border: `1px solid ${BAR_COLORS[d.colorIndex].fill}40`,
                      color: BAR_COLORS[d.colorIndex].fill,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: BAR_COLORS[d.colorIndex].fill }}
                    />
                    {d.name}
                    <span
                      className="ml-1"
                      style={{ fontFamily: 'DM Mono, monospace', color: '#f0f4ff' }}
                    >
                      {d.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* -- Top 5 Suppliers ----------------------------------------------- */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-white">Top 5 Suppliers</h3>
              <p className="text-xs mt-0.5 text-slate-400">By volume of supplied products</p>
            </div>
            <button
              onClick={loadAllSuppliers}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              View all ?
            </button>
          </div>

          {stats.topSuppliers.length === 0 ? (
            <div className="text-center py-12 text-amber-500/70">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm text-amber-400 font-bold">No supplier registered</p>
              <button onClick={() => navigate('/fornecedores')} className="text-xs mt-2 text-amber-500 hover:text-amber-400">
                Add supplier ?
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topSuppliers.map((supplier: any, i: number) => {
                const pct =
                  stats.totalProducts > 0
                    ? (supplier.productCount / stats.totalProducts) * 100
                    : 0;
                return (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-amber-900/10 border border-transparent hover:border-amber-500/20 transition-all"
                  >
                    <span
                      className="text-sm font-bold w-5 text-right flex-shrink-0"
                      style={{ color: rankColors[i], fontFamily: "'DM Mono', monospace" }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-white truncate">{supplier.name}</p>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: `${rankColors[i]}18`,
                              color: rankColors[i],
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {pct.toFixed(1)}%
                          </span>
                          <span
                            className="text-sm font-bold text-white"
                            style={{ fontFamily: "'DM Mono', monospace" }}
                          >
                            {supplier.productCount}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${rankColors[i]}80, ${rankColors[i]})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* -- Rejected Alert ------------------------------------------------- */}
        {stats.summary.rejected > 0 && (
          <div className="rounded-2xl p-5 flex items-start gap-4 bg-red-900/10 border-2 border-red-500/30">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-900/30 border border-red-500/40">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-red-400 mb-1">Attention required</p>
              <p className="text-sm text-slate-300">
                There are{' '}
                <strong className="text-red-400">{stats.summary.rejected} rejected product(s)</strong>{' '}
                that require immediate action.
              </p>
            </div>
            <button
              onClick={() => navigate('/products?status=REJECTED')}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-red-900/20 text-red-400 border border-red-500/40 hover:bg-red-900/40"
            >
              View products ?
            </button>
          </div>
        )}

        {/* -- Summary ------------------------------------------------------- */}
        <Card>
          <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-5">
            Period Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Received',   value: stats.summary.received,   pct: stats.percentages.received,  color: '#dc2626' },
              { label: 'Under Analysis',  value: stats.summary.inAnalysis,                                    color: '#f59e0b' },
              { label: 'Stored', value: stats.summary.inStorage,  pct: stats.percentages.inStorage, color: '#a855f7' },
              { label: 'Delivered',   value: stats.summary.delivered,  pct: stats.percentages.delivered, color: '#34d399' },
              { label: 'Rejected',  value: stats.summary.rejected,   pct: stats.percentages.rejected,  color: '#f87171' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p
                  className="text-3xl font-bold mb-1"
                  style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}
                >
                  {s.value}
                </p>
                <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                {s.pct && s.pct !== '0' && (
                  <p className="text-xs font-bold" style={{ color: s.color }}>{s.pct}%</p>
                )}
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* -- Suppliers Modal ---------------------------------------------------- */}
      {showSuppliersModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) setShowSuppliersModal(false); }}
        >
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 max-h-[80vh]">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-5 border-b-2 border-amber-500/20 bg-gradient-to-r from-slate-900 to-black">
              <h2 className="font-bold text-lg text-white">All Suppliers</h2>
              <button
                onClick={() => setShowSuppliersModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* body */}
            <div className="overflow-y-auto p-6 flex-1">
              {allSuppliers.length === 0 ? (
                <p className="text-center py-12 text-sm text-amber-500/70 font-bold">
                  No suppliers found
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allSuppliers.map(s => (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl bg-slate-900 border-2 border-amber-500/20 hover:border-amber-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm text-white">{s.name}</p>
                          <p className="text-xs mt-1 text-slate-400">NIF: {s.nif}</p>
                          {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                          {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                        </div>
                        <button
                          onClick={() => { navigate('/fornecedores'); setShowSuppliersModal(false); }}
                          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex-shrink-0 ml-3"
                        >
                          Ver ?
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="px-6 py-4 border-t-2 border-amber-500/20">
              <button
                onClick={() => { navigate('/fornecedores'); setShowSuppliersModal(false); }}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white shadow-lg"
              >
                Go to Supplier Management
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

