import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '../../layouts/AppLayout';

const LOGS = [
  { id: 1,  user: 'admin@Tranzor.pt',    action: 'LOGIN',           resource: 'Autenticação',  ip: '192.168.1.10', date: '2026-05-07 09:14:22', level: 'info' },
  { id: 2,  user: 'admin@Tranzor.pt',    action: 'UPDATE',          resource: 'Produto #4521', ip: '192.168.1.10', date: '2026-05-07 09:22:05', level: 'info' },
  { id: 3,  user: 'joao@Tranzor.pt',     action: 'DELETE',          resource: 'Cupão SAVE10',  ip: '10.0.0.42',    date: '2026-05-07 09:45:17', level: 'warning' },
  { id: 4,  user: 'sistema',           action: 'BACKUP',          resource: 'Base de dados', ip: 'interno',      date: '2026-05-07 10:00:00', level: 'info' },
  { id: 5,  user: 'maria@Tranzor.pt',    action: 'CREATE',          resource: 'Encomenda #891',ip: '172.16.0.5',   date: '2026-05-07 10:13:44', level: 'info' },
  { id: 6,  user: 'desconhecido',      action: 'LOGIN_FAILED',    resource: 'Autenticação',  ip: '45.33.32.156', date: '2026-05-07 10:28:01', level: 'error' },
  { id: 7,  user: 'desconhecido',      action: 'LOGIN_FAILED',    resource: 'Autenticação',  ip: '45.33.32.156', date: '2026-05-07 10:28:09', level: 'error' },
  { id: 8,  user: 'carlos@Tranzor.pt',   action: 'EXPORT',          resource: 'Relatório PDF', ip: '10.0.0.88',    date: '2026-05-07 11:05:33', level: 'info' },
  { id: 9,  user: 'admin@Tranzor.pt',    action: 'PERMISSION_GRANT',resource: 'Utilizador #12',ip: '192.168.1.10', date: '2026-05-07 11:22:19', level: 'warning' },
  { id: 10, user: 'sistema',           action: 'CLEANUP',         resource: 'Sessões antigas',ip: 'interno',     date: '2026-05-07 12:00:00', level: 'info' },
];

const LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  info:    { bg: 'rgba(41,128,185,0.08)',  color: '#2980b9' },
  warning: { bg: 'rgba(230,126,34,0.08)', color: '#e67e22' },
  error:   { bg: 'rgba(217,4,41,0.08)',   color: '#D90429' },
};

const LEVEL_LABEL: Record<string, string> = {
  info: 'Info', warning: 'Aviso', error: 'Erro',
};

export default function AuditAdminPage() {
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');

  const logs = LOGS.filter(l => {
    const matchLevel  = filter === 'all' || l.level === filter;
    const matchSearch = !search || l.user.includes(search) || l.action.includes(search.toUpperCase()) || l.resource.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  return (
    <AppLayout>
      <Helmet>
        <title>Auditoria — Tranzor Admin</title>
        <meta name="description" content="Logs e auditoria das operações do sistema Tranzor." />
      </Helmet>

      <div className="adm-root">
        <header className="adm-hero">
          <div>
            <div className="adm-tag">Administração</div>
            <h1 className="adm-title">Auditoria do sistema</h1>
            <p className="adm-sub">Registo de todas as operações e acessos ao sistema.</p>
          </div>
          <div className="adm-hero-stats">
            {[
              { v: LOGS.length,                        l: 'Total de logs' },
              { v: LOGS.filter(l=>l.level==='error').length,   l: 'Erros' },
              { v: LOGS.filter(l=>l.level==='warning').length, l: 'Avisos' },
            ].map(s => (
              <div key={s.l} className="adm-stat">
                <span className="adm-stat-v">{s.v}</span>
                <span className="adm-stat-l">{s.l}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="adm-body">
          <div className="adm-panel">
            {/* filtros */}
            <div className="adm-toolbar">
              <div className="adm-search-wrap">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
                </svg>
                <input
                  type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar utilizador, ação..." className="adm-search"
                  aria-label="Pesquisar logs"
                />
              </div>
              <div className="adm-filters">
                {['all','info','warning','error'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`adm-filter-btn${filter===f?' adm-filter-btn--on':''}`}>
                    {f==='all'?'Todos':LEVEL_LABEL[f]}
                  </button>
                ))}
              </div>
              <button className="adm-export-btn">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3M8 2v8M5 7l3 3 3-3"/>
                </svg>
                Exportar CSV
              </button>
            </div>

            {/* tabela */}
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>{['Nível','Data / Hora','Utilizador','Ação','Recurso','IP'].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td>
                        <span className="adm-status" style={LEVEL_STYLE[l.level]}>
                          {LEVEL_LABEL[l.level]}
                        </span>
                      </td>
                      <td className="adm-td-mono">{l.date}</td>
                      <td className="adm-td-em">{l.user}</td>
                      <td>
                        <span className="adm-action-pill">{l.action}</span>
                      </td>
                      <td className="adm-td-muted">{l.resource}</td>
                      <td className="adm-td-mono">{l.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <p className="adm-empty">Nenhum log corresponde aos filtros.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{ADM_CSS}{`
        .adm-action-pill{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:.5px;background:#f3f3f3;color:#555;padding:3px 8px;border-radius:4px}
        .adm-td-em{font-family:var(--fb);font-size:13px;color:var(--text);font-weight:500}
        .adm-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:1.25rem}
        .adm-search-wrap{display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:8px;padding:0 12px;background:#fff;flex:1;min-width:200px}
        .adm-search{border:none;outline:none;font-family:var(--fb);font-size:13px;color:var(--text);padding:9px 0;background:transparent;width:100%}
        .adm-filters{display:flex;gap:6px;flex-wrap:wrap}
        .adm-filter-btn{padding:8px 14px;border:1.5px solid var(--border);border-radius:8px;background:none;font-family:var(--fh);font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s}
        .adm-filter-btn:hover{border-color:var(--red);color:var(--red)}
        .adm-filter-btn--on{background:var(--r-soft);border-color:var(--red);color:var(--red)}
        .adm-export-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid var(--border);border-radius:8px;background:none;font-family:var(--fh);font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .15s;white-space:nowrap}
        .adm-export-btn:hover{border-color:var(--red);color:var(--red)}
        .adm-empty{text-align:center;padding:2rem;color:var(--muted);font-family:var(--fb);font-size:13px}
        .adm-hero-stats{display:flex;gap:2rem;align-items:flex-end}
        @media(max-width:600px){.adm-hero-stats{display:none}}
      `}</style>
    </AppLayout>
  );
}

/* CSS partilhado entre páginas admin */
const ADM_CSS = `  .adm-root{--red:#D90429;--r-soft:rgba(217,4,41,0.06);--border:#e8e8e8;--text:#111;--muted:#888;--bg:#fff;--bg2:#f8f8f8;--fh:'Manrope',sans-serif;--fb:'Manrope',sans-serif;background:var(--bg);min-height:80vh}
  .adm-hero{padding:5rem 2.5rem 2.5rem;border-bottom:1px solid var(--border);display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;flex-wrap:wrap}
  .adm-tag{font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--red);margin-bottom:1rem}
  .adm-title{font-family:var(--fh);font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--text);margin:0 0 .5rem;letter-spacing:-1.5px}
  .adm-sub{font-family:var(--fb);font-size:14px;color:var(--muted);margin:0}
  .adm-body{max-width:1200px;margin:0 auto;padding:2.5rem;display:flex;flex-direction:column;gap:2rem}
  .adm-panel{background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:1.75rem;overflow:hidden}
  .adm-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
  .adm-panel-title{font-family:var(--fh);font-weight:800;font-size:1.05rem;color:var(--text);margin:0 0 1.25rem;letter-spacing:-.3px}
  .adm-panel-header .adm-panel-title{margin:0}
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
  @media(max-width:700px){.adm-body{padding:1.5rem}.adm-hero{padding:4rem 1.5rem 1.5rem}}
`;