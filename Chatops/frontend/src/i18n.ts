import { useEffect, useState } from 'react';

type Language = 'pt' | 'en' | 'es';

const STORAGE_KEY = 'chatops-lang';

export const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return 'pt';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
  return stored === 'en' || stored === 'es' ? stored : 'pt';
};

export const setStoredLanguage = (lang: Language) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('chatops-language-change'));
};

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>(() => getStoredLanguage());

  useEffect(() => {
    const update = () => {
      const storedLanguage = getStoredLanguage();
      document.documentElement.lang = storedLanguage;
      setLanguage(storedLanguage);
    };
    update();
    window.addEventListener('chatops-language-change', update);
    return () => window.removeEventListener('chatops-language-change', update);
  }, []);

  return { language, setLanguage: (lang: Language) => { setStoredLanguage(lang); setLanguage(lang); } };
};

export const translateText = (text: Record<string, string>, language: Language) => {
  return text[language] || text.pt || '';
};
