import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
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

// ─── Design Tokens (same as Login) ────────────────────────────────────────────
const ds = {
  bg:       '#07090f',
  bgCard:   '#0d1117',
  bgInput:  '#0a0e17',
  border:   '#1a2234',
  accent:   '#d90429',
  textPrimary:   '#f0f4ff',
  textSecondary: '#e5e7eb',
  textMuted:     '#94a3b8',
  success: '#34d399',
  danger:  '#f87171',
  warning: '#f59e0b',
};

const inputClass = `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
  bg-[#0a0e17] border border-[#1a2234] text-[#f0f4ff] placeholder-[#94a3b8]
  focus:border-[#d90429] focus:ring-2 focus:ring-[#d90429]/10`;

const labelClass = `block text-xs font-semibold uppercase tracking-wider mb-2`;

interface Company {
  id: string;
  name: string;
  nif: string;
  email: string;
}

const Register: React.FC = () => {
  const [activeTab, setActiveTab]           = useState<'company' | 'operator'>('company');
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [companies, setCompanies]           = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [companyData, setCompanyData] = useState({
    companyName: '', nif: '', companyEmail: '', phone: '', address: '',
    adminName: '', adminEmail: '', password: '', confirmPassword: '',
  });

  const [operatorData, setOperatorData] = useState({
    selectedCompany: '', operatorName: '', operatorEmail: '', password: '', confirmPassword: '',
  });

  useEffect(() => { injectFonts(); }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const response = await api.get('/companies/public');
      setCompanies(response.data || []);
    } catch {
      setError('Error loading company list');
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'operator' && companies.length === 0) loadCompanies();
  }, [activeTab, companies.length, loadCompanies]);

  const validateCompanyForm = (): string | null => {
    if (!companyData.companyName.trim()) return 'Company name is required';
    if (!companyData.nif.trim()) return 'Tax ID is required';
    if (!/^\d{9}$/.test(companyData.nif)) return 'Tax ID must have 9 digits';
    if (!companyData.companyEmail.trim()) return 'Company email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.companyEmail)) return 'Invalid company email';
    if (!companyData.adminName.trim()) return 'Administrator name is required';
    if (!companyData.adminEmail.trim()) return 'Personal email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.adminEmail)) return 'Invalid personal email';
    if (!companyData.password) return 'Password is required';
    if (companyData.password.length < 6) return 'Password must be at least 6 characters';
    if (companyData.password !== companyData.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateOperatorForm = (): string | null => {
    if (!operatorData.selectedCompany) return 'Select a company';
    if (!operatorData.operatorName.trim()) return 'Name is required';
    if (!operatorData.operatorEmail.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operatorData.operatorEmail)) return 'Invalid email';
    if (!operatorData.password) return 'Password is required';
    if (operatorData.password.length < 6) return 'Password must be at least 6 characters';
    if (operatorData.password !== operatorData.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ve = validateCompanyForm();
    if (ve) { setError(ve); return; }
    setLoading(true);
    try {
      await register({ name: companyData.adminName, email: companyData.adminEmail, password: companyData.password, role: 'ADMIN' });
    } catch (err: any) {
      setError(err?.message || 'Error creating account');
      setLoading(false);
    }
  };

  const handleOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ve = validateOperatorForm();
    if (ve) { setError(ve); return; }
    setLoading(true);
    try {
      await register({ name: operatorData.operatorName, email: operatorData.operatorEmail, password: operatorData.password, role: 'OPERATOR', companyId: operatorData.selectedCompany });
    } catch (err: any) {
      setError(err?.message || 'Error creating account');
      setLoading(false);
    }
  };

  // ── Section header helper ──
  const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${ds.accent}18`, border: `1px solid ${ds.accent}30` }}>
        <span style={{ color: ds.accent }} className="w-4 h-4">{icon}</span>
      </div>
      <h3 className="text-sm font-semibold" style={{ color: ds.textPrimary }}>{title}</h3>
      <div className="flex-1 h-px" style={{ background: ds.border }} />
    </div>
  );

  // ── Info box ──
  const InfoBox = ({ items }: { items: string[] }) => (
    <div className="rounded-xl p-4" style={{ background: `${ds.accent}08`, border: `1px solid ${ds.accent}20` }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ds.accent }}>
        After registration
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: ds.textSecondary }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: ds.success }}>
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: ds.bg }}
      className={`${theme.backgrounds.page} min-h-screen flex items-center justify-center py-12 px-4`}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${ds.border} 1px, transparent 1px), linear-gradient(90deg, ${ds.border} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: 0.2,
        }}
      />
      {/* Glow */}
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(217,4,41,0.08) 0%, transparent 70%)' }} />

      <div
        className={`${theme.cards.form} relative z-10 w-full max-w-xl rounded-2xl p-8`}
        style={{ background: ds.bgCard, border: `1px solid ${ds.border}` }}
      >
        {/* Header */}
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border" style={{ borderColor: `${ds.border}`, color: ds.accent, background: `${ds.accent}12` }}>
            <span className="text-sm font-semibold tracking-[0.3em] uppercase">Logística</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold mt-6 mb-1" style={{ color: ds.textPrimary }}>
          Create New Account
        </h2>
        <p className="text-sm mb-8" style={{ color: ds.textSecondary }}>
          Choose the account type and fill in the date
        </p>

        {/* ── Tabs ── */}
        <div className="flex rounded-xl p-1 mb-8 gap-1" style={{ background: ds.bg, border: `1px solid ${ds.border}` }}>
          {(['company', 'operator'] as const).map(tab => {
            const active = activeTab === tab;
            const label = tab === 'company' ? 'Company / Admin' : 'User / Operator';
            const icon = tab === 'company'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: active ? ds.bgCard : 'transparent',
                  color: active ? ds.textPrimary : ds.textMuted,
                  border: active ? `1px solid ${ds.border}` : '1px solid transparent',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3"
            style={{ background: '#2d111180', border: `1px solid ${ds.danger}30` }}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: ds.danger }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <p className="text-sm" style={{ color: ds.danger }}>{error}</p>
          </div>
        )}

        {/* ════════════════════════════════════════
            COMPANY FORM
        ════════════════════════════════════════ */}
        {activeTab === 'company' && (
          <form onSubmit={handleCompanySubmit} className="space-y-7">
            {/* Company date */}
            <div>
              <SectionHeader
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
                title="Company Date"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Company Name <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="text"  value={companyData.companyName}
                    onChange={e => setCompanyData({ ...companyData, companyName: e.target.value })}
                    className={inputClass} placeholder="E.g.: LogiTransport Ltd" disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Tax ID <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="text"  value={companyData.nif}
                    onChange={e => setCompanyData({ ...companyData, nif: e.target.value.replace(/\D/g, '') })}
                    className={inputClass} placeholder="123456789" maxLength={9} disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Company Email <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="email"  value={companyData.companyEmail}
                    onChange={e => setCompanyData({ ...companyData, companyEmail: e.target.value })}
                    className={inputClass} placeholder="general@company.com" disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>Phone</label>
                  <Input type="text"  value={companyData.phone}
                    onChange={e => setCompanyData({ ...companyData, phone: e.target.value })}
                    className={inputClass} placeholder="+351 912 345 678" disabled={loading} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>Address</label>
                  <Input type="text"  value={companyData.address}
                    onChange={e => setCompanyData({ ...companyData, address: e.target.value })}
                    className={inputClass} placeholder="Example Street, 123" disabled={loading} />
                </div>
              </div>
            </div>

            {/* Admin account */}
            <div>
              <SectionHeader
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
                title="Administrator Account"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Full Name <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="text"  value={companyData.adminName}
                    onChange={e => setCompanyData({ ...companyData, adminName: e.target.value })}
                    className={inputClass} placeholder="John Doe" disabled={loading} required />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Personal Email <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="email"  value={companyData.adminEmail}
                    onChange={e => setCompanyData({ ...companyData, adminEmail: e.target.value })}
                    className={inputClass} placeholder="john.doe@email.com" disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Password <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="password"  value={companyData.password}
                    onChange={e => setCompanyData({ ...companyData, password: e.target.value })}
                    className={inputClass} placeholder="Minimum 6 characters" disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Confirm Password <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="password"  value={companyData.confirmPassword}
                    onChange={e => setCompanyData({ ...companyData, confirmPassword: e.target.value })}
                    className={inputClass} placeholder="Repeat password" disabled={loading} required />
                </div>
              </div>
            </div>

            <InfoBox items={[
              'Will be created as <strong>Administrator</strong> of your company',
              'Will have full access to manage transports, suppliers and reports',
              'Can create and manage other company users',
            ]} />

            <button type="submit" disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98] text-sm"
              style={{ background: loading ? `${ds.accent}70` : ds.accent, color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* ════════════════════════════════════════
            OPERATOR FORM
        ════════════════════════════════════════ */}
        {activeTab === 'operator' && (
          <form onSubmit={handleOperatorSubmit} className="space-y-7">
            <div>
              <label className={labelClass} style={{ color: ds.textMuted }}>
                Company <span style={{ color: ds.danger }}>*</span>
              </label>
              <select
                value={operatorData.selectedCompany}
                onChange={e => setOperatorData({ ...operatorData, selectedCompany: e.target.value })}
                className={inputClass}
                disabled={loading || loadingCompanies}
                required
              >
                <option value="" style={{ background: ds.bgCard }}>
                  {loadingCompanies ? 'Loading companies...' : 'Select a company'}
                </option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} style={{ background: ds.bgCard }}>
                    {c.name} — {c.nif}
                  </option>
                ))}
              </select>
              {companies.length === 0 && !loadingCompanies && (
                <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: ds.warning }}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  No company available. Contact the administrator.
                </p>
              )}
            </div>

            <div>
              <SectionHeader
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
                title="Personal Date"
              />
              <div className="space-y-4">
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Full Name <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="text"  value={operatorData.operatorName}
                    onChange={e => setOperatorData({ ...operatorData, operatorName: e.target.value })}
                    className={inputClass} placeholder="Mary Santos" disabled={loading} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: ds.textMuted }}>
                    Personal Email <span style={{ color: ds.danger }}>*</span>
                  </label>
                  <Input type="email"  value={operatorData.operatorEmail}
                    onChange={e => setOperatorData({ ...operatorData, operatorEmail: e.target.value })}
                    className={inputClass} placeholder="mary.santos@email.com" disabled={loading} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={{ color: ds.textMuted }}>
                      Password <span style={{ color: ds.danger }}>*</span>
                    </label>
                    <Input type="password"  value={operatorData.password}
                      onChange={e => setOperatorData({ ...operatorData, password: e.target.value })}
                      className={inputClass} placeholder="Minimum 6 characters" disabled={loading} required />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: ds.textMuted }}>
                      Confirm Password <span style={{ color: ds.danger }}>*</span>
                    </label>
                    <Input type="password"  value={operatorData.confirmPassword}
                      onChange={e => setOperatorData({ ...operatorData, confirmPassword: e.target.value })}
                      className={inputClass} placeholder="Repeat password" disabled={loading} required />
                  </div>
                </div>
              </div>
            </div>

            <InfoBox items={[
              'Will be created as <strong>Operator</strong> of the selected company',
              'Can manage transports and view reports',
              'The administrator can approve or reject your access',
            ]} />

            <button type="submit" disabled={loading || companies.length === 0}
              className="w-full font-semibold py-3 rounded-xl transition-all duration-200 active:scale-[0.98] text-sm"
              style={{
                background: (loading || companies.length === 0) ? `${ds.accent}50` : ds.accent,
                color: 'white',
                cursor: (loading || companies.length === 0) ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Login link */}
        <div className="mt-8 pt-6 flex items-center gap-4" style={{ borderTop: `1px solid ${ds.border}` }}>
          <p className="text-sm flex-shrink-0" style={{ color: ds.textMuted }}>Already have an account?</p>
          <div className="flex-1 h-px" style={{ background: ds.border }} />
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm font-semibold transition-colors flex-shrink-0"
            style={{ color: ds.accent }}
          >
            Login →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
