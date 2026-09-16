import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { debugApi, debugLogin } from '../utils/apiDebug';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme } from '../theme.config';

// ─── Font Injection ────────────────────────────────────────────────────────────
const injectFonts = () => {
  if (document.getElementById('ls-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ls-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const ds = {
  bg:       '#07090f',
  bgCard:   '#0d1117',
  bgInput:  '#0a0e17',
  border:   '#1a2234',
  borderFocus: '#d90429',
  accent:   '#d90429',
  accentHover: '#b90924',
  textPrimary:   '#f0f4ff',
  textSecondary: '#e5e7eb',
  textMuted:     '#94a3b8',
  success: '#34d399',
  danger:  '#f87171',
};

const inputClass = `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
  bg-[#0a0e17] border border-[#1a2234] text-[#f0f4ff] placeholder-[#94a3b8]
  focus:border-[#d90429] focus:ring-2 focus:ring-[#d90429]/10`;

const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const { login, demoLogin, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { injectFonts(); }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'SUPER_ADMIN') navigate('/superadmin-home', { replace: true });
      else navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err?.message || err?.toString?.() || 'Unknown error while logging in';
      setError(typeof msg === 'string' ? msg : 'Internal error. Please try again.');
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);
    try {
      await demoLogin();
    } catch (err: any) {
      const msg = err?.message || err?.toString?.() || 'Failed to start demo';
      setError(typeof msg === 'string' ? msg : 'Internal error. Please try again.');
      setDemoLoading(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: ds.bg }}
      className={`${theme.backgrounds.page} min-h-screen flex`}
    >
      {/* ── Left Panel – Branding ── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-14"
        style={{ background: '#080c14' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              `linear-gradient(${ds.border} 1px, transparent 1px),
               linear-gradient(90deg, ${ds.border} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            opacity: 0.35,
          }}
        />
        {/* Glow orb */}
        <div
          className="absolute top-[-120px] left-[-120px] w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(217,4,41,0.16) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(217,4,41,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Brand mark */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border" style={{ borderColor: `${ds.accent}30`, color: ds.accent, background: `${ds.accent}12` }}>
            <span className="text-sm font-semibold tracking-[0.3em] uppercase">Logística</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-6 px-3 py-1.5 rounded-full"
            style={{ background: `${ds.accent}15`, color: ds.accent, border: `1px solid ${ds.accent}30` }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            System Online
          </div>
          <h1
            className="font-bold leading-[1.1] mb-6"
            style={{ fontSize: '3.2rem', color: ds.textPrimary }}
          >
            Logistics<br />
            <span style={{ color: ds.accent }}>precise</span> and<br />
            intelligent.
          </h1>
          <p style={{ color: ds.textSecondary }} className="text-lg leading-relaxed max-w-sm">
            Complete control over transports, suppliers and inventory in a unified platform.
          </p>
        </div>

        <div className="relative z-10 text-xs" style={{ color: ds.textMuted }}>
          © {new Date().getFullYear()} Tranzor Logistics · All rights reserved
        </div>
      </div>

      {/* ── Right Panel – Form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">

          {/* Mobile brand mark */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border" style={{ borderColor: `${ds.accent}30`, color: ds.accent, background: `${ds.accent}12` }}>
              <span className="text-sm font-semibold tracking-[0.3em] uppercase">Logística</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: ds.textPrimary }}>
              Welcome
            </h2>
            <p style={{ color: ds.textSecondary }} className="text-sm">
              Enter your credentials to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-6 p-4 rounded-xl flex items-start gap-3"
              style={{ background: '#2d111180', border: `1px solid ${ds.danger}30` }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"
                style={{ color: ds.danger }}>
                <path fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"/>
              </svg>
              <p className="text-sm" style={{ color: ds.danger }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: ds.textSecondary }}>
                Email
              </label>
              <Input type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: ds.textSecondary }}>
                Password
              </label>
              <Input type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98] mt-2 text-sm"
              style={{
                background: loading ? `${ds.accent}80` : ds.accent,
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo Button */}
          <button
            type="button"
            disabled={demoLoading}
            onClick={handleDemoLogin}
            className="w-full font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98] mt-3 text-sm"
            style={{
              background: demoLoading ? `${ds.success}80` : ds.success,
              color: 'white',
              cursor: demoLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {demoLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading Demo...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Try Demo
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: ds.border }} />
            <span className="text-xs" style={{ color: ds.textMuted }}>or</span>
            <div className="flex-1 h-px" style={{ background: ds.border }} />
          </div>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="w-full font-medium py-3 rounded-xl transition-all duration-200 text-sm"
            style={{
              background: 'transparent',
              border: `1px solid ${ds.border}`,
              color: ds.textSecondary,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${ds.accent}50`;
              (e.currentTarget as HTMLButtonElement).style.color = ds.textPrimary;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = ds.border;
              (e.currentTarget as HTMLButtonElement).style.color = ds.textSecondary;
            }}
          >
            Create New Account
          </button>

          {/* Dev credentials – collapsible */}
          <details className="mt-8">
            <summary
              className="text-xs cursor-pointer text-center select-none transition-colors"
              style={{ color: ds.textMuted }}
            >
              Test Credentials
            </summary>
            <div className="mt-3 space-y-2">
              {[
                'superadmin@sistema.com / superadmin123',
                'admin@logistica.com / admin123',
                'operator@logistica.com / operator123',
              ].map(cred => (
                <p
                  key={cred}
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: ds.textMuted,
                    background: ds.bgCard,
                    border: `1px solid ${ds.border}`,
                  }}
                >
                  {cred}
                </p>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default Login;
