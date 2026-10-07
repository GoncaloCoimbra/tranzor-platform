import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'tranzor_cookie_consent';

type ConsentState = 'accepted' | 'rejected' | null;

export default function CookieBanner() {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<ConsentState>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ConsentState;
    if (!saved) {
      // Small delay to avoid "flashing" on initial load
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
    setConsent(saved);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setConsent('accepted');
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setConsent('rejected');
    setVisible(false);
  };

  if (!visible || consent !== null) return null;

  return (
    <div
      role="dialog"
      className="cookie-consent"
      aria-label={t('cookies.ariaLabel')}
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(680px, calc(100vw - 2rem))',
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        flexWrap: 'wrap',
        animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(217,4,41,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
          <circle cx="12" cy="12" r="1" fill="#D90429"/>
          <circle cx="8"  cy="14" r="1" fill="#D90429"/>
          <circle cx="15" cy="9"  r="1" fill="#D90429"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{
          fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 3,
          fontFamily: 'inherit',
        }}>
          {t('cookies.title')}
        </p>
        <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: 0 }}>
          {t('cookies.description')}{' '}
          <Link to="/cookies" style={{ color: '#D90429', fontWeight: 600, textDecoration: 'none' }}>
            {t('cookies.learnMore')}
          </Link>
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleReject}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.15)',
            background: 'transparent',
            color: '#555',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {t('cookies.reject')}
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#D90429',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: 0.3,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {t('cookies.accept')}
        </button>
      </div>
    </div>
  );
}