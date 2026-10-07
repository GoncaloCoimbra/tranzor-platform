import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import ProductFilters, { FilterState } from '../../components/shop/ProductFilters';

/* ─────────────────────────────────────────
   DADOS MOCK
   ───────────────────────────────────────── */
const MOCK_RESULTS = [
  { id: 1,  name: 'Caderno A4 Pautado',       category: 'Escolar',     price: 3.50,  badge: null,        brand: 'Oxford'   },
  { id: 2,  name: 'Caneta Esferográfica',      category: 'Escrita',     price: 1.20,  badge: 'Destaque',  brand: 'BIC'      },
  { id: 3,  name: 'Pasta Arquivo',             category: 'Organização', price: 6.90,  badge: null,        brand: 'Leitz'    },
  { id: 4,  name: 'Marcadores de Texto',       category: 'Escrita',     price: 4.80,  badge: 'Novo',      brand: 'Stabilo'  },
  { id: 5,  name: 'Bloco de Notas',            category: 'Escolar',     price: 2.30,  badge: null,        brand: 'Oxford'   },
  { id: 6,  name: 'Calculadora Científica',    category: 'Escolar',     price: 19.90, badge: null,        brand: 'Casio'    },
  { id: 7,  name: 'Impressora Laser A4',       category: 'Informática', price: 149.0, badge: 'Destaque',  brand: 'HP'       },
  { id: 8,  name: 'Caneta Gel Premium',        category: 'Escrita',     price: 3.99,  badge: null,        brand: 'Pilot'    },
  { id: 9,  name: 'Agenda 2025',               category: 'Escritório',  price: 14.99, badge: 'Sale',      brand: 'Leitz'    },
  { id: 10, name: 'Papel A4 Navigator 500fls', category: 'Escritório',  price: 7.99,  badge: null,        brand: 'Navigator'},
];

/* ─────────────────────────────────────────
   INFERIR CATEGORIA A PARTIR DO QUERY
   Para alimentar ProductFilters com contexto
   ───────────────────────────────────────── */
function inferCategory(q: string): string | undefined {
  const lower = q.toLowerCase();
  if (/calculadora|casio|texas/.test(lower)) return 'escolar';
  if (/caneta|gel|esfer|bic|pilot|stabilo/.test(lower)) return 'escritorio';
  if (/caderno|bloco|notas|oxford/.test(lower)) return 'escolar';
  if (/impressora|laser|jacto|epson|hp/.test(lower)) return 'informatica';
  if (/lápis|pincel|tinta|aguarela|arte/.test(lower)) return 'artes';
  if (/móvel|movel|cadeira|secretária|mesa/.test(lower)) return 'mobiliario';
  return undefined;
}

/* ─────────────────────────────────────────
   SORT OPTIONS
   ───────────────────────────────────────── */
type SortKey = 'relevancia' | 'preco-asc' | 'preco-desc' | 'novo';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia',  label: 'Relevância' },
  { value: 'preco-asc',  label: 'Preço ↑' },
  { value: 'preco-desc', label: 'Preço ↓' },
  { value: 'novo',       label: 'Novidades' },
];

/* ─────────────────────────────────────────
   PÁGINA
   ───────────────────────────────────────── */
export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [catFilter,  setCatFilter]  = useState('Todos');
  const [sortKey,    setSortKey]    = useState<SortKey>('relevancia');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);

  const categories = useMemo(
    () => ['Todos', ...Array.from(new Set(MOCK_RESULTS.map(r => r.category)))],
    [],
  );

  /* Contagem de filtros de produto activos (excluindo range de preço) */
  const productFilterCount = useMemo(() => {
    if (!activeFilters) return 0;
    return Object.entries(activeFilters).reduce((acc, [k, v]) =>
      acc + (Array.isArray(v) ? v.length : 0), 0);
  }, [activeFilters]);

  const filtered = useMemo(() => {
    let list = catFilter === 'Todos'
      ? MOCK_RESULTS
      : MOCK_RESULTS.filter(r => r.category === catFilter);

    // Filtro de preço do ProductFilters
    if (activeFilters?.price) {
      const [lo, hi] = activeFilters.price as [number, number];
      list = list.filter(r => r.price >= lo && r.price <= hi);
    }

    // Ordenação
    if (sortKey === 'preco-asc')  list = [...list].sort((a, b) => a.price - b.price);
    if (sortKey === 'preco-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sortKey === 'novo')       list = [...list].filter(r => r.badge === 'Novo').concat(list.filter(r => r.badge !== 'Novo'));

    return list;
  }, [catFilter, sortKey, activeFilters]);

  const inferredCat = inferCategory(query);

  return (
    <AppLayout
      title={query ? `"${query}" — Pesquisa Tranzor` : 'Pesquisa Tranzornzor'}
      description="Resultados da sua pesquisa na loja Tranzor."
    >
      {/* ── HERO ── */}
      <section style={s.hero}>
        {/* Grid de fundo */}
        <div aria-hidden style={s.heroGrid} />
        <div style={s.heroInner}>
          <span style={s.heroLabel}>— Pesquisa</span>
          <h1 style={s.heroTitle}>
            {query
              ? <>Resultados para{' '}<span style={{ color: '#D90429' }}>"{query}"</span></>
              : <>Resultados da <span style={{ color: '#D90429' }}>Pesquisa</span></>
            }
          </h1>
          <p style={s.heroSub}>
            {filtered.length} {filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
            {productFilterCount > 0 && (
              <span style={s.filterSummary}> · {productFilterCount} filtro{productFilterCount > 1 ? 's' : ''} activo{productFilterCount > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </section>

      {/* ── RESULTADOS ── */}
      <section style={s.body}>
        <div style={s.bodyInner}>

          {/* ─ Barra de controlo ─ */}
          <div style={s.controlBar}>
            {/* Pills de categoria */}
            <div style={s.catPills} role="group" aria-label="Filtrar por categoria">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  style={{
                    ...s.pill,
                    ...(catFilter === cat ? s.pillActive : {}),
                  }}
                  aria-pressed={catFilter === cat}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Ordenação + toggle de filtros */}
            <div style={s.controlRight}>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                style={s.sortSelect}
                aria-label="Ordenar por"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <button
                onClick={() => setFiltersOpen(p => !p)}
                style={s.filterToggleBtn}
                aria-expanded={filtersOpen}
                aria-controls="product-filters-panel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
                </svg>
                Filtros
                {productFilterCount > 0 && (
                  <span style={s.filterToggleBadge}>{productFilterCount}</span>
                )}
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden
                  style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  <path d="M4 6l4 4 4-4"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ─ Painel de filtros compacto (collapsible) ─ */}
          {filtersOpen && (
            <div id="product-filters-panel" style={s.filtersPanel}>
              <ProductFilters
                compact
                category={inferredCat}
                onChange={setActiveFilters}
              />
            </div>
          )}

          {/* ─ Grid de produtos ─ */}
          {filtered.length === 0 ? (
            <div style={s.empty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" style={{ marginBottom: 16 }} aria-hidden>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Nenhum resultado</p>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Tente ajustar os filtros ou pesquisar por outros termos.</p>
              <button
                onClick={() => { setCatFilter('Todos'); setActiveFilters(null); }}
                style={s.clearAllBtn}
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <div style={s.grid}>
              {filtered.map((p, i) => (
                <Link key={p.id} to={`/shop/product/${p.id}`} style={s.cardLink}>
                  <article
                    style={s.card}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.boxShadow = '0 8px 28px rgba(0,0,0,.1)';
                      el.style.transform = 'translateY(-3px)';
                      el.style.borderColor = 'rgba(217,4,41,.2)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.boxShadow = 'none';
                      el.style.transform = 'none';
                      el.style.borderColor = 'rgba(0,0,0,.08)';
                    }}
                  >
                    {/* Imagem placeholder */}
                    <div style={{ ...s.cardImg, animationDelay: `${i * 40}ms` }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" aria-hidden>
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                      {p.badge && (
                        <span style={{
                          ...s.badge,
                          background: p.badge === 'Sale' ? '#D90429' : p.badge === 'Novo' ? '#059669' : '#D90429',
                        }}>{p.badge}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={s.cardBody}>
                      <div style={s.cardMeta}>
                        <span style={s.cardCat}>{p.category}</span>
                        <span style={s.cardBrand}>{p.brand}</span>
                      </div>
                      <p style={s.cardName}>{p.name}</p>
                      <div style={s.cardFooter}>
                        <p style={s.cardPrice}>€{p.price.toFixed(2).replace('.', ',')}</p>
                        <button
                          onClick={e => { e.preventDefault(); /* addToCart(p.id) */ }}
                          style={s.addBtn}
                          aria-label={`Adicionar ${p.name} ao carrinho`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}

          {/* ── Sugestões se houver resultados ── */}
          {filtered.length > 0 && (
            <div style={s.suggestions}>
              <span style={s.suggestionsLabel}>Procuras algo mais específico?</span>
              {['Canetas Gel', 'Cadernos A5', 'Impressoras Laser', 'Lápis de Cor'].map(term => (
                <Link key={term} to={`/search?q=${encodeURIComponent(term)}`} style={s.suggestionLink}>
                  {term}
                </Link>
              ))}
            </div>
          )}

        </div>
      </section>

      <style>{`        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .card-anim { animation: fadeUp .3s both; }
      `}</style>
    </AppLayout>
  );
}

/* ─────────────────────────────────────────
   ESTILOS (objeto tipado)
   ───────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  hero: {
    position: 'relative', padding: '6rem 2rem 3.5rem',
    borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
  },
  heroGrid: {
    position: 'absolute', inset: 0,
    backgroundImage: `linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)`,
    backgroundSize: '72px 72px',
  },
  heroInner: { maxWidth: 900, margin: '0 auto', position: 'relative' },
  heroLabel: {
    display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: 2,
    textTransform: 'uppercase', color: 'var(--red)', marginBottom: '1rem',
    fontFamily: "'Manrope', sans-serif",
  },
  heroTitle: {
    fontFamily: "'Manrope', sans-serif", fontWeight: 800,
    fontSize: 'clamp(1.8rem,4vw,3rem)', lineHeight: 1.1,
    color: 'var(--text)', letterSpacing: -0.5, marginBottom: '.75rem',
  },
  heroSub: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, fontFamily: "'Manrope', sans-serif" },
  filterSummary: { color: 'var(--red)', fontWeight: 600 },

  body: { background: 'var(--bg)', padding: '2.5rem 2rem 5rem' },
  bodyInner: { maxWidth: 1200, margin: '0 auto' },

  /* Barra de controlo */
  controlBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap', marginBottom: '1rem',
  },
  catPills: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: {
    padding: '7px 15px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
    fontFamily: "'Manrope', sans-serif", transition: 'all .15s',
  },
  pillActive: { background: 'var(--red)', color: '#fff', border: '1px solid var(--red)' },
  controlRight: { display: 'flex', alignItems: 'center', gap: 8 },
  sortSelect: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: "'Manrope', sans-serif",
    fontWeight: 600, cursor: 'pointer', outline: 'none',
  },
  filterToggleBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    border: '1.5px solid var(--red-border)', background: 'var(--red-muted)',
    color: 'var(--red)', fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
    cursor: 'pointer', transition: 'background .15s',
  },
  filterToggleBadge: {
    background: 'var(--red)', color: '#fff',
    fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 10,
    padding: '1px 5px', borderRadius: 99,
  },

  /* Painel de filtros */
  filtersPanel: {
    marginBottom: '1.5rem',
    animation: 'fadeUp .2s ease',
  },

  /* Grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '1.1rem',
  },
  cardLink: { textDecoration: 'none' },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden',
    transition: 'box-shadow .2s, transform .2s, border-color .2s',
  },
  cardImg: {
    height: 140, background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: 10, left: 10, color: '#fff',
    fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 99,
    fontFamily: "'Manrope', sans-serif", letterSpacing: 1, textTransform: 'uppercase',
  },
  cardBody: { padding: '0.875rem' },
  cardMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  cardCat: {
    fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: 0.5, fontFamily: "'Manrope', sans-serif",
  },
  cardBrand: {
    fontSize: 10, color: 'var(--red)', fontWeight: 700, fontFamily: "'Manrope', sans-serif",
  },
  cardName: { fontWeight: 700, fontSize: 13, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.4, fontFamily: "'Manrope', sans-serif" },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 16, fontWeight: 800, color: 'var(--red)', fontFamily: "'Manrope', sans-serif" },
  addBtn: {
    width: 30, height: 30, borderRadius: 8,
    background: 'var(--red-muted)', border: '1px solid var(--red-border)',
    color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background .15s',
    flexShrink: 0,
  },

  /* Empty */
  empty: {
    textAlign: 'center', padding: '4rem 2rem',
    background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
  },
  clearAllBtn: {
    padding: '10px 22px', background: 'var(--red)', color: '#fff', border: 'none',
    borderRadius: 8, fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', transition: 'background .15s',
  },

  /* Sugestões */
  suggestions: {
    marginTop: '2rem', paddingTop: '1.5rem',
    borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
  },
  suggestionsLabel: {
    fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Manrope', sans-serif",
    marginRight: 4,
  },
  suggestionLink: {
    padding: '5px 12px', borderRadius: 99, fontSize: 12, fontFamily: "'Manrope', sans-serif",
    fontWeight: 600, color: 'var(--text)', textDecoration: 'none',
    background: 'var(--surface)', border: '1px solid var(--border)',
    transition: 'border-color .15s, color .15s',
  },
};