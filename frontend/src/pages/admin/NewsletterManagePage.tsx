import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';

const CAMPAIGNS = [
  { id: 1, subject: 'Novidades de Maio — Escolar em Destaque', sent: 3420, opened: 1197, clicked: 342, status: 'Enviada',  date: '2026-05-01' },
  { id: 2, subject: 'Flash Sale 48h — Até 25% de desconto',    sent: 3420, opened: 1540, clicked: 612, status: 'Enviada',  date: '2026-04-15' },
  { id: 3, subject: 'Volta às Aulas 2026 — Guia Completo',     sent:    0, opened:    0, clicked:   0, status: 'Rascunho', date: '2026-05-07' },
  { id: 4, subject: 'Bem-vindo à Tranzor — Oferta de Boas-vindas',sent: 210, opened:  182, clicked:  95, status: 'Enviada',  date: '2026-04-01' },
  { id: 5, subject: 'Produtos Novos — Informática e Escritório',sent:    0, opened:    0, clicked:   0, status: 'Agendada', date: '2026-05-10' },
];

const SUBSCRIBERS = [
  { email: 'joao@email.com',   name: 'João Silva',     date: '2025-09-01', active: true  },
  { email: 'maria@email.com',  name: 'Maria Santos',   date: '2025-10-14', active: true  },
  { email: 'carlos@email.com', name: 'Carlos Pereira', date: '2026-01-07', active: false },
  { email: 'ana@email.com',    name: 'Ana Costa',      date: '2024-12-20', active: true  },
  { email: 'rui@email.com',    name: 'Rui Oliveira',   date: '2026-04-30', active: true  },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Enviada:  { bg: 'rgba(39,174,96,0.1)',   color: '#27ae60' },
  Rascunho: { bg: 'rgba(136,136,136,0.1)', color: '#888' },
  Agendada: { bg: 'rgba(41,128,185,0.1)',  color: '#2980b9' },
};

export default function NewsletterManagePage() {
  const [tab, setTab] = useState<'campanhas'|'subscritores'>('campanhas');

  const totalSubs   = SUBSCRIBERS.length;
  const activeSubs  = SUBSCRIBERS.filter(s=>s.active).length;
  const avgOpenRate = Math.round(
    CAMPAIGNS.filter(c=>c.sent>0).reduce((a,c)=>a+(c.opened/c.sent),0) /
    CAMPAIGNS.filter(c=>c.sent>0).length * 100
  );

  return (
    <AppLayout>
      <Helmet>
        <title>Newsletter — Tranzor Admin</title>
        <meta name="description" content="Gestão de newsletter e campanhas de e-mail Tranzor." />
      </Helmet>

      <div className="adm-root">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Newsletter</h1>
            <p className="adm-sub">Gestão de campanhas e subscritores de e-mail.</p>
          </div>
          <div className="adm-hero-stats">
            {[
              { v: totalSubs,          l: 'Subscritores' },
              { v: activeSubs,         l: 'Ativos' },
              { v: `${avgOpenRate}%`,  l: 'Taxa abertura' },
            ].map(s=>(
              <div key={s.l} className="adm-stat">
                <span className="adm-stat-v">{s.v}</span>
                <span className="adm-stat-l">{s.l}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="adm-body">

          {/* tabs */}
          <div className="nl-tabs">
            {(['campanhas','subscritores'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`nl-tab${tab===t?' nl-tab--on':''}`}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'campanhas' && (
            <div className="adm-panel">
              <div className="adm-panel-header">
                <h2 className="adm-panel-title" style={{margin:0}}>Campanhas</h2>
                <button className="cpn-btn-new">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                  </svg>
                  Nova campanha
                </button>
              </div>

              <div className="adm-table-wrap" style={{marginTop:'1.25rem'}}>
                <table className="adm-table">
                  <thead>
                    <tr>{['Assunto','Estado','Data','Enviados','Abertos','Cliques',''].map(h=><th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {CAMPAIGNS.map(c=>(
                      <tr key={c.id}>
                        <td style={{fontWeight:500,maxWidth:280}}>{c.subject}</td>
                        <td><span className="adm-status" style={STATUS_STYLE[c.status]}>{c.status}</span></td>
                        <td className="adm-td-mono">{new Date(c.date).toLocaleDateString('pt-PT')}</td>
                        <td className="adm-td-num">{c.sent>0?c.sent.toLocaleString('pt-PT'):'—'}</td>
                        <td>
                          {c.sent>0
                            ? <span className="nl-rate" style={{color:'#2980b9'}}>{Math.round(c.opened/c.sent*100)}%</span>
                            : <span className="adm-td-muted">—</span>}
                        </td>
                        <td>
                          {c.sent>0
                            ? <span className="nl-rate" style={{color:'#27ae60'}}>{Math.round(c.clicked/c.sent*100)}%</span>
                            : <span className="adm-td-muted">—</span>}
                        </td>
                        <td style={{display:'flex',gap:8}}>
                          <button className="adm-link-btn">{c.status==='Rascunho'?'Editar':'Ver'}</button>
                          {c.status==='Rascunho'&&<button className="adm-link-btn" style={{color:'#27ae60'}}>Enviar</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'subscritores' && (
            <div className="adm-panel">
              <div className="adm-panel-header">
                <h2 className="adm-panel-title" style={{margin:0}}>Subscritores</h2>
                <button className="cpn-btn-new">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3M8 2v8M5 7l3 3 3-3"/>
                  </svg>
                  Exportar CSV
                </button>
              </div>

              <div className="adm-table-wrap" style={{marginTop:'1.25rem'}}>
                <table className="adm-table">
                  <thead>
                    <tr>{['Nome','E-mail','Subscrição','Estado',''].map(h=><th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {SUBSCRIBERS.map(s=>(
                      <tr key={s.email}>
                        <td style={{fontWeight:500}}>{s.name}</td>
                        <td className="adm-td-muted">{s.email}</td>
                        <td className="adm-td-mono">{new Date(s.date).toLocaleDateString('pt-PT')}</td>
                        <td>
                          <span className="adm-status" style={s.active
                            ?{bg:'rgba(39,174,96,0.1)',color:'#27ae60'} as any
                            :{background:'rgba(136,136,136,0.1)',color:'#888'}}>
                            {s.active?'Ativo':'Inativo'}
                          </span>
                        </td>
                        <td>
                          <button className="adm-link-btn" style={{color:'#888'}}>Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{ADM_CSS}{`
        .adm-panel-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
        .adm-panel-title{font-family:var(--fh);font-weight:800;font-size:1.05rem;color:var(--text);letter-spacing:-.3px}
        .nl-tabs{display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:-2px}
        .nl-tab{padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:var(--fh);font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:all .15s}
        .nl-tab:hover{color:var(--text)}
        .nl-tab--on{color:var(--red);border-bottom-color:var(--red)}
        .nl-rate{font-family:var(--fh);font-size:12px;font-weight:700}
        .cpn-btn-new{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:var(--red);color:#fff;border:none;border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:background .2s}
        .cpn-btn-new:hover{background:#b8031c}
        .adm-hero-stats{display:flex;gap:2rem;align-items:flex-end}
        @media(max-width:600px){.adm-hero-stats{display:none}}
      `}</style>
    </AppLayout>
  );
}

const ADM_CSS = `  .adm-root{--red:#D90429;--r-soft:rgba(217,4,41,0.06);--border:#e8e8e8;--text:#111;--muted:#888;--bg:#fff;--fh:'Manrope',sans-serif;--fb:'Manrope',sans-serif;background:var(--bg);min-height:80vh}
  .adm-hero{padding:5rem 2.5rem 2.5rem;border-bottom:1px solid var(--border);display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;flex-wrap:wrap}
  .adm-tag{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--red);margin-bottom:1rem}
  .adm-title{font-family:var(--fh);font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--text);margin:0 0 .5rem;letter-spacing:-1.5px}
  .adm-sub{font-family:var(--fb);font-size:14px;color:var(--muted);margin:0}
  .adm-body{max-width:1200px;margin:0 auto;padding:2.5rem;display:flex;flex-direction:column;gap:1.5rem}
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
  .adm-stat{display:flex;flex-direction:column;align-items:flex-end}
  .adm-stat-v{font-family:var(--fh);font-weight:800;font-size:2rem;color:var(--red);line-height:1;letter-spacing:-1px}
  .adm-stat-l{font-family:var(--fb);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  @media(max-width:700px){.adm-body{padding:1.5rem}.adm-hero{padding:4rem 1.5rem 1.5rem}}
`;