import React from 'react';
import { useLanguage } from '../i18n';
import './LanguageSwitcher.css';

type Language = 'pt' | 'en' | 'es';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <div className="chatops-language-switcher">
      <select value={language} onChange={handleChange} className="chatops-lang-select">
        <option value="pt">Português</option>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
}
