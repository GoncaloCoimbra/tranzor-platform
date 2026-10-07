import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import { apiClient } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useCartStore, fmt } from '../../store/cartStore';

export default function WishlistPage() {
	const user = useAuthStore(state => state.user);
	const navigate = useNavigate();
	const addItem = useCartStore(state => state.addItem);

	const [favorites, setFavorites] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [shareModal, setShareModal] = useState(false);
	const [shareLink, setShareLink] = useState('');
	const [copied, setCopied] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const fetchFavorites = async () => {
		if (!user) {
			setLoading(false);
			return;
		}

		try {
			const response = await apiClient.get<{ favorites: any[] }>('/account/favorites');
			if (!response.success || !response.data) {
				throw new Error(response.error?.message || 'Não foi possível carregar a lista de desejos.');
			}
			setFavorites(response.data.favorites || []);
		} catch (err: any) {
			setError(err.message || 'Erro ao carregar favoritos.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFavorites();
	}, [user]);

	const handleRemoveFavorite = async (productId: string) => {
		setRemovingId(productId);
		try {
			const response = await apiClient.delete(`/account/favorites/${productId}`);
			if (!response.success) {
				throw new Error(response.error?.message || 'Não foi possível remover o produto.');
			}
			setFavorites(prev => prev.filter(item => item._id !== productId && item.id !== productId));
		} catch (err: any) {
			setError(err.message || 'Erro ao remover favorito.');
		} finally {
			setRemovingId(null);
		}
	};

	const handleAddToCart = (product: any) => {
		addItem({
			id: product._id?.toString() ?? product.id?.toString(),
			name: product.name,
			price: Number(product.price ?? product.currentPrice ?? 0) || 0,
			quantity: 1,
			to: `/shop/product/${product.slug ?? product._id ?? product.id}`,
			image: product.images?.[0] || product.image || '',
		});
		window.dispatchEvent(new CustomEvent('Tranzor:cart-add'));
	};

	const handleShare = async (method: string) => {
		const url = shareLink || window.location.href;
		const message = `Confira a minha lista de desejos Tranzor: ${url}`;

		if (method === 'Copiar Link') {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(url);
				setCopied(true);
			}
			return;
		}

		if (method === 'Email') {
			window.open(`mailto:?subject=Minha%20Lista%20de%20Desejos&body=${encodeURIComponent(message)}`, '_blank');
			return;
		}

		if (method === 'WhatsApp') {
			window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
			return;
		}

		if (method === 'Facebook') {
			window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
		}
	};

	const totalValue = favorites.reduce((sum, item) => sum + (Number(item.price ?? item.currentPrice ?? 0) || 0), 0);
	const formattedTotalValue = fmt(totalValue);

	if (!user) {
		return (
			<AppLayout title="Lista de Desejos" description="Aceda à sua lista de produtos favoritos." canonical="/shop/wishlist">
				<section className="page-hero" style={{ background: 'linear-gradient(135deg, var(--red-dark), var(--red))' }}>
					<h1 style={{ color: 'white' }}>Minha Lista de Desejos</h1>
					<p className="page-copy" style={{ color: 'rgba(255,255,255,0.9)' }}>
						Faça login para guardar produtos favoritos e aceder à sua lista pessoal.
					</p>
				</section>

				<section style={{ padding: '4rem 0' }}>
					<div className="container" style={{ textAlign: 'center' }}>
						<div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--charcoal-2)', border: '1px solid var(--border)', borderRadius: 18, padding: '3rem 2rem' }}>
							<h2 style={{ marginBottom: 16 }}>Ainda não está logado</h2>
							<p style={{ color: 'var(--muted)', marginBottom: 24 }}>
								Para guardar produtos e aceder aos seus favoritos, efetue login na sua conta Tranzor.
							</p>
							<button onClick={() => navigate('/auth/login')} style={{ padding: '14px 24px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
								Entrar / Registar
							</button>
						</div>
					</div>
				</section>
			</AppLayout>
		);
	}

	if (loading) {
		return (
			<AppLayout title="Lista de Desejos" description="Aceda à sua lista de produtos favoritos." canonical="/shop/wishlist">
				<section className="page-hero" style={{ background: 'linear-gradient(135deg, var(--red-dark), var(--red))' }}>
					<h1 style={{ color: 'white' }}>Minha Lista de Desejos</h1>
					<p className="page-copy" style={{ color: 'rgba(255,255,255,0.9)' }}>
						A carregar os seus favoritos...
					</p>
				</section>
				<section style={{ padding: '4rem 0' }}>
					<div className="container" style={{ textAlign: 'center' }}>
						<div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--charcoal-2)', border: '1px solid var(--border)', borderRadius: 18, padding: '3rem 2rem' }}>
							<p style={{ color: 'var(--muted)' }}>Aguarde enquanto carregamos a sua lista de desejos.</p>
						</div>
					</div>
				</section>
			</AppLayout>
		);
	}

	const inStockCount = favorites.filter(item => item.inStock).length;

	const renderFavoriteItem = (item: any) => {
		const itemId = item._id?.toString() ?? item.id?.toString() ?? '';
		const productLink = `/shop/product/${item.slug ?? itemId}`;

		return (
			<div key={itemId} className="page-card" style={{ opacity: !item.inStock ? 0.6 : 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
				<Link to={productLink} style={{ display: 'block', marginBottom: '1rem' }}>
					<img
						src={item.images?.[0] || item.image || '/api/placeholder/300/300'}
						alt={item.name || 'Produto favorito'}
						style={{ width: '100%', borderRadius: 12, objectFit: 'cover', minHeight: 180 }}
					/>
				</Link>
				<div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>{item.category}</div>
				<h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', lineHeight: 1.3 }}>
					<Link to={productLink} style={{ color: 'inherit', textDecoration: 'none' }}>{item.name}</Link>
				</h3>
				<div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
					Adicionado em {item.dateAdded || '—'}
				</div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: 'auto' }}>
					<div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--red)' }}>{fmt(Number(item.price ?? item.currentPrice ?? 0) || 0)}</div>
					{!item.inStock && (
						<span style={{
							background: 'var(--red-muted)',
							color: 'var(--red)',
							padding: '0.3rem 0.6rem',
							borderRadius: '4px',
							fontSize: '0.75rem',
							fontWeight: 600
						}}>
							Indisponível
						</span>
					)}
				</div>
				<div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
					<button
						onClick={() => handleRemoveFavorite(itemId)}
						disabled={removingId === itemId}
						style={{
							width: '100%',
							padding: '10px',
							background: 'transparent',
							color: 'var(--red)',
							border: '1px solid var(--red)',
							borderRadius: '6px',
							fontSize: '0.85rem',
							fontWeight: 700,
							cursor: removingId === itemId ? 'not-allowed' : 'pointer'
						}}>
						Remover dos Favoritos
					</button>
					<button
						onClick={() => handleAddToCart(item)}
						disabled={!item.inStock}
						style={{
							width: '100%',
							padding: '10px',
							background: item.inStock ? 'var(--red)' : 'var(--surface-2)',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							fontSize: '0.9rem',
							fontWeight: 600,
							cursor: item.inStock ? 'pointer' : 'not-allowed'
						}}>
						Adicionar ao Carrinho
					</button>
				</div>
			</div>
		);
	};

	return (
		<AppLayout
			title="Minha Lista de Desejos"
			description="Guarde seus produtos favoritos Tranzor para comprar mais tarde."
			canonical="/shop/wishlist"
		>
			<section className="page-hero" style={{ background: 'linear-gradient(135deg, var(--red-dark), var(--red))' }}>
				<h1 style={{ color: 'white' }}>Minha Lista de Desejos</h1>
				<p className="page-copy" style={{ color: 'rgba(255,255,255,0.9)' }}>
					Guarde seus produtos favoritos para comprar depois e aceda a eles sempre que quiser.
				</p>
			</section>

			<section style={{ padding: '2rem 0' }}>
				<div className="container">
						{favorites.length > 0 ? (
						<>
							{/* Info Cards */}
							<div className="page-grid page-grid-3" style={{ marginBottom: '3rem' }}>
								<div className="page-card">
									<div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Itens na Lista</div>
									<div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--red)' }}>{favorites.length}</div>
								</div>

								<div className="page-card">
									<div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Disponíveis</div>
									<div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>{inStockCount}</div>
								</div>

								<div className="page-card">
									<div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Valor Total</div>
									<div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>
										{formattedTotalValue}
									</div>
								</div>
							</div>

							{/* Ações */}
							<div style={{
								display: 'flex',
								gap: '1rem',
								marginBottom: '2rem',
								flexWrap: 'wrap'
							}}>
								<button
									onClick={() => {
                                        setShareLink(window.location.href);
                                        setCopied(false);
                                        setShareModal(!shareModal);
                                    }}
									style={{
										padding: '12px 24px',
										background: 'var(--red)',
										color: 'white',
										border: 'none',
										borderRadius: '6px',
										fontSize: '1rem',
										fontWeight: 600,
										cursor: 'pointer'
									}}
								>
									Compartilhar Lista
								</button>
								<button
									onClick={() => favorites.forEach(item => handleAddToCart(item))}
									style={{
										padding: '12px 24px',
										background: 'var(--red-dark)',
										color: 'white',
										border: 'none',
										borderRadius: '6px',
										fontSize: '1rem',
										fontWeight: 600,
										cursor: 'pointer'
									}}
								>
									Adicionar todos ao Carrinho
								</button>
							</div>

							{shareModal && (
								<div style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
									gap: '1rem',
									background: 'var(--charcoal-2)',
									border: '1px solid var(--border)',
									borderRadius: 16,
									padding: '2rem',
									marginBottom: '2rem'
								}}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
										<h3 style={{ margin: 0 }}>Compartilhar Esta Lista</h3>
										<button
											onClick={() => setShareModal(false)}
											style={{
												padding: '10px 16px',
												borderRadius: 8,
												border: '1px solid var(--border)',
												background: 'transparent',
												cursor: 'pointer'
											}}
										>
											Fechar
										</button>
									</div>
									{['WhatsApp', 'Email', 'Facebook', 'Copiar Link'].map((method, idx) => (
										<button key={idx} onClick={() => handleShare(method)} style={{
											padding: '12px',
											background: 'var(--charcoal-3)',
											border: '1px solid var(--border)',
											borderRadius: '8px',
											cursor: 'pointer',
											fontWeight: 600,
											width: '100%'
										}}>
											{method === 'Copiar Link' && copied ? 'Link Copiado!' : method}
										</button>
									))}
								</div>
							)}

							{/* Lista de Produtos */}

							<div className="page-grid page-grid-4">{favorites.map(renderFavoriteItem)}</div>
						</>
					) : (
						<div style={{
							background: 'var(--charcoal-2)',
							borderRadius: '12px',
							border: '1px solid var(--border)',
							padding: '3rem',
							textAlign: 'center'
						}}>
							<h3 style={{ margin: '0 0 0.75rem 0' }}>Sua Lista de Desejos está Vazia</h3>
							<p style={{ margin: 0, color: 'var(--muted)' }}>Comece a adicionar produtos que gostaria de comprar mais tarde.</p>
						</div>
					)}
				</div>
			</section>
		</AppLayout>
	);
}
