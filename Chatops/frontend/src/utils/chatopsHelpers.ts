type ChatLanguage = 'pt' | 'en' | 'es';

const LOCALES: Record<ChatLanguage, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
};

export const getLocale = (language: ChatLanguage) => LOCALES[language];

const RELATIVE_DAY_LABELS: Record<ChatLanguage, { today: string; yesterday: string }> = {
  pt: { today: 'Hoje', yesterday: 'Ontem' },
  en: { today: 'Today', yesterday: 'Yesterday' },
  es: { today: 'Hoy', yesterday: 'Ayer' },
};

export const formatTimestamp = (ts: number, language: ChatLanguage = 'pt') => {
  const date = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString(LOCALES[language], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `${RELATIVE_DAY_LABELS[language].today} ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `${RELATIVE_DAY_LABELS[language].yesterday} ${time}`;
  return `${date.toLocaleDateString(LOCALES[language], { day: '2-digit', month: 'short' })} ${time}`;
};

export const getDateLabel = (ts: number, language: ChatLanguage = 'pt') => {
  const date = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return RELATIVE_DAY_LABELS[language].today;
  if (date.toDateString() === yesterday.toDateString()) return RELATIVE_DAY_LABELS[language].yesterday;
  return date.toLocaleDateString(LOCALES[language], { day: '2-digit', month: 'long', year: 'numeric' });
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getInitials = (userId: string) =>
  userId.split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') ||
  userId.slice(0, 2).toUpperCase();

const AVATAR_COLORS = [
  'hsl(0,80%,42%)', 'hsl(355,75%,38%)', 'hsl(348,65%,45%)',
  'hsl(5,70%,40%)',  'hsl(0,60%,35%)',   'hsl(10,72%,44%)',
];
export const getAvatarColor = (uid: string) => AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];
