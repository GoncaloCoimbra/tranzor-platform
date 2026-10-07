import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';

export default function ErrorPage() {
  const [copied, setCopied] = useState(false);

  const handleRetry = () => window.location.reload();

  const handleCopy = () => {
    const info = `URL: ${window.location.href}\nData: ${new Date().toISOString()}`;
    navigator.clipboard?.writeText(info).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AppLayout>
      <div className="err-root">
        {/* fundo decorativo */}
        <div className="err-bg" aria-hidden>
          <div className="err-bg-code">500</div>
          <div className="err-bg-line err-bg-line--1" />
          <div className="err-bg-line err-bg-line--2" />
        </div>

        <div className="err-body">
          <div className="err-tag">
            <span className="err-dot" />
            Erro 500
          </div>

          <div className="err-icon" aria-hidden>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          <h1 className="err-title">Algo correu<br/>mal</h1>

          <p className="err-desc">
            Ocorreu um erro inesperado no servidor.<br />
            A nossa equipa foi notificada. Se o problema persistir,
            contacte o suporte Tranzor.
          </p>

          {/* info técnica */}
          <div className="err-tech">
            <div className="err-tech-row">
              <span className="err-tech-key">Referência</span>
              <span className="err-tech-val">{`ERR-${Date.now().toString(36).toUpperCase()}`}</span>
            </div>
            <div className="err-tech-row">
              <span className="err-tech-key">Data e hora</span>
              <span className="err-tech-val">{new Date().toLocaleString('pt-PT')}</span>
            </div>
            <button className="err-copy-btn" onClick={handleCopy} aria-label="Copiar informação de diagnóstico">
              {copied
                ? <><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M3 8l3 3 7-7"/></svg> Copiado</>
                : <><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="4" y="4" width="9" height="9" rx="1"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg> Copiar diagnóstico</>
              }
            </button>
          </div>

          <div className="err-actions">
            <button className="err-btn err-btn--primary" onClick={handleRetry}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M14 4a7 7 0 1 0 .5 4"/>
                <polyline points="14 1 14 5 10 5"/>
              </svg>
              Tentar novamente
            </button>
            <Link to="/" className="err-btn err-btn--ghost">
              Voltar ao início
            </Link>
            <Link to="/contact" className="err-btn err-btn--link">
              Contactar suporte
            </Link>
          </div>
        </div>
      </div>

      <style>{`        .err-root {
          --red:       #D90429;
          --red-soft:  rgba(217,4,41,0.06);
          --red-mid:   rgba(217,4,41,0.14);
          --text:      #111;
          --muted:     #888;
          --muted-l:   #555;
          --border:    #e4e4e4;
          --bg:        #ffffff;
          --bg2:       #f7f7f7;
          --font-h:    'Manrope', sans-serif;
          --font-b:    'Manrope', sans-serif;

          position: relative;
          min-height: 78vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--bg);
          padding: 4rem 2rem 6rem;
        }

        .err-bg {
          position: absolute; inset: 0;
          pointer-events: none; user-select: none;
        }
        .err-bg-code {
          position: absolute;
          right: -2rem; top: 50%;
          transform: translateY(-54%);
          font-family: var(--font-h);
          font-weight: 800;
          font-size: clamp(9rem, 22vw, 18rem);
          letter-spacing: -0.06em;
          color: transparent;
          -webkit-text-stroke: 1.5px var(--border);
          line-height: 1;
          animation: fadeIn 0.6s 0.1s both;
        }
        .err-bg-line {
          position: absolute; left: 0; right: 0;
          height: 1px; background: var(--border);
        }
        .err-bg-line--1 { top: 30%; }
        .err-bg-line--2 { bottom: 28%; }

        .err-body {
          position: relative;
          display: flex; flex-direction: column;
          align-items: flex-start;
          max-width: 560px; width: 100%;
          animation: slideUp 0.5s cubic-bezier(.25,.8,.25,1) both;
        }

        .err-tag {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-h); font-size: 11px;
          font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
          color: var(--red); margin-bottom: 2rem;
          animation: fadeIn 0.4s 0.15s both;
        }
        .err-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--red);
          animation: pulse 2s ease-in-out infinite;
        }

        .err-icon {
          color: var(--red);
          margin-bottom: 1.5rem;
          animation: fadeIn 0.4s 0.2s both;
        }

        .err-title {
          font-family: var(--font-h); font-weight: 800;
          font-size: clamp(2.8rem, 6vw, 4.5rem);
          color: var(--text); line-height: 1.0;
          letter-spacing: -2.5px; margin: 0 0 1.5rem;
          animation: slideUp 0.5s 0.2s cubic-bezier(.25,.8,.25,1) both;
        }

        .err-desc {
          font-family: var(--font-b); font-size: 15px;
          color: var(--muted); line-height: 1.8;
          margin: 0 0 1.75rem; max-width: 420px;
          animation: fadeIn 0.4s 0.3s both;
        }

        /* bloco técnico */
        .err-tech {
          width: 100%; max-width: 420px;
          border: 1.5px solid var(--border); border-radius: 10px;
          background: var(--bg2);
          padding: 14px 16px 12px;
          margin-bottom: 2.5rem;
          animation: fadeIn 0.4s 0.35s both;
        }
        .err-tech-row {
          display: flex; justify-content: space-between;
          align-items: center; gap: 12px;
          padding: 4px 0;
        }
        .err-tech-row + .err-tech-row {
          border-top: 1px solid var(--border);
          margin-top: 4px; padding-top: 8px;
        }
        .err-tech-key {
          font-family: var(--font-h); font-size: 10px;
          font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: var(--muted);
        }
        .err-tech-val {
          font-family: 'Courier New', monospace; font-size: 11px;
          color: var(--muted-l); letter-spacing: 0.5px;
        }
        .err-copy-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 12px; padding: 0;
          background: transparent; border: none; cursor: pointer;
          font-family: var(--font-h); font-size: 10px;
          font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
          color: var(--red); transition: opacity 0.2s;
        }
        .err-copy-btn:hover { opacity: 0.7; }

        .err-actions {
          display: flex; gap: 10px; flex-wrap: wrap;
          animation: fadeIn 0.4s 0.4s both;
        }

        .err-btn {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-h); font-size: 12px;
          font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          padding: 13px 22px; border-radius: 8px;
          text-decoration: none; cursor: pointer; border: none;
          transition: transform 0.15s, box-shadow 0.15s, background 0.2s, color 0.2s;
        }
        .err-btn:hover { transform: translateY(-2px); }

        .err-btn--primary {
          background: var(--red); color: white;
          box-shadow: 0 4px 16px rgba(217,4,41,0.25);
        }
        .err-btn--primary:hover { background: #b8031c; box-shadow: 0 6px 22px rgba(217,4,41,0.35); }

        .err-btn--ghost {
          background: transparent; color: var(--muted);
          border: 1.5px solid var(--border);
        }
        .err-btn--ghost:hover { border-color: var(--red); color: var(--red); }

        .err-btn--link {
          background: transparent; color: var(--muted);
          padding-left: 4px; padding-right: 4px;
          border: none;
        }
        .err-btn--link:hover { color: var(--red); transform: none; text-decoration: underline; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </AppLayout>
  );
}