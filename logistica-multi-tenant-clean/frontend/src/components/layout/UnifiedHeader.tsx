import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, translateText, TRANSLATIONS } from '../../i18n';
import { SITE_FULL_NAME } from '../../site.config';
import NotificationPanel from '../NotificationPanel';
import './UnifiedHeader.css';

interface UnifiedHeaderProps {
  variant?: 'admin' | 'public';
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ variant = 'admin' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profilePath = user?.role === 'SUPER_ADMIN' ? '/superadmin/profile' : '/profile';
  const homePath = user?.role === 'SUPER_ADMIN' ? '/superadmin-home' : '/dashboard';
  const [showMenu, setShowMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const { language, setLanguage } = useLanguage();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <header className="unified-header">
      <div className="header-content">
        {/* Brand */}
        <div className="brand-section">
          <Link to={homePath} className="brand-link flex items-center gap-3">
            <div className="brand-logo h-10 w-10 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 shadow-lg flex items-center justify-center text-white font-black">
              L
            </div>
            <div>
              <div className="text-lg font-bold text-white">{SITE_FULL_NAME}</div>
              <div className="text-xs uppercase tracking-[0.35em] text-red-300">Logistics Platform</div>
            </div>
          </Link>
        </div>

        {/* Right Section */}
        <div className="header-actions">
          <NotificationPanel />

          <div
            className="language-menu"
            onMouseEnter={() => setShowLanguageMenu(true)}
            onMouseLeave={() => setShowLanguageMenu(false)}
          >
            <button
              type="button"
              className="language-current"
              aria-expanded={showLanguageMenu}
              aria-haspopup="menu"
              onClick={() => setShowLanguageMenu((isOpen) => !isOpen)}
              title={language === 'pt' ? 'Português' : language === 'en' ? 'English' : 'Español'}
            >
              {language.toUpperCase()}
            </button>
            <div className={`language-dropdown${showLanguageMenu ? ' is-open' : ''}`} role="menu">
              {(['pt', 'en', 'es'] as const)
                .filter((lang) => lang !== language)
                .map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className="language-option"
                    onClick={() => {
                      setLanguage(lang);
                      setShowLanguageMenu(false);
                    }}
                    title={lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : 'Español'}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
            </div>
          </div>

          <div
            className="header-user"
            ref={userMenuRef}
          >
            {user && <span className="user-name">{user.name || user.email}</span>}
            <button
              type="button"
              className="header-btn icon-button user-menu-btn"
              onClick={() => setShowMenu((isOpen) => !isOpen)}
              title={t('userMenuTitle')}
              aria-label={t('userMenuTitle')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3" />
                <path d="M5.5 20c0-2.485 2.015-4.5 4.5-4.5h4c2.485 0 4.5 2.015 4.5 4.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="user-dropdown">
                <Link to={profilePath} className="dropdown-item">{t('headerProfile')}</Link>
                {user?.role !== 'SUPER_ADMIN' && (
                  <Link to="/configuracoes" className="dropdown-item">{t('headerSettings')}</Link>
                )}
                <hr className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item logout-btn"
                  onClick={() => {
                    logout();
                    setShowMenu(false);
                  }}
                >
                  {t('headerLogout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default UnifiedHeader;