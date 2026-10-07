import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';

interface BrandProduct {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  price?: number | string;
  currentPrice?: number | string;
  badge?: string;
}

const formatBrandLabel = (brand?: string) => {
  if (!brand) return 'Marca';
  return brand.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatPrice = (price?: number | string) => {
  if (price === undefined || price === null) return '—';
  if (typeof price === 'number') {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
  }
  return String(price);
};

export default function BrandPage() {
  const { brand } = useParams<{ brand?: string }>();
  const label = useMemo(() => formatBrandLabel(brand), [brand]);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      if (!brand) {
        setProducts([]);
        setError('Marca inválida');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setProducts([]);

      try {
        const response = await apiClient.get<{ products: BrandProduct[] }>(`/shop/products?brand=${encodeURIComponent(brand)}&view=summary`);
        if (!response.success) {
          throw new Error(response.error?.message || 'Erro ao carregar produtos da marca');
        }

        setProducts(response.data?.products ?? []);
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar produtos da marca');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [brand]);

  return (
    <AppLayout
      title={`${label} — Tranzor`}
      description={`Descubra todos os produtos da marca ${label} disponíveis na Tranzor.`}
    >
      {/* ── HERO ── */}
      <section style={{
        position: 'relative', padding: '6rem 2rem 4rem',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)`,
          backgroundSize: '72px 72px',
        }} />
        <div aria-hidden style={{
          position: 'absolute', bottom: '-30%', left: '-5%',
          width: 400, height: 400,
          background: 'radial-gradient(circle,var(--red-muted) 0%,transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', fontSize: 12, color: 'var(--text-muted)' }}>
            <Link to="/shop" style={{ color: 'var(--red)', textDecoration: 'none', fontWeight: 600 }}>Loja</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--red)' }}>— Marca</span>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 'clamp(1.8rem,4vw,3rem)', lineHeight: 1.1,
                color: 'var(--text)', letterSpacing: -0.5,
              }}>{label}</h1>
            </div>
          </div>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 520 }}>
            Conheça a gama completa de produtos desta marca, disponíveis na Tranzor com entrega rápida.
          </p>
        </div>
      </section>

      {/* ── GRID ── */}
      <section style={{ background: 'var(--bg)', padding: '3rem 2rem 5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loading ? 'A carregar produtos...' : `${products.length} produto${products.length === 1 ? '' : 's'} da marca`}</span>
            <select style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '7px 12px', background: 'var(--surface)', cursor: 'pointer',
            }}>
              <option>Ordenar: Relevância</option>
              <option>Preço crescente</option>
              <option>Preço decrescente</option>
            </select>
          </div>

          {error ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--red)', background: 'var(--surface)', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Não foi possível carregar os produtos.</p>
              <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)' }}>{error}</p>
            </div>
          ) : loading ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>A carregar produtos...</div>
          ) : products.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Não há produtos disponíveis para a marca {label} no momento.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {products.map((product) => {
                const key = product._id ?? product.id ?? product.slug ?? product.name;
                return (
                  <Link key={key} to={`/shop/product/${product.slug ?? product._id ?? product.id}`} style={{ textDecoration: 'none' }}>
                    <article style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, overflow: 'hidden',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                    }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.transform = 'none';
                      }}
                    >
                      <div style={{
                        height: 160, background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden>
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21,15 16,10 5,21"/>
                        </svg>
                        {product.badge && (
                          <span style={{
                            position: 'absolute', top: 10, left: 10,
                            background: 'var(--red)', color: '#fff',
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                          }}>{product.badge}</span>
                        )}
                      </div>
                      <div style={{ padding: '1rem' }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{product.name}</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)' }}>{formatPrice(product.currentPrice ?? product.price)}</p>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
