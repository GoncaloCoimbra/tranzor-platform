import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';

export default function NewArrivalsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState(t('shop.newArrivals.filters.all'));

  const arrivals = [
    { id: 1, name: t('shop.newArrivals.sampleItems.executive.name'), category: t('shop.newArrivals.sampleItems.executive.category'), price: '€8,90', badge: t('shop.newArrivals.badges.new'), days: 1 },
    { id: 2, name: t('shop.newArrivals.sampleItems.planner.name'), category: t('shop.newArrivals.sampleItems.planner.category'), price: '€5,50', badge: t('shop.newArrivals.badges.new'), days: 2 },
    { id: 3, name: t('shop.newArrivals.sampleItems.file.name'), category: t('shop.newArrivals.sampleItems.file.category'), price: '€12,00', badge: t('shop.newArrivals.badges.new'), days: 3 },
    { id: 4, name: t('shop.newArrivals.sampleItems.markers.name'), category: t('shop.newArrivals.sampleItems.markers.category'), price: '€7,80', badge: t('shop.newArrivals.badges.new'), days: 5 },
    { id: 5, name: t('shop.newArrivals.sampleItems.agenda.name'), category: t('shop.newArrivals.sampleItems.agenda.category'), price: '€14,90', badge: t('shop.newArrivals.badges.featured'), days: 6 },
    { id: 6, name: t('shop.newArrivals.sampleItems.clips.name'), category: t('shop.newArrivals.sampleItems.clips.category'), price: '€2,30', badge: t('shop.newArrivals.badges.new'), days: 7 },
  ];

  const filters = [
    t('shop.newArrivals.filters.all'),
    t('shop.newArrivals.filters.school'),
    t('shop.newArrivals.filters.writing'),
    t('shop.newArrivals.filters.organization'),
    t('shop.newArrivals.filters.planning'),
  ];

  const filtered = active === t('shop.newArrivals.filters.all') ? arrivals : arrivals.filter(p => p.category === active);

  return (
    <AppLayout
      title={t('shop.newArrivals.pageTitle')}
      description={t('shop.newArrivals.pageDescription')}
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
        <div aria-hidden style={{
          position: 'absolute', top: '-10%', right: '-8%',
          width: 450, height: 450,
          background: 'radial-gradient(circle,var(--red-muted) 0%,transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: 2,
            textTransform: 'uppercase', color: 'var(--red)', marginBottom: '1.25rem',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
            {t('shop.newArrivals.eyebrow')}
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(2rem,4vw,3.2rem)', lineHeight: 1.1,
            color: 'var(--text)', letterSpacing: -0.5, marginBottom: '1rem',
          }}>
            {t('shop.newArrivals.titlePart1')} <span style={{ color: 'var(--red)' }}>{t('shop.newArrivals.titlePart2')}</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 500, marginBottom: '2rem' }}>
            {t('shop.newArrivals.description')}
          </p>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: t('shop.newArrivals.stats.newThisWeek'), value: '6' },
              { label: t('shop.newArrivals.stats.categories'), value: '4' },
              { label: t('shop.newArrivals.stats.fastShipping'), value: '24h' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg)', padding: '3rem 2rem 5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '2rem' }}>
            {filters.map(f => (
              <button key={f} onClick={() => setActive(f)} style={{
                padding: '7px 16px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: active === f ? '1px solid var(--red)' : '1px solid var(--border)',
                background: active === f ? 'var(--red)' : 'var(--surface)',
                color: active === f ? '#fff' : 'var(--text)',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {filtered.map(p => (
              <Link key={p.id} to={`/shop/product/${p.id}`} style={{ textDecoration: 'none' }}>
                <article style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                  transition: 'box-shadow 0.2s, transform 0.2s',
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
                    height: 150, background: 'linear-gradient(135deg,var(--surface-2),var(--charcoal-3))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                    <span style={{
                      position: 'absolute', top: 10, left: 10,
                      background: p.badge === t('shop.newArrivals.badges.featured') ? 'var(--text)' : 'var(--red)',
                      color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                    }}>{p.badge}</span>
                    <span style={{
                      position: 'absolute', bottom: 8, right: 8,
                      fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface)',
                      padding: '2px 7px', borderRadius: 99, fontWeight: 600,
                    }}>{t('shop.newArrivals.daysAgo', { count: p.days })}</span>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.category}</span>
                    <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', margin: '4px 0 6px' }}>{p.name}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)' }}>{p.price}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}