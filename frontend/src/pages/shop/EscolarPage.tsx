import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import { useCartStore } from '../../store/cartStore';

const styles = `
  /* ── DESIGN TOKENS (mirrors ShopPage + HomePage) ── */
  .esc-root {
    --c-bg:       #ffffff;
    --c-bg-2:     #f7f7f7;
    --c-red:      #D90429;
    --c-red-soft: rgba(217,4,41,0.06);
    --c-red-mid:  rgba(217,4,41,0.18);
    --c-text:     #111111;
    --c-muted:    #888888;
    --c-muted-l:  #555555;
    --c-border:   #e4e4e4;
    --font-head:  'Manrope', sans-serif;
    --font-body:  'Manrope', sans-serif;
    --radius:     10px;

    font-family: var(--font-body);
    background:  var(--c-bg);
    color:       var(--c-text);
    min-height:  100vh;
  }

  /* ── HERO — white bg, red editorial accent ── */
  .esc-hero {
    background: var(--c-bg);
    border-bottom: 1px solid var(--c-border);
    padding: 5.5rem 2.5rem 4rem;
    position: relative;
    overflow: hidden;
  }

  /* subtle red glow top-right */
  .esc-hero::before {
    content: '';
    position: absolute;
    top: -80px;
    right: -100px;
    width: 520px;
    height: 520px;
    background: radial-gradient(circle, rgba(217,4,41,0.07) 0%, transparent 65%);
    pointer-events: none;
  }

  /* ghost watermark */
  .esc-hero::after {
    content: 'ESCOLAR';
    position: absolute;
    top: 50%;
    right: -1rem;
    transform: translateY(-50%);
    font-family: var(--font-head);
    font-size: clamp(5rem, 16vw, 13rem);
    font-weight: 800;
    color: rgba(217,4,41,0.04);
    white-space: nowrap;
    pointer-events: none;
    letter-spacing: -0.04em;
    line-height: 1;
    user-select: none;
  }

  .esc-hero-inner {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }

  .esc-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-head);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--c-red);
    margin-bottom: 1.5rem;
  }

  .esc-eyebrow-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-red);
    display: inline-block;
    animation: esc-pulse 2s ease infinite;
    box-shadow: 0 0 6px rgba(217,4,41,0.5);
  }

  @keyframes esc-pulse {
    0%,100% { opacity:.4; transform:scale(.85); }
    50%      { opacity:1;  transform:scale(1.2); }
  }

  .esc-hero h1 {
    font-family: var(--font-head);
    font-weight: 800;
    font-size: clamp(2.6rem, 6vw, 5rem);
    color: var(--c-text);
    margin: 0 0 1rem;
    line-height: 1.05;
    letter-spacing: -2px;
  }

  .esc-hero h1 em {
    font-style: normal;
    color: var(--c-red);
  }

  .esc-hero p {
    color: var(--c-muted-l);
    font-size: 15px;
    font-weight: 400;
    max-width: 500px;
    margin: 0 0 2rem;
    line-height: 1.8;
  }

  /* promo pill — replaces full red banner */
  .esc-promo-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    background: var(--c-red-soft);
    border: 1.5px solid var(--c-red-mid);
    color: var(--c-red);
    font-family: var(--font-head);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
    padding: 0.65rem 1.25rem;
    border-radius: 99px;
    margin-top: 1rem;
  }

  .esc-promo-pill .tag {
    background: var(--c-red);
    color: white;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 99px;
  }

  /* ── TRUST BAR (mirrors HomePage) ── */
  .esc-trust {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }

  .esc-trust-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--c-muted-l);
  }

  /* ── FILTER NAV (matches ShopPage pill style) ── */
  .esc-filters {
    background: var(--c-bg);
    border-bottom: 2px solid var(--c-red);
    padding: 0.85rem 2.5rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .esc-filters-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .esc-filter-btn {
    font-family: var(--font-head);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 0.45rem 1.1rem;
    border-radius: 99px;
    border: 1.5px solid var(--c-border);
    color: var(--c-muted-l);
    text-decoration: none;
    background: transparent;
    transition: all 0.18s ease;
    cursor: pointer;
  }

  .esc-filter-btn:hover,
  .esc-filter-btn.active {
    background: var(--c-red);
    border-color: var(--c-red);
    color: white;
  }

  /* ── CONTENT AREA ── */
  .esc-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem 2.5rem 5rem;
  }

  /* section label — same as ShopPage "shop-section-header" */
  .esc-section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 2rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--c-text);
  }

  .esc-section-title {
    font-family: var(--font-head);
    font-weight: 800;
    font-size: 1.25rem;
    color: var(--c-text);
    margin: 0;
    letter-spacing: -0.5px;
  }

  .esc-section-count {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--c-muted);
  }

  /* ── PRODUCT GRID ── */
  .esc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 1.25rem;
    margin-bottom: 4rem;
  }

  /* ── PRODUCT CARD (mirrors ShopPage prod-card) ── */
  .esc-card {
    background: var(--c-bg-2);
    border: 1.5px solid var(--c-border);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.25s, transform 0.3s, box-shadow 0.3s;
    cursor: pointer;
    animation: esc-fadeUp 0.4s both;
  }

  .esc-card:hover {
    border-color: var(--c-red-mid);
    transform: translateY(-5px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.08), 0 0 0 1px var(--c-red-mid);
  }

  @keyframes esc-fadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }

  .esc-card-img-wrap {
    position: relative;
    height: 200px;
    overflow: hidden;
    background: var(--c-bg);
  }

  .esc-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.5s cubic-bezier(0.22,1,0.36,1);
  }

  .esc-card:hover .esc-card-img {
    transform: scale(1.06);
  }

  /* quick-add overlay (mirrors prod-quick-add) */
  .esc-quick-add {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: rgba(217,4,41,0.92);
    backdrop-filter: blur(8px);
    padding: 12px;
    text-align: center;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
    z-index: 2;
  }

  .esc-card:hover .esc-quick-add {
    transform: translateY(0);
  }

  .esc-quick-add button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-family: var(--font-head);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    width: 100%;
  }

  .esc-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 3;
    font-family: var(--font-head);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 4px;
    color: white;
  }

  .esc-badge.sale { background: var(--c-red); }
  .esc-badge.new  { background: #059669; }

  .esc-card-info {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .esc-card-name {
    font-family: var(--font-head);
    font-weight: 700;
    font-size: 14px;
    color: var(--c-text);
    line-height: 1.35;
    margin: 0;
    flex: 1;
  }

  .esc-card-name a {
    color: inherit;
    text-decoration: none;
    transition: color 0.15s;
  }

  .esc-card-name a:hover { color: var(--c-red); }

  .esc-stars-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .esc-stars {
    display: flex;
    gap: 2px;
  }

  .esc-rating-count {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--c-muted);
  }

  .esc-desc {
    font-size: 12.5px;
    color: var(--c-muted-l);
    line-height: 1.65;
    margin: 0;
  }

  .esc-price-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-top: auto;
  }

  .esc-price {
    font-family: var(--font-head);
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--c-red);
    letter-spacing: -0.5px;
  }

  .esc-original {
    font-size: 0.85rem;
    color: var(--c-muted);
    text-decoration: line-through;
  }

  /* ── CTA BLOCK (mirrors shop-support) ── */
  .esc-cta {
    background: var(--c-bg-2);
    border: 1.5px solid var(--c-border);
    border-radius: 16px;
    padding: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .esc-cta h2 {
    font-family: var(--font-head);
    font-weight: 800;
    font-size: 1.3rem;
    color: var(--c-text);
    margin: 0 0 8px;
  }

  .esc-cta p {
    color: var(--c-muted-l);
    font-size: 13.5px;
    line-height: 1.7;
    margin: 0;
    max-width: 440px;
  }

  .esc-cta-btns {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .esc-btn-primary {
    font-family: var(--font-head);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 12px 24px;
    border-radius: var(--radius);
    background: var(--c-red);
    color: white;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }

  .esc-btn-primary:hover { background: #b8031c; transform: translateY(-1px); }

  .esc-btn-ghost {
    font-family: var(--font-head);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 12px 22px;
    border-radius: var(--radius);
    background: transparent;
    color: var(--c-muted-l);
    text-decoration: none;
    border: 1.5px solid var(--c-border);
    transition: border-color 0.2s, color 0.2s;
  }

  .esc-btn-ghost:hover { border-color: var(--c-red); color: var(--c-red); }

  /* ── TOAST ── */
  .esc-toast {
    position: fixed;
    bottom: 2rem;
    right: 1.5rem;
    background: var(--c-text);
    color: white;
    font-family: var(--font-head);
    font-size: 13px;
    font-weight: 600;
    padding: 12px 18px;
    border-radius: 8px;
    border: 1px solid rgba(217,4,41,0.35);
    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    pointer-events: none;
    transition: opacity 0.3s, transform 0.3s;
  }

  .esc-toast-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-red);
    flex-shrink: 0;
  }

  .esc-toast.hidden {
    opacity: 0;
    transform: translateX(12px);
  }

  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--c-red);
    outline-offset: 3px;
    border-radius: 4px;
  }

  @media (max-width: 600px) {
    .esc-hero { padding: 4rem 1.5rem 3rem; }
    .esc-container { padding: 2rem 1.5rem 4rem; }
    .esc-grid { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .esc-cta { flex-direction: column; }
  }
`;

export default function EscolarPage() {
	const [searchParams] = useSearchParams();
	const isPromo = searchParams.get('promo') === '1';
	const addItem = useCartStore(state => state.addItem);
	const [addedId, setAddedId] = useState<string | null>(null);
	const [showToast, setShowToast] = useState(false);
	const [toastName, setToastName] = useState('');

	const escolarProducts = [
		{
			id: 'escolar-1',
			name: 'Mochila Escolar Nike — 25L',
			price: 45.99,
			originalPrice: 59.99,
			badge: 'Sale',
			rating: 4.7,
			ratingCount: 156,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-1',
			description: 'Mochila escolar resistente com compartimentos organizados.'
		},
		{
			id: 'escolar-2',
			name: 'Estojo Escolar Completo Faber-Castell',
			price: 24.99,
			badge: 'Novo',
			rating: 4.8,
			ratingCount: 89,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-2',
			description: 'Estojo completo com canetas, lápis e acessórios escolares.'
		},
		{
			id: 'escolar-3',
			name: 'Caderno Oxford A4 Pautado — 200 Fls',
			price: 5.49,
			rating: 4.6,
			ratingCount: 312,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-3',
			description: 'Caderno de qualidade premium para estudantes.'
		},
		{
			id: 'escolar-4',
			name: 'Calculadora Científica Casio FX-991EX',
			price: 39.99,
			originalPrice: 49.99,
			badge: 'Sale',
			rating: 4.9,
			ratingCount: 203,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-4',
			description: 'Calculadora científica avançada para matemática e ciências.'
		},
		{
			id: 'escolar-5',
			name: 'Lápis de Cor Faber-Castell — 24 cores',
			price: 18.99,
			rating: 4.7,
			ratingCount: 145,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-5',
			description: 'Lápis de cor profissionais para arte e educação.'
		},
		{
			id: 'escolar-6',
			name: 'Agenda Escolar 2024-2025',
			price: 12.99,
			badge: 'Novo',
			rating: 4.5,
			ratingCount: 78,
			image: '/api/placeholder/300/300',
			to: '/shop/product/escolar-6',
			description: 'Agenda escolar organizada com calendário e espaços para notas.'
		}
	];

	const handleAddToCart = (product: any) => {
		addItem({
			id: product.id,
			name: product.name,
			price: product.price,
			originalPrice: product.originalPrice,
			image: product.image,
			to: product.to
		});
		setAddedId(product.id);
		setToastName(product.name.split('—')[0].trim());
		setShowToast(true);
		setTimeout(() => setAddedId(null), 1400);
		setTimeout(() => setShowToast(false), 2400);
	};

	return (
		<AppLayout
			title={isPromo ? "Material Escolar em Promoção" : "Material Escolar"}
			description={isPromo ? "Até 40% de desconto em material escolar para o regresso às aulas." : "Material escolar de qualidade para estudantes de todos os níveis."}
			canonical="/shop/escolar"
		>
			<style>{styles}</style>

			<div className="esc-root">

				{/* ── HERO ── */}
				<section className="esc-hero">
					<div className="esc-hero-inner">
						<div className="esc-eyebrow">
							<span className="esc-eyebrow-dot" aria-hidden />
							{isPromo ? 'Regresso às Aulas · Promoção' : 'Material Escolar · Coleção Completa'}
						</div>

						<h1>
							{isPromo
								? <><em>Promoções</em><br />Regresso às Aulas</>
								: <>Material<br /><em>Escolar</em></>
							}
						</h1>

						<p>
							{isPromo
								? 'Até 40% de desconto em material escolar para o regresso às aulas. Prepare-se para o novo ano letivo.'
								: 'Tudo o que precisa para o sucesso escolar: mochilas, cadernos, material de escrita e acessórios.'
							}
						</p>

						{/* trust items */}
						<div className="esc-trust">
							{[
								{ icon: 'M9 12l2 2 4-4', label: 'Devoluções em 30 dias' },
								{ icon: 'M5 12h14M12 5l7 7-7 7', label: 'Portes grátis acima de 35€' },
								{ icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', label: '98% satisfação' },
							].map(({ icon, label }) => (
								<div key={label} className="esc-trust-item">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
										<path d={icon} />
									</svg>
									<span>{label}</span>
								</div>
							))}
						</div>

						{isPromo && (
							<div className="esc-promo-pill">
								<span className="tag">Oferta</span>
								Descontos até 40% + Entrega gratuita acima de 39€
							</div>
						)}
					</div>
				</section>

				{/* ── FILTERS ── */}
				<nav className="esc-filters" aria-label="Filtros de categoria">
					<div className="esc-filters-inner">
						<Link to="/shop/escolar" className={`esc-filter-btn ${!isPromo ? 'active' : ''}`}>
							Todos
						</Link>
						<Link to="/shop/escolar?promo=1" className={`esc-filter-btn ${isPromo ? 'active' : ''}`}>
							Promoção
						</Link>
						<Link to="/shop/escolar?category=mochilas" className="esc-filter-btn">Mochilas</Link>
						<Link to="/shop/escolar?category=material-escrita" className="esc-filter-btn">Escrita</Link>
						<Link to="/shop/escolar?category=acessorios" className="esc-filter-btn">Acessórios</Link>
					</div>
				</nav>

				{/* ── PRODUCTS ── */}
				<div className="esc-container">

					<div className="esc-section-header">
						<h2 className="esc-section-title">Produtos</h2>
						<span className="esc-section-count">{escolarProducts.length} referências</span>
					</div>

					<div className="esc-grid">
						{escolarProducts.map((product, i) => (
							<div
								key={product.id}
								className="esc-card"
								style={{ animationDelay: `${i * 60}ms` }}
							>
								{/* image + overlay */}
								<div className="esc-card-img-wrap">
									<img
										src={product.image}
										alt={product.name}
										className="esc-card-img"
									/>
									{product.badge && (
										<span className={`esc-badge ${product.badge === 'Sale' ? 'sale' : 'new'}`}>
											{product.badge}
										</span>
									)}
									<div className="esc-quick-add">
										<button onClick={() => handleAddToCart(product)}>
											{addedId === product.id ? '✓ Adicionado' : '+ Adicionar ao Carrinho'}
										</button>
									</div>
								</div>

								{/* info */}
								<div className="esc-card-info">
									<p className="esc-card-name">
										<Link to={`/shop/product/${product.id}`}>{product.name}</Link>
									</p>

									<div className="esc-stars-row" aria-label={`${product.rating} de 5 — ${product.ratingCount} avaliações`}>
										<div className="esc-stars" aria-hidden>
											{[1,2,3,4,5].map(i => (
												<svg key={i} width="10" height="10" viewBox="0 0 24 24"
													fill={i <= Math.round(product.rating) ? '#D90429' : 'none'}
													stroke="#D90429" strokeWidth="2">
													<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
												</svg>
											))}
										</div>
										<span className="esc-rating-count">({product.ratingCount})</span>
									</div>

									<p className="esc-desc">{product.description}</p>

									<div className="esc-price-row">
										<span className="esc-price">{product.price.toFixed(2).replace('.', ',')}€</span>
										{product.originalPrice && (
											<span className="esc-original">{product.originalPrice.toFixed(2).replace('.', ',')}€</span>
										)}
									</div>
								</div>
							</div>
						))}
					</div>

					{/* ── CTA ── */}
					<div className="esc-cta">
						<div>
							<h2>Precisa de Ajuda para Escolher?</h2>
							<p>Os nossos especialistas estão disponíveis para ajudar a escolher o material escolar ideal para si.</p>
						</div>
						<div className="esc-cta-btns">
							<Link to="/contact" className="esc-btn-primary">Fale Connosco</Link>
							<Link to="/faq" className="esc-btn-ghost">Perguntas Frequentes</Link>
						</div>
					</div>
				</div>

				{/* ── TOAST ── */}
				<div className={`esc-toast ${showToast ? '' : 'hidden'}`} role="status" aria-live="polite">
					<span className="esc-toast-dot" aria-hidden />
					{toastName} adicionado ao carrinho
				</div>
			</div>
		</AppLayout>
	);
}