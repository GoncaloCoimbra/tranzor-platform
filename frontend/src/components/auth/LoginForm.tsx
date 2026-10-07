import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';

/* ─────────────────────────────────────────
   ÍCONES
   ───────────────────────────────────────── */
function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

/* ─────────────────────────────────────────
   PROPS
   ───────────────────────────────────────── */
interface LoginFormProps {
  /** Callback chamado após login com sucesso (opcional — por defeito navega para '/') */
  onSuccess?: () => void;
  /** Mostrar o link "Esqueceu a password?" */
  showForgot?: boolean;
  /** Mostrar links para registo */
  showRegister?: boolean;
  /** Modo compacto (ex: dentro de modal) */
  compact?: boolean;
}

/* ─────────────────────────────────────────
   COMPONENTE
   ───────────────────────────────────────── */
export default function LoginForm({
  onSuccess,
  showForgot = true,
  showRegister = true,
  compact = false,
}: LoginFormProps) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const login    = useAuthStore(state => state.login);

  const fallbackDestination = '/account/profile';
  const fromState = location.state as { from?: string | { pathname?: string; search?: string } } | null;
  const from = typeof fromState?.from === 'string'
    ? fromState.from
    : fromState?.from
      ? `${fromState.from.pathname ?? ''}${fromState.from.search ?? ''}`
      : fallbackDestination;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || t('auth.invalidLogin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={`auth-form${compact ? ' auth-form--compact' : ''}`} noValidate>

        {/* Email */}
        <div className="auth-field">
          <label htmlFor="lf-email" className="auth-label">{t('auth.email')}</label>
          <div className="auth-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="auth-input-icon" aria-hidden>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              id="lf-email"
              name="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              disabled={loading}
              autoComplete="email"
              className={`auth-input${error ? ' auth-input--error' : ''}`}
              aria-describedby={error ? 'lf-error' : undefined}
            />
          </div>
        </div>

        {/* Password */}
        <div className="auth-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <label htmlFor="lf-password" className="auth-label" style={{ margin: 0 }}>{t('auth.password')}</label>
            {showForgot && (
              <Link to="/auth/forgot" className="auth-forgot-link" tabIndex={loading ? -1 : 0}>{t('auth.forgotLink')}</Link>
            )}
          </div>
          <div className="auth-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="auth-input-icon" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="lf-password"
              name="password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
              className={`auth-input auth-input--pass${error ? ' auth-input--error' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="auth-eye-btn"
              aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
              tabIndex={-1}
            >
              <IconEye open={showPass} />
            </button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div id="lf-error" className="auth-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Botão */}
        <button type="submit" className="auth-btn-primary" disabled={loading || !email.trim() || !password.trim()}>
          {loading ? (
            <span className="auth-spinner" aria-hidden />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
          )}
          {loading ? t('auth.signInLoading') : t('auth.signInButton')}
        </button>
      </form>

      {/* Links */}
      {showRegister && (
        <p className="auth-switch">
          {t('auth.noAccount')}{' '}
          <Link to="/auth/register" className="auth-switch-link">{t('auth.createFreeAccount')}</Link>
        </p>
      )}

      <AuthStyles />
    </>
  );
}

/* ─────────────────────────────────────────
   ESTILOS PARTILHADOS (injectados uma vez)
   ───────────────────────────────────────── */
export function AuthStyles() {
  return (
    <style>{`
      /* ── Layout do formulário ── */
      .auth-form { display:flex; flex-direction:column; gap:20px; }
      .auth-form--compact { gap:14px; }

      /* ── Campo ── */
      .auth-field { display:flex; flex-direction:column; gap:8px; }
      .auth-label {
        font-family: var(--font-display);
        font-weight: 700; font-size: 12px; letter-spacing: 0.5px;
        text-transform: uppercase; color: var(--text);
        margin-bottom: 0;
      }

      /* ── Input wrapper ── */
      .auth-input-wrap {
        position: relative; display: flex; align-items: center;
      }
      .auth-input-icon {
        position: absolute; left: 14px; color: var(--muted);
        pointer-events: none; flex-shrink: 0; z-index: 1;
        transition: color 0.2s;
      }
      .auth-input-wrap:focus-within .auth-input-icon { color: var(--red); }

      .auth-input {
        width: 100%; padding: 13px 14px 13px 42px;
        background: var(--charcoal-2);
        border: 1.5px solid var(--border);
        border-radius: 10px; outline: none;
        color: var(--text);
        font-family: var(--font-body); font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        box-sizing: border-box;
      }
      .auth-input::placeholder { color: var(--muted); }
      .auth-input:focus {
        border-color: var(--red);
        background: var(--charcoal-3);
        box-shadow: 0 0 0 3px rgba(217,4,41,0.1);
      }
      .auth-input--error { border-color: rgba(217,4,41,0.6) !important; }
      .auth-input--error:focus { box-shadow: 0 0 0 3px rgba(217,4,41,0.15) !important; }
      .auth-input--pass { padding-right: 44px; }

      /* ── Olho da password ── */
      .auth-eye-btn {
        position: absolute; right: 12px;
        background: none; border: none; cursor: pointer;
        color: var(--muted); display: flex; align-items: center;
        padding: 4px; border-radius: 4px;
        transition: color 0.2s;
      }
      .auth-eye-btn:hover { color: var(--text); }

      /* ── Link esqueceu ── */
      .auth-forgot-link {
        font-family: var(--font-display); font-size: 11px;
        font-weight: 600; color: var(--red);
        text-decoration: none; letter-spacing: 0.3px;
        transition: opacity 0.2s;
      }
      .auth-forgot-link:hover { opacity: 0.75; }

      /* ── Erro ── */
      .auth-error {
        display: flex; align-items: center; gap: 8px;
        background: rgba(217,4,41,0.08);
        border: 1px solid rgba(217,4,41,0.25);
        border-radius: 8px; padding: 10px 14px;
        font-family: var(--font-display); font-size: 13px;
        font-weight: 600; color: var(--red);
        animation: errIn 0.25s ease;
      }
      @keyframes errIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }

      /* ── Botão primário ── */
      .auth-btn-primary {
        width: 100%; padding: 14px 20px;
        background: var(--red); color: white;
        border: none; border-radius: 10px; cursor: pointer;
        font-family: var(--font-display); font-weight: 700;
        font-size: 13px; letter-spacing: 0.02em; text-transform: uppercase;
        display: flex; align-items: center; justify-content: center; gap: 10px;
        transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 4px 20px rgba(217,4,41,0.25);
      }
      .auth-btn-primary:hover:not(:disabled) {
        background: #b8031c; transform: translateY(-1px);
        box-shadow: 0 8px 28px rgba(217,4,41,0.3);
      }
      .auth-btn-primary:disabled {
        opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
      }

      /* ── Botão secundário (outline) ── */
      .auth-btn-secondary {
        width: 100%; padding: 13px 20px;
        background: transparent; color: var(--text);
        border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer;
        font-family: var(--font-display); font-weight: 600;
        font-size: 13px; letter-spacing: 0.5px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: border-color 0.2s, color 0.2s, background 0.2s;
        text-decoration: none;
      }
      .auth-btn-secondary:hover {
        border-color: rgba(217,4,41,0.35); color: var(--red);
        background: rgba(217,4,41,0.04);
      }

      /* ── Spinner ── */
      .auth-spinner {
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        animation: spin 0.7s linear infinite; display: inline-block;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Divisor ── */
      .auth-divider {
        display: flex; align-items: center; gap: 12px; color: var(--muted);
        font-family: var(--font-display); font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.02em;
      }
      .auth-divider::before, .auth-divider::after {
        content: ''; flex: 1; height: 1px; background: var(--border);
      }

      /* ── Mensagem de troca ── */
      .auth-switch {
        text-align: center; margin: 0;
        font-family: var(--font-display); font-size: 13px;
        color: var(--muted);
      }
      .auth-switch-link {
        color: var(--red); font-weight: 700; text-decoration: none;
        transition: opacity 0.2s;
      }
      .auth-switch-link:hover { opacity: 0.75; }

      /* ── Força da password ── */
      .auth-strength { display: flex; flex-direction: column; gap: 6px; }
      .auth-strength-bar {
        display: flex; gap: 4px; height: 3px;
      }
      .auth-strength-seg {
        flex: 1; border-radius: 99px;
        background: var(--border);
        transition: background 0.3s;
      }
      .auth-strength-seg--active.s1 { background: #e74c3c; }
      .auth-strength-seg--active.s2 { background: #e67e22; }
      .auth-strength-seg--active.s3 { background: #f1c40f; }
      .auth-strength-seg--active.s4 { background: #2ecc71; }
      .auth-strength-label {
        font-family: var(--font-display); font-size: 11px;
        color: var(--muted); letter-spacing: 0.3px;
      }

      /* ── Checklist password ── */
      .auth-check-list {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 5px;
      }
      .auth-check-item {
        display: flex; align-items: center; gap: 8px;
        font-family: var(--font-display); font-size: 12px; color: var(--muted);
        transition: color 0.2s;
      }
      .auth-check-item--ok { color: #2ecc71; }
      .auth-check-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--muted); flex-shrink: 0;
        transition: background 0.2s;
      }
      .auth-check-item--ok .auth-check-dot { background: #2ecc71; }

      /* ── Sucesso ── */
      .auth-success-box {
        text-align: center; padding: 2rem 0;
        display: flex; flex-direction: column; align-items: center; gap: 20px;
      }
      .auth-success-ring {
        width: 72px; height: 72px; border-radius: 50%;
        background: rgba(46,204,113,0.12);
        border: 2px solid rgba(46,204,113,0.3);
        display: flex; align-items: center; justify-content: center;
        animation: popIn 0.5s cubic-bezier(.22,1,.36,1);
      }
      @keyframes popIn { from { transform:scale(0.5); opacity:0; } to { transform:scale(1); opacity:1; } }
      .auth-success-title {
        font-family: var(--font-display); font-weight: 800;
        font-size: 1.4rem; color: var(--text); margin: 0;
      }
      .auth-success-text {
        font-family: var(--font-display); font-size: 14px;
        color: var(--muted-light); line-height: 1.7; margin: 0; max-width: 340px;
      }
    `}</style>
  );
}