import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import Review from '../models/Review';
import User from '../models/User';
import { isB2BRole, optionalAuth } from '../middleware/auth';
import { getCachedValue, setCachedValue } from '../utils/cache';
import { roundMoney } from '../utils/money';
import { getEffectivePrice, resolvePricingContext } from '../utils/pricingEngine';
import { measureShopOperation } from '../utils/metrics';
import { searchProducts } from '../services/productSearch';

const router = Router();
const CATALOG_CACHE_TTL_MS = 60_000;
const catalogInflight = new Map<string, Promise<unknown>>();

function buildCatalogCacheKey(route: string, payload: Record<string, any>) {
	return `catalog:${route}:${JSON.stringify(payload)}`;
}

async function getOrLoadCatalogValue<T>(key: string, load: () => Promise<T>): Promise<T> {
	const cached = await measureShopOperation('cache.read', () => getCachedValue<T>(key));
	if (cached !== null) {
		return cached;
	}

	const pending = catalogInflight.get(key);
	if (pending) {
		return pending.then(value => value as T);
	}

	const request = load()
		.then(async value => {
			await measureShopOperation('cache.write', () => setCachedValue(key, value, CATALOG_CACHE_TTL_MS));
			return value;
		})
		.finally(() => catalogInflight.delete(key));

	catalogInflight.set(key, request);
	return request;
}

async function getB2BPricing(req: Request) {
	if (!(req as any).user || !isB2BRole((req as any).user.role)) {
		return null;
	}

	const userId = (req as any).user.userId;
	const cacheKey = `pricing:user:${userId}`;
	const cachedPricing = await getCachedValue<any>(cacheKey);
	if (cachedPricing) {
		return cachedPricing;
	}

	const user = await User.findById(userId).select('b2bDiscountRate pricingTier pricingOverrides role').lean();
	if (!user) {
		return null;
	}

	const pricing = resolvePricingContext(user as any, 1);
	await setCachedValue(cacheKey, pricing, CATALOG_CACHE_TTL_MS);
	return pricing;
}

function applyAccountPricing(product: any, pricing: { discountRate: number; overrides: any[]; pricingTier: string }) {
	return {
		...product,
		accountPrice: getEffectivePrice(product.currentPrice, {
			role: 'b2b',
			pricingTier: pricing.pricingTier as any,
			pricingOverrides: pricing.overrides,
			b2bDiscountRate: pricing.discountRate,
		}, product._id?.toString(), undefined, 1),
		accountDiscountRate: pricing.discountRate
	};
}

function findProductByIdOrSlug(idOrSlug: string) {
	if (Types.ObjectId.isValid(idOrSlug)) {
		return Product.findById(idOrSlug);
	}

	return Product.findOne({ slug: idOrSlug });
}


// GET /shop/products - List products with advanced filtering
router.get('/products', optionalAuth, async (req: Request, res: Response) => {
	try {
		const {
			category,
			subcategory,
			brand,
			minPrice,
			maxPrice,
			inStock,
			isFeatured,
			isNew,
			search,
			view,
			sort = 'createdAt',
			order = 'desc',
			limit = 20,
			page = 1
		} = req.query;

		const accountPricing = await getB2BPricing(req);
		const query: any = { isActive: true, isDeleted: false };
		const sortOptions: any = {};

		if ((req as any).user && isB2BRole((req as any).user.role)) {
			const user = await User.findById((req as any).user.userId).select('authorizedProducts');
			if (user?.authorizedProducts && user.authorizedProducts.length > 0) {
				query._id = { $in: user.authorizedProducts };
			}
		}

		if (category) query.category = category;
		if (subcategory) query.subcategory = subcategory;
		if (brand) query.brand = brand;
		if (minPrice || maxPrice) {
			query.price = {};
			if (minPrice) query.price.$gte = Number(minPrice);
			if (maxPrice) query.price.$lte = Number(maxPrice);
		}
		if (inStock === 'true') query.inStock = true;
		if (isFeatured === 'true') query.isFeatured = true;
		if (isNew === 'true') query.isNew = true;

		if (search) {
			query.$text = { $search: search };
		}

		const sortOrder = order === 'asc' ? 1 : -1;
		switch (sort) {
			case 'price':
				sortOptions.price = sortOrder;
				break;
			case 'rating':
				sortOptions['rating.average'] = sortOrder;
				break;
			case 'name':
				sortOptions.name = sortOrder;
				break;
			case 'createdAt':
			default:
				sortOptions.createdAt = sortOrder;
				break;
		}

		const skip = (Number(page) - 1) * Number(limit);
		const cacheKey = buildCatalogCacheKey('products', {
			category,
			subcategory,
			brand,
			minPrice,
			maxPrice,
			inStock,
			isFeatured,
			isNew,
			search,
			view,
			sort,
			order,
			limit,
			page,
			userId: (req as any).user?.userId ?? 'anonymous'
		});
		const countCacheKey = buildCatalogCacheKey('product-count', { query });
		const productSelection = view === 'summary'
			? 'name slug price salePrice category subcategory brand sku barcode code images inStock stockQuantity rating isFeatured isNew createdAt'
			: undefined;
		const payload = await getOrLoadCatalogValue(cacheKey, async () => {
			const [products, total] = await Promise.all([
				measureShopOperation('catalog.products_query', () => {
					let productQuery = Product.find(query);
					if (productSelection) {
						productQuery = productQuery.select(productSelection);
					}
					return productQuery
						.populate('category', 'name slug')
						.sort(sortOptions)
						.limit(Number(limit))
						.skip(skip)
						.lean({ virtuals: true }).exec();
				}),
				getOrLoadCatalogValue(
					countCacheKey,
					() => measureShopOperation('catalog.count_query', () => Product.countDocuments(query).exec()),
				)
			]);
			const totalPages = Math.ceil(total / Number(limit));
			return {
				products,
				pagination: {
					currentPage: Number(page),
					totalPages,
					totalProducts: total,
					hasNextPage: Number(page) < totalPages,
					hasPrevPage: Number(page) > 1
				}
			};
		});

		const productsWithPricing = view === 'summary' || accountPricing
			? payload.products.map((product: any) => {
				const selectedProduct = view === 'summary'
					? { ...product, currentPrice: product.salePrice || product.price }
					: product;
				return accountPricing
					? applyAccountPricing(selectedProduct, accountPricing)
					: selectedProduct;
			})
			: payload.products;

		res.json({
			success: true,
			products: productsWithPricing,
			pagination: payload.pagination
		});
	} catch (error) {
		console.error('Get products error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/products/:id - Get product details with reviews
router.get('/products/:id', optionalAuth, async (req: Request, res: Response) => {
	try {
		const accountPricing = await getB2BPricing(req);
		const product = await getOrLoadCatalogValue(
			buildCatalogCacheKey('product-detail', { idOrSlug: req.params.id }),
			() => measureShopOperation('detail.product_query', () => findProductByIdOrSlug(req.params.id)
				.populate('category', 'name slug description')
				.populate('createdBy', 'name')
				.lean({ virtuals: true }).exec()),
		);

		if (!product) {
			return res.status(404).json({
				success: false,
				error: 'Produto não encontrado'
			});
		}

		const productId = product._id.toString();
		const [reviewData, viewCountUpdate] = await Promise.all([
			measureShopOperation('detail.reviews', () => getOrLoadCatalogValue(
				buildCatalogCacheKey('product-reviews', { productId }),
				async () => Promise.all([
					Review.getProductReviews(product._id as any),
					Review.getAverageRating(product._id as any),
				]),
			)),
			measureShopOperation('detail.view_count_write', () => Product.findByIdAndUpdate(
				product._id,
				{ $inc: { viewCount: 1 } },
				{ returnDocument: 'after' },
			).select('viewCount').lean().exec()),
		]);
		if (!viewCountUpdate) {
			throw new Error(`Product ${productId} disappeared before its view count could be updated`);
		}
		const [reviews, ratingStats] = reviewData;

		const responseProduct: any = {
			...product,
			viewCount: viewCountUpdate.viewCount,
			currentPrice: product.currentPrice,
			discountPercentage: product.discountPercentage
		};

		if (accountPricing) {
			responseProduct.accountPrice = getEffectivePrice(product.currentPrice, {
				role: 'b2b',
				pricingTier: accountPricing.pricingTier as any,
				pricingOverrides: accountPricing.overrides,
				b2bDiscountRate: accountPricing.discountRate,
			}, product._id.toString(), undefined, 1);
			responseProduct.accountDiscountRate = accountPricing.discountRate;
		}

		res.json({
			success: true,
			data: {
				product: responseProduct,
				reviews,
				ratingStats
			}
		});
	} catch (error) {
		console.error('Get product error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/products/:id/reviews - Get product reviews
router.get('/products/:id/reviews', async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 10 } = req.query;
		const skip = (Number(page) - 1) * Number(limit);

		const reviews = await Review.find({
			product: req.params.id as any,
			isApproved: true
		} as any)
		.populate('user', 'name')
		.sort({ createdAt: -1 })
		.limit(Number(limit))
		.skip(skip);

		const total = await Review.countDocuments({
			product: req.params.id as any,
			isApproved: true
		} as any);

		res.json({
			success: true,
			reviews,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				totalReviews: total
			}
		});
	} catch (error) {
		console.error('Get product reviews error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/categories - Get all categories
router.get('/categories', async (req: Request, res: Response) => {
	try {
		const categories = await getOrLoadCatalogValue(
			buildCatalogCacheKey('categories', {}),
			() => measureShopOperation('catalog.categories_query', () => Category.getTree()),
		);

		res.json({
			success: true,
			categories
		});
	} catch (error) {
		console.error('Get categories error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/categories/:slug - Get category products
router.get('/categories/:slug', optionalAuth, async (req: Request, res: Response) => {
	try {
		const accountPricing = await getB2BPricing(req);
		const category = await Category.findOne({ slug: req.params.slug });

		if (!category) {
			return res.status(404).json({
				success: false,
				error: 'Categoria não encontrada'
			});
		}

		const { page = 1, limit = 20 } = req.query;
		const skip = (Number(page) - 1) * Number(limit);
		const total = await Product.countDocuments({
			category: category._id as any,
			isActive: true
		} as any);

		const products = await Product.find({
			category: category._id as any,
			isActive: true
		} as any)
		.sort({ createdAt: -1 })
		.limit(Number(limit))
		.skip(skip)
		.lean({ virtuals: true });

		const productsWithPricing = accountPricing
			? products.map((product: any) => applyAccountPricing(product, accountPricing))
			: products;
		res.json({
			success: true,
			category,
			products: productsWithPricing,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				totalProducts: total
			}
		});
	} catch (error) {
		console.error('Get category products error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/search - Advanced search
router.get('/search', optionalAuth, async (req: Request, res: Response) => {
	try {
		const accountPricing = await getB2BPricing(req);
		const { category, limit = 20, page = 1 } = req.query;
		const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

		if (!q) {
			return res.status(400).json({
				success: false,
				error: 'Termo de busca é obrigatório'
			});
		}

		const skip = (Number(page) - 1) * Number(limit);
		const searchOptions = {
			category: typeof category === 'string' ? category : undefined,
			page: Number(page),
			limit: Number(limit),
		};

		const userId = (req as any).user?.userId ?? 'anonymous';
		const cacheKey = buildCatalogCacheKey('search', {
			q: q.toLocaleLowerCase(),
			category,
			limit,
			page,
			userId
		});
		const payload = await getOrLoadCatalogValue(cacheKey, async () => {
			let products;
			let total;
			const searchResult = await measureShopOperation('search.engine_query', () => searchProducts(q, searchOptions));

			if (searchResult) {
				const foundProducts = await measureShopOperation('search.product_hydration', () => Product.find({
					_id: { $in: searchResult.ids },
					isActive: true,
					isDeleted: false,
				})
					.populate('category', 'name slug')
					.lean({ virtuals: true }).exec());
				const productsById = new Map(foundProducts.map(product => [product._id.toString(), product]));
				products = searchResult.ids
					.map(id => productsById.get(id))
					.filter((product): product is NonNullable<typeof product> => Boolean(product));
				total = searchResult.total;
			} else {
				const query: any = {
					isActive: true,
					isDeleted: false,
					$text: { $search: q }
				};
				if (searchOptions.category) query.category = searchOptions.category;

				const [fallbackProducts, fallbackTotal] = await Promise.all([
					measureShopOperation('search.mongo_fallback_query', () => Product.find(query, { score: { $meta: 'textScore' } })
						.populate('category', 'name slug')
						.sort({ score: { $meta: 'textScore' } })
						.limit(Number(limit))
						.skip(skip)
						.lean({ virtuals: true }).exec()),
					measureShopOperation('search.mongo_fallback_count', () => getOrLoadCatalogValue(
						buildCatalogCacheKey('search-count', { query }),
						() => measureShopOperation('search.mongo_fallback_count_query', () => Product.countDocuments(query).exec()),
					))
				]);
				products = fallbackProducts;
				total = fallbackTotal;
			}

			return {
				products,
				pagination: {
					currentPage: Number(page),
					totalPages: Math.ceil(total / Number(limit)),
					totalProducts: total
				}
			};
		});

		const productsWithPricing = accountPricing
			? payload.products.map((product: any) => applyAccountPricing(product, accountPricing))
			: payload.products;

		res.json({
			success: true,
			query: q,
			products: productsWithPricing,
			pagination: payload.pagination
		});
	} catch (error) {
		console.error('Search error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/long-tail/:slug - Long-tail SEO page metadata and aggregate offer schema
router.get('/long-tail/:slug', optionalAuth, async (req: Request, res: Response) => {
	try {
		const category = await Category.findOne({ slug: req.params.slug });
		if (!category) {
			return res.status(404).json({ success: false, error: 'Categoria não encontrada' });
		}

		const products = await Product.find({ category: category._id as any, isActive: true } as any)
			.sort({ salesCount: -1 })
			.limit(30)
			.lean({ virtuals: true });

		const prices = products.map((product: any) => product.currentPrice || product.price);
		const lowPrice = prices.length ? Math.min(...prices) : 0;
		const highPrice = prices.length ? Math.max(...prices) : 0;

		const schema = {
			'@context': 'https://schema.org',
			'@type': 'AggregateOffer',
			'name': `Compras em volume de ${category.name}`,
			'description': `Ofertas B2B para ${category.name} com preços de volume e descontos por palete.`,
			'priceCurrency': 'EUR',
			'lowPrice': lowPrice,
			'highPrice': highPrice,
			'offerCount': products.length,
			'itemCondition': 'https://schema.org/NewCondition',
			'availability': products.some((product: any) => product.inStock) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
			'category': category.name
		};

		res.json({
			success: true,
			seo: {
				title: `Comprar ${category.name} em volume industrial`,
				description: `Encontre descontos exclusivos para empresas em ${category.name}, com ofertas de volume e condições B2B.`,
				keywords: [category.name, 'comprar em volume', 'desconto B2B', 'palete', 'oferta agregada'],
				jsonLd: schema
			},
			products: products.slice(0, 20)
		});
	} catch (error) {
		console.error('Long-tail SEO page error:', error);
		res.status(500).json({ success: false, error: 'Erro ao gerar página SEO de cauda longa' });
	}
});

// GET /shop/featured - Get featured products
router.get('/featured', optionalAuth, async (req: Request, res: Response) => {
	try {
		const accountPricing = await getB2BPricing(req);
		const { limit = 10 } = req.query;

		const products = await Product.findFeatured(Number(limit));
		const productsWithPricing = accountPricing
			? products.map((product: any) => applyAccountPricing(product, accountPricing))
			: products;

		res.json({
			success: true,
			products: productsWithPricing
		});
	} catch (error) {
		console.error('Get featured products error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/brands - Get all brands
router.get('/brands', async (req: Request, res: Response) => {
	try {
		const brands = await Product.distinct('brand', { isActive: true });

		res.json({
			success: true,
			brands: brands.filter(Boolean)
		});
	} catch (error) {
		console.error('Get brands error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /shop/products/:id/dynamic-price - Calculate dynamic price based on quantity
router.get('/products/:id/dynamic-price', optionalAuth, async (req: Request, res: Response) => {
	try {
		const { quantity = 1 } = req.query;
		const qty = Number(quantity);

		if (qty < 1) {
			return res.status(400).json({
				success: false,
				error: 'Quantidade deve ser maior que 0'
			});
		}

const product = await findProductByIdOrSlug(req.params.id);
		if (!product || !product.isActive) {
			return res.status(404).json({
				success: false,
				error: 'Produto não encontrado'
			});
		}

		const accountPricing = await getB2BPricing(req);
		const b2bDiscount = accountPricing?.discountRate ?? 0;

		const dynamicPrice = getEffectivePrice(product.currentPrice || product.price, {
			role: 'b2b',
			pricingTier: accountPricing?.pricingTier as any,
			pricingOverrides: accountPricing?.overrides,
			b2bDiscountRate: b2bDiscount,
		}, product._id.toString(), undefined, qty);

		// Fetch volume discount tiers for reference
		const volumeTiers = product.volumeDiscounts || [];
		const applicableTier = volumeTiers
			.filter((tier: any) => qty >= tier.minQuantity)
			.sort((a: any, b: any) => b.minQuantity - a.minQuantity)
			.shift();

		res.json({
			success: true,
			product: {
				id: product._id,
				name: product.name,
				basePrice: product.currentPrice || product.price,
				dynamicPrice,
				quantity: qty,
				applicableTier: applicableTier ? {
					minQuantity: applicableTier.minQuantity,
					discountPercent: applicableTier.discountPercent
				} : null,
				b2bDiscount,
				volumeTiers: volumeTiers.map((tier: any) => ({
					minQuantity: tier.minQuantity,
					discountPercent: tier.discountPercent
				})),
				totalForQuantity: roundMoney(dynamicPrice * qty)
			}
		});
	} catch (error) {
		console.error('Get dynamic price error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro ao calcular preço dinâmico'
		});
	}
});

export default router;