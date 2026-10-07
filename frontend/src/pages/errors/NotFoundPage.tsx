import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';

export default function NotFoundPage() {
  return (
    <AppLayout>
      <div className="err-root">
        {/* fundo decorativo */}
        <div className="err-bg" aria-hidden>
          <div className="err-bg-code">404</div>
          <div className="err-bg-line err-bg-line--1" />
          <div className="err-bg-line err-bg-line--2" />
        </div>

        <div className="err-body">
          <div className="err-tag">
            <span className="err-dot" />
            Erro 404
          </div>

          <div className="err-icon" aria-hidden>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </div>

          <h1 className="err-title">Página não<br/>encontrada</h1>

          <p className="err-desc">
            A página que procura não existe ou foi movida.<br />
            Verifique o endereço ou volte à página inicial.
          </p>

          {/* sugestões rápidas */}
          <div className="err-suggestions">
            <span className="err-suggestions-label">Talvez esteja à procura de</span>
            <div className="err-chips">
              {[
                { label: 'Início',    to: '/' },
                { label: 'Loja',     to: '/shop' },
                { label: 'Contacto', to: '/contact' },
                { label: 'FAQ',      to: '/faq' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="err-chip">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="err-actions">
            <Link to="/" className="err-btn err-btn--primary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M10 13l-5-5 5-5"/>
              </svg>
              Voltar ao início
            </Link>
            <Link to="/shop" className="err-btn err-btn--ghost">
              Ver a loja
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
          --border:    #e4e4e4;
          --bg:        #ffffff;
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
          margin: 0 0 2rem; max-width: 400px;
          animation: fadeIn 0.4s 0.3s both;
        }

        .err-suggestions {
          margin-bottom: 2.5rem;
          animation: fadeIn 0.4s 0.35s both;
        }
        .err-suggestions-label {
          display: block;
          font-family: var(--font-h); font-size: 10px;
          font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
          color: var(--muted); margin-bottom: 10px;
        }
        .err-chips {
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .err-chip {
          padding: 6px 14px;
          border: 1.5px solid var(--border); border-radius: 99px;
          font-family: var(--font-h); font-size: 11px; font-weight: 600;
          color: var(--muted); text-decoration: none;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .err-chip:hover {
          border-color: var(--red); color: var(--red);
          background: var(--red-soft);
        }

        .err-actions {
          display: flex; gap: 12px; flex-wrap: wrap;
          animation: fadeIn 0.4s 0.4s both;
        }

        .err-btn {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-h); font-size: 12px;
          font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          padding: 13px 24px; border-radius: 8px;
          text-decoration: none; cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
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