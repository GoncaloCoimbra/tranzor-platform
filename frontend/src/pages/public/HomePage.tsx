import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';
import { useCartStore } from '../../store/cartStore';

/* ─────────────────────────────────────────
   SEO
   ───────────────────────────────────────── */
function SEOHead() {
  const { t } = useTranslation();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Loja de Exemplo', url: 'https://example.com', foundingDate: '2010' },
      { '@type': 'WebSite', url: 'https://example.com', potentialAction: { '@type': 'SearchAction', target: 'https://example.com/shop?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
    ],
  };

  return (
    <Helmet>
      <title>{t('home.seoTitle')}</title>
      <meta name="description" content={t('home.seoDescription')} />
      <link rel="canonical" href="https://example.com" />
      <meta property="og:title" content={t('home.seoOgTitle')} />
      <meta property="og:description" content={t('home.seoOgDescription')} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://example.com" />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}

/* ─────────────────────────────────────────
   TOAST
   ───────────────────────────────────────── */
interface Toast { id: number; message: string; }
const toastListeners: Array<(t: Toast) => void> = [];
export function fireToast(message: string) {
  const id = Date.now();
  toastListeners.forEach(fn => fn({ id, message }));
}
function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3000);
    };
    toastListeners.push(handler);
    return () => { const i = toastListeners.indexOf(handler); if (i > -1) toastListeners.splice(i, 1); };
  }, []);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'fixed', bottom: '2rem', right: '1.5rem', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast-enter" style={{ background: 'var(--charcoal-2)', border: '1px solid rgba(217,4,41,0.4)', borderRadius: 8, padding: '12px 18px', color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   ANIMATED COUNTER
   ───────────────────────────────────────── */
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      const duration = 1800;
      const startTime = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(ease * end));
        if (progress < 1) requestAnimationFrame(tick);
        else setCount(end);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);
  return <span ref={ref}>{count.toLocaleString('pt-PT')}{suffix}</span>;
}

/* ─────────────────────────────────────────
   STAR RATING
   ───────────────────────────────────────── */
function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label={`${rating} de 5 — ${count} avaliações`}>
      <div aria-hidden style={{ display: 'flex', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#c8962a' : 'none'} stroke="#c8962a" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        ))}
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-display)', letterSpacing: 0.3 }}>({count})</span>
    </div>
  );
}

/* ─────────────────────────────────────────
   HERO MOSAIC
   ───────────────────────────────────────── */
function HeroMosaic() {
  const { t } = useTranslation();

  return (
    <div className="hero-mosaic" aria-hidden>
      <div className="mosaic-item mosaic-tall">
        <img src="https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=480&h=700&fit=crop&q=85" alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div className="mosaic-overlay" />
        <span className="mosaic-label">{t('home.heroMosaic.notebooks')}</span>
      </div>
      <div className="mosaic-item">
        <img src="https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400&h=320&fit=crop&q=85" alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div className="mosaic-overlay" />
        <span className="mosaic-label">{t('home.heroMosaic.pens')}</span>
      </div>
      <div className="mosaic-item">
        <img src="https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=320&fit=crop&q=85" alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div className="mosaic-overlay" />
        <span className="mosaic-label">{t('home.heroMosaic.pencils')}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CATEGORY CARD
   ───────────────────────────────────────── */
interface CategoryCardProps { image: string; label: string; count: string; to: string; delay: number; featured?: boolean; }
function CategoryCard({ image, label, count, to, delay, featured, exploreLabel }: CategoryCardProps & { exploreLabel: string }) {
  return (
    <Link
      to={to}
      className={`cat-card animate-up${featured ? ' cat-card--featured' : ''}`}
      style={{ animationDelay: `${delay}s`, animationFillMode: 'both' }}
      aria-label={`${label}: ${count}`}
    >
      <img src={image} alt="" loading="lazy" decoding="async" className="cat-card-img" />
      <div className="cat-card-overlay" />
      <div className="cat-card-content">
        <span className="cat-card-count">{count}</span>
        <h3 className="cat-card-label">{label}</h3>
        <span className="cat-card-arrow">{exploreLabel}</span>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────
   PRODUCT CARD
   ───────────────────────────────────────── */
interface ProductCardProps { name: string; price: string; originalPrice?: string; badge?: string; to: string; delay: number; rating?: number; ratingCount?: number; image?: string; }
function ProductCard({ name, price, originalPrice, badge, to, delay, rating = 4.5, ratingCount = 128, image }: ProductCardProps) {
  const { t } = useTranslation();
  const addItem = useCartStore(state => state.addItem);
  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const priceNum = parseFloat(price.replace('€', '').replace(',', '.'));
    addItem({ id: to, name: name.split(' — ')[0], price: priceNum, originalPrice: originalPrice ? parseFloat(originalPrice.replace('€', '').replace(',', '.')) : undefined, badge, to });
    fireToast(t('home.products.addedToast', { name: name.split(' — ')[0] }));
    window.dispatchEvent(new CustomEvent('tranzor:cart-add'));
  }, [name, price, originalPrice, badge, to, addItem, t]);

  return (
    <Link to={to} className="prod-card animate-up" style={{ animationDelay: `${delay}s`, animationFillMode: 'both' }} aria-label={`${name}, ${price}`}>
      <div className="prod-image">
        {image && (
          <img src={image} alt={name} loading="lazy" decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)', willChange: 'transform' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {badge && <span className={`prod-badge ${badge === 'Sale' ? 'prod-badge--sale' : 'prod-badge--new'}`}>{badge}</span>}
        <div className="prod-quick-add">
          <button type="button" onClick={handleAddToCart} onMouseDown={e => e.stopPropagation()} aria-label={t('home.products.addAria', { name })}>
            + {t('home.products.addToCart')}
          </button>
        </div>
      </div>
      <div className="prod-info">
        <p className="prod-name">{name}</p>
        <StarRating rating={rating} count={ratingCount} />
        <div className="prod-pricing">
          <span className="prod-price">{price}</span>
          {originalPrice && <span className="prod-original">{originalPrice}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────
   TESTIMONIAL
   ───────────────────────────────────────── */
function TestimonialCard({ quote, author, role, delay }: { quote: string; author: string; role: string; delay: number }) {
  return (
    <figure className="testi-card animate-up" style={{ animationDelay: `${delay}s`, animationFillMode: 'both', margin: 0 }}>
      <div className="testi-mark" aria-hidden>"</div>
      <blockquote style={{ margin: 0 }}>
        <p className="testi-quote">{quote}</p>
      </blockquote>
      <figcaption className="testi-author">
        <div className="testi-avatar" aria-hidden>{author[0]}</div>
        <div>
          <div className="testi-name">{author}</div>
          <div className="testi-role">{role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

/* ─────────────────────────────────────────
   FLOATING ACTIONS (scroll-to-top + live chat)
   ───────────────────────────────────────── */
function FloatingActions() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', toggle, { passive: true });
    return () => window.removeEventListener('scroll', toggle);
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '1.5rem',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s',
      }}
    >
      {/* Voltar ao topo */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={t('home.floatingActions.scrollToTopAria')}
        className="back-top"
        style={{ position: 'static', opacity: 1, pointerEvents: 'auto' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="18,15 12,9 6,15"/>
        </svg>
      </button>

      {/* Live Chat — Ícone melhorado */}
      <Link
        to="/support/live-chat"
        className="float-chat"
        aria-label={t('home.floatingActions.liveChatAria')}
        title={t('home.floatingActions.liveChatTitle')}
      >
        <span className="float-chat-dot" aria-hidden />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span className="float-chat-label">Chat</span>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────
   BRAND CAROUSEL
   ───────────────────────────────────────── */
function BrandCarousel() {
  const { t } = useTranslation();
  const brands = [
    { name: 'Pilot',         image: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Pilot_Pen_logo.svg/200px-Pilot_Pen_logo.svg.png' },
    { name: 'Stabilo',       image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/STABILO_Logo.svg/200px-STABILO_Logo.svg.png' },
    { name: 'HP',            image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HP_logo_2012.svg/160px-HP_logo_2012.svg.png' },
    { name: 'Leitz',         image: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Leitz_logo.svg/200px-Leitz_logo.svg.png' },
    { name: 'Esselte',       image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=240&h=140&fit=crop&q=80', logo: null },
    { name: 'Oxford',        image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=240&h=140&fit=crop&q=80', logo: null },
    { name: 'Navigator',     image: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Navigator_paper_logo.svg/200px-Navigator_paper_logo.svg.png' },
    { name: 'Staedtler',     image: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Staedtler_Logo.svg/200px-Staedtler_Logo.svg.png' },
    { name: 'Faber-Castell', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=240&h=140&fit=crop&q=80', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Faber-Castell_Logo.svg/200px-Faber-Castell_Logo.svg.png' },
    { name: 'BIC',           image: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=240&h=140&fit=crop&q=80&crop=right', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/BIC_logo.svg/200px-BIC_logo.svg.png' },
  ];
  const items = [...brands, ...brands];
  return (
    <section aria-labelledby="brands-heading" style={{ padding: '0 0 8rem', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 2rem', textAlign: 'center', marginBottom: '3rem' }}>
        <p className="section-eyebrow">{t('home.brandCarousel.eyebrow')}</p>
        <h2 id="brands-heading" className="section-title">{t('home.brandCarousel.title')}</h2>
      </div>
      <div className="brand-track-wrap" aria-hidden>
        <div className="brand-track">
          {items.map((b, idx) => (
            <div key={`${b.name}-${idx}`} className="brand-item">
              <img src={b.image} alt="" loading="lazy" decoding="async" className="brand-bg" />
              <div className="brand-scrim" />
              <div className="brand-face">
                {b.logo
                  ? <img src={b.logo} alt={b.name} style={{ maxHeight: 26, maxWidth: 85, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; const s = e.currentTarget.nextElementSibling as HTMLElement|null; if(s) s.style.display='block'; }} />
                  : null
                }
                <span className="brand-name-fallback" style={{ display: b.logo ? 'none' : 'block' }}>{b.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   PÁGINA PRINCIPAL
   ───────────────────────────────────────── */
export default function HomePage() {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <SEOHead />
      <FloatingActions />
      <ToastContainer />

      {/* ══════════════════════════════════════
          1. HERO
      ══════════════════════════════════════ */}
      <section role="banner" aria-label={t('home.heroAriaLabel')} className="hero-section">
        <div className="hero-grain" aria-hidden />
        <div className="hero-glow" aria-hidden />

        <div className="hero-inner">
          {/* — Left: editorial text — */}
          <div className="hero-text">
            <div className="hero-eyebrow animate-up" style={{ animationDelay: '0.05s' }}>
              <span className="eyebrow-dot" aria-hidden />
              {t('home.heroEyebrow')}
            </div>

            <h1 className="hero-headline">
              <span className="hero-line hero-line--serif animate-up" style={{ animationDelay: '0.15s' }}>{t('home.heroLine1')}</span>
              <span className="hero-line hero-line--bold animate-up" style={{ animationDelay: '0.25s' }}>
                {t('home.heroLine2')}
                <svg className="hero-underline" aria-hidden viewBox="0 0 320 10" fill="none" preserveAspectRatio="none">
                  <path d="M0,8 Q80,1 160,6 Q240,11 320,5" stroke="var(--red)" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="hero-line hero-line--italic animate-up" style={{ animationDelay: '0.35s' }}>{t('home.heroLine3')}</span>
            </h1>

            <p className="hero-body animate-up" style={{ animationDelay: '0.45s' }}>
              {t('home.heroBody', { count: '25.000' })}
            </p>

            {/* ── CTAs principais ── */}
            <div className="hero-actions animate-up" style={{ animationDelay: '0.55s' }}>
              <Link to="/shop" className="btn-hero-primary" aria-label={t('home.viewCatalogAria')}>
                {t('home.viewCatalog')}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link to="/b2b" className="btn-hero-ghost" aria-label={t('home.businessSolutionsAria')}>
                {t('home.businessSolutions')}
              </Link>
            </div>

            {/* ── Trust bar ── */}
            <div className="hero-trust animate-up" style={{ animationDelay: '0.65s' }}>
              {[
                { icon: 'M9 12l2 2 4-4', label: t('home.trustReturns') },
                { icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', label: t('home.trustSatisfaction') },
                { icon: 'M5 12h14M12 5l7 7-7 7', label: t('home.trustShipping') },
              ].map(({ icon, label }) => (
                <div key={label} className="trust-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon}/></svg>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* — Right: product mosaic — */}
          <div className="hero-mosaic-wrap animate-up" style={{ animationDelay: '0.3s' }}>
            <HeroMosaic />
            <div className="hero-badge" aria-hidden>
              <span className="hero-badge-num">50</span>
              <span className="hero-badge-txt">{t('home.heroBadgeYears')}<br/>{t('home.heroBadgeLocation')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. STATS
      ══════════════════════════════════════ */}
      <section aria-labelledby="stats-heading" className="stats-section">
        <h2 id="stats-heading" className="sr-only">{t('home.statsHeading')}</h2>
        <div className="stats-inner">
          {[
            { value: 25000, suffix: '+', label: t('home.statsProductsLabel'), note: t('home.statsProductsNote') },
            { value: 50,    suffix: '+', label: t('home.statsYearsLabel'), note: t('home.statsYearsNote') },
            { value: 700,   suffix: '+', label: t('home.statsDeliveriesLabel'), note: t('home.statsDeliveriesNote') },
            { value: 98,    suffix: '%', label: t('home.statsCustomersLabel'), note: t('home.statsCustomersNote') },
          ].map(({ value, suffix, label, note }, i) => (
            <div key={label} className="stat-item animate-up" style={{ animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: 'both' }}>
              <div className="stat-num"><Counter end={value} suffix={suffix} /></div>
              <div className="stat-label">{label}</div>
              <div className="stat-note">{note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          3. CATEGORIAS
      ══════════════════════════════════════ */}
      <section aria-labelledby="cat-heading" style={{ padding: '8rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="section-eyebrow">{t('home.categories.eyebrow')}</p>
            <h2 id="cat-heading" className="section-title" style={{ marginBottom: 0 }}>{t('home.categories.title')}</h2>
          </div>
          <Link to="/shop" className="link-accent">{t('home.categories.link')}</Link>
        </div>

        <div className="cat-grid">
          <CategoryCard featured image="https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=800&fit=crop&q=85" label={t('home.categories.office')} count={t('home.categories.officeCount')} to="/shop/escritorio" delay={0.1} exploreLabel={t('home.categories.explore')} />
          <CategoryCard image="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=320&fit=crop&q=85" label={t('home.categories.school')} count={t('home.categories.schoolCount')} to="/shop/escolar" delay={0.15} exploreLabel={t('home.categories.explore')} />
          <CategoryCard image="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=320&fit=crop&q=85" label={t('home.categories.arts')} count={t('home.categories.artsCount')} to="/shop/artes" delay={0.2} exploreLabel={t('home.categories.explore')} />
          <CategoryCard image="https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&h=320&fit=crop&q=85" label={t('home.categories.tech')} count={t('home.categories.techCount')} to="/shop/tecnologia" delay={0.25} exploreLabel={t('home.categories.explore')} />
          <CategoryCard image="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=320&fit=crop&q=85" label={t('home.categories.furniture')} count={t('home.categories.furnitureCount')} to="/shop/mobiliario" delay={0.3} exploreLabel={t('home.categories.explore')} />
        </div>

        <Link to="/shop/impressao" className="impressao-strip animate-up" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{t('home.printingServices.title')}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-light)', marginTop: 2 }}>{t('home.printingServices.body')}</div>
            </div>
          </div>
          <span className="impressao-cta">{t('home.printingServices.cta')}</span>
        </Link>
      </section>

      {/* ══════════════════════════════════════
          4. PRODUTOS EM DESTAQUE
      ══════════════════════════════════════ */}
      <section aria-labelledby="prod-heading" style={{ background: 'var(--charcoal-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8rem 2rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3.5rem', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p className="section-eyebrow">{t('home.featuredProducts.eyebrow')}</p>
              <h2 id="prod-heading" className="section-title" style={{ marginBottom: 0 }}>{t('home.featuredProducts.title')}</h2>
            </div>
            <Link to="/shop" className="link-accent">{t('home.featuredProducts.link')}</Link>
          </div>
          <div className="prod-grid">
            <ProductCard name="Caneta Pilot G-2 — Pack 10 cores" price="12,99€" originalPrice="16,99€" badge="Sale" to="/shop/product/caneta-pilot-g2" delay={0.1} rating={4.8} ratingCount={312} image="https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=560&h=420&fit=crop&q=85" />
            <ProductCard name="Caderno A4 Pautado Oxford — 200 Fls" price="5,49€" to="/shop/product/caderno-oxford-a4" delay={0.15} rating={4.6} ratingCount={89} image="https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=560&h=420&fit=crop&q=85" />
            <ProductCard name="Marcadores Stabilo Boss — Pack 4" price="8,29€" badge="Novo" to="/shop/product/marcadores-stabilo" delay={0.2} rating={4.7} ratingCount={204} image="https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=560&h=420&fit=crop&q=85" />
            <ProductCard name="Papel Navigator A4 — Resma 500 Fls" price="7,99€" originalPrice="9,49€" badge="Sale" to="/shop/product/papel-navigator-a4" delay={0.25} rating={4.9} ratingCount={521} image="https://images.unsplash.com/photo-1568667256549-094345857637?w=560&h=420&fit=crop&q=85" />
            <ProductCard name="Mochila Escolar Ergonomica — 24L" price="39,99€" badge="Novo" to="/shop/product/mochila-escolar" delay={0.3} rating={4.7} ratingCount={189} image="https://images.unsplash.com/photo-1518455249501-3b7fecc8fbc0?w=560&h=420&fit=crop&q=85" />
            <ProductCard name="Marcador de Quadro Branco — Pack 6" price="11,99€" originalPrice="14,99€" badge="Sale" to="/shop/product/marcador-quadro-branco" delay={0.35} rating={4.4} ratingCount={142} image="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=560&h=420&fit=crop&q=85" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          5. EDITORIAL BANNER
      ══════════════════════════════════════ */}
      <section aria-labelledby="promo-heading" style={{ padding: '8rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
        <div className="editorial-banner">
          <div className="editorial-banner-img">
            <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop&q=85" alt="Material escolar em promoção" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div className="editorial-banner-scrim" />
          </div>
          <div className="editorial-banner-content">
            <div className="editorial-banner-tag">{t('home.editorialBanner.eyebrow')}</div>
            <h2 id="promo-heading" className="editorial-banner-title">{t('home.editorialBanner.title')}</h2>
            <p className="editorial-banner-body">{t('home.editorialBanner.body')}</p>
            <Link to="/shop/escolar?promo=1" className="btn-editorial" aria-label={t('home.editorialBanner.aria')}>
              {t('home.editorialBanner.link')}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
          <div className="editorial-banner-badge" aria-hidden>
            <span>{t('home.editorialBanner.badge')}</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          6. PORQUÊ TRANZOR
      ══════════════════════════════════════ */}
      <section aria-labelledby="why-heading" style={{ background: 'var(--charcoal-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8rem 2rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <p className="section-eyebrow">{t('home.whyTranzor.eyebrow')}</p>
            <h2 id="why-heading" className="section-title">{t('home.whyTranzor.title')}</h2>
          </div>
          <div className="why-list">
            {[
              { num: '01', title: '+25.000 Referências', desc: 'Das principais marcas mundiais — Pilot, Stabilo, HP, Leitz, Faber-Castell e muito mais. Tudo num só lugar, sem compromissos de qualidade.', link: '/shop' },
              { num: '02', title: 'Entrega em Todo Portugal', desc: 'Mais de 700 entregas diárias para todo o território nacional. Receba em 24–48h ou levante gratuitamente nas nossas lojas físicas em Lisboa e Porto.', link: '/shipping-info' },
              { num: '03', title: 'Centro de Impressão', desc: 'Cópias, scan, encadernação, plastificação, carimbos e convites personalizados. Um serviço completo disponível nas lojas físicas Tranzor.', link: '/shop/impressao' },
              { num: '04', title: 'Soluções para Empresas', desc: 'Contratos anuais, conta corrente, faturação simplificada e preços especiais para volume. Para empresas, escolas e instituições de qualquer dimensão.', link: '/b2b' },
            ].map(({ num, title, desc, link }, i) => (
              <Link key={num} to={link} className="why-item animate-up" style={{ animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: 'both', textDecoration: 'none' }}>
                <div className="why-num" aria-hidden>{num}</div>
                <div className="why-divider" aria-hidden />
                <div className="why-body">
                  <h3 className="why-title">{title}</h3>
                  <p className="why-desc">{desc}</p>
                  <span className="why-link">{t('home.whyTranzor.learnMore')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          7. MARCAS
      ══════════════════════════════════════ */}
      <BrandCarousel />

      {/* ══════════════════════════════════════
          8. CAMPANHAS
      ══════════════════════════════════════ */}
      <section aria-labelledby="camp-heading" style={{ padding: '0 2rem 8rem', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="section-eyebrow">{t('home.campaigns.eyebrow')}</p>
            <h2 id="camp-heading" className="section-title" style={{ marginBottom: 0 }}>{t('home.campaigns.title')}</h2>
          </div>
          <Link to="/shop/ofertas" className="link-accent">{t('home.campaigns.link')}</Link>
        </div>
        <div className="camp-grid">
          {[
            { title: t('home.campaigns.card1Title'), discount: t('home.campaigns.card1Discount'), desc: t('home.campaigns.card1Desc'), link: '/shop/escolar?campaign=backtoschool', color: '#d90429', img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop&q=80' },
            { title: t('home.campaigns.card2Title'), discount: t('home.campaigns.card2Discount'), desc: t('home.campaigns.card2Desc'), link: '/shop/escritorio?campaign=office', color: '#1e6091', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop&q=80' },
            { title: t('home.campaigns.card3Title'), discount: t('home.campaigns.card3Discount'), desc: t('home.campaigns.card3Desc'), link: '/shop/tecnologia?campaign=tech', color: '#2a9d8f', img: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&h=400&fit=crop&q=80' },
          ].map((c, i) => (
            <Link key={c.title} to={c.link} className="camp-card animate-up" style={{ animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: 'both', '--camp-color': c.color } as React.CSSProperties} aria-label={`${c.title} — ${c.discount}`}>
              <img src={c.img} alt="" loading="lazy" decoding="async" className="camp-bg" />
              <div className="camp-scrim" style={{ '--camp-color': c.color } as React.CSSProperties} />
              <div className="camp-content">
                <span className="camp-discount">{c.discount}</span>
                <h3 className="camp-title">{c.title}</h3>
                <p className="camp-desc">{c.desc}</p>
                <span className="camp-cta">{t('home.campaigns.cta')}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          9. TESTEMUNHOS
      ══════════════════════════════════════ */}
      <section aria-labelledby="testi-heading" style={{ padding: '8rem 2rem', borderTop: '1px solid var(--border)', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p className="section-eyebrow">{t('home.testimonials.eyebrow')}</p>
          <h2 id="testi-heading" className="section-title">{t('home.testimonials.title')}</h2>
        </div>
        <div className="testi-grid">
          {(t('home.testimonials.quotes', { returnObjects: true }) as string[]).map((quote, index) => (
            <TestimonialCard key={quote} quote={quote} author={(t('home.testimonials.authors', { returnObjects: true }) as string[])[index]} role={(t('home.testimonials.roles', { returnObjects: true }) as string[])[index]} delay={0.1 + index * 0.1} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          10. NEWSLETTER
      ══════════════════════════════════════ */}
      <section aria-labelledby="nl-heading" style={{ padding: '0 2rem 8rem', maxWidth: 1280, margin: '0 auto' }}>
        <div className="nl-box">
          <div className="nl-deco" aria-hidden />
          <div className="nl-left">
            <p className="section-eyebrow" style={{ textAlign: 'left' }}>{t('home.newsletter.eyebrow')}</p>
            <h2 id="nl-heading" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--text)', lineHeight: 1.2, margin: '0 0 12px' }}>{t('home.newsletter.title')}</h2>
            <p style={{ color: 'var(--muted-light)', fontSize: 14, lineHeight: 1.75, maxWidth: 340 }}>{t('home.newsletter.body')}</p>
          </div>
          <div className="nl-right">
            <form onSubmit={e => { e.preventDefault(); fireToast(t('home.newsletter.success')); }} aria-label={t('home.newsletter.ariaLabel')}>
              <label htmlFor="nl-email" style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{t('home.newsletter.emailLabel')}</label>
              <div className="nl-field">
                <input id="nl-email" type="email" placeholder={t('home.newsletter.placeholder')} required autoComplete="email" className="nl-input" />
                <button type="submit" className="nl-btn">{t('home.newsletter.button')}</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{t('home.newsletter.privacy')} <Link to="/privacy" style={{ color: 'var(--muted-light)', textDecoration: 'underline' }}>{t('home.newsletter.privacyLink')}</Link>. {t('home.newsletter.privacySuffix')}</p>
            </form>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          11. MEGASTORES
      ══════════════════════════════════════ */}
      <section aria-labelledby="stores-heading" style={{ background: 'var(--charcoal-2)', borderTop: '1px solid var(--border)', padding: '8rem 2rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p className="section-eyebrow">{t('home.stores.eyebrow')}</p>
            <h2 id="stores-heading" className="section-title">{t('home.stores.title')}</h2>
          </div>
          <div className="stores-grid">
            {[
              { city: 'Lisboa', address: 'Rua da Imaginação, 123', hours: 'Seg–Sex 9h–20h · Sab–Dom 10h–19h', phone: '+351 210 000 000', mapsUrl: 'https://maps.google.com/?q=Tranzor+Lisboa', since: 'Loja principal' },
              { city: 'Porto', address: 'Avenida dos Sonhos, 45', hours: 'Seg–Sex 9h–20h · Sab–Dom 10h–19h', phone: '+351 220 000 000', mapsUrl: 'https://maps.google.com/?q=Tranzor+Porto', since: 'Loja de apoio' },
            ].map(({ city, address, hours, phone, mapsUrl, since }) => (
              <div key={city} className="store-card">
                <div className="store-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8" aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span className="store-since">{since}</span>
                </div>
                <h3 className="store-city">Loja<br />{city}</h3>
                <address style={{ fontStyle: 'normal', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--muted-light)' }}>{address}</span>
                  <time style={{ fontSize: 13, color: 'var(--muted)' }}>{hours}</time>
                  <a href={`tel:${phone.replace(/\s/g,'')}`} style={{ fontSize: 14, color: 'var(--text)', textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{phone}</a>
                </address>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="store-directions" aria-label={`${t('home.stores.ariaPrefix')} ${city}`}>
                  {t('home.stores.cta')}
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          ESTILOS
      ══════════════════════════════════════ */}
      <style>{`
        :root { --font-serif: Georgia, 'Times New Roman', serif; }

        .sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }

        @keyframes fadeUp  { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes scrollL { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse   { 0%,100% { opacity:.4; transform:scale(.85); } 50% { opacity:1; transform:scale(1.2); } }

        .animate-up  { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards; opacity:0; }
        .toast-enter { animation: toastIn 0.3s ease; }

        a:focus-visible, button:focus-visible, input:focus-visible { outline:2px solid var(--red); outline-offset:3px; border-radius:4px; }

        .section-eyebrow { font-family:var(--font-display); font-weight:600; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--red); margin:0 0 14px; text-align:center; }
        .section-title { font-family:var(--font-serif); font-weight:700; font-size:clamp(2rem,4vw,3.2rem); color:var(--text); line-height:1.15; margin:0 0 1.5rem; letter-spacing:-0.5px; }
        .link-accent { font-family:var(--font-display); font-weight:600; font-size:13px; color:var(--red); text-decoration:none; letter-spacing:0.5px; display:inline-flex; align-items:center; gap:6px; transition:gap 0.2s, color 0.2s; border-bottom:1px solid rgba(217,4,41,0.3); padding-bottom:2px; }
        .link-accent:hover { gap:10px; color:var(--red-vivid); border-color:var(--red); }

        /* ── HERO ── */
        .hero-section { position:relative; min-height:90vh; display:flex; align-items:center; padding:6rem 2rem 5rem; overflow:hidden; }
        .hero-grain { position:absolute; inset:0; pointer-events:none; z-index:1; opacity:0.025; background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>"); }
        .hero-glow { position:absolute; top:10%; right:-8%; width:600px; height:600px; background:radial-gradient(circle, rgba(217,4,41,0.1) 0%, transparent 65%); pointer-events:none; z-index:0; }
        .hero-inner { position:relative; z-index:2; max-width:1280px; margin:0 auto; width:100%; display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; }
        @media (max-width:860px) { .hero-inner { grid-template-columns:1fr; } .hero-mosaic-wrap { display:none; } }

        .hero-eyebrow { display:inline-flex; align-items:center; gap:10px; font-family:var(--font-display); font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--muted-light); margin-bottom:2.5rem; }
        .eyebrow-dot { width:6px; height:6px; background:var(--red); border-radius:50%; display:inline-block; animation:pulse 2s ease infinite; box-shadow:0 0 6px rgba(217,4,41,0.6); }

        .hero-headline { margin:0 0 2rem; line-height:1; letter-spacing:-1px; }
        .hero-line { display:block; }
        .hero-line--serif { font-family:var(--font-serif); font-style:italic; font-size:clamp(1.6rem,3.5vw,2.6rem); color:var(--muted-light); font-weight:400; margin-bottom:4px; }
        .hero-line--bold { font-family:var(--font-display); font-weight:800; font-size:clamp(3.5rem,7.5vw,6.5rem); color:var(--text); position:relative; display:inline-block; }
        .hero-underline { position:absolute; bottom:-2px; left:0; width:100%; height:10px; overflow:visible; }
        .hero-line--italic { font-family:var(--font-serif); font-style:italic; font-size:clamp(1.8rem,4vw,3rem); color:var(--red); font-weight:700; margin-top:6px; }

        .hero-body { font-size:clamp(1rem,1.8vw,1.1rem); color:var(--muted-light); max-width:460px; line-height:1.85; margin-bottom:2.5rem; }
        .hero-body strong { color:var(--text); }

        .hero-actions { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:2.5rem; }

        .btn-hero-primary { background:var(--red); color:white; padding:15px 32px; border-radius:var(--radius); font-family:var(--font-display); font-weight:700; font-size:13px; letter-spacing:0.02em; text-transform:uppercase; text-decoration:none; display:inline-flex; align-items:center; gap:10px; white-space:nowrap; transition:background 0.2s, transform 0.2s, box-shadow 0.2s; box-shadow:0 4px 20px rgba(217,4,41,0.3); border:none; }
        .btn-hero-primary:hover { background:var(--red-vivid); transform:translateY(-2px); box-shadow:0 8px 32px rgba(217,4,41,0.4); }
        .btn-hero-ghost { background:transparent; color:var(--text); padding:15px 28px; border-radius:var(--radius); font-family:var(--font-display); font-weight:600; font-size:13px; letter-spacing:0.01em; text-decoration:none; display:inline-flex; align-items:center; white-space:nowrap; border:1px solid var(--border); transition:border-color 0.2s, color 0.2s, background 0.2s; }
        .btn-hero-ghost:hover { border-color:rgba(217,4,41,0.4); color:var(--red); background:rgba(217,4,41,0.05); }

        /* ── Floating chat button (ESTILO MELHORADO) ── */
        .float-chat {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d90429 0%, #b60222 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          color: white;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(217,4,41,0.45), 0 2px 6px rgba(0,0,0,0.2);
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s, width 0.3s cubic-bezier(0.22,1,0.36,1), border-radius 0.3s;
          overflow: hidden;
          white-space: nowrap;
          position: relative;
          backdrop-filter: blur(6px);
        }
        .float-chat:hover {
          width: 130px;
          border-radius: 24px;
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(217,4,41,0.55), 0 4px 8px rgba(0,0,0,0.25);
        }
        .float-chat-dot {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #4ade80;
          opacity: 0.95;
          animation: pulse 2s ease infinite;
          box-shadow: 0 0 8px rgba(74,222,128,0.8);
          border: 2px solid white;
          z-index: 2;
        }
        .float-chat-label {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: white;
          white-space: nowrap;
          opacity: 0;
          width: 0;
          overflow: hidden;
          transition: opacity 0.25s 0.05s, width 0.3s cubic-bezier(0.22,1,0.36,1);
          display: inline-block;
        }
        .float-chat:hover .float-chat-label {
          opacity: 1;
          width: auto;
        }
        /* Ícone SVG centralizado */
        .float-chat svg {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
        }

        .hero-trust { display:flex; gap:20px; flex-wrap:wrap; }
        .trust-item { display:flex; align-items:center; gap:7px; }
        .trust-item span { font-family:var(--font-display); font-size:12px; font-weight:500; color:var(--muted-light); }

        .hero-mosaic-wrap { position:relative; }
        .hero-mosaic { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:260px 220px; gap:10px; border-radius:20px; overflow:hidden; }
        .mosaic-item { position:relative; overflow:hidden; cursor:default; transition:transform 0.4s ease; }
        .mosaic-item:first-child { grid-row:1/3; border-radius:16px 4px 4px 16px; }
        .mosaic-item:nth-child(2) { border-radius:4px 16px 4px 4px; }
        .mosaic-item:nth-child(3) { border-radius:4px 4px 16px 4px; }
        .mosaic-item img { transition:transform 0.5s cubic-bezier(0.22,1,0.36,1); }
        .mosaic-item:hover img { transform:scale(1.06); }
        .mosaic-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); }
        .mosaic-label { position:absolute; bottom:12px; left:14px; font-family:var(--font-display); font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.8); }
        .hero-badge { position:absolute; top:-18px; right:-18px; width:84px; height:84px; border-radius:50%; background:var(--red); color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(217,4,41,0.4); z-index:10; }
        .hero-badge-num { font-family:var(--font-serif); font-weight:700; font-size:28px; line-height:1; }
        .hero-badge-txt { font-family:var(--font-display); font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; opacity:0.85; text-align:center; line-height:1.3; }

        /* ── STATS ── */
        .stats-section { background:var(--charcoal-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:4rem 2rem; }
        .stats-inner { max-width:1280px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:0; }
        .stat-item { padding:2rem; text-align:center; border-right:1px solid var(--border); }
        .stat-item:last-child { border-right:none; }
        @media (max-width:600px) { .stat-item { border-right:none; border-bottom:1px solid var(--border); } }
        .stat-num { font-family:var(--font-serif); font-weight:700; font-size:clamp(2.4rem,5vw,3.8rem); color:var(--red); line-height:1; margin-bottom:6px; }
        .stat-label { font-family:var(--font-display); font-weight:700; font-size:13px; color:var(--text); margin-bottom:4px; }
        .stat-note { font-family:var(--font-display); font-size:11px; color:var(--muted); letter-spacing:0.5px; }

        /* ── CATEGORIES ── */
        .cat-grid { display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:280px 240px; gap:10px; margin-bottom:10px; }
        @media (max-width:700px) { .cat-grid { grid-template-columns:1fr 1fr; grid-template-rows:auto; } .cat-card--featured { grid-column:1/-1; height:240px; } }
        .cat-card { position:relative; overflow:hidden; border-radius:14px; display:flex; align-items:flex-end; text-decoration:none; cursor:pointer; transition:transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s; }
        .cat-card--featured { grid-row:1/3; }
        .cat-card:hover { transform:scale(1.015); box-shadow:0 24px 60px rgba(0,0,0,0.5); }
        .cat-card-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.22,1,0.36,1); }
        .cat-card:hover .cat-card-img { transform:scale(1.07); }
        .cat-card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.1) 55%, transparent 80%); transition:background 0.4s; }
        .cat-card:hover .cat-card-overlay { background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, rgba(217,4,41,0.08) 100%); }
        .cat-card-content { position:relative; z-index:1; padding:1.25rem 1.5rem; width:100%; display:flex; flex-direction:column; gap:2px; }
        .cat-card--featured .cat-card-content { padding:2rem; }
        .cat-card-count { font-family:var(--font-display); font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.6); }
        .cat-card-label { font-family:var(--font-display); font-weight:800; color:white; font-size:18px; line-height:1.1; margin:2px 0; }
        .cat-card--featured .cat-card-label { font-family:var(--font-serif); font-size:2rem; }
        .cat-card-arrow { font-family:var(--font-display); font-size:11px; font-weight:700; letter-spacing:1px; color:rgba(255,255,255,0); text-transform:uppercase; transition:color 0.3s, transform 0.3s; transform:translateY(6px); display:inline-block; }
        .cat-card:hover .cat-card-arrow { color:rgba(255,255,255,0.9); transform:translateY(0); }

        .impressao-strip { display:flex; align-items:center; justify-content:space-between; padding:1.5rem 2rem; border:1px solid var(--border); border-radius:14px; text-decoration:none; background:var(--charcoal-2); transition:border-color 0.3s, background 0.3s, transform 0.3s; gap:1rem; flex-wrap:wrap; }
        .impressao-strip:hover { border-color:rgba(217,4,41,0.4); background:var(--charcoal-3); transform:translateY(-2px); }
        .impressao-cta { font-family:var(--font-display); font-size:13px; font-weight:700; color:var(--red); white-space:nowrap; letter-spacing:0.5px; }

        /* ── PRODUCTS ── */
        .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr)); gap:1.25rem; }
        .prod-card { text-decoration:none; background:var(--charcoal-2); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; border:1px solid var(--border); transition:border-color 0.3s, transform 0.3s, box-shadow 0.3s; }
        .prod-card:hover { border-color:rgba(217,4,41,0.3); transform:translateY(-5px); box-shadow:0 20px 60px rgba(0,0,0,0.5); }
        .prod-image { height:240px; overflow:hidden; position:relative; background:var(--charcoal-3); }
        .prod-card:hover .prod-image img { transform:scale(1.06); }
        .prod-badge { position:absolute; top:12px; left:12px; z-index:2; font-family:var(--font-display); font-size:10px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:4px 10px; border-radius:4px; color:white; }
        .prod-badge--sale { background:var(--red); }
        .prod-badge--new  { background:#27ae60; }
        .prod-quick-add { position:absolute; bottom:0; left:0; right:0; z-index:2; transform:translateY(100%); transition:transform 0.3s cubic-bezier(0.22,1,0.36,1); background:rgba(217,4,41,0.92); backdrop-filter:blur(8px); padding:12px; text-align:center; }
        .prod-card:hover .prod-quick-add { transform:translateY(0); }
        .prod-quick-add button { background:none; border:none; color:white; cursor:pointer; font-family:var(--font-display); font-weight:700; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; width:100%; }
        .prod-info { padding:1.25rem; display:flex; flex-direction:column; gap:8px; flex:1; }
        .prod-name { font-family:var(--font-display); font-weight:600; font-size:14px; color:var(--offwhite); line-height:1.4; margin:0; flex:1; }
        .prod-pricing { display:flex; align-items:center; gap:8px; margin-top:auto; }
        .prod-price { font-family:var(--font-serif); font-weight:700; font-size:20px; color:var(--red); }
        .prod-original { font-size:13px; color:var(--muted); text-decoration:line-through; }

        /* ── EDITORIAL BANNER ── */
        .editorial-banner { position:relative; border-radius:20px; overflow:hidden; min-height:420px; display:flex; align-items:flex-end; }
        .editorial-banner-img { position:absolute; inset:0; }
        .editorial-banner-img img { transition:transform 8s ease; }
        .editorial-banner:hover .editorial-banner-img img { transform:scale(1.04); }
        .editorial-banner-scrim { position:absolute; inset:0; background:linear-gradient(100deg, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.3) 75%, transparent 100%); }
        .editorial-banner-content { position:relative; z-index:1; padding:3.5rem; max-width:520px; }
        .editorial-banner-tag { font-family:var(--font-display); font-size:10px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:rgba(255,255,255,0.6); margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .editorial-banner-tag::before { content:''; display:inline-block; width:20px; height:1px; background:var(--red); }
        .editorial-banner-title { font-family:var(--font-serif); font-weight:700; font-size:clamp(2.8rem,6vw,5rem); color:white; line-height:1; margin:0 0 18px; letter-spacing:-1px; }
        .editorial-banner-body { color:rgba(255,255,255,0.75); font-size:15px; line-height:1.75; margin:0 0 28px; max-width:400px; }
        .btn-editorial { display:inline-flex; align-items:center; gap:10px; background:white; color:var(--red); padding:13px 26px; border-radius:10px; font-family:var(--font-display); font-weight:700; font-size:13px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:none; transition:transform 0.2s, box-shadow 0.2s; }
        .btn-editorial:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.25); }
        .editorial-banner-badge { position:absolute; top:2.5rem; right:3rem; z-index:2; font-family:var(--font-serif); font-weight:700; font-size:5rem; color:rgba(255,255,255,0.12); line-height:1; letter-spacing:-2px; pointer-events:none; user-select:none; }

        /* ── WHY ── */
        .why-list { display:flex; flex-direction:column; gap:0; }
        .why-item { display:grid; grid-template-columns:80px 1px 1fr; gap:0 2.5rem; padding:3rem 1.5rem; border-bottom:1px solid var(--border); align-items:start; cursor:pointer; transition:background 0.3s; border-radius:8px; }
        .why-item:first-child { border-top:1px solid var(--border); }
        .why-item:hover { background:rgba(217,4,41,0.03); }
        .why-num { font-family:var(--font-serif); font-weight:700; font-size:3rem; color:rgba(217,4,41,0.2); line-height:1; transition:color 0.3s; }
        .why-item:hover .why-num { color:rgba(217,4,41,0.5); }
        .why-divider { background:var(--border); width:1px; margin-top:6px; align-self:stretch; transition:background 0.3s; }
        .why-item:hover .why-divider { background:rgba(217,4,41,0.3); }
        .why-body { padding-top:6px; }
        .why-title { font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--text); margin:0 0 10px; }
        .why-desc { color:var(--muted-light); font-size:14px; line-height:1.8; margin:0 0 14px; max-width:540px; }
        .why-link { font-family:var(--font-display); font-size:12px; font-weight:700; color:var(--red); letter-spacing:1px; text-transform:uppercase; opacity:0; transition:opacity 0.3s; display:inline-flex; align-items:center; gap:4px; }
        .why-item:hover .why-link { opacity:1; }

        /* ── BRAND CAROUSEL ── */
        .brand-track-wrap { overflow:hidden; }
        .brand-track { display:flex; gap:10px; width:max-content; animation:scrollL 35s linear infinite; align-items:center; }
        .brand-track-wrap:hover .brand-track { animation-play-state:paused; }
        .brand-item { width:160px; height:96px; border-radius:12px; border:1px solid var(--border); overflow:hidden; position:relative; flex-shrink:0; transition:border-color 0.25s, transform 0.25s, box-shadow 0.25s; cursor:default; }
        .brand-item:hover { border-color:rgba(217,4,41,0.5); transform:translateY(-4px); box-shadow:0 12px 32px rgba(0,0,0,0.4); }
        .brand-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:grayscale(0.5) brightness(0.45); transition:filter 0.35s, transform 0.35s; }
        .brand-item:hover .brand-bg { filter:grayscale(0) brightness(0.6); transform:scale(1.08); }
        .brand-scrim { position:absolute; inset:0; background:linear-gradient(160deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%); transition:background 0.3s; }
        .brand-item:hover .brand-scrim { background:linear-gradient(160deg, rgba(217,4,41,0.15) 0%, rgba(0,0,0,0.55) 100%); }
        .brand-face { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:0 14px; }
        .brand-name-fallback { font-family:var(--font-display); font-weight:800; font-size:16px; color:white; letter-spacing:-0.5px; text-shadow:0 1px 6px rgba(0,0,0,0.7); }

        /* ── CAMPAIGNS ── */
        .camp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr)); gap:1.25rem; }
        .camp-card { position:relative; border-radius:16px; overflow:hidden; min-height:300px; display:flex; align-items:flex-end; text-decoration:none; transition:transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s; }
        .camp-card:hover { transform:translateY(-6px); box-shadow:0 28px 60px rgba(0,0,0,0.5); }
        .camp-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.22,1,0.36,1); }
        .camp-card:hover .camp-bg { transform:scale(1.06); }
        .camp-scrim { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 55%, transparent 80%); transition:background 0.4s; }
        .camp-card:hover .camp-scrim { background:linear-gradient(to top, color-mix(in srgb, var(--camp-color) 70%, black) 0%, rgba(0,0,0,0.3) 55%, transparent 80%); }
        .camp-content { position:relative; z-index:1; padding:2rem; }
        .camp-discount { display:inline-block; padding:4px 12px; border-radius:6px; font-family:var(--font-display); font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; background:var(--camp-color, var(--red)); color:white; margin-bottom:10px; }
        .camp-title { font-family:var(--font-serif); font-weight:700; font-size:1.8rem; color:white; margin:0 0 8px; line-height:1.1; }
        .camp-desc { color:rgba(255,255,255,0.75); font-size:13px; line-height:1.7; margin:0 0 14px; }
        .camp-cta { font-family:var(--font-display); font-weight:700; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.7); transition:color 0.3s; }
        .camp-card:hover .camp-cta { color:white; }

        /* ── TESTIMONIALS ── */
        .testi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr)); gap:1.5rem; max-width:1080px; margin:0 auto; }
        .testi-card { background:var(--charcoal-2); border:1px solid var(--border); border-radius:16px; padding:2.5rem; transition:border-color 0.3s, transform 0.3s, box-shadow 0.3s; }
        .testi-card:hover { border-color:rgba(217,4,41,0.25); transform:translateY(-3px); box-shadow:0 16px 48px rgba(0,0,0,0.35); }
        .testi-mark { font-family:var(--font-serif); font-size:5rem; line-height:0.6; color:var(--red); margin-bottom:1.5rem; opacity:0.6; }
        .testi-quote { font-family:var(--font-serif); font-style:italic; font-size:16px; color:var(--muted-light); line-height:1.8; margin:0 0 1.75rem; }
        .testi-author { display:flex; align-items:center; gap:12px; }
        .testi-avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; background:rgba(217,4,41,0.15); border:1px solid rgba(217,4,41,0.3); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; font-size:15px; color:var(--red); }
        .testi-name { font-family:var(--font-display); font-weight:700; font-size:13px; color:var(--text); margin-bottom:2px; }
        .testi-role { font-size:11px; color:var(--muted); letter-spacing:0.5px; }

        /* ── NEWSLETTER ── */
        .nl-box { background:var(--charcoal-2); border:1px solid var(--border); border-radius:20px; padding:clamp(2rem,5vw,4rem); display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; position:relative; overflow:hidden; }
        @media (max-width:640px) { .nl-box { grid-template-columns:1fr; gap:2rem; } }
        .nl-deco { position:absolute; right:-60px; bottom:-60px; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle, rgba(217,4,41,0.07) 0%, transparent 65%); pointer-events:none; }
        .nl-field { display:flex; border:1px solid rgba(217,4,41,0.3); border-radius:10px; overflow:hidden; }
        .nl-input { flex:1; padding:14px 18px; background:var(--charcoal-3); border:none; outline:none; color:var(--white); font-family:var(--font-display); font-size:14px; }
        .nl-input::placeholder { color:var(--muted); }
        .nl-btn { background:var(--red); color:white; border:none; padding:14px 22px; cursor:pointer; font-family:var(--font-display); font-weight:700; font-size:12px; letter-spacing:0.02em; text-transform:uppercase; white-space:nowrap; transition:background 0.2s; flex-shrink:0; }
        .nl-btn:hover { background:var(--red-vivid); }

        /* ── STORES ── */
        .stores-grid { display:flex; flex-wrap:wrap; justify-content:center; gap:1.5rem; max-width:900px; margin:0 auto; }
        .store-card { flex:1 1 340px; max-width:420px; background:var(--charcoal-2); border:1px solid var(--border); border-radius:16px; padding:2.5rem; transition:border-color 0.3s, transform 0.3s; }
        .store-card:hover { border-color:rgba(217,4,41,0.3); transform:translateY(-3px); }
        .store-header { display:flex; align-items:center; gap:10px; margin-bottom:1rem; }
        .store-since { font-family:var(--font-display); font-size:11px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); }
        .store-city { font-family:var(--font-serif); font-weight:700; font-size:1.6rem; color:var(--text); margin:0 0 1.5rem; line-height:1.15; }
        .store-directions { display:inline-flex; align-items:center; gap:6px; margin-top:1.5rem; font-family:var(--font-display); font-weight:700; font-size:12px; letter-spacing:0.02em; text-transform:uppercase; color:var(--red); text-decoration:none; border-bottom:1px solid rgba(217,4,41,0.3); padding-bottom:2px; transition:gap 0.2s, border-color 0.2s; }
        .store-directions:hover { gap:10px; border-color:var(--red); }

        /* ── Scroll to top ── */
        .back-top { width:40px; height:40px; border-radius:50%; background:var(--charcoal-2); border:1px solid rgba(217,4,41,0.4); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--red); transition:transform 0.2s, box-shadow 0.2s; }
        .back-top:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(217,4,41,0.2); }

        header, nav, [class*="header"], [class*="navbar"], [class*="Header"], [class*="Navbar"] { position:relative; z-index:50 !important; }

        @media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; } }
      `}</style>
    </AppLayout>
  );
}