import { Router, Request, Response } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Category from '../models/Category';
import Order from '../models/Order';
import Review from '../models/Review';
import B2BQuote from '../models/B2BQuote';
import AnalyticsEvent from '../models/AnalyticsEvent';
import { requireRole } from '../middleware/auth';
import { summarizeAnalyticsEvents } from '../services/analyticsSummary';
import { generateSaftExport } from '../services/saftService';
import { reconcileStripePayments } from '../services/stripeReconciliation';
import { removeProductFromSearch, syncProductsToSearch } from '../services/productSearch';
import { clearCacheByPrefix } from '../utils/cache';

const router = Router();

// Apply admin role middleware to all routes
router.use(requireRole(['admin']));

// GET /admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
	try {
		const [
			totalUsers,
			totalProducts,
			totalOrders,
			totalRevenue,
			recentOrders,
			lowStockProducts
		] = await Promise.all([
			User.countDocuments({ isActive: true }),
			Product.countDocuments({ isActive: true }),
			Order.countDocuments(),
			Order.aggregate([
				{ $match: { paymentStatus: 'paid' } },
				{ $group: { _id: null, total: { $sum: '$total' } } }
			]),
			Order.find()
				.sort({ createdAt: -1 })
				.limit(5)
				.populate('user', 'name')
				.select('orderNumber total status createdAt'),
			Product.find({
				isActive: true,
				stockQuantity: { $lte: 5 }
			})
			.select('name stockQuantity lowStockThreshold')
			.limit(10)
		]);

		const revenue = totalRevenue[0]?.total || 0;

		// Monthly stats (simplified)
		const currentMonth = new Date();
		currentMonth.setDate(1);
		const monthlyOrders = await Order.countDocuments({
			createdAt: { $gte: currentMonth }
		});

		res.json({
			success: true,
			stats: {
				totalUsers,
				totalProducts,
				totalOrders,
				totalRevenue: revenue,
				monthlyOrders,
				lowStockCount: lowStockProducts.length
			},
			recentOrders,
			lowStockProducts
		});
	} catch (error) {
		console.error('Get dashboard error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

router.get('/analytics', async (req: Request, res: Response) => {
	try {
		const startDateValue = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
		const endDateValue = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
		const category = typeof req.query.category === 'string' ? req.query.category : undefined;
		const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
		const product = typeof req.query.product === 'string' ? req.query.product : undefined;

		const startDate = startDateValue ? new Date(startDateValue) : undefined;
		const endDate = endDateValue ? new Date(endDateValue) : undefined;
		const isValidStartDate = startDate && !Number.isNaN(startDate.getTime());
		const isValidEndDate = endDate && !Number.isNaN(endDate.getTime());

		const events = await AnalyticsEvent.find().sort({ createdAt: -1 }).lean();
		const summary = summarizeAnalyticsEvents(events as any[], {
			startDate: isValidStartDate ? startDate : undefined,
			endDate: isValidEndDate ? endDate : undefined,
			category,
			channel,
			product,
		});

		res.json({
			success: true,
			data: summary
		});
	} catch (error) {
		console.error('Get analytics dashboard error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

router.get('/saft/export', async (req: any, res: any) => {
	try {
		const exportOptions: any = {};
		if (typeof req.query.from === 'string') exportOptions.from = req.query.from;
		if (typeof req.query.to === 'string') exportOptions.to = req.query.to;

		const { xml, signature } = await generateSaftExport(exportOptions);
		res.setHeader('Content-Type', 'application/xml');
		if (signature) {
			return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<SignedAuditFile>\n<Signature>${signature}</Signature>\n${xml.replace(/^<\?xml.*\?>/, '')}\n</SignedAuditFile>`);
		}

		return res.send(xml);
	} catch (error) {
		console.error('SAF-T export error:', error);
		res.status(500).json({
			success: false,
			error: 'Falha ao gerar o arquivo SAF-T',
		});
	}
});

router.get('/stripe/reconciliation', async (req: any, res: any) => {
	try {
		const limit = Number(req.query.limit || 100);
		const report = await reconcileStripePayments(limit);

		res.json({
			success: true,
			report,
		});
	} catch (error) {
		console.error('Stripe reconciliation error:', error);
		res.status(500).json({
			success: false,
			error: 'Falha na reconciliação Stripe',
		});
	}
});

// GET /admin/users - Get all users
router.get('/users', async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 20, search, role, isActive } = req.query;
		const searchText: string = typeof search === 'string' ? search : Array.isArray(search) && typeof search[0] === 'string' ? search[0] : '';

		const query: any = {};
		if (searchText) {
			query.$or = [
				{ name: new RegExp(searchText, 'i') },
				{ email: new RegExp(searchText, 'i') }
			];
		}
		if (role) query.role = role;
		if (isActive !== undefined) query.isActive = isActive === 'true';

		const skip = (Number(page) - 1) * Number(limit);

		const users = await User.find(query)
			.select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken')
			.sort({ createdAt: -1 })
			.limit(Number(limit))
			.skip(skip);

		const total = await User.countDocuments(query);

		res.json({
			success: true,
			users,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				totalUsers: total
			}
		});
	} catch (error) {
		console.error('Get users error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// PUT /admin/users/:id - Update user
router.put('/users/:id', async (req: Request, res: Response) => {
	try {
		const { role, isActive, loyaltyPoints } = req.body;

		const updateData: any = {};
		if (role) updateData.role = role;
		if (isActive !== undefined) updateData.isActive = isActive;
		if (loyaltyPoints !== undefined) updateData.loyaltyPoints = loyaltyPoints;

		const user = await User.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ returnDocument: 'after', runValidators: true }
		).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken');

		if (!user) {
			return res.status(404).json({
				success: false,
				error: 'Usuário não encontrado'
			});
		}

		res.json({
			success: true,
			message: 'Usuário atualizado com sucesso',
			user
		});
	} catch (error) {
		console.error('Update user error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// PRODUCTS MANAGEMENT

// GET /admin/products - Get all products
router.get('/products', async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 20, search, category, inStock } = req.query;

		const query: any = {};
		if (search) {
			query.$text = { $search: search };
		}
		if (category) query.category = category;
		if (inStock !== undefined) query.inStock = inStock === 'true';

		const skip = (Number(page) - 1) * Number(limit);

		const products = await Product.find(query)
			.populate('category', 'name')
			.populate('createdBy', 'name')
			.sort({ createdAt: -1 })
			.limit(Number(limit))
			.skip(skip);

		const total = await Product.countDocuments(query);

		res.json({
			success: true,
			products,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				totalProducts: total
			}
		});
	} catch (error) {
		console.error('Get products error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// GET /admin/b2b/quotes - Get all B2B quote requests
router.get('/b2b/quotes', async (req: Request, res: Response) => {
	try {
		const page = Number(req.query.page || 1);
		const limit = Number(req.query.limit || 20);
		const status = typeof req.query.status === 'string' ? req.query.status : undefined;
		const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
		const searchText = typeof req.query.search === 'string' ? req.query.search : Array.isArray(req.query.search) && typeof req.query.search[0] === 'string' ? req.query.search[0] : '';
		const query: any = {};

		if (status && status !== 'all') query.status = status;
		if (priority && priority !== 'all') query.priority = priority;
		if (searchText) {
			query.$or = [
				{ companyName: new RegExp(searchText, 'i') },
				{ contactName: new RegExp(searchText, 'i') },
				{ email: new RegExp(searchText, 'i') },
				{ description: new RegExp(searchText, 'i') },
				{ quoteNumber: new RegExp(searchText, 'i') }
			];
		}

		const skip = (page - 1) * limit;
		const quotes = await B2BQuote.find(query)
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(skip);
		const total = await B2BQuote.countDocuments(query);

		res.json({
			success: true,
			quotes,
			pagination: {
				currentPage: page,
				totalPages: Math.max(1, Math.ceil(total / limit)),
				totalQuotes: total,
				pageSize: limit
			}
		});
	} catch (error) {
		console.error('Get B2B quotes error:', error);
		res.status(500).json({ success: false, error: 'Erro interno do servidor' });
	}
});

// GET /admin/b2b/quotes/:id - Get detailed quote request
router.get('/b2b/quotes/:id', async (req: Request, res: Response) => {
	try {
		const quote = await B2BQuote.findById(req.params.id);
		if (!quote) {
			return res.status(404).json({ success: false, error: 'Orçamento não encontrado' });
		}

		res.json({ success: true, quote });
	} catch (error) {
		console.error('Get B2B quote detail error:', error);
		res.status(500).json({ success: false, error: 'Erro interno do servidor' });
	}
});

// PUT /admin/b2b/quotes/:id - Update B2B quote request status or notes
router.put('/b2b/quotes/:id', async (req: Request, res: Response) => {
	try {
		const updateData: any = {};
		const { status, priority, notes, totalEstimate } = req.body;
		if (status) updateData.status = status;
		if (priority) updateData.priority = priority;
		if (notes !== undefined) updateData.notes = notes;
		if (totalEstimate !== undefined) updateData.totalEstimate = totalEstimate;

		const quote = await B2BQuote.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after', runValidators: true });
		if (!quote) {
			return res.status(404).json({ success: false, error: 'Orçamento não encontrado' });
		}

		res.json({ success: true, message: 'Orçamento atualizado com sucesso', quote });
	} catch (error) {
		console.error('Update B2B quote error:', error);
		res.status(500).json({ success: false, error: 'Erro interno do servidor' });
	}
});

// POST /admin/products - Create product
router.post('/products', async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.userId;
		const productData = {
			...req.body,
			createdBy: userId
		};

		const product = new Product(productData);
		await product.save();
		await syncProductsToSearch([product]);
		await clearCacheByPrefix('catalog:');

		await product.populate('category', 'name');
		await product.populate('createdBy', 'name');

		res.status(201).json({
			success: true,
			message: 'Produto criado com sucesso',
			product
		});
	} catch (error) {
		console.error('Create product error:', error);

		if (error instanceof Error && (error as any).name === 'ValidationError') {
			const errors = Object.values((error as any).errors).map((err: any) => err.message);
			return res.status(400).json({
				success: false,
				error: errors.join(', ')
			});
		}

		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// PUT /admin/products/:id - Update product
router.put('/products/:id', async (req: Request, res: Response) => {
	try {
		const product = await Product.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ returnDocument: 'after', runValidators: true }
		)
		.populate('category', 'name')
		.populate('createdBy', 'name');

		if (!product) {
			return res.status(404).json({
				success: false,
				error: 'Produto não encontrado'
			});
		}

		await syncProductsToSearch([product]);
		await clearCacheByPrefix('catalog:');

		res.json({
			success: true,
			message: 'Produto atualizado com sucesso',
			product
		});
	} catch (error) {
		console.error('Update product error:', error);

		if (error instanceof Error && (error as any).name === 'ValidationError') {
			const errors = Object.values((error as any).errors).map((err: any) => err.message);
			return res.status(400).json({
				success: false,
				error: errors.join(', ')
			});
		}

		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// DELETE /admin/products/:id - Soft delete product
router.delete('/products/:id', async (req: Request, res: Response) => {
	try {
		const product = await Product.findByIdAndUpdate(
			req.params.id,
			{ isActive: false, isDeleted: true, deletedAt: new Date() },
			{ returnDocument: 'after' }
		);

		if (!product) {
			return res.status(404).json({
				success: false,
				error: 'Produto não encontrado'
			});
		}

		await removeProductFromSearch(product._id.toString());
		await clearCacheByPrefix('catalog:');

		res.json({
			success: true,
			message: 'Produto desativado com sucesso'
		});
	} catch (error) {
		console.error('Delete product error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// CATEGORIES MANAGEMENT

// GET /admin/categories - Get all categories
router.get('/categories', async (req: Request, res: Response) => {
	try {
		const categories = await Category.find()
			.sort({ sortOrder: 1, name: 1 })
			.populate('parent', 'name')
			.populate('subcategories', 'name');

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

// POST /admin/categories - Create category
router.post('/categories', async (req: Request, res: Response) => {
	try {
		const category = new Category(req.body);
		await category.save();
		await clearCacheByPrefix('catalog:');

		await category.populate('parent', 'name');
		await category.populate('subcategories', 'name');

		res.status(201).json({
			success: true,
			message: 'Categoria criada com sucesso',
			category
		});
	} catch (error) {
		console.error('Create category error:', error);

		if (error instanceof Error && (error as any).name === 'ValidationError') {
			const errors = Object.values((error as any).errors).map((err: any) => err.message);
			return res.status(400).json({
				success: false,
				error: errors.join(', ')
			});
		}

		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// ORDERS MANAGEMENT

// GET /admin/orders - Get all orders
router.get('/orders', async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
		const searchText: string = typeof search === 'string' ? search : Array.isArray(search) && typeof search[0] === 'string' ? search[0] : '';

		const query: any = {};
		if (status) query.status = status;
		if (paymentStatus) query.paymentStatus = paymentStatus;
		if (searchText) {
			query.$or = [
				{ orderNumber: new RegExp(searchText, 'i') },
				{ 'shippingAddress.email': new RegExp(searchText, 'i') }
			];
		}

		const skip = (Number(page) - 1) * Number(limit);

		const orders = await Order.find(query)
			.populate('user', 'name email')
			.populate('items.product', 'name sku')
			.sort({ createdAt: -1 })
			.limit(Number(limit))
			.skip(skip);

		const total = await Order.countDocuments(query);

		res.json({
			success: true,
			orders,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				totalOrders: total
			}
		});
	} catch (error) {
		console.error('Get orders error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// PUT /admin/orders/:id/status - Update order status
router.put('/orders/:id/status', async (req: Request, res: Response) => {
	try {
		const { status, trackingNumber, notes } = req.body;

		const order = await Order.findById(req.params.id);
		if (!order) {
			return res.status(404).json({
				success: false,
				error: 'Encomenda não encontrada'
			});
		}

		await order.updateStatus(status, notes);

		if (trackingNumber) {
			order.trackingNumber = trackingNumber;
			await order.save();
		}

		await order.populate('user', 'name email');
		await order.populate('items.product', 'name sku');

		res.json({
			success: true,
			message: 'Status da encomenda atualizado com sucesso',
			order
		});
	} catch (error) {
		console.error('Update order status error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// REVIEWS MANAGEMENT

// GET /admin/reviews - Get all reviews
router.get('/reviews', async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 20, isApproved, product } = req.query;

		const query: any = {};
		if (isApproved !== undefined) query.isApproved = isApproved === 'true';
		if (product) query.product = product;

		const skip = (Number(page) - 1) * Number(limit);

		const reviews = await Review.find(query)
			.populate('user', 'name')
			.populate('product', 'name')
			.sort({ createdAt: -1 })
			.limit(Number(limit))
			.skip(skip);

		const total = await Review.countDocuments(query);

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
		console.error('Get reviews error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// PUT /admin/reviews/:id/approve - Approve review
router.put('/reviews/:id/approve', async (req: Request, res: Response) => {
	try {
		const review = await Review.findByIdAndUpdate(
			req.params.id,
			{ isApproved: true },
			{ returnDocument: 'after' }
		)
		.populate('user', 'name')
		.populate('product', 'name');

		if (!review) {
			return res.status(404).json({
				success: false,
				error: 'Avaliação não encontrada'
			});
		}

		await clearCacheByPrefix('catalog:product-reviews:');

		res.json({
			success: true,
			message: 'Avaliação aprovada com sucesso',
			review
		});
	} catch (error) {
		console.error('Approve review error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

// DELETE /admin/reviews/:id - Delete review
router.delete('/reviews/:id', async (req: Request, res: Response) => {
	try {
		const review = await Review.findByIdAndDelete(req.params.id);

		if (!review) {
			return res.status(404).json({
				success: false,
				error: 'Avaliação não encontrada'
			});
		}

		res.json({
			success: true,
			message: 'Avaliação removida com sucesso'
		});
	} catch (error) {
		console.error('Delete review error:', error);
		res.status(500).json({
			success: false,
			error: 'Erro interno do servidor'
		});
	}
});

export default router;