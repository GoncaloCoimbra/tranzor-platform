import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string;
  ordersCount?: number;
  totalSpent?: number;
};

export default function CustomerManagePage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState<string | ''>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit };
      if (search) params.search = search;
      if (role) params.role = role;
      if (isActive !== '') params.isActive = isActive;

      const res = await apiClient.get<{ users: any[]; pagination: any }>(`/admin/users` + (Object.keys(params).length ? '?' : ''));

      // apiClient returns response.data already; but it uses ApiResponse wrapper
      if (!res.success || !res.data) throw new Error(res.error?.message || 'Erro ao obter utilizadores');

      // backend returns { users, pagination }
      setUsers(res.data.users.map(u => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        ordersCount: u.ordersCount ?? 0,
        totalSpent: u.totalSpent ?? 0,
      })));

      const pagination = res.data.pagination ?? { currentPage: page, totalPages: 1, totalUsers: res.data.users.length };
      setPage(pagination.currentPage || page);
      setTotalPages(pagination.totalPages || 1);
      setTotalUsers(pagination.totalUsers || (res.data.users.length || 0));
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const handleSearch = () => { setPage(1); load(); };

  return (
    <AppLayout>
      <Helmet>
        <title>Clientes — Tranzor Admin</title>
        <meta name="description" content="Gestão de clientes da plataforma Tranzor." />
      </Helmet>

      <div className="adm-root">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Clientes</h1>
            <p className="adm-sub">Gestão e histórico de todos os clientes registados.</p>
          </div>
          <div className="adm-hero-stats">
            <div className="adm-stat">
              <span className="adm-stat-v">{loading ? '...' : totalUsers}</span>
              <span className="adm-stat-l">Total</span>
            </div>
          </div>
        </header>

        <div className="adm-body">
          <div className="adm-panel">
            <div className="adm-toolbar">
              <div className="adm-search-wrap">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
                </svg>
                <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Nome ou e-mail..." className="adm-search" aria-label="Pesquisar clientes"/>
                <button className="adm-link-btn" onClick={handleSearch} style={{marginLeft:8}}>Pesquisar</button>
              </div>

              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <select value={role} onChange={e=>setRole(e.target.value)} className="adm-select" aria-label="Filtrar papel">
                  <option value="">Todos os papeis</option>
                  <option value="user">User</option>
                  <option value="b2b">B2B</option>
                  <option value="admin">Admin</option>
                </select>
                <select value={isActive} onChange={e=>setIsActive(e.target.value)} className="adm-select" aria-label="Filtrar ativo">
                  <option value="">Todos</option>
                  <option value="true">Ativos</option>
                  <option value="false">Inativos</option>
                </select>
              </div>
            </div>

            {error && <div className="adm-panel" style={{borderColor:'rgba(217,4,41,0.1)'}}>{error}</div>}

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>{['Cliente','E-mail','Papel','Ativo','Desde','Ações'].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:'2rem'}}>Carregando...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:'2rem'}}>Nenhum cliente encontrado.</td></tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td style={{fontWeight:600}}>{u.name}</td>
                        <td className="adm-td-muted">{u.email}</td>
                        <td className="adm-td-muted">{u.role || '-'}</td>
                        <td>{u.isActive ? <span className="adm-status" style={{background:'rgba(39,174,96,0.08)',color:'#27ae60'}}>Ativo</span> : <span className="adm-status" style={{background:'rgba(136,136,136,0.08)',color:'#888'}}>Inativo</span>}</td>
                        <td className="adm-td-mono">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-PT') : '-'}</td>
                        <td><button className="adm-link-btn">Ver</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
              <div style={{color:'var(--muted)'}}>Página {page} de {totalPages}</div>
              <div style={{display:'flex',gap:8}}>
                <button className="adm-filter-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>Anterior</button>
                <button className="adm-filter-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>Seguinte</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{ADM_CSS}</style>
    </AppLayout>
  );
}

const ADM_CSS = `  .adm-root{--red:#D90429;--r-soft:rgba(217,4,41,0.06);--border:#e8e8e8;--text:#111;--muted:#888;--bg:#fff;--fh:'Manrope',sans-serif;--fb:'Manrope',sans-serif;background:var(--bg);min-height:80vh}
  .adm-hero{padding:5rem 2.5rem 2.5rem;border-bottom:1px solid var(--border);display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;flex-wrap:wrap}
  .adm-tag{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--red);margin-bottom:1rem}
  .adm-title{font-family:var(--fh);font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--text);margin:0 0 .5rem;letter-spacing:-1.5px}
  .adm-sub{font-family:var(--fb);font-size:14px;color:var(--muted);margin:0}
  .adm-body{max-width:1200px;margin:0 auto;padding:2.5rem;display:flex;flex-direction:column;gap:2rem}
  .adm-panel{background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:1.75rem;overflow:hidden}
  .adm-table-wrap{overflow-x:auto}
  .adm-table{width:100%;border-collapse:collapse;font-family:var(--fb);font-size:13.5px}
  .adm-table th{text-align:left;font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:0 12px 12px;border-bottom:1px solid var(--border)}
  .adm-table td{padding:12px;border-bottom:1px solid #f5f5f5;color:var(--text);vertical-align:middle}
  .adm-table tr:last-child td{border-bottom:none}
  .adm-table tr:hover td{background:#fafafa}
  .adm-td-mono{font-family:'Courier New',monospace;font-size:11.5px;color:var(--muted)}
  .adm-td-muted{color:var(--muted);font-size:12.5px}
  .adm-td-num{font-family:var(--fh);font-weight:700}
  .adm-status{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:99px;white-space:nowrap}
  .adm-link-btn{background:none;border:none;color:var(--red);font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;padding:4px 0;transition:opacity .2s}
  .adm-link-btn:hover{opacity:.7}
  .adm-select{font-family:var(--fb);font-size:12px;padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--text);outline:none;cursor:pointer}
  .adm-select:focus{border-color:var(--red)}
  .adm-stat{display:flex;flex-direction:column;align-items:flex-end}
  .adm-stat-v{font-family:var(--fh);font-weight:800;font-size:2rem;color:var(--red);line-height:1;letter-spacing:-1px}
  .adm-stat-l{font-family:var(--fb);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  .adm-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:1.25rem}
  .adm-search-wrap{display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:8px;padding:0 12px;background:#fff;flex:1;min-width:200px}
  .adm-search{border:none;outline:none;font-family:var(--fb);font-size:13px;color:var(--text);padding:9px 0;background:transparent;width:100%}
  .adm-filter-btn{padding:8px 14px;border:1.5px solid var(--border);border-radius:8px;background:none;font-family:var(--fh);font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s}
  .adm-filter-btn:hover{border-color:var(--red);color:var(--red)}
  .adm-filter-btn--on{background:var(--r-soft);border-color:var(--red);color:var(--red)}
  @media(max-width:700px){.adm-body{padding:1.5rem}.adm-hero{padding:4rem 1.5rem 1.5rem}}
`;