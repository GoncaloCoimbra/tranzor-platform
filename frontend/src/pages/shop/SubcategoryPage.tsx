import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';
import ProductFilters, { FilterState } from '../../components/shop/ProductFilters';

// --- Mock de produtos (igual) ---
interface Product {
  id: number;
  name: string;
  price: string;
  priceNum: number;
  badge?: string;
  brand?: string;
  category?: string;
}

const ALL_PRODUCTS: Product[] = [
  { id: 1, name: 'Caneta Pilot G2', price: '12,99€', priceNum: 12.99, badge: 'Sale', brand: 'pilot', category: 'canetas' },
  { id: 2, name: 'Caderno Oxford A4', price: '5,49€', priceNum: 5.49, badge: '', brand: 'oxford', category: 'cadernos' },
  { id: 3, name: 'Marcador Stabilo', price: '8,29€', priceNum: 8.29, badge: 'Novo', brand: 'stabilo', category: 'marcadores' },
  { id: 4, name: 'Lápis Faber-Castell', price: '3,99€', priceNum: 3.99, badge: '', brand: 'faber', category: 'lapis' },
  { id: 5, name: 'Calculadora Casio FX', price: '24,90€', priceNum: 24.9, badge: 'Destaque', brand: 'casio', category: 'calculadoras' },
  { id: 6, name: 'Tinteiro HP', price: '19,99€', priceNum: 19.99, badge: '', brand: 'hp', category: 'impressoras' },
  { id: 7, name: 'Agenda 2025', price: '14,99€', priceNum: 14.99, badge: 'Promo', brand: 'clairef', category: 'cadernos' },
  { id: 8, name: 'Pincel Sintético', price: '2,50€', priceNum: 2.5, badge: '', brand: 'pentel', category: 'pinceis' },
  { id: 9, name: 'Puzzle 1000 peças', price: '18,90€', priceNum: 18.9, badge: '', brand: '', category: 'puzzles' },
  { id: 10, name: 'Cadeira Ergonómica', price: '249,00€', priceNum: 249, badge: '', brand: 'leitz', category: 'mobiliario' },
];

function normalizeFilterValue(value?: string): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}


const CATEGORY_PRODUCT_KEYS: Record<string, string[]> = {
  artes: ['pintura', 'telas', 'pinceis', 'lapis', 'marcadores', 'canetas'],
  escolar: ['cadernos', 'canetas', 'lapis', 'calculadoras', 'marcadores'],
  escritorio: ['canetas', 'papel', 'impressoras', 'calculadoras', 'mobiliario'],
  informatica: ['impressoras', 'armazenamento'],
  tecnologia: ['impressoras', 'armazenamento'],
  mobiliario: ['mobiliario'],
  gifts: ['canetas', 'cadernos'],
  higiene: ['higiene'],
  industria: ['industria', 'epi'],
  jogos: ['puzzles', 'jogos'],
};

const PRODUCT_CATEGORY_MAPPING: Record<string, string> = {
  caneta: 'canetas',
  canetas: 'canetas',
  'canetas-de-ponta-fina': 'canetas',
  'canetas-de-esferografica': 'canetas',
  'canetas-de-gel': 'canetas',
  'canetas-de-luxo': 'canetas',
  'canetas-e-escrita': 'canetas',
  'conjuntos-de-escrita': 'canetas',
  caderno: 'cadernos',
  cadernos: 'cadernos',
  'cadernos-a4': 'cadernos',
  'cadernos-a5': 'cadernos',
  'cadernos-e-blocos': 'cadernos',
  'cadernos-premium': 'cadernos',
  diarios: 'cadernos',
  'diarios-e-cadernos': 'cadernos',
  'bullet-journals': 'cadernos',
  bloco: 'cadernos',
  'blocos-de-notas': 'cadernos',
  nota: 'cadernos',
  'post-it-e-notas-adesivas': 'cadernos',
  agendas: 'cadernos',
  planners: 'cadernos',
  'calendarios-e-agendas': 'cadernos',
  'calendarios-de-parede': 'cadernos',
  lapis: 'lapis',
  'lapis-de-cor': 'lapis',
  'lapis-de-grafite': 'lapis',
  grafite: 'lapis',
  'carvao-e-sanguinea': 'lapis',
  pasteis: 'lapis',
  'desenhar-e-colorir': 'lapis',
  pincel: 'pinceis',
  pinceis: 'pinceis',
  'pinceis-e-acessorios': 'pinceis',
  'pinceis-sinteticos': 'pinceis',
  'pinceis-de-pelo': 'pinceis',
  'kits-de-arte': 'pinceis',
  'acessorios-de-atelier': 'pinceis',
  marcador: 'marcadores',
  marcadores: 'marcadores',
  aguarela: 'pintura',
  acrilica: 'pintura',
  oleo: 'pintura',
  pintura: 'pintura',
  guache: 'pintura',
  'guache-e-tempera': 'pintura',
  auxiliares: 'pintura',
  tela: 'telas',
  telas: 'telas',
  'telas-de-algodao': 'telas',
  'telas-de-linho': 'telas',
  chassis: 'telas',
  paletes: 'pintura',
  calculadora: 'calculadoras',
  calculadoras: 'calculadoras',
  cientificas: 'calculadoras',
  basicas: 'calculadoras',
  graficas: 'calculadoras',
  impressora: 'impressoras',
  impressoras: 'impressoras',
  'impressoras-jacto-de-tinta': 'impressoras',
  'impressoras-laser': 'impressoras',
  'impressoras-multifuncoes': 'impressoras',
  impressao: 'impressoras',
  'consumiveis-de-impressao': 'impressoras',
  plotters: 'impressoras',
  tinteiros: 'impressoras',
  toners: 'impressoras',
  'fitas-e-etiquetas': 'impressoras',
  papel: 'papel',
  'papel-a4': 'papel',
  'papel-fotografico': 'papel',
  'papel-reciclado': 'papel',
  'papel-de-cor': 'papel',
  'papel-tissue': 'higiene',
  'lencos-de-papel': 'higiene',
  guardanapos: 'higiene',
  'papel-higienico': 'higiene',
  'rolo-de-cozinha': 'higiene',
  'sabao-liquido': 'higiene',
  desinfetantes: 'higiene',
  'sacos-de-lixo': 'higiene',
  'contentores-de-reciclagem': 'higiene',
  armazenamento: 'armazenamento',
  'pens-usb': 'armazenamento',
  'discos-externos': 'armazenamento',
  'cartoes-de-memoria': 'armazenamento',
  'perifericos-e-acessorios': 'armazenamento',
  som: 'armazenamento',
  auriculares: 'armazenamento',
  colunas: 'armazenamento',
  microfones: 'armazenamento',
  headsets: 'armazenamento',
  webcams: 'armazenamento',
  ratos: 'armazenamento',
  teclados: 'armazenamento',
  scanners: 'armazenamento',
  mobiliario: 'mobiliario',
  cadeira: 'mobiliario',
  'cadeiras-de-escritorio': 'mobiliario',
  secretarias: 'mobiliario',
  'secretarias-retas': 'mobiliario',
  'secretarias-em-l': 'mobiliario',
  'secretarias-elevatorias': 'mobiliario',
  'armarios-e-gavetas': 'mobiliario',
  'armarios-de-madeira': 'mobiliario',
  'armarios-metalicos': 'mobiliario',
  gaveteiros: 'mobiliario',
  'mesas-de-reuniao': 'mobiliario',
  dossiers: 'mobiliario',
  'caixas-de-arquivo': 'mobiliario',
  separadores: 'mobiliario',
  'pastas-suspensas': 'mobiliario',
  'caixas-organizadoras': 'mobiliario',
  'suportes-de-monitor': 'mobiliario',
  pranchetas: 'mobiliario',
  agrafadores: 'mobiliario',
  furadoras: 'mobiliario',
  guilhotinas: 'mobiliario',
  tesouras: 'mobiliario',
  estojos: 'mobiliario',
  'porta-documentos': 'mobiliario',
  mochilas: 'mobiliario',
  'malas-e-trolleys': 'mobiliario',
  'capas-de-transporte': 'mobiliario',
  'reguas-e-esquadros': 'mobiliario',
  'home-office': 'mobiliario',
  ergonomicas: 'mobiliario',
  executivas: 'mobiliario',
  operacionais: 'mobiliario',
  visitante: 'mobiliario',
  organizacao: 'mobiliario',
  'arquivamento': 'mobiliario',
  'fixacao-e-corte': 'mobiliario',
  'transportar-e-guardar': 'mobiliario',
  'corte': 'mobiliario',
  'bisturis-e-x-atos': 'mobiliario',
  'bases-de-corte': 'mobiliario',
  'cavaletes-de-chao': 'pinceis',
  'cavaletes-e-atelier': 'pinceis',
  'conjuntos': 'lapis',
  'conjuntos-personalizaveis': 'cadernos',
  'brinquedos-educativos': 'jogos',
  matematica: 'jogos',
  ciencias: 'jogos',
  linguas: 'jogos',
  musica: 'jogos',
  puzzles: 'puzzles',
  '500-pecas': 'puzzles',
  '1000-pecas': 'puzzles',
  '3d': 'puzzles',
  infantis: 'puzzles',
  apontadores: 'canetas',
  borrachas: 'canetas',
  cofres: 'mobiliario',
  corretores: 'canetas',
  escrita: 'canetas',
  'escrita-e-correcao': 'canetas',
  'esferograficas-premium': 'canetas',
  'kits-de-escrita': 'canetas',
  'kits-e-conjuntos': 'cadernos',
  modulares: 'mobiliario',
  redondas: 'mobiliario',
  retangulares: 'mobiliario',
};

function resolveProductCategoryFromText(value?: string): string | undefined {
  const text = normalizeFilterValue(value);
  if (!text) return undefined;

  if (PRODUCT_CATEGORY_MAPPING[text]) return PRODUCT_CATEGORY_MAPPING[text];

  const aliasMapping: Array<[RegExp, string]> = [
    [/(?:\b|^)(?:caneta|canetas|esferografica|gel|fineliner|rollerball|fonte|marcador|brushpen|pincel|luxo)(?:\b|$)/, 'canetas'],
    [/(?:\b|^)(?:caderno|bloco|nota|diario|bullet|agenda)(?:\b|$)/, 'cadernos'],
    [/(?:\b|^)(?:lapis|grafite|carvao|pastel|desenho|ilustracao)(?:\b|$)/, 'lapis'],
    [/(?:\b|^)(?:marcador|marcadores)(?:\b|$)/, 'marcadores'],
    [/(?:\b|^)(?:pintura|acrilica|aguarela|oleo|guache|tinta)(?:\b|$)/, 'pintura'],
    [/(?:\b|^)(?:tela|telas|chassis)(?:\b|$)/, 'telas'],
    [/(?:\b|^)(?:desinfetante|spray|sprays|sabao|sabonete|higiene|len[cç]o|guardanapos|rolo-de-cozinha|sacos|contentores|papeleira|papeleiras)(?:\b|$)/, 'higiene'],
    [/(?:\b|^)(?:papel|postit|notas?|tissue)(?:\b|$)/, 'papel'],
    [/(?:\b|^)(?:calculadora|calculadoras)(?:\b|$)/, 'calculadoras'],
    [/(?:\b|^)(?:impressora|impressoras|plotter|tinteiro|toner)(?:\b|$)/, 'impressoras'],
    [/(?:\b|^)(?:armazenamento|pens|usb|cartao|disco|discos)(?:\b|$)/, 'armazenamento'],
    [/(?:\b|^)(?:cadeira|cadeiras|secretaria|secretarias|mesa|mesas|armario|armarios|gaveta|gavetas|mobiliario)(?:\b|$)/, 'mobiliario'],
    [/(?:\b|^)(?:epi|protecao|luva|luvas|mascara|mascaras|oculos|capacete|capacetes|vestuario)(?:\b|$)/, 'epi'],
    [/(?:\b|^)(?:embalagem|fita|fitas|sinalizacao|placa|placas|cones|barreiras|polietileno|filme)(?:\b|$)/, 'industria'],
    [/(?:\b|^)(?:jogo|brinquedo|puzzle|classico|classicos|cooperativo|cooperativos|familia|cartas)(?:\b|$)/, 'jogos'],
    [/(?:\b|^)(?:500-pecas|1000-pecas|3d|infantis)(?:\b|$)/, 'puzzles'],
  ];

  for (const [pattern, mapped] of aliasMapping) {
    if (pattern.test(text)) return mapped;
  }

  return undefined;
}

function filterProducts(products: Product[], filters: FilterState, categorySlug?: string, sub?: string, type?: string): Product[] {
  let filtered = [...products];
  const [minPrice, maxPrice] = filters.price;
  filtered = filtered.filter(p => p.priceNum >= minPrice && p.priceNum <= maxPrice);

  const matchingCategories = categorySlug ? CATEGORY_PRODUCT_KEYS[categorySlug.toLowerCase()] : undefined;
  if (matchingCategories) {
    filtered = filtered.filter(p => matchingCategories.includes(p.category ?? ''));
  }

  const subTypeCategory = resolveProductCategoryFromText(type) ?? resolveProductCategoryFromText(sub);
  if (subTypeCategory) {
    if (matchingCategories && !matchingCategories.includes(subTypeCategory)) {
      return [];
    }
    filtered = filtered.filter(p => p.category === subTypeCategory);
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'price' || !Array.isArray(value) || value.length === 0) continue;
    if (key === 'marca') {
      const selectedBrands = value as string[];
      filtered = filtered.filter(p => p.brand && selectedBrands.includes(p.brand));
    }
    if (key === 'tipo') {
      const selectedTypes = value as string[];
      filtered = filtered.filter(p => p.category && selectedTypes.includes(p.category));
    }
  }
  return filtered;
}

export default function SubcategoryPage() {
  const { t } = useTranslation();
  const { subcategory } = useParams<{ subcategory?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const categorySlug = subcategory;
  const sub = searchParams.get('sub') || undefined;
  const type = searchParams.get('type') || undefined;

  // Inicializar filtros a partir da URL de forma segura (sem erros de tipo)
  const getInitialFilters = (): FilterState => {
    const initial: FilterState = { price: [0, 500] };
    const priceMin = searchParams.get('price_min');
    const priceMax = searchParams.get('price_max');
    if (priceMin && priceMax) {
      initial.price = [Number(priceMin), Number(priceMax)];
    }

    // Percorrer todos os parâmetros e preencher os filtros (exceto os reservados)
    for (const [key, value] of searchParams.entries()) {
      if (key === 'sub' || key === 'type' || key === 'price_min' || key === 'price_max' || key === 'page' || key === 'sort') {
        continue;
      }
      // Se o valor contiver vírgulas, assume-se que é uma lista de valores
      if (value.includes(',')) {
        (initial as any)[key] = value.split(',');
      } else {
        (initial as any)[key] = [value];
      }
    }
    return initial;
  };

  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(ALL_PRODUCTS);
  const [loading, setLoading] = useState(false);

  const updateFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Sincronizar URL e filtrar produtos
  useEffect(() => {
    const params = new URLSearchParams();
    if (sub) params.set('sub', sub);
    if (type) params.set('type', type);

    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'price') {
        const [min, max] = value as [number, number];
        params.set('price_min', String(min));
        params.set('price_max', String(max));
      } else if (Array.isArray(value) && value.length > 0) {
        params.set(key, (value as string[]).join(','));
      }
    });

    setSearchParams(params, { replace: true });

    setLoading(true);
    const timeout = setTimeout(() => {
      const results = filterProducts(ALL_PRODUCTS, filters, categorySlug, sub, type);
      setFilteredProducts(results);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters, sub, type, setSearchParams]);

  const categoryLabelMap: Record<string, string> = {
    artes: t('shop.categoryPages.artes.heroTitle'),
    escolar: t('shop.categoryPages.escolar.heroTitle'),
    escritorio: t('shop.categoryPages.escritorio.heroTitle'),
    tecnologia: t('shop.categoryPages.tecnologia.heroTitle'),
    mobiliario: t('shop.categoryPages.mobiliario.heroTitle'),
    gifts: t('navbar.gifts'),
    higiene: t('navbar.hygiene'),
    industria: t('navbar.industry'),
    informatica: t('navbar.technology'),
    jogos: t('navbar.toys'),
  };

  const label = subcategory
    ? (categoryLabelMap[subcategory] ?? subcategory.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    : t('shop.shopFilters.subcategories');

  const pageTitle = sub ? `${sub} – ${label}` : label;
  const canonicalUrl = subcategory ? `/shop/category/${subcategory}` : '/shop';
  const pageDescription = t('shop.categoryPage.description', { label: label.toLowerCase() });
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: pageDescription,
    url: `${window.location.origin}${canonicalUrl}`,
  };

  return (
    <AppLayout
      title={`${pageTitle} — Tranzor`}
      description={pageDescription}
      canonical={canonicalUrl}
      structuredData={structuredData}
    >
      {/* Hero section (igual ao seu código original) */}
      <section style={{
        position: 'relative', padding: '4rem 2rem 3rem',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(var(--accent) 1px, transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)`,
          backgroundSize: '72px 72px',
        }} />
        <div aria-hidden style={{
          position: 'absolute', top: '-20%', right: '-8%',
          width: 420, height: 420,
          background: 'radial-gradient(circle,var(--red-muted) 0%,transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', fontSize: 12, color: 'var(--text-muted)' }}>
            <Link to="/shop" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>{t('nav.shop')}</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
            <Link to={`/shop/category/${subcategory}`} style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>{label}</Link>
            {sub && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{sub}</span>
              </>
            )}
            {type && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{type}</span>
              </>
            )}
          </nav>
          <h1 style={{
            fontFamily: 'var(--font-display, "Manrope", sans-serif)', fontWeight: 700,
            fontSize: 'clamp(2rem,4vw,3rem)', lineHeight: 1.1,
            color: 'var(--text)', letterSpacing: -0.5, marginBottom: '1rem',
          }}>
            {sub || type || label.split(' ')[0]}{' '}
            <span style={{ color: 'var(--red)' }}>{sub ? '' : (type || label.split(' ').slice(1).join(' ') || '')}</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 500, margin: 0 }}>
            {sub ? t('shop.categoryPage.subcategoryDescription', { sub }) : type ? t('shop.categoryPage.typeDescription', { type }) : t('shop.categoryPage.collectionDescription', { label: label.toLowerCase() })}
          </p>
        </div>
      </section>

      {/* Corpo com filtros e produtos */}
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '2rem 2rem 5rem', background: 'var(--bg)',
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem',
      }}>
        <aside style={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>
          <ProductFilters
            category={categorySlug}
            subcategory={sub || type}
            onChange={updateFilters}
            compact={false}
          />
        </aside>

        <main>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {loading ? t('common.loading') : t('shop.categoryPage.resultsCount', { count: filteredProducts.length })}
            </span>
            <select style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '7px 12px', background: 'var(--surface)', cursor: 'pointer',
            }}>
              <option>{t('shop.shopFilters.sortBy')}: {t('shop.shopFilters.sortRelevance')}</option>
              <option>{t('shop.shopFilters.sortPriceAsc')}</option>
              <option>{t('shop.shopFilters.sortPriceDesc')}</option>
              <option>{t('shop.shopFilters.sortNewest')}</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--surface)', borderRadius: 20 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>{t('shop.categoryPage.noProducts')}</p>
              <button onClick={() => updateFilters({ price: [0, 500] })} style={{ marginTop: 12, padding: '8px 20px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 99, cursor: 'pointer' }}>
                {t('shop.shopFilters.clearFilters')}
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1.25rem',
            }}>
              {filteredProducts.map(product => (
                <Link key={product.id} to={`/shop/product/${product.id}`} style={{ textDecoration: 'none' }}>
                  <article style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    height: '100%', display: 'flex', flexDirection: 'column',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}
                  >
                    <div style={{
                      height: 160, background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" aria-hidden>
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                      {product.badge && (
                        <span style={{
                          position: 'absolute', top: 10, left: 10,
                          background: product.badge === 'Sale' ? 'var(--red)' : '#059669',
                          color: '#fff', fontSize: 10, fontWeight: 700,
                          padding: '3px 8px', borderRadius: 99,
                        }}>{product.badge}</span>
                      )}
                    </div>
                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{product.name}</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)', marginTop: 'auto' }}>{product.price}</p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .subcategory-layout {
            grid-template-columns: 1fr !important;
          }
          .filters-sidebar {
            position: static !important;
            margin-bottom: 2rem;
          }
        }
      `}</style>
    </AppLayout>
  );
}
