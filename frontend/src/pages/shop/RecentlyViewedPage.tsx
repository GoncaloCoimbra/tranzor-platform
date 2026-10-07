import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';

export default function RecentlyViewedPage() {
  const { t } = useTranslation();

  const recentlyViewed = [
    {
      id: 1,
      name: t('shop.recentlyViewed.sampleItems.caderno.name'),
      category: t('shop.recentlyViewed.sampleItems.caderno.category'),
      price: '€3,50',
      viewedAt: t('shop.recentlyViewed.sampleItems.caderno.time'),
    },
    {
      id: 2,
      name: t('shop.recentlyViewed.sampleItems.pen.name'),
      category: t('shop.recentlyViewed.sampleItems.pen.category'),
      price: '€1,20',
      viewedAt: t('shop.recentlyViewed.sampleItems.pen.time'),
    },
    {
      id: 3,
      name: t('shop.recentlyViewed.sampleItems.folder.name'),
      category: t('shop.recentlyViewed.sampleItems.folder.category'),
      price: '€6,90',
      viewedAt: t('shop.recentlyViewed.sampleItems.folder.time'),
    },
  ];

  const hasItems = recentlyViewed.length > 0;

  return (
    <AppLayout
      title={t('shop.recentlyViewed.pageTitle')}
      description={t('shop.recentlyViewed.pageDescription')}
    >
      <section style={{
        position: 'relative', padding: '6rem 2rem 4rem',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)`,
          backgroundSize: '72px 72px',
        }} />
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--red)', display: 'block', marginBottom: '1.25rem' }}>
            — {t('shop.recentlyViewed.historyEyebrow')}
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(2rem,4vw,3rem)', lineHeight: 1.1,
            color: 'var(--text)', letterSpacing: -0.5, marginBottom: '1rem',
          }}>
            {t('shop.recentlyViewed.titlePart1')} <span style={{ color: 'var(--red)' }}>{t('shop.recentlyViewed.titlePart2')}</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 500 }}>
            {t('shop.recentlyViewed.description')}
          </p>
        </div>
      </section>

      <section style={{ background: 'var(--bg)', padding: '3rem 2rem 5rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {!hasItems ? (
            <div style={{
              textAlign: 'center', padding: '5rem 2rem',
              background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--red-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D90429" strokeWidth="1.5" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>{t('shop.recentlyViewed.emptyTitle')}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t('shop.recentlyViewed.emptyBody')}</p>
              <Link to="/shop" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--red)', color: '#fff', textDecoration: 'none',
                fontWeight: 700, fontSize: 13, padding: '10px 24px', borderRadius: 8,
                letterSpacing: 0.5,
              }}>
                {t('shop.recentlyViewed.exploreShop')}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentlyViewed.map(p => (
                <Link key={p.id} to={`/shop/product/${p.id}`} style={{ textDecoration: 'none' }}>
                  <article style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}
                  >
                    <div style={{
                      width: 72, height: 72, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden>
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.category}</span>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: '3px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.viewedAt}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>{p.price}</p>
                      <span style={{
                        fontSize: 11, color: 'var(--red)', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4,
                      }}>
                        {t('shop.recentlyViewed.viewProduct')}
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </div>
                  </article>
                </Link>
              ))}

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <Link to="/shop" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', textDecoration: 'none',
                  fontWeight: 600, fontSize: 13, padding: '10px 24px', borderRadius: 8,
                }}>
                  {t('shop.recentlyViewed.continueExploring')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}