import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

/* ─────────────────────────────────────────
   MAPA: rótulo → slug interno
   ───────────────────────────────────────── */
const INTERNAL_SLUG: Record<string, string> = {
  'Artes':              'artes',
  'Escolar':            'escolar',
  'Escritório':         'escritorio',
  'Gifts':              'gifts',
  'Higiene e Limpeza':  'higiene',
  'Indústria':          'industria',
  'Informática':        'informatica',
  'Jogos e Brinquedos': 'jogos',
  'Mobiliário':         'mobiliario',
};

/* ─────────────────────────────────────────
   DADOS DE CATEGORIAS
   ─────────────────────────────────────────
   NOTA: os slugs ?sub= nas sub-rotas têm de
   coincidir com os mapeamentos em ProductFilters
   (resolveFilters → subMapping).
   ───────────────────────────────────────── */
interface SubSubCat { label: string; promo?: boolean }
interface SubCat    { label: string; children?: SubSubCat[] }
interface Category  { label: string; count: string; children?: SubCat[] }

interface HighlightProduct {
  title: string;
  price: string;
  rating: number;
  to: string;
  badge?: string;
}

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const CATEGORIES: Category[] = [
  {
    label: 'Artes', count: '+3.000',
    children: [
      { label: 'Cavaletes e Atelier', children: [
        { label: 'Cavaletes de Mesa' },
        { label: 'Cavaletes de Chão' },
        { label: 'Acessórios de Atelier' },
      ]},
      { label: 'Corte', children: [
        { label: 'Bisturis e X-Atos' },
        { label: 'Bases de Corte' },
        { label: 'Guilhotinas' },
      ]},
      { label: 'Desenho e Ilustração', children: [
        { label: 'Lápis de Grafite' },   // → filtros 'lapis'
        { label: 'Carvão e Sanguínea' },  // → filtros 'lapis'
        { label: 'Canetas de Ponta Fina' },
        { label: 'Mesas de Luz' },
      ]},
      { label: 'Pintura', children: [
        { label: 'Acrílica' },            // → filtros 'pintura'
        { label: 'Aguarela', promo: true },
        { label: 'Auxiliares' },
        { label: 'Conjuntos', promo: true },
        { label: 'Guache e Tempera' },
        { label: 'Óleo' },
        { label: 'Sprays' },
      ]},
      { label: 'Telas', children: [
        { label: 'Telas de Algodão' },    // → filtros 'telas'
        { label: 'Telas de Linho' },
        { label: 'Chassis' },
      ]},
      { label: 'Pincéis e Acessórios', children: [
        { label: 'Pincéis Sintéticos' },  // → filtros 'pinceis'
        { label: 'Pincéis de Pelo' },
        { label: 'Paletes' },
      ]},
    ]
  },
  {
    label: 'Escolar', count: '+5.000',
    children: [
      { label: 'Cadernos e Blocos', children: [
        { label: 'Cadernos A4' },         // → filtros 'cadernos'
        { label: 'Cadernos A5' },
        { label: 'Blocos de Notas' },
        { label: 'Post-it e Notas Adesivas' },
      ]},
      { label: 'Calculadoras', children: [
        { label: 'Científicas' },         // → filtros 'calculadoras'
        { label: 'Básicas' },
        { label: 'Gráficas' },
      ]},
      { label: 'Desenhar e Colorir', children: [
        { label: 'Lápis de Cor' },        // → filtros 'lapis'
        { label: 'Marcadores' },          // → filtros 'marcadores'
        { label: 'Pastéis' },             // → filtros 'lapis'
        { label: 'Conjuntos', promo: true },
      ]},
      { label: 'Escrita e Correção', children: [
        { label: 'Canetas' },             // → filtros 'canetas'
        { label: 'Lápis' },              // → filtros 'lapis'
        { label: 'Borrachas' },
        { label: 'Corretores' },
        { label: 'Apontadores' },
      ]},
      { label: 'Organização', children: [
        { label: 'Estojos' },
        { label: 'Porta-documentos' },
        { label: 'Réguas e Esquadros' },
      ]},
      { label: 'Transportar e Guardar', children: [
        { label: 'Mochilas' },
        { label: 'Estojos' },
        { label: 'Malas e Trolleys' },
        { label: 'Capas de Transporte' },
      ]},
    ]
  },
  {
    label: 'Escritório', count: '+6.000',
    children: [
      { label: 'Arquivamento', children: [
        { label: 'Dossiers' },
        { label: 'Caixas de Arquivo' },
        { label: 'Separadores' },
        { label: 'Pastas Suspensas' },
      ]},
      { label: 'Calendários e Agendas', children: [
        { label: 'Agendas' },
        { label: 'Calendários de Mesa' },
        { label: 'Calendários de Parede' },
        { label: 'Planners', promo: true },
      ]},
      { label: 'Escrita', children: [
        { label: 'Canetas de Esferográfica' }, // → filtros 'canetas'
        { label: 'Canetas de Gel' },
        { label: 'Marcadores' },               // → filtros 'marcadores'
        { label: 'Esferográficas Premium', promo: true },
      ]},
      { label: 'Papel e Impressão', children: [
        { label: 'Papel A4' },                 // → filtros 'papel'
        { label: 'Papel Fotográfico' },
        { label: 'Papel Reciclado' },
        { label: 'Papel de Cor' },
      ]},
      { label: 'Organização', children: [
        { label: 'Porta-canetas' },
        { label: 'Caixas Organizadoras' },
        { label: 'Suportes de Monitor' },
        { label: 'Pranchetas' },
      ]},
      { label: 'Fixação e Corte', children: [
        { label: 'Agrafadores' },
        { label: 'Furadoras' },
        { label: 'Guilhotinas' },
        { label: 'Tesouras' },
      ]},
    ]
  },
  {
    label: 'Gifts', count: '+1.200',
    children: [
      { label: 'Canetas e Escrita', children: [
        { label: 'Canetas de Luxo', promo: true },
        { label: 'Conjuntos de Escrita' },
      ]},
      { label: 'Diários e Cadernos', children: [
        { label: 'Diários' },
        { label: 'Cadernos Premium', promo: true },
        { label: 'Bullet Journals' },
      ]},
      { label: 'Kits e Conjuntos', children: [
        { label: 'Kits de Arte' },
        { label: 'Kits de Escrita' },
        { label: 'Conjuntos Personalizáveis', promo: true },
      ]},
    ]
  },
  {
    label: 'Higiene e Limpeza', count: '+900',
    children: [
      { label: 'Contentores e Sacos', children: [
        { label: 'Papeleiras' },
        { label: 'Contentores de Reciclagem' },
        { label: 'Sacos de Lixo' },
      ]},
      { label: 'Desinfetantes', children: [
        { label: 'Gel Desinfetante' },
        { label: 'Spray Desinfetante' },
      ]},
      { label: 'Higiene Pessoal', children: [
        { label: 'Sabão Líquido' },
        { label: 'Papel Higiénico' },
        { label: 'Lenços de Papel' },
      ]},
      { label: 'Papel Tissue', children: [
        { label: 'Rolo de Cozinha' },
        { label: 'Guardanapos' },
        { label: 'Papel de Mãos' },
      ]},
    ]
  },
  {
    label: 'Indústria', count: '+2.500',
    children: [
      { label: 'EPI — Proteção Individual', children: [
        { label: 'Luvas' },                   // → filtros 'epi'
        { label: 'Máscaras', promo: true },
        { label: 'Óculos de Proteção' },
        { label: 'Capacetes' },
        { label: 'Vestuário de Proteção' },
      ]},
      { label: 'Embalagem', children: [
        { label: 'Caixas de Cartão' },
        { label: 'Filme Estirável' },
        { label: 'Sacos de Polietileno' },
      ]},
      { label: 'Fitas Adesivas', children: [
        { label: 'Fita de Embalagem' },
        { label: 'Fita de Dupla Face' },
        { label: 'Fita Foam' },
      ]},
      { label: 'Sinalização', children: [
        { label: 'Placas de Sinalização' },
        { label: 'Fitas de Sinalização' },
        { label: 'Cones e Barreiras' },
      ]},
    ]
  },
  {
    label: 'Informática', count: '+1.800',
    children: [
      { label: 'Consumíveis de Impressão', children: [
        { label: 'Tinteiros', promo: true },
        { label: 'Toners' },
        { label: 'Fitas e Etiquetas' },
      ]},
      { label: 'Impressão', children: [
        { label: 'Impressoras Jacto de Tinta' }, // → filtros 'impressoras'
        { label: 'Impressoras Laser' },
        { label: 'Impressoras Multifunções', promo: true },
        { label: 'Plotters' },
      ]},
      { label: 'Periféricos e Acessórios', children: [
        { label: 'Ratos' },
        { label: 'Teclados' },
        { label: 'Webcams' },
        { label: 'Scanners' },
      ]},
      { label: 'Armazenamento de Dados', children: [
        { label: 'Pens USB' },                   // → filtros 'armazenamento'
        { label: 'Discos Externos' },
        { label: 'Cartões de Memória' },
      ]},
      { label: 'Som', children: [
        { label: 'Auriculares' },
        { label: 'Colunas' },
        { label: 'Microfones' },
        { label: 'Headsets', promo: true },
      ]},
    ]
  },
  {
    label: 'Jogos e Brinquedos', count: '+700',
    children: [
      { label: 'Jogos de Mesa', children: [
        { label: 'Clássicos' },              // → filtros 'jogos'
        { label: 'Cooperativos' },
        { label: 'Família' },
        { label: 'Cartas' },
      ]},
      { label: 'Puzzles', children: [
        { label: '500 peças' },              // → filtros 'puzzles'
        { label: '1000 peças', promo: true },
        { label: 'Infantis' },
        { label: '3D' },
      ]},
      { label: 'Brinquedos Educativos', children: [
        { label: 'Matemática' },
        { label: 'Línguas' },
        { label: 'Ciências' },
        { label: 'Música' },
      ]},
    ]
  },
  {
    label: 'Mobiliário', count: '+500',
    children: [
      { label: 'Cadeiras de Escritório', children: [
        { label: 'Ergonómicas', promo: true }, // → filtros 'mobiliario'
        { label: 'Executivas' },
        { label: 'Operacionais' },
        { label: 'Visitante' },
      ]},
      { label: 'Secretárias', children: [
        { label: 'Secretárias Retas' },
        { label: 'Secretárias em L' },
        { label: 'Secretárias Elevatórias', promo: true },
        { label: 'Home Office' },
      ]},
      { label: 'Armários e Gavetas', children: [
        { label: 'Armários Metálicos' },
        { label: 'Armários de Madeira' },
        { label: 'Gaveteiros' },
        { label: 'Cofres' },
      ]},
      { label: 'Mesas de Reunião', children: [
        { label: 'Redondas' },
        { label: 'Retangulares' },
        { label: 'Modulares', promo: true },
      ]},
    ]
  },
];

/* ─────────────────────────────────────────
   ÍCONES
   ───────────────────────────────────────── */
const CATEGORY_LABELS: Record<string, string> = {
  'Artes': 'navbar.artes',
  'Escolar': 'navbar.school',
  'Escritório': 'navbar.office',
  'Gifts': 'navbar.gifts',
  'Higiene e Limpeza': 'navbar.hygiene',
  'Indústria': 'navbar.industry',
  'Informática': 'navbar.technology',
  'Jogos e Brinquedos': 'navbar.toys',
  'Mobiliário': 'navbar.furniture',
};

const translateCategory = (t: (key: string) => string, label: string) =>
  CATEGORY_LABELS[label] ? t(CATEGORY_LABELS[label]) : label;

const CAT_ICONS: Record<string, React.ReactNode> = {
  'Artes': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="7" cy="19" r="2.5"/><circle cx="5" cy="9" r="2.5"/><path d="M5.5 9.5 Q 9 12 13 6.5 Q 16.5 8 19 13 Q 16 17 7 19 Q 5.5 14 5.5 9.5Z" strokeWidth="1" opacity=".4"/></svg>,
  'Escolar': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  'Escritório': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Gifts': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  'Higiene e Limpeza': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 2C6 2 2 7 2 12s4 10 10 10 10-4.5 10-10S18 2 12 2z"/><path d="M12 6v6l4 2"/></svg>,
  'Indústria': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/><line x1="12" y1="22" x2="12" y2="15.5"/><line x1="22" y1="8.5" x2="12" y2="15.5"/><line x1="2" y1="8.5" x2="12" y2="15.5"/></svg>,
  'Informática': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Jogos e Brinquedos': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="17.5" cy="13.5" r="1" fill="currentColor"/><path d="M17.92 11.62a10 10 0 0 0-2.12-3.43 10 10 0 0 0-3.43-2.12c-.36-.14-.78-.06-1.05.21l-4.3 4.3a1.05 1.05 0 0 0-.21 1.05 10 10 0 0 0 2.12 3.43 10 10 0 0 0 3.43 2.12c.36.14.78.06 1.05-.21l4.3-4.3c.27-.27.35-.69.21-1.05z"/></svg>,
  'Mobiliário': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"/><line x1="6" y1="18" x2="6" y2="22"/><line x1="18" y1="18" x2="18" y2="22"/></svg>,
};

/* ─────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────── */
function FilterSidebar() {
  const { t } = useTranslation();
  const [openCat, setOpenCat]       = useState<string | null>(null);
  const [openSubCat, setOpenSubCat] = useState<string | null>(null);

  const toggleCat    = (label: string) => { setOpenCat(prev => prev === label ? null : label); setOpenSubCat(null); };
  const toggleSubCat = (label: string, e: React.MouseEvent) => { e.preventDefault(); setOpenSubCat(prev => prev === label ? null : label); };

  return (
    <aside className="shop-sidebar" aria-label="Filtros por categoria">
      <div className="sidebar-heading">{t('shop.shopFilters.categories')}</div>
      <nav>
        {CATEGORIES.map(cat => {
          const isOpen      = openCat === cat.label;
          const hasChildren = !!(cat.children?.length);
          return (
            <div key={cat.label} className="sidebar-cat-group">
              <div className={`sidebar-cat-row ${isOpen ? 'sidebar-cat-row--open' : ''}`}>
                <Link
                  to={`/shop/category/${INTERNAL_SLUG[cat.label] ?? cat.label.toLowerCase()}`}
                  className="sidebar-cat-link"
                >
                  <span className="sidebar-cat-icon">{CAT_ICONS[cat.label] || null}</span>
                  <span className="sidebar-cat-label">{translateCategory(t, cat.label)}</span>
                  <span className="sidebar-cat-count">{cat.count}</span>
                </Link>
                {hasChildren && (
                  <button onClick={() => toggleCat(cat.label)} className="sidebar-expand-btn" aria-expanded={isOpen} aria-label={`${isOpen ? 'Fechar' : 'Abrir'} subcategorias de ${cat.label}`}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path d="M4 6l4 4 4-4"/>
                    </svg>
                  </button>
                )}
              </div>

              {hasChildren && isOpen && (
                <ul className="sidebar-sub-list" role="list">
                  {cat.children!.map(sub => {
                    const subOpen          = openSubCat === sub.label;
                    const hasGrandChildren = !!(sub.children?.length);
                    return (
                      <li key={sub.label} className="sidebar-sub-item">
                        <div className={`sidebar-sub-row ${subOpen ? 'sidebar-sub-row--open' : ''}`}>
                          <Link
                            to={`/shop/category/${INTERNAL_SLUG[cat.label] ?? cat.label.toLowerCase()}?sub=${encodeURIComponent(sub.label)}`}
                            className="sidebar-sub-link"
                          >
                            {sub.label}
                          </Link>
                          {hasGrandChildren && (
                            <button onClick={(e) => toggleSubCat(sub.label, e)} className="sidebar-expand-btn sidebar-expand-btn--sm" aria-expanded={subOpen} aria-label={`${subOpen ? 'Fechar' : 'Abrir'} ${sub.label}`}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ transform: subOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <path d="M4 6l4 4 4-4"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        {hasGrandChildren && subOpen && (
                          <ul className="sidebar-grand-list" role="list">
                            {sub.children!.map(grand => (
                              <li key={grand.label}>
                                <Link
                                  to={`/shop/category/${INTERNAL_SLUG[cat.label] ?? cat.label.toLowerCase()}?sub=${encodeURIComponent(sub.label)}&type=${encodeURIComponent(grand.label)}`}
                                  className="sidebar-grand-link"
                                >
                                  {grand.label}
                                  {grand.promo && <span className="sidebar-promo-tag">Promo</span>}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ─────────────────────────────────────────
   PRODUTO THUMB
   ───────────────────────────────────────── */
function ProductThumb() {
  return (
    <div className="highlight-thumb" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="7.5,4.27 12,6.11 16.5,4.27"/><line x1="12" y1="22.76" x2="12" y2="12"/>
      </svg>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars-wrap" aria-label={`${rating} estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" aria-hidden fill={i < Math.floor(rating) ? '#D90429' : 'none'} stroke="#D90429" strokeWidth="2" strokeLinecap="round">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────
   PÁGINA PRINCIPAL
   ───────────────────────────────────────── */
export default function ShopPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [highlights, setHighlights] = useState<HighlightProduct[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadHighlights() {
      setHighlightsLoading(true);
      try {
        let products: any[] = [];
        const featuredResponse = await apiClient.get<{ products: any[] }>('/shop/featured?limit=10');
        if (!active) return;

        if (featuredResponse.success && Array.isArray((featuredResponse as any).products)) {
          products = (featuredResponse as any).products;
        }

        if (products.length === 0) {
          const fallbackResponse = await apiClient.get<{ products: any[] }>('/shop/products?limit=10&view=summary');
          if (!active) return;
          products = Array.isArray((fallbackResponse as any).products)
            ? (fallbackResponse as any).products
            : Array.isArray(fallbackResponse.data?.products)
              ? fallbackResponse.data.products
              : [];
        }

        if (products.length > 0) {
          setHighlights(products.map((product: any) => {
            const idOrSlug = product.slug ?? product._id ?? product.id;
            const identifier = typeof idOrSlug === 'string' ? idOrSlug : String(idOrSlug);
            const price = currencyFormatter.format(Number(product.accountPrice ?? product.currentPrice ?? product.price ?? 0));
            const rating = Number(product.rating?.average ?? product.rating ?? 0) || 0;

            return {
              title: product.name || 'Produto',
              price,
              rating,
              to: `/shop/product/${identifier}`,
              badge: product.isNew ? 'Novo' : product.isFeatured ? 'Sale' : undefined,
            };
          }));
        }
      } catch (error) {
        console.error('Failed to load highlight products', error);
      } finally {
        if (active) setHighlightsLoading(false);
      }
    }

    loadHighlights();
    return () => { active = false; };
  }, []);
  const quickFilters = [
    t('shop.shopPage.quickFilters.pens'),
    t('shop.shopPage.quickFilters.notebooks'),
    t('shop.shopPage.quickFilters.paperA4'),
    t('shop.shopPage.quickFilters.planners'),
    t('shop.shopPage.quickFilters.inks'),
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/shop/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <AppLayout
      title={t('shop.shopPage.title')}
      description={t('shop.shopPage.description')}
      canonical="/shop"
    >
      {/* ── Hero ── */}
      <header className="shop-hero">
        <div className="shop-hero-inner">
          <div className="shop-hero-label">{t('shop.shopPage.heroLabel', 'Loja Tranzor')}</div>
          <h1 className="shop-hero-title">
            {t('shop.shopPage.heroTitle', 'Mais de 25.000 produtos para escritório e escola')}
          </h1>
          <p className="shop-hero-sub">
            {t('shop.shopPage.heroSubtitle', 'Tudo o que precisa em papelaria, tecnologia e soluções empresariais com entrega rápida em Portugal.')}
          </p>

          <form onSubmit={handleSearch} className="shop-search-form" role="search" aria-label={t('nav.search', 'Pesquisar')}>
            <label htmlFor="shop-search" className="sr-only">{t('nav.search', 'Pesquisar')}</label>
            <div className="shop-search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" aria-hidden className="shop-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input ref={searchRef} id="shop-search" type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('shop.shopPage.searchPlaceholder', 'Pesquisar produtos')} className="shop-search-input" autoComplete="off" />
              <button type="submit" className="shop-search-btn" aria-label={t('nav.search', 'Pesquisar')}>{t('nav.search', 'Pesquisar')}</button>
            </div>
          </form>

          <div className="shop-hero-pills">
            {quickFilters.map(term => (
              <button key={term} onClick={() => { setSearchTerm(term); searchRef.current?.focus(); }} className="shop-pill">{term}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Link to="/shop/novidades" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(217,4,41,0.08)', border: '1px solid rgba(217,4,41,0.2)', borderRadius: 99, color: 'var(--c-red)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, textDecoration: 'none', letterSpacing: 0.5, transition: 'background 0.2s' }}>
              ✦ {t('nav.news')}
            </Link>
            <Link to="/shop/vistos-recentemente" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 99, color: 'var(--c-muted-l)', fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 12, textDecoration: 'none', letterSpacing: 0.5, transition: 'background 0.2s' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              {t('shop.recentlyViewed.pageTitle')}
            </Link>
            <Link to="/shop/ofertas" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 99, color: 'var(--c-muted-l)', fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 12, textDecoration: 'none', letterSpacing: 0.5, transition: 'background 0.2s' }}>
              {t('shop.shopPage.promotions')}
            </Link>
          </div>
        </div>

        <div className="shop-hero-stats" aria-label={t('shop.shopPage.statsAria')}>
          {[
            { value: '25K+', label: t('shop.shopPage.statsProducts') },
            { value: '48h',  label: t('shop.shopPage.statsDelivery') },
            { value: '50+',  label: t('shop.shopPage.statsYears') },
          ].map(stat => (
            <div key={stat.label} className="shop-stat">
              <span className="shop-stat-val">{stat.value}</span>
              <span className="shop-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="shop-body">
        <FilterSidebar />

        <main className="shop-content">

          {/* ── Categorias ── */}
          <section aria-labelledby="cats-heading" className="shop-section">
            <div className="shop-section-header">
              <h2 id="cats-heading" className="shop-section-title">{t('shop.shopFilters.categories')}</h2>
              <Link to="/shop" className="shop-section-link">
                {t('shop.shopPage.viewAll')}
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </Link>
            </div>
            <div className="cats-grid">
              {CATEGORIES.map((cat, i) => (
                <Link
                  key={cat.label}
                  to={`/shop/category/${INTERNAL_SLUG[cat.label] ?? cat.label.toLowerCase()}`}
                  className="cat-card"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="cat-card-icon">{CAT_ICONS[cat.label]}</span>
                  <span className="cat-card-name">{translateCategory(t, cat.label)}</span>
                  <span className="cat-card-count">{cat.count} refs</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Produtos em destaque ── */}
          <section aria-labelledby="highlights-heading" className="shop-section">
            <div className="shop-section-header">
              <h2 id="highlights-heading" className="shop-section-title">{t('shop.shopPage.highlights')}</h2>
              <Link to="/shop/ofertas" className="shop-section-link">
                {t('shop.shopPage.viewPromotions')}
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </Link>
            </div>
            <div className="highlights-grid">
              {highlightsLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="highlight-card" style={{ animationDelay: `${i * 60}ms`, minHeight: 180, opacity: 0.5 }}>
                  <ProductThumb />
                  <div style={{ width: '100%', height: 20, background: '#ececec', borderRadius: 10, marginTop: 16 }} />
                </div>
              ))}

              {!highlightsLoading && highlights.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center', color: 'var(--c-muted)' }}>
                  {t('shop.shopPage.noHighlights', 'Ainda não há produtos em destaque.')}
                </div>
              )}

              {!highlightsLoading && highlights.map((prod, i) => (
                <Link key={`${prod.title}-${i}`} to={prod.to} className="highlight-card" data-testid="product-card" style={{ animationDelay: `${i * 60}ms` }}>
                  {prod.badge && (
                    <span className={`hcard-badge ${prod.badge === 'Sale' ? 'hcard-badge--sale' : 'hcard-badge--novo'}`}>{prod.badge}</span>
                  )}
                  <ProductThumb />
                  <span className="hcard-name">{prod.title}</span>
                  <div className="hcard-bottom">
                    <span className="hcard-price">{prod.price}</span>
                    <Stars rating={prod.rating} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Novidades ── */}
          <section className="shop-section">
            <div style={{ background: 'linear-gradient(135deg, rgba(217,4,41,0.06) 0%, rgba(217,4,41,0.02) 100%)', border: '1.5px solid rgba(217,4,41,0.15)', borderRadius: 14, padding: '2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--c-red)', marginBottom: 8 }}>— {t('shop.shopPage.newArrivalsEyebrow')}</div>
                <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.4rem', color: 'var(--c-text)', margin: 0, lineHeight: 1.2 }}>✦ {t('shop.shopPage.newArrivalsTitle')}</h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-muted-l)', margin: '8px 0 0', lineHeight: 1.6 }}>{t('shop.shopPage.newArrivalsDescription')}</p>
              </div>
              <Link to="/shop/novidades"
                style={{ padding: '12px 28px', background: 'var(--c-red)', color: 'white', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', borderRadius: 10, textDecoration: 'none', flexShrink: 0, transition: 'background 0.2s, transform 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#b8031c'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-red)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                {t('shop.shopPage.viewNewArrivals')} →
              </Link>
            </div>
          </section>

          {/* ── Suporte ── */}
          <section className="shop-support" aria-labelledby="support-heading">
            <div className="shop-support-text">
              <h2 id="support-heading" className="shop-support-title">{t('help.title')}</h2>
              <p className="shop-support-desc">{t('help.chatbot')}</p>
            </div>
            <div className="shop-support-actions">
              <Link to="/contact" className="shop-support-cta">{t('contact.submitButton')}</Link>
              <Link to="/faq" className="shop-support-ghost">{t('help.faq')}</Link>
            </div>
          </section>

        </main>
      </div>

      {/* ── Estilos ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .shop-hero, .shop-body {
          --c-bg: #ffffff; --c-bg-2: #f7f7f7;
          --c-red: #D90429; --c-red-soft: rgba(217,4,41,0.06); --c-red-mid: rgba(217,4,41,0.15);
          --c-text: #111111; --c-muted: #888888; --c-muted-l: #555555;
          --c-border: #e4e4e4;
          --font-head: 'Syne', sans-serif; --font-body: 'DM Sans', sans-serif;
        }

        .sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }

        .shop-hero { background:#ffffff; border-bottom:1px solid var(--c-border); padding:6rem 2.5rem 3.5rem; text-align:center; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2.5rem; }
        .shop-hero-inner { flex:1; max-width:980px; width:100%; margin:0 auto; }
        .shop-hero-label { font-family:var(--font-head);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--c-red);margin:0 auto 1.25rem; display:inline-block; }
        .shop-hero-title { font-family:var(--font-head);font-weight:700;font-size:clamp(1.3rem,2.2vw,2rem);color:var(--c-text);line-height:1.25;letter-spacing:.32em;word-spacing:.6rem;margin:0 0 1rem; max-width:70rem; width:100%; margin-left:auto; margin-right:auto; text-transform:uppercase; }
        .shop-hero-accent { color:var(--c-red); letter-spacing:.35em; }
        .shop-hero-sub { font-family:var(--font-body);font-size:0.97rem;color:var(--c-muted-l);line-height:1.9;margin:0 auto 2rem; max-width:56rem; width:100%; }

        .shop-search-form { margin-bottom:1.25rem; }
        .shop-search-wrap { display:flex;align-items:center;border:1.5px solid var(--c-border);border-radius:10px;background:var(--c-bg-2);overflow:hidden;max-width:560px;transition:border-color 0.2s; margin: 0 auto; }
        .shop-search-wrap:focus-within { border-color:var(--c-red); }
        .shop-search-icon { margin-left:14px;flex-shrink:0; }
        .shop-search-input { flex:1;padding:13px 12px;background:transparent;border:none;outline:none;color:var(--c-text);font-family:var(--font-body);font-size:14px; }
        .shop-search-input::placeholder { color:var(--c-muted); }
        .shop-search-btn { padding:13px 20px;background:var(--c-red);color:white;border:none;cursor:pointer;white-space:nowrap;font-family:var(--font-head);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;transition:background 0.2s; }
        .shop-search-btn:hover { background:#b8031c; }

        .shop-hero-pills { display:flex;gap:8px;flex-wrap:wrap; }
        .shop-pill { padding:6px 14px;background:transparent;border:1px solid var(--c-border);border-radius:99px;font-family:var(--font-head);font-size:11px;font-weight:600;color:var(--c-muted-l);cursor:pointer;transition:border-color 0.2s,color 0.2s,background 0.2s; }
        .shop-pill:hover { border-color:var(--c-red);color:var(--c-red);background:var(--c-red-soft); }

        .shop-hero-stats { display:flex;gap:2.5rem;align-items:flex-end;padding-bottom:.25rem; }
        @media (max-width:640px) { .shop-hero-stats { display:none; } }
        .shop-stat { display:flex;flex-direction:column;align-items:flex-end; }
        .shop-stat-val { font-family:var(--font-head);font-weight:800;font-size:2.2rem;color:var(--c-red);line-height:1;letter-spacing:-1px; }
        .shop-stat-label { font-family:var(--font-body);font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:1px; }

        .shop-body { display:grid;grid-template-columns:240px 1fr;max-width:1400px;margin:0 auto;background:#ffffff; }
        @media (max-width:900px) { .shop-body { grid-template-columns:1fr; } }

        .shop-sidebar { border-right:1px solid var(--c-border);padding:2.5rem 0 4rem;position:sticky;top:0;height:100vh;overflow-y:auto;background:#ffffff;scrollbar-width:thin;scrollbar-color:var(--c-border) transparent; }
        @media (max-width:900px) { .shop-sidebar { position:static;height:auto;border-right:none;border-bottom:1px solid var(--c-border);padding:1.5rem 2.5rem; } }
        .sidebar-heading { font-family:var(--font-head);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--c-muted);padding:0 1.5rem 1rem;border-bottom:1px solid var(--c-border);margin-bottom:.5rem; }
        .sidebar-cat-group { border-bottom:1px solid var(--c-border); }
        .sidebar-cat-row { display:flex;align-items:center;transition:background 0.15s; }
        .sidebar-cat-row:hover,.sidebar-cat-row--open { background:var(--c-red-soft); }
        .sidebar-cat-link { flex:1;display:flex;align-items:center;gap:10px;padding:11px 1.5rem;text-decoration:none;color:var(--c-text);min-width:0;transition:color 0.2s; }
        .sidebar-cat-link:hover { color:var(--c-red); }
        .sidebar-cat-row--open .sidebar-cat-link { color:var(--c-red); }
        .sidebar-cat-icon { flex-shrink:0;color:var(--c-muted); }
        .sidebar-cat-row--open .sidebar-cat-icon { color:var(--c-red); }
        .sidebar-cat-label { font-family:var(--font-head);font-size:13px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .sidebar-cat-count { font-family:var(--font-body);font-size:10px;color:var(--c-muted);white-space:nowrap;margin-right:4px; }
        .sidebar-expand-btn { width:36px;height:38px;flex-shrink:0;background:transparent;border:none;cursor:pointer;color:var(--c-muted);display:flex;align-items:center;justify-content:center;transition:color 0.2s; }
        .sidebar-expand-btn:hover { color:var(--c-red); }
        .sidebar-expand-btn--sm { width:28px;height:32px; }

        .sidebar-sub-list { list-style:none;margin:0;padding:4px 0;background:var(--c-bg-2);border-top:1px solid var(--c-border); }
        .sidebar-sub-item { display:flex;flex-direction:column; }
        .sidebar-sub-row { display:flex;align-items:center;transition:background 0.15s; }
        .sidebar-sub-row:hover,.sidebar-sub-row--open { background:rgba(217,4,41,0.04); }
        .sidebar-sub-link { flex:1;display:block;padding:8px 1.5rem 8px 2.75rem;font-family:var(--font-body);font-size:12.5px;font-weight:400;color:var(--c-muted-l);text-decoration:none;transition:color 0.15s; }
        .sidebar-sub-link:hover { color:var(--c-red); }
        .sidebar-sub-row--open .sidebar-sub-link { color:var(--c-red);font-weight:500; }

        .sidebar-grand-list { list-style:none;margin:0;padding:4px 0 6px;background:#ffffff;border-top:1px solid var(--c-border); }
        .sidebar-grand-link { display:flex;align-items:center;gap:6px;padding:7px 1.5rem 7px 3.5rem;font-family:var(--font-body);font-size:12px;color:var(--c-muted);text-decoration:none;transition:color 0.15s; }
        .sidebar-grand-link:hover { color:var(--c-red); }
        .sidebar-grand-link::before { content:'';width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0;opacity:.5; }
        .sidebar-promo-tag { font-family:var(--font-head);font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:var(--c-red);color:white;padding:2px 5px;border-radius:3px; }

        .shop-content { padding:2.5rem 2.5rem 6rem;background:#ffffff; }
        .shop-section { margin-bottom:3.5rem; }
        .shop-section-header { display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1.5rem;padding-bottom:.875rem;border-bottom:2px solid var(--c-text); }
        .shop-section-title { font-family:var(--font-head);font-weight:800;font-size:1.35rem;color:var(--c-text);margin:0;letter-spacing:-.5px; }
        .shop-section-link { display:inline-flex;align-items:center;gap:6px;font-family:var(--font-head);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--c-red);text-decoration:none;transition:gap 0.2s; }
        .shop-section-link:hover { gap:9px; }

        .cats-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem; }
        .cat-card { display:flex;flex-direction:column;align-items:center;gap:10px;padding:1.5rem 1rem;background:var(--c-bg-2);border:1.5px solid var(--c-border);border-radius:12px;text-decoration:none;animation:fadeUp .35s both;transition:border-color .2s,box-shadow .2s,transform .2s; }
        .cat-card:hover { border-color:var(--c-red-mid);transform:translateY(-3px);box-shadow:0 6px 20px rgba(217,4,41,.08); }
        .cat-card-icon { color:var(--c-red); }
        .cat-card-name { font-family:var(--font-head);font-weight:700;font-size:13px;color:var(--c-text);text-align:center;line-height:1.3; }
        .cat-card:hover .cat-card-name { color:var(--c-red); }
        .cat-card-count { font-family:var(--font-body);font-size:11px;color:var(--c-muted); }

        .highlights-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:1rem; }
        .highlight-card { display:flex;flex-direction:column;align-items:center;gap:10px;padding:1.25rem 1rem;background:#ffffff;border:1.5px solid var(--c-border);border-radius:12px;text-decoration:none;position:relative;animation:fadeUp .35s both;transition:border-color .2s,box-shadow .2s,transform .2s; }
        .highlight-card:hover { border-color:var(--c-red-mid);transform:translateY(-3px);box-shadow:0 6px 20px rgba(217,4,41,.08); }
        .hcard-badge { position:absolute;top:10px;left:10px;font-family:var(--font-head);font-size:8px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 7px;border-radius:4px;color:white; }
        .hcard-badge--sale { background:var(--c-red); }
        .hcard-badge--novo { background:#059669; }
        .highlight-thumb { width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:var(--c-bg-2);border-radius:10px; }
        .hcard-name { font-family:var(--font-head);font-weight:600;font-size:13px;color:var(--c-text);text-align:center;line-height:1.4; }
        .highlight-card:hover .hcard-name { color:var(--c-red); }
        .hcard-bottom { display:flex;align-items:center;justify-content:space-between;width:100%; }
        .hcard-price { font-family:var(--font-head);font-weight:800;font-size:16px;color:var(--c-red); }
        .stars-wrap { display:flex;gap:1px;align-items:center; }

        .shop-support { display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;padding:2.5rem;background:var(--c-bg-2);border:1.5px solid var(--c-border);border-radius:14px; }
        .shop-support-title { font-family:var(--font-head);font-weight:800;font-size:1.3rem;color:var(--c-text);margin:0 0 8px; }
        .shop-support-desc { font-family:var(--font-body);font-size:13.5px;color:var(--c-muted-l);line-height:1.65;margin:0;max-width:480px; }
        .shop-support-actions { display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0; }
        .shop-support-cta { padding:12px 24px;background:var(--c-red);color:white;font-family:var(--font-head);font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:8px;text-decoration:none;transition:background .2s,transform .15s; }
        .shop-support-cta:hover { background:#b8031c;transform:translateY(-1px); }
        .shop-support-ghost { padding:12px 22px;background:transparent;color:var(--c-muted-l);font-family:var(--font-head);font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1.5px solid var(--c-border);border-radius:8px;text-decoration:none;transition:border-color .2s,color .2s; }
        .shop-support-ghost:hover { border-color:var(--c-red);color:var(--c-red); }

        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        a:focus-visible,button:focus-visible,input:focus-visible { outline:2px solid var(--c-red);outline-offset:3px;border-radius:4px; }
      `}</style>
    </AppLayout>
  );
}