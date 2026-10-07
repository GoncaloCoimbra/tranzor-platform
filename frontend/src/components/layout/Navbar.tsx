import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore, useCartComputed } from '../../store/cartStore';
import { useAuthStore } from '@/store/authStore';
import LanguageSwitcher from '../LanguageSwitcher';

const BASE = 'https://loja.tranzor.pt/shop';

interface Suggestion {
  label: string;
  type: 'categoria' | 'produto' | 'pesquisa';
  url: string;
  internal?: boolean;
  category?: string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'Artes',             type: 'categoria', url: `${BASE}?group=Artes` },
  { label: 'Escolar',           type: 'categoria', url: `${BASE}?group=Escolar` },
  { label: 'Escritório',        type: 'categoria', url: `${BASE}?group=Escrit%C3%B3rio` },
  { label: 'Gifts',             type: 'categoria', url: `${BASE}?group=Gifts` },
  { label: 'Higiene e Limpeza', type: 'categoria', url: `${BASE}?group=Higiene` },
  { label: 'Indústria',         type: 'categoria', url: `${BASE}?group=Ind%C3%BAstria` },
  { label: 'Informática',       type: 'categoria', url: `${BASE}?group=Inform%C3%A1tica` },
  { label: 'Jogos e Brinquedos',type: 'categoria', url: `${BASE}?group=Jogos` },
  { label: 'Mobiliário',        type: 'categoria', url: `${BASE}?group=Mobili%C3%A1rio` },
  { label: 'Cadernos e Blocos',      type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Cadernos%20e%20Blocos`,      category: 'Escolar' },
  { label: 'Canetas e Lápis',        type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Escrita%20e%20Corre%C3%A7%C3%A3o`, category: 'Escolar' },
  { label: 'Mochilas',               type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Transportar%20e%20Guardar`,  category: 'Escolar' },
  { label: 'Calculadoras',           type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Calculadoras`,               category: 'Escolar' },
  { label: 'Pintura',                type: 'categoria', url: `${BASE}?group=Artes&txtflt02=Pintura`,                      category: 'Artes' },
  { label: 'Aguarela',               type: 'categoria', url: `${BASE}?group=Artes&txtflt02=Pintura&txtflt03=Aguarela`,    category: 'Artes' },
  { label: 'Telas',                  type: 'categoria', url: `${BASE}?group=Artes&txtflt02=Telas`,                        category: 'Artes' },
  { label: 'Tinteiros',              type: 'categoria', url: `${BASE}?group=Inform%C3%A1tica&txtflt02=Consumíveis%20de%20Impressão&txtflt03=Tinteiros`, category: 'Informática' },
  { label: 'Impressoras',            type: 'categoria', url: `${BASE}?group=Inform%C3%A1tica&txtflt02=Impress%C3%A3o`,   category: 'Informática' },
  { label: 'Papel A4',               type: 'categoria', url: `${BASE}?group=Escrit%C3%B3rio&txtflt02=Papel%20e%20Impress%C3%A3o`, category: 'Escritório' },
  { label: 'Agendas',                type: 'categoria', url: `${BASE}?group=Escrit%C3%B3rio&txtflt02=Calend%C3%A1rios%20e%20Agendas`, category: 'Escritório' },
  { label: 'Dossiers',               type: 'categoria', url: `${BASE}?group=Escrit%C3%B3rio&txtflt02=Arquivamento`,      category: 'Escritório' },
  { label: 'Marcadores',             type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Desenhar%20e%20Colorir`,    category: 'Escolar' },
  { label: 'Tesouras',               type: 'categoria', url: `${BASE}?group=Escolar&txtflt02=Tesouras`,                  category: 'Escolar' },
  { label: 'Puzzles',                type: 'categoria', url: `${BASE}?group=Jogos&txtflt02=Puzzles`,                     category: 'Jogos' },
  { label: 'Cadeiras de Escritório', type: 'categoria', url: `${BASE}?group=Mobili%C3%A1rio&txtflt02=Cadeiras%20de%20Escrit%C3%B3rio`, category: 'Mobiliário' },
  { label: 'Secretárias',            type: 'categoria', url: `${BASE}?group=Mobili%C3%A1rio&txtflt02=Secret%C3%A1rias`, category: 'Mobiliário' },
  { label: 'Pens USB',               type: 'categoria', url: `${BASE}?group=Inform%C3%A1tica&txtflt02=Armazenamento%20de%20Dados&txtflt03=Pens%20USB`, category: 'Informática' },
  { label: 'Luvas',                  type: 'categoria', url: `${BASE}?group=Ind%C3%BAstria&txtflt02=EPI&txtflt03=Luvas`, category: 'Indústria' },
  { label: 'Máscaras',               type: 'categoria', url: `${BASE}?group=Ind%C3%BAstria&txtflt02=EPI&txtflt03=M%C3%A1scaras`, category: 'Indústria' },
  { label: 'Desinfetantes',          type: 'categoria', url: `${BASE}?group=Higiene&txtflt02=Desinfetantes`,             category: 'Higiene e Limpeza' },
  { label: 'Papel Higiénico',        type: 'categoria', url: `${BASE}?group=Higiene&txtflt02=Higiene%20Pessoal`,         category: 'Higiene e Limpeza' },
  { label: 'Caneta Pilot G-2',    type: 'produto', url: `${BASE}?txtflt01=Pilot%20G-2` },
  { label: 'Caderno Oxford A4',   type: 'produto', url: `${BASE}?txtflt01=Oxford%20A4`,    category: 'Cadernos' },
  { label: 'Marcadores Stabilo',  type: 'produto', url: `${BASE}?txtflt01=Stabilo`,        category: 'Marcadores' },
  { label: 'Papel Navigator A4',  type: 'produto', url: `${BASE}?txtflt01=Navigator%20A4`, category: 'Papel' },
  { label: 'Tinteiro HP 302',     type: 'produto', url: `${BASE}?txtflt01=HP%20302`,       category: 'Consumíveis' },
  { label: 'Toner Samsung',       type: 'produto', url: `${BASE}?txtflt01=Toner%20Samsung`,category: 'Consumíveis' },
  { label: 'BIC Cristal',         type: 'produto', url: `${BASE}?txtflt01=BIC%20Cristal`,  category: 'Escrita' },
  { label: 'Post-it 3M',          type: 'produto', url: `${BASE}?txtflt01=Post-it%203M`,   category: 'Organização' },
  // Páginas internas
  { label: 'Novidades',           type: 'pesquisa', url: '/shop/novidades',             internal: true },
  { label: 'Vistos Recentemente', type: 'pesquisa', url: '/shop/vistos-recentemente',   internal: true },
];

const POPULAR: Suggestion[] = [
  { label: 'Papel A4',            type: 'pesquisa', url: `${BASE}?txtflt01=Papel%20A4` },
  { label: 'Canetas',             type: 'pesquisa', url: `${BASE}?txtflt01=Canetas` },
  { label: 'Cadernos',            type: 'pesquisa', url: `${BASE}?txtflt01=Cadernos` },
  { label: 'Tinteiros',           type: 'pesquisa', url: `${BASE}?txtflt01=Tinteiros` },
  { label: 'Agendas 2025',        type: 'pesquisa', url: `${BASE}?txtflt01=Agendas%202025` },
  { label: 'Novidades',           type: 'pesquisa', url: '/shop/novidades',            internal: true },
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getMatches(query: string): Suggestion[] {
  if (!query.trim()) return [];
  const q = normalize(query);
  const matches = SUGGESTIONS.filter(s => normalize(s.label).includes(q));
  matches.sort((a, b) => {
    const aStarts = normalize(a.label).startsWith(q);
    const bStarts = normalize(b.label).startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    if (a.type === 'categoria' && b.type !== 'categoria') return -1;
    if (a.type !== 'categoria' && b.type === 'categoria') return 1;
    return a.label.localeCompare(b.label, 'pt');
  });
  return matches.slice(0, 8);
}

function TypeIcon({ type }: { type: Suggestion['type'] }) {
  if (type === 'categoria') return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  );
  if (type === 'produto') return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M13.5 5.5L8 2 2.5 5.5v5L8 14l5.5-3.5v-5z"/>
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
    </svg>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = normalize(text).indexOf(normalize(query));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(217,4,41,0.12)', color: '#D90429', borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface SearchDropdownProps {
  query: string;
  onSelect: (s: Suggestion) => void;
  onInternalSearch: (q: string) => void;
  activeIdx: number;
}

function SearchDropdown({ query, onSelect, onInternalSearch, activeIdx }: SearchDropdownProps) {
  const { t } = useTranslation();
  const results = query.trim() ? getMatches(query) : [];
  const showPopular = !query.trim();
  const items = showPopular ? POPULAR : results;

  const typeLabel = (type: Suggestion['type']) => {
    if (type === 'categoria') return t('nav.searchTypeCategory');
    if (type === 'produto') return t('nav.searchTypeProduct');
    return t('nav.searchTypeSearch');
  };

  if (items.length === 0 && !showPopular) return (
    <div className="sd-wrap">
      <div className="sd-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>{t('nav.searchNoResults', { query })}</span>
        <button className="sd-search-all" onMouseDown={e => { e.preventDefault(); onInternalSearch(query); }}>
          {t('nav.searchAllResults', { query })}
        </button>
      </div>
    </div>
  );

  return (
    <div className="sd-wrap" role="listbox">
      {showPopular && <div className="sd-section-label">{t('nav.popularSearches')}</div>}
      {!showPopular && results.length > 0 && <div className="sd-section-label">{t('nav.suggestions')}</div>}

      {items.map((item, i) => (
        <button
          key={item.label}
          role="option"
          aria-selected={i === activeIdx}
          className={`sd-item ${i === activeIdx ? 'sd-item--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); onSelect(item); }}
        >
          <span className={`sd-icon sd-icon--${item.type}`}>
            <TypeIcon type={item.type} />
          </span>
          <span className="sd-label">
            <Highlighted text={item.label} query={query} />
            {item.category && <span className="sd-cat">{t('nav.searchInCategory', { category: item.category })}</span>}
            {item.internal && <span className="sd-cat">— {t('nav.searchInternalPage')}</span>}
          </span>
          <span className="sd-type-pill">{item.internal ? t('nav.searchInternal') : typeLabel(item.type)}</span>
        </button>
      ))}

      {!showPopular && (
        <button
          className="sd-footer"
          onMouseDown={e => { e.preventDefault(); onInternalSearch(query); }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
          </svg>
          {t('nav.searchSeeAllResults', { query })}
        </button>
      )}
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled]         = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [cartCount, setCartCount]       = useState(0);
  const [reminder, setReminder]         = useState(false);
  const [cartReminder, setCartReminder] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchFocus, setSearchFocus]   = useState(false);
  const [activeIdx, setActiveIdx]       = useState(-1);

  const reminderTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartReminderTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef         = useRef<HTMLInputElement>(null);
  const dropdownRef       = useRef<HTMLDivElement>(null);

  const location  = useLocation();
  const navigate  = useNavigate();
  const { t } = useTranslation();
  const { itemCount } = useCartComputed();

  const showDropdown = searchFocus;
  const currentResults = searchQuery.trim() ? getMatches(searchQuery) : POPULAR;

  useEffect(() => {
    const handler = () => {
      setCartCount(prev => {
        const next = prev + 1;
        if (reminderTimer.current) clearTimeout(reminderTimer.current);
        reminderTimer.current = setTimeout(() => {
          setReminder(true);
          setTimeout(() => setReminder(false), 5000);
        }, 20000);
        return next;
      });
    };
    window.addEventListener('tranzor:cart-add', handler);
    return () => {
      window.removeEventListener('tranzor:cart-add', handler);
      if (reminderTimer.current) clearTimeout(reminderTimer.current);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); setSearchQuery(''); setSearchFocus(false); }, [location]);

  useEffect(() => {
    if (itemCount > 0) {
      if (!cartReminderTimer.current) {
        cartReminderTimer.current = setInterval(() => {
          setCartReminder(true);
          setTimeout(() => setCartReminder(false), 8000);
        }, 4 * 60 * 60 * 1000);
      }
    } else {
      if (cartReminderTimer.current) { clearInterval(cartReminderTimer.current); cartReminderTimer.current = null; }
      setCartReminder(false);
    }
    return () => { if (cartReminderTimer.current) { clearInterval(cartReminderTimer.current); cartReminderTimer.current = null; } };
  }, [itemCount]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) setSearchFocus(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => setActiveIdx(-1), [searchQuery]);

  const handleInternalSearch = useCallback((q: string) => {
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setSearchQuery('');
      setSearchFocus(false);
      setActiveIdx(-1);
    }
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, currentResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && currentResults[activeIdx]) {
        handleSelect(currentResults[activeIdx]);
      } else if (searchQuery.trim()) {
        handleInternalSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setSearchFocus(false);
      searchRef.current?.blur();
    }
  };

  const handleSelect = useCallback((s: Suggestion) => {
    if (s.internal) {
      navigate(s.url);
    } else if (s.type === 'pesquisa') {
      navigate(`/search?q=${encodeURIComponent(s.label)}`);
    } else {
      window.open(s.url, '_blank');
    }
    setSearchQuery('');
    setSearchFocus(false);
    setActiveIdx(-1);
  }, [navigate]);

  const user = useAuthStore(state => state.user);
  const handleCartClick = () => {
    setReminder(false);
    setCartReminder(false);
    if (reminderTimer.current) clearTimeout(reminderTimer.current);
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (user) {
      navigate('/account/profile');
    } else {
      navigate('/auth/login', { state: { from: '/account/profile' } });
    }
  };

  // ── Nav links ──────────────────────────────────────────────────────────────
  const navLinks = [
    { to: '/',                   label: t('nav.home') },
    { to: '/shop/novidades',     label: t('nav.news') },
    { to: '/about',              label: t('nav.about') },
    { to: '/contact',            label: t('nav.contact') },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      <nav
        style={{
          position: 'sticky', top: 0, left: 0, right: 0, zIndex: 1000,
          transition: 'all 0.35s cubic-bezier(.22,1,.36,1)',
          background: scrolled ? 'var(--bg)' : 'var(--bg)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          boxShadow: scrolled ? 'var(--shadow-nav)' : 'none',
        }}
        aria-label={t('nav.mainNavigation')}
        className="site-navbar"
      >
        <div style={{
          maxWidth: 'none', width: '100%', margin: '0 auto', padding: '0 clamp(1rem, 3vw, 2.5rem)',
          height: 72, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>

          {/* LOGO */}
          <Link to="/" aria-label="Tranzor — início" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none', color: 'var(--red)', fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 800, letterSpacing: '-0.06em' }}>
            Tranzor
          </Link>

          {/* LINKS DESKTOP */}
          <ul style={{ display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0, alignItems: 'center', flex: 1, justifyContent: 'center' }} className="desktop-nav">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} style={{
                  color: label.startsWith('✦') ? 'var(--red)' : 'var(--red)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase',
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: isActive(to) ? 'rgba(217,4,41,0.1)' : 'transparent',
                  border: isActive(to) ? '1px solid rgba(217,4,41,0.18)' : '1px solid transparent',
                  transition: 'all 0.25s ease',
                }}>{label}</Link>
              </li>
            ))}

            {/* Vistos Recentemente — link discreto */}
            <li>
              <Link
                to="/shop/vistos-recentemente"
                style={{
                  color: 'var(--red)', textDecoration: 'none',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase',
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: isActive('/shop/vistos-recentemente') ? 'rgba(217,4,41,0.1)' : 'transparent',
                  border: isActive('/shop/vistos-recentemente') ? '1px solid rgba(217,4,41,0.18)' : '1px solid transparent',
                  transition: 'all 0.25s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                </svg>
                {t('nav.recent')}
              </Link>
            </li>

            {/* CTA ver produtos */}
            <li>
              <Link to="/shop" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--red)', color: 'var(--white)', textDecoration: 'none',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase',
                padding: '12px 18px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0,
                border: '1px solid var(--red)',
                boxShadow: '0 10px 30px rgba(217,4,41,0.18)',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >{t('nav.shopCta')} →</Link>
            </li>
          </ul>

          {/* AÇÕES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="nav-actions">

            {/* PESQUISA */}
            <div style={{ position: 'relative' }}>
              <div className={`navbar-search-control${searchFocus ? ' is-focused' : ''}`}>
                <svg className="navbar-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  className="navbar-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocus(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('nav.searchPlaceholder')}
                  autoComplete="off"
                  aria-label={t('nav.searchAriaLabel')}
                  aria-autocomplete="list"
                  aria-expanded={showDropdown}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} aria-label={t('nav.clearSearch')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 10px 0 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                    </svg>
                  </button>
                )}
              </div>

              {showDropdown && (
                <div ref={dropdownRef} id="search-dropdown">
                  <SearchDropdown
                    query={searchQuery}
                    onSelect={handleSelect}
                    onInternalSearch={handleInternalSearch}
                    activeIdx={activeIdx}
                  />
                </div>
              )}
            </div>

            {/* SELETOR DE IDIOMA */}
            <LanguageSwitcher />

            {/* CARRINHO */}
            <div style={{ position: 'relative' }}>
              <Link to="/cart" onClick={handleCartClick} aria-label={t('nav.cartAriaLabel', { count: cartCount })}
                style={{ color: 'var(--red)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(217,4,41,0.18)', transition: 'background 0.2s, transform 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(217,4,41,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6L8 18H16L18 6H6Z"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M6 6L4 3H1" strokeLinecap="round"/>
                </svg>
              </Link>
              {cartCount > 0 && (
                <span data-testid="cart-count" aria-hidden style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 99, background: 'var(--red)', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'badgePop 0.3s cubic-bezier(.22,1,.36,1)' }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}

              {reminder && (
                <div role="status" aria-live="polite" style={{ position: 'absolute', top: 52, right: 0, background: 'white', border: '1px solid rgba(217,4,41,0.35)', borderRadius: 12, padding: '12px 16px', width: 220, boxShadow: '0 12px 36px rgba(0,0,0,0.14)', zIndex: 2000, animation: 'reminderIn 0.35s cubic-bezier(.22,1,.36,1)' }}>
                  <div style={{ position: 'absolute', top: -7, right: 14, width: 12, height: 12, background: 'white', border: '1px solid rgba(217,4,41,0.35)', borderRight: 'none', borderBottom: 'none', transform: 'rotate(45deg)' }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d90429" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M6 6L8 18H16L18 6H6Z"/><circle cx="9" cy="20" r="1.5" fill="#d90429" stroke="none"/><circle cx="15" cy="20" r="1.5" fill="#d90429" stroke="none"/><path d="M6 6L4 3H1" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#d90429', marginBottom: 3 }}>{t('nav.cartReminderTitle', { count: cartCount })}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.4 }}>{t('nav.cartReminderBody')}</p>
                    </div>
                  </div>
                  <Link to="/cart" onClick={handleCartClick} style={{ display: 'block', marginTop: 10, background: '#d90429', color: 'white', textAlign: 'center', padding: '8px', borderRadius: 8, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>{t('nav.viewCart')} →</Link>
                </div>
              )}

              {cartReminder && (
                <div role="status" aria-live="polite" style={{ position: 'absolute', top: 52, right: 0, background: 'white', border: '1px solid rgba(217,4,41,0.35)', borderRadius: 12, padding: '12px 16px', width: 240, boxShadow: '0 12px 36px rgba(0,0,0,0.14)', zIndex: 2000, animation: 'reminderIn 0.35s cubic-bezier(.22,1,.36,1)' }}>
                  <div style={{ position: 'absolute', top: -7, right: 14, width: 12, height: 12, background: 'white', border: '1px solid rgba(217,4,41,0.35)', borderRight: 'none', borderBottom: 'none', transform: 'rotate(45deg)' }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d90429" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#d90429', marginBottom: 3 }}>{t('nav.cartReminderTitleAlt')}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.4 }}>{t('nav.cartReminderBodyAlt', { count: itemCount })}</p>
                    </div>
                  </div>
                  <Link to="/cart" onClick={handleCartClick} style={{ display: 'block', marginTop: 10, background: '#d90429', color: 'white', textAlign: 'center', padding: '8px', borderRadius: 8, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>{t('nav.viewCart')} →</Link>
                </div>
              )}
            </div>

            {/* PERFIL */}
            <Link
              to={user ? '/account/profile' : '/auth/login'}
              aria-label={user ? t('nav.profileAriaLabel') : t('nav.accountAriaLabel')}
              onClick={handleProfileClick}
              style={{ color: 'var(--red)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(217,4,41,0.18)', transition: 'background 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(217,4,41,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>
              </svg>
            </Link>
          </div>

          {/* BURGER */}
          <button onClick={() => setMenuOpen(v => !v)} aria-label={t('nav.openMenu')} aria-expanded={menuOpen}
            style={{ display: 'none', border: '1px solid rgba(217,4,41,0.18)', background: 'transparent', borderRadius: 12, padding: '10px', cursor: 'pointer', color: 'var(--red)', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            className="burger-btn">
            {[0,1,2].map(i => (
              <span key={i} style={{ display: 'block', width: 20, height: 2, background: 'var(--red)', borderRadius: 2, marginBottom: i < 2 ? 4 : 0, transform: menuOpen ? (i === 0 ? 'rotate(45deg) translateY(6px)' : i === 2 ? 'rotate(-45deg) translateY(-6px)' : 'none') : 'none', opacity: menuOpen && i === 1 ? 0 : 1, transition: 'all 0.2s ease' }} />
            ))}
          </button>
        </div>
      </nav>

      {/* DRAWER MOBILE */}
      <div className="mobile-drawer" style={{ position: 'fixed', inset: 0, zIndex: 990, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(22px)', padding: '5.5rem 1.5rem 1.5rem', transform: menuOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.35s cubic-bezier(.22,1,.36,1)', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        {navLinks.map(({ to, label }) => (
          <Link key={to} to={to} style={{ color: 'var(--red)', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: 0.4 }}>{label}</Link>
        ))}
        <Link to="/shop/vistos-recentemente" style={{ color: '#888', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
          </svg>
          {t('nav.recentlyViewed')}
        </Link>
        <div style={{ height: 1, background: 'rgba(217,4,41,0.12)' }} />
        <Link to="/account/orders" style={{ color: '#555', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{t('nav.orders')}</Link>
        <Link to="/account/profile" style={{ color: '#555', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{t('nav.profile')}</Link>
        <Link to="/shop" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '16px 20px', borderRadius: '999px', border: '1px solid var(--red)', background: 'var(--red)', color: 'var(--white)', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{t('nav.shopCta')} →</Link>
      </div>

      {/* ESTILOS */}
      <style>{`
        .sd-wrap { position:absolute; top:calc(100% + 10px); left:50%; transform:translateX(-50%); width:380px; background:#ffffff; border:1.5px solid #e8e8e8; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.12),0 4px 16px rgba(217,4,41,0.06); overflow:hidden; animation:sdIn 0.2s cubic-bezier(.22,1,.36,1); z-index:3000; }
        .sd-section-label { padding:10px 14px 6px; font-family:'Manrope',sans-serif; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#aaa; border-bottom:1px solid #f0f0f0; }
        .sd-item { width:100%; display:flex; align-items:center; gap:10px; padding:10px 14px; background:none; border:none; cursor:pointer; text-align:left; transition:background 0.15s; border-bottom:1px solid #f7f7f7; }
        .sd-item:last-of-type { border-bottom:none; }
        .sd-item:hover, .sd-item--active { background:rgba(217,4,41,0.04); }
        .sd-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sd-icon--categoria { background:rgba(217,4,41,0.08); color:#D90429; }
        .sd-icon--produto { background:rgba(0,0,0,0.05); color:#444; }
        .sd-icon--pesquisa { background:rgba(0,0,0,0.04); color:#888; }
        .sd-label { flex:1; min-width:0; font-family:'Manrope',sans-serif; font-size:13.5px; font-weight:500; color:#111; display:flex; flex-direction:column; gap:1px; }
        .sd-cat { font-size:11px; font-weight:400; color:#aaa; }
        .sd-type-pill { font-family:'Manrope',sans-serif; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:3px 7px; border-radius:99px; background:#f3f3f3; color:#999; white-space:nowrap; }
        .sd-item--active .sd-type-pill { background:rgba(217,4,41,0.08); color:#D90429; }
        .sd-footer { display:flex; align-items:center; gap:7px; padding:10px 14px; font-family:'Manrope',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:#D90429; text-decoration:none; background:rgba(217,4,41,0.03); border-top:1px solid #f0f0f0; transition:background 0.15s; width:100%; border:none; border-top:1px solid #f0f0f0; cursor:pointer; }
        .sd-footer:hover { background:rgba(217,4,41,0.07); }
        .sd-empty { padding:28px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; font-family:'Manrope',sans-serif; font-size:13px; color:#aaa; text-align:center; }
        .sd-search-all { font-family:'Manrope',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.5px; color:#D90429; text-decoration:none; background:none; border:none; cursor:pointer; margin-top:4px; }
        .sd-search-all:hover { text-decoration:underline; }
        @keyframes sdIn { from { opacity:0; transform:translateX(-50%) translateY(-6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes badgePop { from { transform:scale(0.4); opacity:0; } to { transform:scale(1); opacity:1; } }
        @keyframes reminderIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 1200px) { .desktop-nav { display:none !important; } .burger-btn { display:flex !important; } .nav-actions { gap:12px !important; } .sd-wrap { width:320px; } }
        @media (max-width: 620px) { .nav-actions { gap:10px !important; } .sd-wrap { width:290px; left:auto; right:0; transform:none; } }
        @media (prefers-reduced-motion: reduce) { nav, .burger-btn span, .mobile-drawer, .sd-wrap { transition:none !important; animation:none !important; } }
      `}</style>
    </>
  );
}