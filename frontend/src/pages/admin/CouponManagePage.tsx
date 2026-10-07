import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min: number;
  uses: number;
  maxUses: number;
  status: string;
  expires?: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Ativo:    { bg: 'rgba(39,174,96,0.1)',   color: '#27ae60' },
  Inativo:  { bg: 'rgba(136,136,136,0.1)', color: '#888' },
  Expirado: { bg: 'rgba(230,126,34,0.1)', color: '#e67e22' },
  Esgotado: { bg: 'rgba(217,4,41,0.08)',  color: '#D90429' },
};

export default function CouponManagePage(){
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [items, setItems] = useState<Coupon[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUses, setTotalUses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try{
      const params: Record<string, any> = { page, limit };
      if (filter) params.status = filter;
      const qs = new URLSearchParams(params).toString();
      const res = await apiClient.get<any>(`/admin/coupons${qs?`?${qs}`:''}`);
      if (!res.success || !res.data) throw new Error(res.error?.message || 'Erro ao obter cupões');

      const coupons = (res.data.items || res.data.coupons || []).map((c: any) => ({
        id: c._id || c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        min: c.min || 0,
        uses: c.uses || 0,
        maxUses: c.maxUses || 0,
        status: c.status,
        expires: c.expires
      }));

      setItems(coupons);
      setTotalUses(coupons.reduce((a:any,c:any)=>a+c.uses,0));
      const pagination = res.data.pagination || { currentPage: page, totalPages: 1 };
      setPage(pagination.currentPage || page);
      setTotalPages(pagination.totalPages || 1);
    }catch(err:any){ setError(err?.message || 'Erro desconhecido'); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  return (
    <AppLayout>
      <Helmet>
        <title>Cupões — Tranzor Admin</title>
        <meta name="description" content="Gestão de cupões de desconto Tranzor." />
      </Helmet>

      <div className="adm-root">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Cupões de desconto</h1>
            <p className="adm-sub">Crie e gira cupões de desconto para os seus clientes.</p>
          </div>
          <div className="adm-hero-stats">
            <div className="adm-stat"><span className="adm-stat-v">{loading?'...':items.filter(i=>i.status==='Ativo').length}</span><span className="adm-stat-l">Ativos</span></div>
            <div className="adm-stat"><span className="adm-stat-v">{loading?'...':totalUses}</span><span className="adm-stat-l">Total de usos</span></div>
            <div className="adm-stat"><span className="adm-stat-v">{loading?'...':items.filter(i=>i.status==='Esgotado').length}</span><span className="adm-stat-l">Esgotados</span></div>
          </div>
        </header>

        <div className="adm-body">
          {showForm && (
            <div className="adm-panel">
              <h2 className="adm-panel-title">Novo cupão</h2>
              <div className="cpn-form-grid">
                {[{id:'code',label:'Código',type:'text'},{id:'value',label:'Valor',type:'number'},{id:'min',label:'Compra mínima',type:'number'},{id:'maxUses',label:'Máx. utilizações',type:'number'},{id:'expires',label:'Expira',type:'date'}].map(f=>(
                  <div key={f.id} className="cpn-field"><label className="cpn-label">{f.label}</label><input className="cpn-input" id={f.id} type={f.type}/></div>
                ))}
                <div className="cpn-field"><label className="cpn-label">Tipo</label><select className="adm-select"><option>Percentagem</option><option>Fixo (€)</option></select></div>
              </div>
              <div className="cpn-form-actions"><button className="cpn-btn-save">Guardar cupão</button><button className="cpn-btn-cancel" onClick={()=>setShowForm(false)}>Cancelar</button></div>
            </div>
          )}

          <div className="adm-panel">
            <div className="adm-panel-header">
              <h2 className="adm-panel-title" style={{margin:0}}>Todos os cupões</h2>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <div className="adm-filters">
                  {['','Ativo','Inativo','Expirado','Esgotado'].map(f=>(
                    <button key={f||'all'} onClick={()=>{ setFilter(f); setPage(1); }} className={`adm-filter-btn${filter===f?' adm-filter-btn--on':''}`}>{f===''?'Todos':f}</button>
                  ))}
                </div>
                <button className="cpn-btn-new" onClick={()=>setShowForm(v=>!v)}>Novo cupão</button>
              </div>
            </div>

            <div className="adm-table-wrap" style={{marginTop:'1.25rem'}}>
              <table className="adm-table">
                <thead>
                  <tr>{['Código','Tipo','Desconto','Mín. compra','Usos','Estado','Expira',''].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading? (
                    <tr><td colSpan={8} style={{textAlign:'center',padding:20}}>Carregando...</td></tr>
                  ) : items.length===0 ? (
                    <tr><td colSpan={8} style={{textAlign:'center',padding:20}}>Nenhum cupão encontrado.</td></tr>
                  ) : (
                    items.map(c=>{
                      const pct = c.maxUses?Math.round((c.uses/c.maxUses)*100):0;
                      return (
                        <tr key={c.id}>
                          <td><span className="cpn-code">{c.code}</span></td>
                          <td className="adm-td-muted">{c.type}</td>
                          <td className="adm-td-num">{c.type==='Percentagem'?`${c.value}%`:`€${c.value}`}</td>
                          <td className="adm-td-muted">{c.min>0?`€${c.min}`:'-'}</td>
                          <td>
                            <div className="cpn-uses"><span className="cpn-uses-txt">{c.uses}/{c.maxUses}</span><div className="cpn-bar-bg"><div className="cpn-bar-fill" style={{width:`${Math.min(pct,100)}%`,background:pct>=100?'#D90429':pct>60?'#e67e22':'#27ae60'}}/></div></div>
                          </td>
                          <td><span className="adm-status" style={STATUS_STYLE[c.status]}>{c.status}</span></td>
                          <td className="adm-td-mono">{c.expires?new Date(c.expires).toLocaleDateString('pt-PT'):'-'}</td>
                          <td style={{display:'flex',gap:8}}><button className="adm-link-btn">Editar</button><button className="adm-link-btn" style={{color:'#888'}}>Pausar</button></td>
                        </tr>
                      );
                    })
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
  .adm-panel-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .adm-panel-title{font-family:var(--fh);font-weight:800;font-size:1.05rem;color:var(--text);margin:0 0 1.25rem;letter-spacing:-.3px}
  .adm-filters{display:flex;gap:6px;flex-wrap:wrap}
  .adm-filter-btn{padding:8px 14px;border:1.5px solid var(--border);border-radius:8px;background:none;font-family:var(--fh);font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s}
  .adm-filter-btn:hover{border-color:var(--red);color:var(--red)}
  .adm-filter-btn--on{background:var(--r-soft);border-color:var(--red);color:var(--red)}
  .cpn-code{font-family:'Courier New',monospace;font-size:12px;font-weight:700;background:#f3f3f3;padding:3px 8px;border-radius:5px;letter-spacing:1px;color:var(--text)}
  .cpn-uses{display:flex;flex-direction:column;gap:3px;min-width:90px}
  .cpn-uses-txt{font-family:var(--fb);font-size:11.5px;color:var(--muted)}
  .cpn-bar-bg{height:4px;background:#f0f0f0;border-radius:99px;overflow:hidden}
  .cpn-bar-fill{height:100%;border-radius:99px;transition:width .3s}
  .cpn-btn-new{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:background .2s}
  .cpn-btn-new:hover{background:#b8031c}
  .cpn-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:1.25rem}
  .cpn-field{display:flex;flex-direction:column;gap:5px}
  .cpn-label{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}
  .cpn-input{padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--fb);font-size:13px;color:var(--text);outline:none;background:#fff;transition:border-color .2s}
  .cpn-input:focus{border-color:var(--red)}
  .cpn-form-actions{display:flex;gap:10px}
  .cpn-btn-save{padding:11px 24px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:background .2s}
  .cpn-btn-save:hover{background:#b8031c}
  .cpn-btn-cancel{padding:11px 20px;background:none;color:var(--muted);border:1.5px solid var(--border);border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:all .2s}
  .cpn-btn-cancel:hover{border-color:var(--red);color:var(--red)}
  .adm-hero-stats{display:flex;gap:2rem;align-items:flex-end}
  @media(max-width:600px){.adm-hero-stats{display:none}}
`;