// ─── ContentManagePage.tsx ───────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

type ContentItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  updated?: string;
  author?: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Publicado: { bg: 'rgba(39,174,96,0.1)',   color: '#27ae60' },
  Rascunho:  { bg: 'rgba(136,136,136,0.1)', color: '#888' },
  Inativo:   { bg: 'rgba(136,136,136,0.1)', color: '#888' },
  Agendado:  { bg: 'rgba(41,128,185,0.1)',  color: '#2980b9' },
};

export default function ContentManagePage() {
  const [filter, setFilter] = useState('');
  const [type,   setType]   = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit };
      if (filter) params.status = filter;
      if (type) params.type = type;

      const qs = new URLSearchParams(params).toString();
      const res = await apiClient.get<any>(`/admin/contents${qs ? `?${qs}` : ''}`);

      setItems((res.data.items || res.data.contents || []).map((c: any) => ({
        id: c._id || c.id,
        title: c.title,
        type: c.type,
        status: c.status,
        updated: c.updatedAt || c.updated || c.modifiedAt,
        author: c.author?.name || c.author || c.updatedBy,
      })));

      const pagination = res.data.pagination || { currentPage: page, totalPages: 1, totalItems: (res.data.items || res.data.contents || []).length };
      setPage(pagination.currentPage || page);
      setTotalPages(pagination.totalPages || 1);
      setTotalItems(pagination.totalItems || (res.data.items||res.data.contents||[]).length || 0);
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido');
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  return (
    <AppLayout>
      <Helmet>
        <title>Conteúdos — Tranzor Admin</title>
        <meta name="description" content="Gestão de conteúdos do site Tranzor." />
      </Helmet>

      <div className="adm-root">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Gestão de conteúdos</h1>
            <p className="adm-sub">Banners, textos e imagens do site Tranzor.</p>
          </div>
          <div className="adm-hero-stats">
            <div className="adm-stat">
              <span className="adm-stat-v">{loading ? '...' : totalItems}</span>
              <span className="adm-stat-l">Total</span>
            </div>
          </div>
        </header>

        <div className="adm-body">
          <div className="adm-panel">
            <div className="adm-panel-header">
              <h2 className="adm-panel-title" style={{margin:0}}>Todos os conteúdos</h2>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <select value={type} onChange={e=>{ setType(e.target.value); setPage(1); }} className="adm-select" aria-label="Filtrar tipo">
                  <option value="">Todos os tipos</option>
                  {['Banner','Texto','Imagem','Pop-up'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <button className="cpn-btn-new">Novo conteúdo</button>
              </div>
            </div>

            <div className="adm-filters" style={{margin:'1rem 0'}}>
              {['','Publicado','Rascunho','Agendado','Inativo'].map(f=>(
                <button key={f||'all'} onClick={()=>{ setFilter(f); setPage(1); }}
                  className={`adm-filter-btn${filter===f?' adm-filter-btn--on':''}`}>
                  {f===''?'Todos':f}
                </button>
              ))}
            </div>

            {error && <div style={{color:'#b00',padding:8,marginBottom:8}}>{error}</div>}

            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>{['Título','Tipo','Estado','Última edição','Autor',''].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:'2rem'}}>Carregando...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:'2rem'}}>Nenhum conteúdo encontrado.</td></tr>
                  ) : (
                    items.map(c=> (
                      <tr key={c.id}>
                        <td style={{fontWeight:500}}>{c.title}</td>
                        <td><span className="cnt-type-pill">{c.type}</span></td>
                        <td><span className="adm-status" style={STATUS_STYLE[c.status]}>{c.status}</span></td>
                        <td className="adm-td-mono">{c.updated ? new Date(c.updated).toLocaleDateString('pt-PT') : '-'}</td>
                        <td className="adm-td-muted">{c.author || '-'}</td>
                        <td style={{display:'flex',gap:8}}>
                          <button className="adm-link-btn">Editar</button>
                          <button className="adm-link-btn" style={{color:'#888'}}>Duplicar</button>
                        </td>
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
  .adm-status{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:99px;white-space:nowrap}
  .adm-link-btn{background:none;border:none;color:var(--red);font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;padding:4px 0;transition:opacity .2s}
  .adm-link-btn:hover{opacity:.7}
  .adm-select{font-family:var(--fb);font-size:12px;padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--text);outline:none;cursor:pointer}
  .adm-select:focus{border-color:var(--red)}
  .adm-stat{display:flex;flex-direction:column;align-items:flex-end}
  .adm-stat-v{font-family:var(--fh);font-weight:800;font-size:2rem;color:var(--red);line-height:1;letter-spacing:-1px}
  .adm-stat-l{font-family:var(--fb);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  .adm-panel-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .adm-panel-title{font-family:var(--fh);font-weight:800;font-size:1.05rem;color:var(--text);letter-spacing:-.3px}
  .adm-filters{display:flex;gap:6px;flex-wrap:wrap}
  .adm-filter-btn{padding:8px 14px;border:1.5px solid var(--border);border-radius:8px;background:none;font-family:var(--fh);font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s}
  .adm-filter-btn:hover{border-color:var(--red);color:var(--red)}
  .adm-filter-btn--on{background:var(--r-soft);border-color:var(--red);color:var(--red)}
  .cnt-type-pill{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:#f3f3f3;color:#666;padding:3px 9px;border-radius:5px}
  .cpn-btn-new{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:background .2s}
  .cpn-btn-new:hover{background:#b8031c}
  .adm-empty{text-align:center;padding:2rem;color:var(--muted);font-family:var(--fb);font-size:13px}
  @media(max-width:700px){.adm-body{padding:1.5rem}.adm-hero{padding:4rem 1.5rem 1.5rem}}
`;