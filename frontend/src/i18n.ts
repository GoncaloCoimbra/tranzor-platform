// Frontend i18n Configuration
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptTranslations from './locales/pt.json';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

const resources = {
  pt: { translation: ptTranslations },
  en: { translation: enTranslations },
  es: { translation: esTranslations },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'en', 'es'],
    defaultNS: 'translation',
    ns: ['translation'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? 'pt';
  });

// Keep document language and localStorage in sync with i18next
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('site-language', lng);
  document.documentElement.lang = lng;
});

export default i18n;
