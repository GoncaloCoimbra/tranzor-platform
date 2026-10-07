import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyOrders: number;
  lowStockCount: number;
}

interface RecentOrder {
  id: string;
  customer: string;
  total: number;
  status: string;
  date: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Processado: { bg: 'rgba(39,174,96,0.1)', color: '#27ae60' },
  Enviado: { bg: 'rgba(41,128,185,0.1)', color: '#2980b9' },
  Pendente: { bg: 'rgba(230,126,34,0.1)', color: '#e67e22' },
  Cancelado: { bg: 'rgba(217,4,41,0.08)', color: '#D90429' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          stats: DashboardStats;
          recentOrders: any[];
          lowStockProducts: any[];
        }>('/admin/dashboard');

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Não foi possível carregar o painel de administração.');
        }

        setStats(response.data.stats);
        setRecentOrders(response.data.recentOrders.map(order => ({
          id: order.orderNumber || order._id || order.id,
          customer: order.user?.name || 'Cliente',
          total: order.total || 0,
          status: order.status || 'Pendente',
          date: order.createdAt || '',
        })));
        setLowStock(response.data.lowStockProducts.map((product: any) => ({
          id: product._id || product.id,
          name: product.name,
          stockQuantity: product.stockQuantity || 0,
          lowStockThreshold: product.lowStockThreshold || 0,
        })));
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar o painel.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const displayedOrders = period === 'today'
    ? recentOrders.filter(order => order.date.startsWith(new Date().toISOString().slice(0, 10)))
    : recentOrders;

  return (
    <AppLayout>
      <Helmet>
        <title>Painel de Administração — Tranzor</title>
        <meta name="description" content="Visão geral das operações administrativas Tranzor." />
      </Helmet>

      <div className="adm-root" data-testid="admin-dashboard">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Painel de controlo</h1>
            <p className="adm-sub">Visão geral das operações Tranzor — {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </header>

        <div className="adm-body">
          <div className="adm-kpis">
            <div className="adm-kpi">
              <div className="adm-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
              </div>
              <div data-testid="total-users" className="adm-kpi-val">{loading ? '...' : stats?.totalUsers ?? '—'}</div>
              <div className="adm-kpi-label">Utilizadores</div>
              <div className="adm-kpi-change adm-kpi-change--up">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                  <path d="M5 2l4 6H1z" />
                </svg>
                +8.2%
              </div>
            </div>

            <div className="adm-kpi">
              <div className="adm-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 6L8 18H16L18 6H6ZM9 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 6L4 3H1" />
                </svg>
              </div>
              <div data-testid="total-orders" className="adm-kpi-val">{loading ? '...' : stats?.totalOrders ?? '—'}</div>
              <div className="adm-kpi-label">Encomendas</div>
              <div className="adm-kpi-change adm-kpi-change--up">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                  <path d="M5 2l4 6H1z" />
                </svg>
                +12.5%
              </div>
            </div>

            <div className="adm-kpi">
              <div className="adm-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div data-testid="total-revenue" className="adm-kpi-val">{loading ? '...' : formatCurrency(stats?.totalRevenue ?? 0)}</div>
              <div className="adm-kpi-label">Receitas</div>
              <div className="adm-kpi-change adm-kpi-change--up">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                  <path d="M5 2l4 6H1z" />
                </svg>
                +15.3%
              </div>
            </div>

            <div className="adm-kpi">
              <div className="adm-kpi-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <div className="adm-kpi-val">{loading ? '...' : stats?.lowStockCount ?? '—'}</div>
              <div className="adm-kpi-label">Produtos com stock baixo</div>
              <div className="adm-kpi-change adm-kpi-change--dn">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                  <path d="M5 8L1 2h8z" />
                </svg>
                -2.1%
              </div>
            </div>
          </div>

          {error && (
            <div className="adm-panel" style={{ borderColor: 'rgba(217,4,41,0.2)' }}>
              <p style={{ color: '#D90429', margin: 0 }}>{error}</p>
            </div>
          )}

          <div className="adm-panel">
            <div className="adm-panel-header">
              <h2 className="adm-panel-title">Encomendas recentes</h2>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="adm-select" aria-label="Período">
                <option value="today">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
              </select>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>{['ID', 'Cliente', 'Total', 'Estado', 'Data', ''].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {displayedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        {loading ? 'Carregando...' : 'Nenhuma encomenda encontrada para este período.'}
                      </td>
                    </tr>
                  ) : (
                    displayedOrders.map(order => (
                      <tr key={order.id}>
                        <td className="adm-td-mono">{order.id}</td>
                        <td>{order.customer}</td>
                        <td className="adm-td-num">{formatCurrency(order.total)}</td>
                        <td>
                          <span className="adm-status" style={STATUS_COLORS[order.status] || { color: '#777', background: 'rgba(117,117,117,0.1)' }}>
                            {order.status}
                          </span>
                        </td>
                        <td className="adm-td-muted">{new Date(order.date).toLocaleDateString('pt-PT')}</td>
                        <td>
                          <button className="adm-link-btn">Ver</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="adm-panel">
              <h2 className="adm-panel-title">Produtos com stock crítico</h2>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr><th>Produto</th><th>Stock</th><th>Limite</th></tr>
                  </thead>
                  <tbody>
                    {lowStock.map(product => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.stockQuantity}</td>
                        <td>{product.lowStockThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`        .adm-root{--red:#D90429;--r-soft:rgba(217,4,41,0.06);--border:#e8e8e8;--text:#111;--muted:#888;--bg:#fff;--bg2:#f8f8f8;--fh:'Manrope',sans-serif;--fb:'Manrope',sans-serif;background:var(--bg);min-height:80vh}
        .adm-hero{padding:5rem 2.5rem 2.5rem;border-bottom:1px solid var(--border);background:#fff}
        .adm-tag{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--red);margin-bottom:1rem}
        .adm-title{font-family:var(--fh);font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--text);margin:0 0 .5rem;letter-spacing:-1.5px}
        .adm-sub{font-family:var(--fb);font-size:14px;color:var(--muted);margin:0}
        .adm-body{max-width:1200px;margin:0 auto;padding:2.5rem;display:flex;flex-direction:column;gap:2rem}
        .adm-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
        .adm-kpi{background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:1.5rem;display:flex;flex-direction:column;gap:6px;transition:box-shadow .2s,transform .2s}
        .adm-kpi:hover{box-shadow:0 6px 24px rgba(0,0,0,.07);transform:translateY(-2px)}
        .adm-kpi-icon{width:36px;height:36px;border-radius:9px;background:var(--r-soft);display:flex;align-items:center;justify-content:center;margin-bottom:4px}
        .adm-kpi-val{font-family:var(--fh);font-weight:800;font-size:1.75rem;color:var(--text);letter-spacing:-1px;line-height:1}
        .adm-kpi-label{font-family:var(--fb);font-size:12px;color:var(--muted)}
        .adm-kpi-change{display:inline-flex;align-items:center;gap:4px;font-family:var(--fh);font-size:11px;font-weight:700;margin-top:4px}
        .adm-kpi-change--up{color:#27ae60}.adm-kpi-change--dn{color:var(--red)}
        .adm-panel{background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:1.75rem;overflow:hidden}
        .adm-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
        .adm-panel-title{font-family:var(--fh);font-weight:800;font-size:1.05rem;color:var(--text);margin:0 0 1.25rem;letter-spacing:-.3px}
        .adm-alerts{display:flex;flex-direction:column;gap:.625rem}
        .adm-alert{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:8px}
        .adm-alert-text{flex:1;font-family:var(--fb);font-size:13.5px;color:var(--text)}
        .adm-badge{font-family:var(--fh);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:99px}
        .adm-select{font-family:var(--fb);font-size:12px;padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--text);outline:none;cursor:pointer}
        .adm-select:focus{border-color:var(--red)}
        .adm-table-wrap{overflow-x:auto}
        .adm-table{width:100%;border-collapse:collapse;font-family:var(--fb);font-size:13.5px}
        .adm-table th{text-align:left;font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:0 12px 12px;border-bottom:1px solid var(--border)}
        .adm-table td{padding:12px;border-bottom:1px solid #f5f5f5;color:var(--text)}
        .adm-table tr:last-child td{border-bottom:none}
        .adm-table tr:hover td{background:#fafafa}
        .adm-td-mono{font-family:'Courier New',monospace;font-size:12px;color:var(--muted)}
        .adm-td-num{font-family:var(--fh);font-weight:700;color:var(--text)}
        .adm-td-muted{color:var(--muted);font-size:12.5px}
        .adm-status{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:99px}
        .adm-link-btn{background:none;border:none;color:var(--red);font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;padding:4px 0;transition:opacity .2s}
        .adm-link-btn:hover{opacity:.7}
        @media(max-width:700px){.adm-body{padding:1.5rem}.adm-hero{padding:4rem 1.5rem 1.5rem}}
      `}</style>
    </AppLayout>
  );
}
