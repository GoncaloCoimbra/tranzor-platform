import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';

export default function ContactPage() {
	const { t } = useTranslation();
	return (
		<AppLayout
			title={t('contact.pageTitle')}
			description={t('contact.pageDescription')}
			canonical="/contact"
		>
			<section className="page-hero">
				<p className="section-label">{t('contact.eyebrow')}</p>
				<h1>{t('contact.heroTitle')}</h1>
				<p className="page-copy">
					{t('contact.heroBody')}
				</p>
			</section>

			<section className="container page-grid page-grid-2" style={{ marginBottom: '4rem' }}>
				<div className="page-panel">
					<h2 className="page-heading">{t('contact.detailsTitle')}</h2>
					<p className="page-copy">{t('contact.detailsBody')}</p>
					<ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0 0 0', display: 'grid', gap: '1rem' }}>
						<li><strong>{t('contact.emailLabel')}:</strong> <a href="mailto:geral@example.com" style={{ color: 'var(--red)', textDecoration: 'none' }}>geral@example.com</a></li>
						<li><strong>{t('contact.phoneLabel')}:</strong> <a href="tel:+351234000000" style={{ color: 'var(--red)', textDecoration: 'none' }}>+351 234 000 000</a></li>
						<li><strong>{t('contact.locationLabel')}:</strong> {t('contact.locationValue')}</li>
						<li><strong>{t('contact.hoursLabel')}:</strong> {t('contact.hoursValue')}</li>
					</ul>
				</div>

				<form className="page-card" style={{ display: 'grid', gap: '1rem' }}>
					<label htmlFor="nome" style={{ fontWeight: 700, color: 'var(--red)' }}>{t('contact.nameLabel')}</label>
					<input id="nome" name="nome" type="text" required style={{ width: '100%', padding: '0.9rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
					<label htmlFor="email" style={{ fontWeight: 700, color: 'var(--red)' }}>{t('contact.emailLabel')}</label>
					<input id="email" name="email" type="email" required style={{ width: '100%', padding: '0.9rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
					<label htmlFor="mensagem" style={{ fontWeight: 700, color: 'var(--red)' }}>{t('contact.messageLabel')}</label>
					<textarea id="mensagem" name="mensagem" rows={5} required style={{ width: '100%', padding: '0.9rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
					<button type="submit" className="btn btn-primary">{t('contact.submitButton')}</button>
				</form>
			</section>

			<section className="container page-panel" style={{ marginBottom: '4rem' }}>
				<h2 className="page-heading">{t('contact.supportTitle')}</h2>
				<p className="page-copy">
					{t('contact.supportBody')}
				</p>
			</section>
		</AppLayout>
	);
}
