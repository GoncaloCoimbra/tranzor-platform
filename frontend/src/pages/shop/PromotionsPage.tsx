import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import { useCartStore } from '../../store/cartStore';

/* ─────────────────────────────────────────
   ÍCONE PLACEHOLDER DE PRODUTO
   ───────────────────────────────────────── */
function ProductPlaceholder() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
      stroke="#D90429" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="7.5,4.27 12,6.11 16.5,4.27"/>
      <line x1="12" y1="22.76" x2="12" y2="12"/>
    </svg>
  );
}

/* ─────────────────────────────────────────
   ESTRELAS DE AVALIAÇÃO (SVG, sem emojis)
   ───────────────────────────────────────── */
function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="star-rating" aria-label={`${rating} de 5 estrelas, ${count} avaliações`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" aria-hidden
          fill={i < Math.floor(rating) ? '#D90429' : 'none'}
          stroke="#D90429" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
      <span className="star-count">({count})</span>
    </div>
  );
}

/* ─────────────────────────────────────────
   CARD DE PRODUTO
   ───────────────────────────────────────── */
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  badge?: string;
  rating: number;
  ratingCount: number;
  image: string;
  category: string;
  description: string;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article className="promo-card" aria-label={product.name}>
      {/* badges */}
      <div className="promo-card-badges">
        {product.discount && (
          <span className="badge-discount" aria-label={`${product.discount}% de desconto`}>
            -{product.discount}%
          </span>
        )}
        {product.badge && (
          <span className={`badge-label ${product.badge === 'Sale' ? 'badge-sale' : 'badge-novo'}`}>
            {product.badge}
          </span>
        )}
      </div>

      {/* imagem */}
      <Link to={`/shop/product/${product.id}`} className="promo-card-img" tabIndex={-1} aria-hidden>
        <ProductPlaceholder />
      </Link>

      {/* info */}
      <div className="promo-card-body">
        <Link to={`/shop/product/${product.id}`} className="promo-card-name">
          {product.name}
        </Link>

        <StarRating rating={product.rating} count={product.ratingCount} />

        <p className="promo-card-desc">{product.description}</p>

        <div className="promo-card-pricing">
          <span className="promo-price-main">
            {product.price.toFixed(2).replace('.', ',')}€
          </span>
          {product.originalPrice && (
            <span className="promo-price-original">
              {product.originalPrice.toFixed(2).replace('.', ',')}€
            </span>
          )}
        </div>

        <button
          onClick={handleAdd}
          className={`promo-add-btn ${added ? 'promo-add-btn--added' : ''}`}
          aria-label={`Adicionar ${product.name} ao carrinho`}
        >
          {added ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              Adicionado
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Adicionar ao carrinho
            </>
          )}
        </button>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────
   PÁGINA PRINCIPAL
   ───────────────────────────────────────── */
export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState('todas');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const addItem = useCartStore(state => state.addItem);

  const promotions: Product[] = [
    {
      id: 'promo-1',
      name: 'Caneta Pilot G-2 — Pack 10 cores',
      price: 12.99,
      originalPrice: 16.99,
      discount: 24,
      badge: 'Sale',
      rating: 4.8,
      ratingCount: 312,
      image: '/api/placeholder/300/300',
      category: 'escritorio',
      description: 'Pack de 10 canetas gel Pilot G-2 nas cores mais utilizadas.'
    },
    {
      id: 'promo-2',
      name: 'Caderno Oxford A4 Pautado — 200 Fls',
      price: 5.49,
      rating: 4.6,
      ratingCount: 89,
      image: '/api/placeholder/300/300',
      category: 'escolar',
      description: 'Caderno premium Oxford A4 com 200 folhas pautadas.'
    },
    {
      id: 'promo-3',
      name: 'Marcadores Stabilo Boss — Pack 4',
      price: 8.29,
      badge: 'Novo',
      rating: 4.7,
      ratingCount: 204,
      image: '/api/placeholder/300/300',
      category: 'artes',
      description: 'Marcadores de ponta fina Stabilo Boss, ideais para realce.'
    },
    {
      id: 'promo-4',
      name: 'Papel Navigator A4 — Resma 500 Fls',
      price: 7.99,
      originalPrice: 9.49,
      discount: 16,
      badge: 'Sale',
      rating: 4.9,
      ratingCount: 521,
      image: '/api/placeholder/300/300',
      category: 'papelaria',
      description: 'Papel A4 branco Navigator, qualidade profissional.'
    },
    {
      id: 'promo-5',
      name: 'Agenda 2024 Semana a Semana',
      price: 14.99,
      originalPrice: 19.99,
      discount: 25,
      badge: 'Sale',
      rating: 4.5,
      ratingCount: 167,
      image: '/api/placeholder/300/300',
      category: 'escritorio',
      description: 'Agenda semanal completa para organização profissional.'
    },
    {
      id: 'promo-6',
      name: 'Porta-lápis Metalizado',
      price: 3.99,
      originalPrice: 5.99,
      discount: 33,
      rating: 4.3,
      ratingCount: 98,
      image: '/api/placeholder/300/300',
      category: 'acessorios',
      description: 'Porta-lápis resistente em metal cromado.'
    }
  ];

  const tabs = [
    { id: 'todas',     label: 'Todas',     count: promotions.length },
    { id: 'escritorio', label: 'Escritório', count: promotions.filter(p => p.category === 'escritorio').length },
    { id: 'escolar',   label: 'Escolar',   count: promotions.filter(p => p.category === 'escolar').length },
    { id: 'papelaria', label: 'Papelaria', count: promotions.filter(p => p.category === 'papelaria').length },
    { id: 'artes',     label: 'Artes',     count: promotions.filter(p => p.category === 'artes').length },
  ];

  const filtered = activeTab === 'todas'
    ? promotions
    : promotions.filter(p => p.category === activeTab);

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      to: `/shop/product/${product.id}`
    });
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubscribed(true);
  };

  return (
    <AppLayout
      title="Promoções Tranzor"
      description="Descubra todas as promoções e descontos especiais da Tranzor. Até 40% de desconto em produtos selecionados."
      canonical="/shop/ofertas"
    >
      {/* ── Hero ── */}
      <header className="promo-hero">
        <div className="promo-hero-inner">
          <div className="promo-hero-label">Ofertas especiais</div>
          <h1 className="promo-hero-title">
            Promoções<br />
            <span className="promo-hero-accent">exclusivas</span>
          </h1>
          <p className="promo-hero-sub">
            Até 40% de desconto em produtos selecionados.<br />
            Entrega gratuita em compras acima de 35€.
          </p>
          <div className="promo-hero-meta">
            <div className="promo-hero-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Tempo limitado
            </div>
            <div className="promo-hero-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h6l3 5v3h-9V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              Envio grátis +39€
            </div>
          </div>
        </div>

        {/* decoração lateral */}
        <div className="promo-hero-deco" aria-hidden>
          <div className="deco-circle deco-circle-1" />
          <div className="deco-circle deco-circle-2" />
          <div className="deco-number">40<span>%</span></div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="promo-tabs-wrap">
        <div className="promo-tabs-inner">
          <nav className="promo-tabs" role="tablist" aria-label="Filtrar por categoria">
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`promo-tab ${activeTab === tab.id ? 'promo-tab--active' : ''}`}
              >
                {tab.label}
                <span className="promo-tab-count">{tab.count}</span>
              </button>
            ))}
          </nav>
          <p className="promo-results-count" aria-live="polite">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Grelha de produtos ── */}
      <main className="promo-main">
        <div className="promo-grid" role="list">
          {filtered.map((product, i) => (
            <div key={product.id} role="listitem"
              style={{ animationDelay: `${i * 60}ms` }}
              className="promo-grid-item">
              <ProductCard product={product} onAdd={handleAddToCart} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="promo-empty" role="status">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="#D90429" strokeWidth="1" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <p>Nenhum produto nesta categoria.</p>
            <button onClick={() => setActiveTab('todas')} className="promo-tab promo-tab--active" style={{ marginTop: 8 }}>
              Ver todas
            </button>
          </div>
        )}

        {/* ── Newsletter ── */}
        <section className="promo-newsletter" aria-labelledby="newsletter-heading">
          <div className="promo-newsletter-inner">
            <div className="promo-newsletter-text">
              <div className="promo-hero-label" style={{ color: 'rgba(217,4,41,0.6)' }}>Newsletter</div>
              <h2 id="newsletter-heading" className="promo-newsletter-title">
                Não perca as próximas promoções
              </h2>
              <p className="promo-newsletter-sub">
                Seja o primeiro a saber das nossas ofertas exclusivas e descontos especiais.
              </p>
            </div>

            <div className="promo-newsletter-form-wrap">
              {subscribed ? (
                <div className="promo-subscribed" role="status">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="#D90429" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  <span>Subscrito com sucesso!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="promo-newsletter-form" aria-label="Subscrever newsletter">
                  <label htmlFor="newsletter-email" className="sr-only">Endereço de email</label>
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="O seu endereço de email"
                    className="promo-newsletter-input"
                  />
                  <button type="submit" className="promo-newsletter-btn">
                    Subscrever
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </form>
              )}
              <p className="promo-newsletter-note">
                Sem spam. Cancelamento a qualquer momento.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Estilos ── */}
      <style>{`        /* ── Variáveis locais (tema branco) ── */
        .promo-hero, .promo-tabs-wrap, .promo-main {
          --c-bg: #ffffff;
          --c-bg-2: #f7f7f7;
          --c-red: #D90429;
          --c-red-soft: rgba(217,4,41,0.06);
          --c-red-mid: rgba(217,4,41,0.15);
          --c-text: #111111;
          --c-muted: #888888;
          --c-muted-light: #555555;
          --c-border: #e4e4e4;
          --font-head: 'Manrope', sans-serif;
          --font-body: 'Manrope', sans-serif;
        }

        .sr-only {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        /* ── Hero ── */
        .promo-hero {
          background: #ffffff;
          border-bottom: 1px solid var(--c-border);
          padding: 6rem 2.5rem 4rem;
          position: relative; overflow: hidden;
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }
        .promo-hero-inner {
          max-width: 620px; position: relative; z-index: 2;
        }
        .promo-hero-label {
          font-family: var(--font-head); font-size: 11px;
          font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
          color: var(--c-red); margin-bottom: 1.25rem;
        }
        .promo-hero-title {
          font-family: var(--font-head); font-weight: 800;
          font-size: clamp(2.8rem, 6vw, 4.5rem);
          color: var(--c-text); line-height: 1.05;
          letter-spacing: -2px; margin: 0 0 1.25rem;
        }
        .promo-hero-accent { color: var(--c-red); }
        .promo-hero-sub {
          font-family: var(--font-body); font-size: 15px;
          color: var(--c-muted-light); line-height: 1.75;
          margin: 0 0 2rem;
        }
        .promo-hero-meta { display: flex; gap: 12px; flex-wrap: wrap; }
        .promo-hero-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--c-red-soft); border: 1px solid var(--c-red-mid);
          color: var(--c-red); border-radius: 99px;
          font-family: var(--font-head); font-size: 11px;
          font-weight: 700; letter-spacing: 0.5px;
          padding: 7px 14px;
        }

        /* decoração hero */
        .promo-hero-deco {
          position: relative; flex-shrink: 0;
          width: 220px; height: 220px;
          display: none;
        }
        @media (min-width: 800px) { .promo-hero-deco { display: block; } }
        .deco-circle {
          position: absolute; border-radius: 50%;
          border: 1.5px solid var(--c-red-mid);
        }
        .deco-circle-1 { width: 220px; height: 220px; top: 0; left: 0; }
        .deco-circle-2 { width: 160px; height: 160px; top: 30px; left: 30px;
          border-color: var(--c-red); border-style: dashed; opacity: 0.3; }
        .deco-number {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          font-family: var(--font-head); font-weight: 800;
          font-size: 5rem; color: var(--c-red); letter-spacing: -4px;
          line-height: 1; user-select: none;
        }
        .deco-number span { font-size: 2.5rem; vertical-align: super; }

        /* ── Tabs ── */
        .promo-tabs-wrap {
          background: #ffffff;
          border-bottom: 1px solid var(--c-border);
          position: sticky; top: 0; z-index: 10;
        }
        .promo-tabs-inner {
          max-width: 1280px; margin: 0 auto; padding: 0 2.5rem;
          display: flex; align-items: center;
          justify-content: space-between; gap: 1rem; flex-wrap: wrap;
        }
        .promo-tabs {
          display: flex; gap: 0; overflow-x: auto;
          scrollbar-width: none;
        }
        .promo-tabs::-webkit-scrollbar { display: none; }
        .promo-tab {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 1rem 1.25rem;
          font-family: var(--font-head); font-size: 12px;
          font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          background: transparent; border: none; cursor: pointer;
          color: var(--c-muted); white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: color 0.2s, border-color 0.2s;
        }
        .promo-tab:hover { color: var(--c-red); }
        .promo-tab--active {
          color: var(--c-red) !important;
          border-bottom-color: var(--c-red) !important;
        }
        .promo-tab-count {
          background: var(--c-red-soft); color: var(--c-red);
          border-radius: 99px; font-size: 10px; font-weight: 700;
          padding: 2px 7px; min-width: 20px; text-align: center;
        }
        .promo-tab--active .promo-tab-count {
          background: var(--c-red); color: white;
        }
        .promo-results-count {
          font-family: var(--font-body); font-size: 12px;
          color: var(--c-muted); white-space: nowrap; flex-shrink: 0;
        }

        /* ── Main ── */
        .promo-main {
          background: #ffffff;
          max-width: 1280px; margin: 0 auto;
          padding: 3rem 2.5rem 7rem;
        }

        /* ── Grid ── */
        .promo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
          gap: 1.5rem;
          margin-bottom: 5rem;
        }
        .promo-grid-item {
          animation: fadeUp 0.4s both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Card ── */
        .promo-card {
          background: #ffffff;
          border: 1.5px solid var(--c-border);
          border-radius: 14px; overflow: hidden;
          display: flex; flex-direction: column;
          position: relative;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .promo-card:hover {
          border-color: var(--c-red-mid);
          box-shadow: 0 8px 32px rgba(217,4,41,0.08);
        }

        .promo-card-badges {
          position: absolute; top: 12px; left: 12px;
          display: flex; gap: 6px; z-index: 2;
        }
        .badge-discount {
          background: var(--c-red); color: white;
          font-family: var(--font-head); font-size: 11px; font-weight: 800;
          letter-spacing: 0.5px; padding: 4px 9px; border-radius: 5px;
        }
        .badge-label {
          font-family: var(--font-head); font-size: 9px; font-weight: 800;
          letter-spacing: 1.5px; text-transform: uppercase;
          padding: 4px 9px; border-radius: 5px; color: white;
        }
        .badge-sale { background: var(--c-red); }
        .badge-novo { background: #059669; }

        .promo-card-img {
          display: flex; align-items: center; justify-content: center;
          height: 160px; background: var(--c-bg-2);
          text-decoration: none;
          border-bottom: 1px solid var(--c-border);
          transition: background 0.2s;
        }
        .promo-card:hover .promo-card-img { background: #f0f0f0; }

        .promo-card-body {
          padding: 1.25rem; display: flex;
          flex-direction: column; flex: 1; gap: 8px;
        }

        .promo-card-name {
          font-family: var(--font-head); font-weight: 700; font-size: 14px;
          color: var(--c-text); text-decoration: none; line-height: 1.4;
          transition: color 0.2s;
        }
        .promo-card-name:hover { color: var(--c-red); }

        .star-rating {
          display: flex; align-items: center; gap: 2px;
        }
        .star-count {
          font-family: var(--font-body); font-size: 11px;
          color: var(--c-muted); margin-left: 5px;
        }

        .promo-card-desc {
          font-family: var(--font-body); font-size: 12px;
          color: var(--c-muted); line-height: 1.6; margin: 0;
          flex: 1;
        }

        .promo-card-pricing {
          display: flex; align-items: baseline; gap: 9px;
        }
        .promo-price-main {
          font-family: var(--font-head); font-weight: 800;
          font-size: 1.25rem; color: var(--c-red);
        }
        .promo-price-original {
          font-family: var(--font-body); font-size: 12px;
          color: var(--c-muted); text-decoration: line-through;
        }

        .promo-add-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 11px 16px; margin-top: 4px;
          background: var(--c-red); color: white;
          font-family: var(--font-head); font-size: 11px;
          font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          border: none; border-radius: 8px; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .promo-add-btn:hover { background: #b8031c; transform: translateY(-1px); }
        .promo-add-btn--added {
          background: #059669 !important; transform: none !important;
        }

        /* ── Empty ── */
        .promo-empty {
          text-align: center; padding: 5rem 2rem;
          color: var(--c-muted); font-family: var(--font-body);
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }

        /* ── Newsletter ── */
        .promo-newsletter {
          border: 1.5px solid var(--c-border);
          border-radius: 14px; overflow: hidden;
        }
        .promo-newsletter-inner {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        @media (max-width: 720px) {
          .promo-newsletter-inner { grid-template-columns: 1fr; }
        }
        .promo-newsletter-text {
          padding: 3rem;
          background: var(--c-red-soft);
          border-right: 1.5px solid var(--c-border);
        }
        @media (max-width: 720px) {
          .promo-newsletter-text {
            border-right: none;
            border-bottom: 1.5px solid var(--c-border);
          }
        }
        .promo-newsletter-title {
          font-family: var(--font-head); font-weight: 800;
          font-size: clamp(1.4rem, 3vw, 2rem);
          color: var(--c-text); line-height: 1.15;
          letter-spacing: -0.5px; margin: 0.75rem 0 0.75rem;
        }
        .promo-newsletter-sub {
          font-family: var(--font-body); font-size: 14px;
          color: var(--c-muted-light); line-height: 1.7; margin: 0;
        }
        .promo-newsletter-form-wrap {
          padding: 3rem; background: #ffffff;
          display: flex; flex-direction: column; justify-content: center;
        }
        .promo-newsletter-form {
          display: flex; flex-direction: column; gap: 10px;
        }
        .promo-newsletter-input {
          width: 100%; padding: 13px 16px; box-sizing: border-box;
          border: 1.5px solid var(--c-border); border-radius: 8px;
          background: var(--c-bg-2); color: var(--c-text);
          font-family: var(--font-body); font-size: 14px; outline: none;
          transition: border-color 0.2s;
        }
        .promo-newsletter-input:focus { border-color: var(--c-red); }
        .promo-newsletter-btn {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          padding: 13px 20px; background: var(--c-red); color: white;
          font-family: var(--font-head); font-size: 12px;
          font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          border: none; border-radius: 8px; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .promo-newsletter-btn:hover { background: #b8031c; transform: translateY(-1px); }
        .promo-newsletter-note {
          font-family: var(--font-body); font-size: 11px;
          color: var(--c-muted); margin: 6px 0 0; text-align: center;
        }
        .promo-subscribed {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--font-head); font-size: 15px; font-weight: 700;
          color: var(--c-red);
        }

        /* ── Focus ── */
        a:focus-visible, button:focus-visible, input:focus-visible {
          outline: 2px solid var(--c-red); outline-offset: 3px; border-radius: 4px;
        }
      `}</style>
    </AppLayout>
  );
}