import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, translateText, TRANSLATIONS } from '../../i18n';
import { SITE_FULL_NAME } from '../../site.config';

const UnifiedFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);

  return (
    <footer className="layout-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link to="/dashboard" className="footer-logo" aria-label={SITE_FULL_NAME}>L</Link>
          <div>
            <strong>{SITE_FULL_NAME}</strong>
            <p>{language === 'pt' ? 'Gestão logística multi-tenant.' : language === 'es' ? 'Gestión logística multi-tenant.' : 'Multi-tenant logistics management.'}</p>
          </div>
        </div>

        <nav className="footer-links" aria-label={language === 'pt' ? 'Navegação do rodapé' : 'Footer navigation'}>
          <div>
            <strong>{language === 'pt' ? 'Suporte' : language === 'es' ? 'Soporte' : 'Support'}</strong>
            <Link to="/help">{t('footerContact')}</Link>
            <Link to="/tutorials">{language === 'pt' ? 'Tutoriais' : language === 'es' ? 'Tutoriales' : 'Tutorials'}</Link>
            <Link to="/status">{language === 'pt' ? 'Estado do sistema' : language === 'es' ? 'Estado del sistema' : 'System status'}</Link>
          </div>
          <div>
            <strong>{language === 'pt' ? 'Legal' : language === 'es' ? 'Legal' : 'Legal'}</strong>
            <Link to="/privacy-policy">{t('footerPrivacy')}</Link>
            <Link to="/terms-of-use">{t('footerTerms')}</Link>
            <Link to="/cookies">Cookies</Link>
          </div>
        </nav>

        <div className="footer-contact">
          <strong>{language === 'pt' ? 'Contacto' : language === 'es' ? 'Contacto' : 'Contact'}</strong>
          <a href="mailto:support@tranzor.io">support@tranzor.io</a>
          <span>+351 256 123 456</span>
          <span className="footer-status"><i aria-hidden="true" /> {language === 'pt' ? 'Sistemas operacionais' : language === 'es' ? 'Sistemas operativos' : 'Systems operational'}</span>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; {currentYear} {SITE_FULL_NAME}. {t('footerRights')}</span>
        <span>{language === 'pt' ? 'Construído para operações mais claras.' : language === 'es' ? 'Creado para operaciones más claras.' : 'Built for clearer operations.'}</span>
      </div>
    </footer>
  );
};

export default UnifiedFooter;
