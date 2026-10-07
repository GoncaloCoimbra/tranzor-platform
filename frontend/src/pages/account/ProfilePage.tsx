import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';
import i18n from '@/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientCard {
	id: string;
	createdAt: string;
}

interface Profile {
	name: string;
	email: string;
	phone: string;
	company?: string;
	taxId?: string;
	address: string;
	isStudent: boolean;
	studentProof: File | null;
	clientCard: ClientCard | null;
}

interface Notifications {
	email: boolean;
	push: boolean;
	sms: boolean;
	marketing: boolean;
}

interface FormErrors {
	name?: string;
	email?: string;
	phone?: string;
	company?: string;
	taxId?: string;
	address?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\+\-\(\)]{9,15}$/;

function validateProfile(profile: Profile, t: (key: string) => string): FormErrors {
	const errors: FormErrors = {};
	if (!profile.name.trim()) errors.name = t('account.profile.validation.nameRequired');
	else if (profile.name.trim().length < 2) errors.name = t('account.profile.validation.nameTooShort');
	if (!profile.email.trim()) errors.email = t('account.profile.validation.emailRequired');
	else if (!EMAIL_RE.test(profile.email)) errors.email = t('account.profile.validation.emailInvalid');
	if (profile.phone && !PHONE_RE.test(profile.phone)) errors.phone = t('account.profile.validation.phoneInvalid');
	if (profile.company && profile.company.trim().length < 2) errors.company = t('account.profile.validation.companyInvalid');
	if (profile.taxId && !/^[0-9]{9}$/.test(profile.taxId)) errors.taxId = t('account.profile.validation.taxIdInvalid');
	if (!profile.address.trim()) errors.address = t('account.profile.validation.addressRequired');
	return errors;
}

// ─── API helpers ───────────────────────────────────────────────────────────

function formatAddress(address: any) {
	if (!address) return '';
	if (typeof address === 'string') return address;
	return [address.street, address.city, address.postalCode, address.country]
		.filter(Boolean)
		.join(', ');
}

const api = {
	fetchProfile: async (): Promise<Omit<Profile, 'studentProof' | 'clientCard'> & { clientCard: ClientCard | null }> => {
		const response = await apiClient.get<{ user: any }>('/account/profile');
		if (!response.success) {
			throw new Error(response.error?.message || 'account.profile.errors.fetchProfile');
		}

		const user = response.data?.user ?? (response as any).user;
		if (!user) {
			throw new Error(response.error?.message || 'account.profile.errors.fetchProfile');
		}

		return {
			name: user.name || '',
			email: user.email || '',
			phone: user.profile?.phone || '',
			company: user.profile?.company || '',
			taxId: user.profile?.taxId || '',
			address: formatAddress(user.profile?.address),
			isStudent: user.profile?.isStudent ?? false,
			clientCard: user.clientCard ? { id: user.clientCard.id, createdAt: user.clientCard.createdAt } : null,
		};
	},
	saveProfile: async (data: Partial<Profile>): Promise<void> => {
		const response = await apiClient.put('/account/profile', data);
		if (!response.success) {
			throw new Error(response.error?.message || 'account.profile.errors.saveProfile');
		}
	},
	createClientCard: async (): Promise<ClientCard> => {
		const response = await apiClient.post<{ clientCard: ClientCard }>('/account/client-card');
		if (!response.success || !response.data) {
			throw new Error(response.error?.message || 'account.profile.errors.createClientCard');
		}
		return response.data.clientCard;
	},
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleSwitchProps {
	checked: boolean;
	onChange: () => void;
	id: string;
}

function ToggleSwitch({ checked, onChange, id }: ToggleSwitchProps) {
	return (
		<label htmlFor={id} className="toggle-switch" aria-checked={checked} role="switch">
			<input
				id={id}
				type="checkbox"
				checked={checked}
				onChange={onChange}
				className="toggle-input"
			/>
			<span className="toggle-track">
				<span className="toggle-thumb" />
			</span>
		</label>
	);
}

interface FieldProps {
	label: string;
	error?: string;
	children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
	return (
		<div className={`profile-field${error ? ' profile-field--error' : ''}`}>
			<label className="profile-label">{label}</label>
			{children}
			{error && <span className="profile-error">{error}</span>}
		</div>
	);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
	const { t } = useTranslation();
	const [profile, setProfile] = useState<Profile>({
		name: '',
		email: '',
		phone: '',
		address: '',
		isStudent: false,
		studentProof: null,
		clientCard: null,
	});
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState<Profile | null>(null);
	const [errors, setErrors] = useState<FormErrors>({});
	const [loading, setLoading] = useState(false);
	const [pageLoading, setPageLoading] = useState(true);
	const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
	const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
	const [notifications, setNotifications] = useState<Notifications>({
		email: true,
		push: false,
		sms: false,
		marketing: false,
	});

	// ── Load initial data ────────────────────────────────────────────────────

	useEffect(() => {
		const savedLang = localStorage.getItem('site-language') as 'pt' | 'en' | 'es' | null;
		if (savedLang) {
			setLanguage(savedLang);
		}

		const savedNotifs = localStorage.getItem('notifications');
		if (savedNotifs) {
			try { setNotifications(JSON.parse(savedNotifs)); } catch { /* ignore */ }
		}

		api.fetchProfile()
			.then(data => setProfile(prev => ({ ...prev, ...data })))
			.catch(() => setStatus('error', t('account.profile.errors.fetchProfile')))
			.finally(() => setPageLoading(false));
	}, []);

	// ── Helpers ──────────────────────────────────────────────────────────────

	const setStatus = (type: 'success' | 'error', text: string) => {
		setStatusMessage({ type, text });
		setTimeout(() => setStatusMessage(null), 4000);
	};

	const applyDarkMode = (isDark: boolean) => {
		document.documentElement.classList.toggle('theme-dark', isDark);
	};

	// ── Handlers ─────────────────────────────────────────────────────────────

	const handleEditStart = () => {
		setDraft({ ...profile });
		setErrors({});
		setEditing(true);
	};

	const handleEditCancel = () => {
		if (draft) setProfile(draft);
		setDraft(null);
		setErrors({});
		setEditing(false);
	};

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setProfile(prev => ({ ...prev, [name]: value }));
		setErrors(prev => ({ ...prev, [name]: undefined }));
	}, []);

	const handleNotificationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const updated = { ...notifications, [e.target.name]: e.target.checked };
		setNotifications(updated);
		localStorage.setItem('notifications', JSON.stringify(updated));
	}, [notifications]);

	const handleStudentToggle = () => setProfile(prev => ({ ...prev, isStudent: !prev.isStudent }));

	const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] ?? null;
		if (file && file.size > 5 * 1024 * 1024) {
			setStatus('error', t('account.profile.uploadTooLarge'));
			return;
		}
		setProfile(prev => ({ ...prev, studentProof: file }));
	};

	const handleDarkModeToggle = () => {
		const next = !darkMode;
		setDarkMode(next);
		localStorage.setItem('darkMode', String(next));
		applyDarkMode(next);
	};

	const handleLanguageChange = (newLang: 'pt' | 'en' | 'es') => {
		setLanguage(newLang);
		localStorage.setItem('site-language', newLang);
		void i18n.changeLanguage(newLang);
	};

	const handleSave = async () => {
		const validationErrors = validateProfile(profile, t);
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			return;
		}
		setLoading(true);
		try {
			await api.saveProfile({
				name: profile.name,
				email: profile.email,
				phone: profile.phone,
				company: profile.company,
				taxId: profile.taxId,
				address: profile.address,
				isStudent: profile.isStudent,
			});
			setDraft(null);
			setEditing(false);
			setStatus('success', t('account.profile.messages.profileUpdated'));
		} catch {
			setStatus('error', t('account.profile.messages.saveFailed'));
		} finally {
			setLoading(false);
		}
	};

	const handleCreateClientCard = async () => {
		setLoading(true);
		try {
			const card = await api.createClientCard();
			setProfile(prev => ({ ...prev, clientCard: card }));
			setStatus('success', t('account.profile.messages.clientCardCreated'));
		} catch {
			setStatus('error', t('account.profile.messages.clientCardCreateFailed'));
		} finally {
			setLoading(false);
		}
	};

	// ── Discount info ────────────────────────────────────────────────────────

	const discountInfo = profile.isStudent
		? { status: t('account.profile.discount.student.status'), discount: t('account.profile.discount.student.discount'), benefits: [t('account.profile.discount.student.benefit1'), t('account.profile.discount.student.benefit2'), t('account.profile.discount.student.benefit3')] }
		: { status: t('account.profile.discount.regular.status'), discount: t('account.profile.discount.regular.discount'), benefits: [t('account.profile.discount.regular.benefit')] };

	// ── Render ───────────────────────────────────────────────────────────────

	if (pageLoading) {
		return (
			<AppLayout>
				<div className="profile-loading">
					<span className="profile-spinner" />
					<p>{t('account.profile.loading')}</p>
				</div>
			</AppLayout>
		);
	}

	return (
		<AppLayout>
			<style>{STYLES}</style>

			<section className="page-hero">
				<h1>{t('account.profile.pageTitle')}</h1>
				<p className="page-copy">{t('account.profile.pageDescription')}</p>
			</section>

			{/* Status toast */}
			{statusMessage && (
				<div className={`profile-toast profile-toast--${statusMessage.type}`} role="alert">
					{statusMessage.text}
				</div>
			)}

			{/* ── Informações Pessoais ── */}
			<section className="container page-panel profile-section">
				<div className="profile-section-header">
					<h2>{t('account.profile.sections.personalInfo')}</h2>
					<div className="profile-actions">
						{editing ? (
							<>
								<button className="btn btn--ghost" onClick={handleEditCancel} disabled={loading}>
									{t('common.cancel')}
								</button>
								<button className="btn btn--primary" onClick={handleSave} disabled={loading}>
									{loading ? t('account.profile.actions.saving') : t('common.save')}
								</button>
							</>
						) : (
							<button className="btn btn--primary" onClick={handleEditStart}>
								{t('common.edit')}
							</button>
						)}
					</div>
				</div>

				<div className="profile-grid">
					<Field label={t('account.profile.fields.name')} error={errors.name}>
						<input className="profile-input" type="text" name="name" value={profile.name} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.fullName')} />
					</Field>
					<Field label={t('account.profile.fields.email')} error={errors.email}>
						<input className="profile-input" type="email" name="email" value={profile.email} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.email')} />
					</Field>
					<Field label={t('account.profile.fields.phone')} error={errors.phone}>
						<input className="profile-input" type="tel" name="phone" value={profile.phone} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.phone')} />
					</Field>
					<Field label={t('account.profile.fields.company')} error={errors.company}>
			<input className="profile-input" type="text" name="company" value={profile.company || ''} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.company')} />
		</Field>
		<Field label={t('account.profile.fields.taxId')} error={errors.taxId}>
			<input className="profile-input" type="text" name="taxId" value={profile.taxId || ''} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.taxId')} />
		</Field>
		<Field label={t('account.profile.fields.address')} error={errors.address}>
						<input className="profile-input" type="text" name="address" value={profile.address} onChange={handleChange} disabled={!editing} placeholder={t('account.profile.placeholders.address')} />
					</Field>
				</div>
			</section>

			{/* ── Preferências ── */}
			<section className="container page-panel profile-section">
				<h2>{t('account.profile.sections.preferences')}</h2>
				<div className="profile-toggle-row">
					<div>
						<h3 className="profile-toggle-title">{t('account.profile.preferences.darkMode.title')}</h3>
						<p className="profile-toggle-desc">{t('account.profile.preferences.darkMode.description')}</p>
					</div>
					<ToggleSwitch id="dark-mode" checked={darkMode} onChange={handleDarkModeToggle} />
				</div>
				<div className="profile-field" style={{ marginTop: '1.5rem' }}>
					<label className="profile-label">{t('account.profile.preferences.language.title')}</label>
					<p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
						{t('account.profile.preferences.language.description')}
					</p>
					<select
						value={language}
						onChange={e => handleLanguageChange(e.target.value as 'pt' | 'en' | 'es')}
						style={{
							width: '100%',
							padding: '0.75rem',
							borderRadius: '0.5rem',
							border: '1px solid var(--border)',
							fontSize: '0.9375rem',
							fontFamily: 'inherit',
							cursor: 'pointer',
							backgroundColor: 'var(--surface)',
						}}
					>
						<option value="pt">{t('account.profile.preferences.language.languages.pt')}</option>
						<option value="en">{t('account.profile.preferences.language.languages.en')}</option>
						<option value="es">{t('account.profile.preferences.language.languages.es')}</option>
					</select>
				</div>
			</section>

			{/* ── Notificações ── */}
			<section className="container page-panel profile-section">
				<h2>{t('account.profile.sections.notifications')}</h2>
				{([
					{ key: 'email', label: t('account.profile.notifications.email.label'), desc: t('account.profile.notifications.email.description') },
					{ key: 'push', label: t('account.profile.notifications.push.label'), desc: t('account.profile.notifications.push.description') },
					{ key: 'sms', label: t('account.profile.notifications.sms.label'), desc: t('account.profile.notifications.sms.description') },
					{ key: 'marketing', label: t('account.profile.notifications.marketing.label'), desc: t('account.profile.notifications.marketing.description') },
				] as const).map(({ key, label, desc }) => (
					<div key={key} className="profile-toggle-row">
						<div>
							<h3 className="profile-toggle-title">{label}</h3>
							<p className="profile-toggle-desc">{desc}</p>
						</div>
						<ToggleSwitch
							id={`notif-${key}`}
							checked={notifications[key]}
							onChange={() => handleNotificationChange({ target: { name: key, checked: !notifications[key] } } as React.ChangeEvent<HTMLInputElement>)}
						/>
					</div>
				))}
			</section>

			{/* ── Status de Estudante ── */}
			<section className="container page-panel profile-section">
				<h2>{t('account.profile.sections.studentStatus')}</h2>
				<div className="profile-toggle-row">
					<div>
						<h3 className="profile-toggle-title">{t('account.profile.student.toggleTitle')}</h3>
						<p className="profile-toggle-desc">{t('account.profile.student.toggleDescription')}</p>
					</div>
					<ToggleSwitch id="is-student" checked={profile.isStudent} onChange={handleStudentToggle} />
				</div>

				{profile.isStudent && (
					<div className="profile-card profile-card--muted" style={{ marginTop: 16 }}>
						<h4 className="profile-card-title">{t('account.profile.student.proofTitle')}</h4>
						<p className="profile-toggle-desc" style={{ marginBottom: 12 }}>
							{t('account.profile.student.proofDescription')}
						</p>
						<input
							type="file"
							accept=".pdf,.jpg,.jpeg,.png"
							onChange={handleProofUpload}
							className="profile-file-input"
						/>
						{profile.studentProof && (
							<p className="profile-file-name">✓ {profile.studentProof.name}</p>
						)}
						<p className="profile-hint">{t('account.profile.student.fileHint')}</p>
					</div>
				)}
			</section>

			{/* ── Programa de Descontos ── */}
			<section className="container page-panel profile-section">
				<h2>{t('account.profile.sections.discountProgram')}</h2>
				<div className="profile-card profile-card--muted">
					<span className="profile-badge">{discountInfo.status}</span>
					<p className="profile-discount-desc">{discountInfo.discount}</p>
					<ul className="profile-benefits">
						{discountInfo.benefits.map((b, i) => <li key={i}>{b}</li>)}
					</ul>
					<p className="profile-hint">{t('account.profile.discount.contactSupport')}</p>
				</div>
			</section>

			{/* ── Ficha de Cliente ── */}
			<section className="container page-panel profile-section" style={{ marginBottom: '4rem' }}>
				<h2>{t('account.profile.sections.clientCard')}</h2>
				{profile.clientCard ? (
					<div className="profile-card profile-card--muted">
						<span className="profile-badge">{t('account.profile.clientCard.activeBadge')}</span>
						<p className="profile-discount-desc">ID: <strong>{profile.clientCard.id}</strong></p>
						<p className="profile-hint">
							{t('account.profile.clientCard.createdOn', { date: new Date(profile.clientCard.createdAt).toLocaleDateString() })}
						</p>
						<button className="btn btn--primary" style={{ marginTop: 12 }}>
							{t('account.profile.clientCard.viewCard')}
						</button>
					</div>
				) : (
					<div className="profile-card profile-card--center">
						<h3 className="profile-card-title">{t('account.profile.clientCard.createTitle')}</h3>
						<p className="profile-toggle-desc" style={{ marginBottom: 20 }}>
							{t('account.profile.clientCard.createDescription')}
						</p>
						<button
							className="btn btn--primary"
							onClick={handleCreateClientCard}
							disabled={loading}
						>
							{loading ? t('account.profile.clientCard.creating') : t('account.profile.clientCard.createButton')}
						</button>
					</div>
				)}
			</section>
		</AppLayout>
	);
}

// ─── Scoped styles ────────────────────────────────────────────────────────────

const STYLES = `
.profile-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 300px;
	gap: 16px;
	color: var(--text-muted);
}
.profile-spinner {
	width: 32px;
	height: 32px;
	border: 3px solid var(--border);
	border-top-color: var(--red);
	border-radius: 50%;
	animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.profile-toast {
	position: fixed;
	bottom: 24px;
	right: 24px;
	z-index: 1000;
	padding: 14px 20px;
	border-radius: 8px;
	font-size: 14px;
	font-weight: 600;
	box-shadow: 0 4px 16px rgba(0,0,0,0.15);
	animation: slideUp 0.25s ease;
}
.profile-toast--success { background: #22c55e; color: #fff; }
.profile-toast--error   { background: var(--red); color: #fff; }
@keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }

.profile-section { margin-bottom: 2rem; }

.profile-section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	margin-bottom: 24px;
}

.profile-actions { display: flex; gap: 8px; }

.btn {
	padding: 10px 18px;
	border-radius: 8px;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	border: none;
	transition: opacity 0.15s, transform 0.1s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn:not(:disabled):active { transform: scale(0.97); }
.btn--primary { background: var(--red); color: #fff; }
.btn--primary:not(:disabled):hover { opacity: 0.88; }
.btn--ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn--ghost:hover { background: var(--charcoal-2); }

.profile-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}
@media (max-width: 600px) { .profile-grid { grid-template-columns: 1fr; } }

.profile-field { display: flex; flex-direction: column; gap: 6px; }
.profile-field--error .profile-input { border-color: var(--red) !important; }

.profile-label { font-size: 14px; font-weight: 600; }

.profile-input {
	width: 100%;
	padding: 11px 12px;
	border: 1px solid var(--border);
	border-radius: 6px;
	font-size: 15px;
	background: var(--bg);
	color: var(--text);
	transition: border-color 0.15s, box-shadow 0.15s;
	box-sizing: border-box;
}
.profile-input:focus { outline: none; border-color: var(--red); box-shadow: 0 0 0 3px rgba(217,4,41,0.12); }
.profile-input:disabled { background: var(--charcoal-2); cursor: default; opacity: 0.75; }

.profile-error { font-size: 12px; color: var(--red); font-weight: 500; }

.profile-toggle-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 0;
	border-bottom: 1px solid var(--border);
	gap: 16px;
}
.profile-toggle-row:last-of-type { border-bottom: none; }
.profile-toggle-title { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.profile-toggle-desc { margin: 0; font-size: 13px; color: var(--text-muted); }

/* Toggle Switch */
.toggle-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
.toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
	position: relative;
	width: 46px;
	height: 24px;
	background: #ccc;
	border-radius: 24px;
	transition: background 0.2s;
}
.toggle-switch[aria-checked="true"] .toggle-track { background: var(--red); }
.toggle-thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 18px;
	height: 18px;
	background: #fff;
	border-radius: 50%;
	transition: left 0.2s;
	box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-switch[aria-checked="true"] .toggle-thumb { left: 25px; }

/* Cards */
.profile-card {
	padding: 20px;
	border-radius: 10px;
	border: 1px solid var(--border);
}
.profile-card--muted { background: var(--charcoal-2); }
.profile-card--center { text-align: center; }
.profile-card-title { margin: 0 0 8px; font-size: 16px; font-weight: 700; }

.profile-badge {
	display: inline-block;
	padding: 4px 10px;
	background: var(--red);
	color: #fff;
	border-radius: 20px;
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.03em;
	margin-bottom: 10px;
}

.profile-discount-desc { margin: 8px 0; font-size: 15px; }

.profile-benefits {
	list-style: none;
	padding: 0;
	margin: 10px 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.profile-benefits li::before { content: '✓  '; color: var(--red); font-weight: 700; }
.profile-benefits li { font-size: 14px; color: var(--text-muted); }

.profile-hint { margin: 8px 0 0; font-size: 12px; color: var(--text-muted); }

.profile-file-input {
	display: block;
	margin-bottom: 8px;
	font-size: 13px;
	max-width: 320px;
}
.profile-file-name { margin: 0 0 4px; font-size: 13px; color: var(--red); font-weight: 600; }
`;