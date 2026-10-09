import { Router, Request, Response } from 'express';
import multer from 'multer';
import XLSX from '@e965/xlsx';
import Product from '../models/Product';
import Cart from '../models/Cart';
import User from '../models/User';
import { asyncHandler } from '../utils/handlers';
import { validate } from '../middleware/validate';
import { addCartItemSchema, updateCartItemSchema, removeCartItemSchema } from '../schemas/cartSchema';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { isB2BRole } from '../middleware/auth';
import { Types } from 'mongoose';
import { addMoney, percentageOf, roundMoney } from '../utils/money';
import { calculateShipping } from '../services/checkoutService';
import { getEffectivePrice, resolvePricingContext } from '../utils/pricingEngine';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface CartItem {
	product: Types.ObjectId;
	name: string;
	sku: string;
	price: number;
	quantity: number;
	variants?: Record<string, string>;
	image?: string;
	weight?: number;
}

function getUserId(req: Request) {
	const userId = req.user?.userId;
	if (!userId) {
		throw new UnauthorizedError('Autenticação necessária');
	}
	return userId;
}

async function getOrCreateCart(userId: string) {
	let cart = await Cart.findOne({ user: userId });
	if (!cart) {
		cart = new Cart({ user: userId, items: [] });
	}
	return cart;
}

async function getPricingContext(userId: string) {
	const user = await User.findById(userId).select('role b2bDiscountRate pricingTier pricingOverrides');
	if (!user || !isB2BRole(user.role)) {
		return null;
	}

	return resolvePricingContext(user as any, 1);
}

async function findProductByIdOrSlug(idOrSlug: string) {
	if (Types.ObjectId.isValid(idOrSlug)) {
		const product = await Product.findById(idOrSlug);
		if (product) return product;
	}

	return Product.findOne({ slug: idOrSlug });
}

function calculateB2BPrice(product: any, pricing: { discountRate: number; overrides: any[]; pricingTier: string } | null, quantity = 1) {
	const basePrice = product.currentPrice ?? product.price ?? 0;
	if (!pricing) {
		return roundMoney(basePrice);
	}

	return getEffectivePrice(basePrice, {
		role: 'b2b',
		pricingTier: pricing.pricingTier as any,
		pricingOverrides: pricing.overrides,
		b2bDiscountRate: pricing.discountRate,
	}, product._id?.toString(), undefined, quantity);
}

// GET /cart - Get user's cart
router.get('/', asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const cart = await getOrCreateCart(userId);
	const items = await populateCartItems(cart.items);
	const summary = calculateCartSummary(items);

	res.json({
		success: true,
		items,
		summary
	});
}));

// POST /cart/add - Add item to cart
router.post('/add', validate(addCartItemSchema), asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const { productId, quantity, variants } = req.body;

	const product = await findProductByIdOrSlug(productId);
	if (!product) {
		throw new NotFoundError('Produto não encontrado');
	}

	if (!product.isActive || !product.inStock) {
		throw new BadRequestError('Produto indisponível');
	}

	if (quantity > product.stockQuantity) {
		throw new BadRequestError(`Quantidade máxima disponível: ${product.stockQuantity}`);
	}

	const pricingContext = await getPricingContext(userId);
	const cart = await getOrCreateCart(userId);
	const existingIndex = cart.items.findIndex(item => item.product.toString() === productId);

	if (existingIndex > -1) {
		const updatedQuantity = cart.items[existingIndex].quantity + quantity;
		if (updatedQuantity > product.stockQuantity) {
			throw new BadRequestError(`Quantidade máxima disponível: ${product.stockQuantity}`);
		}
		cart.items[existingIndex].quantity = updatedQuantity;
	} else {
		cart.items.push({
			product: product._id,
			name: product.name,
			sku: product.sku,
			price: calculateB2BPrice(product, pricingContext, quantity),
			quantity,
			variants,
			image: product.images[0],
			weight: product.weight
		});
	}

	await cart.save();
	const items = await populateCartItems(cart.items);
	const summary = calculateCartSummary(items);

	res.json({
		success: true,
		message: 'Produto adicionado ao carrinho',
		items,
		summary
	});
}));

// PUT /cart/update - Update cart item quantity
router.put('/update', validate(updateCartItemSchema), asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const { productId, quantity } = req.body;

	const product = await findProductByIdOrSlug(productId);
	if (!product) {
		throw new NotFoundError('Produto não encontrado');
	}

	if (quantity > product.stockQuantity) {
		throw new BadRequestError(`Quantidade máxima disponível: ${product.stockQuantity}`);
	}

	const cart = await getOrCreateCart(userId);
	const item = cart.items.find(item => item.product.toString() === productId);
	if (!item) {
		throw new NotFoundError('Produto não encontrado no carrinho');
	}

	item.quantity = quantity;
	await cart.save();

	const items = await populateCartItems(cart.items);
	const summary = calculateCartSummary(items);

	res.json({
		success: true,
		message: 'Carrinho atualizado',
		items,
		summary
	});
}));

// DELETE /cart/remove - Remove item from cart
router.delete('/remove', validate(removeCartItemSchema), asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const { productId } = req.body;

	const cart = await getOrCreateCart(userId);
	const filteredItems = cart.items.filter(item => item.product.toString() !== productId);
	if (filteredItems.length === cart.items.length) {
		throw new NotFoundError('Produto não encontrado no carrinho');
	}

	cart.items = filteredItems;
	await cart.save();

	const items = await populateCartItems(cart.items);
	const summary = calculateCartSummary(items);

	res.json({
		success: true,
		message: 'Produto removido do carrinho',
		items,
		summary
	});
}));

// DELETE /cart/clear - Clear entire cart
router.delete('/clear', asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	await Cart.deleteOne({ user: userId });

	res.json({
		success: true,
		message: 'Carrinho limpo',
		items: [],
		summary: {
			subtotal: 0,
			tax: 0,
			shipping: 0,
			total: 0,
			totalItems: 0,
			totalWeight: 0
		}
	});
}));

// GET /cart/count - Get cart item count
router.get('/count', asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const cart = await Cart.findOne({ user: userId });
	const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

	res.json({
		success: true,
		count
	});
}));

// Helper functions
async function populateCartItems(cartItems: CartItem[]) {
	const uniqueIds = Array.from(new Set(cartItems.map((item) => item.product.toString())));
	const products = await Product.find({ _id: { $in: uniqueIds } }).select('name sku images weight inStock stockQuantity currentPrice');
	const productMap = new Map(products.map((product) => [product._id.toString(), product]));

	return cartItems
		.map((item) => {
			const product = productMap.get(item.product.toString());
			if (!product) {
				return null;
			}

			return {
				...item,
				product: {
					id: product._id,
					name: product.name,
					sku: product.sku,
					image: product.images[0],
					weight: product.weight,
					inStock: product.inStock,
					stockQuantity: product.stockQuantity,
					currentPrice: product.currentPrice
				},
				total: roundMoney(item.price * item.quantity)
			};
		})
		.filter(Boolean);
}

function calculateCartSummary(items: any[]) {
	const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
	const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
	const tax = percentageOf(subtotal, 23);
	const shipping = calculateShipping(subtotal);
	const total = addMoney(subtotal, tax, shipping);

	return {
		subtotal: roundMoney(subtotal),
		tax: roundMoney(tax),
		shipping: roundMoney(shipping),
		total: roundMoney(total),
		totalItems,
		totalWeight: roundMoney(totalWeight)
	};
}

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function similarityScore(value: string, query: string): number {
	const a = normalizeText(value).split(' ').filter(Boolean);
	const b = normalizeText(query).split(' ').filter(Boolean);
	if (!a.length || !b.length) return 0;
	const shared = a.filter(token => b.includes(token)).length;
	const commonRatio = shared / Math.max(a.length, b.length);
	const startsWith = value.toLowerCase().startsWith(query.toLowerCase()) ? 0.4 : 0;
	return Math.min(1, commonRatio + startsWith);
}

async function findBestProductMatch(searchTerm: string) {
	const normalized = normalizeText(searchTerm);
	if (!normalized) return null;

	const skuCandidate = searchTerm.trim().toUpperCase();
	const product = await Product.findOne({ sku: skuCandidate, isActive: true });
	if (product) return product;

	const candidates = await Product.find({
		isActive: true,
		$or: [
			{ sku: { $regex: skuCandidate, $options: 'i' } },
			{ name: { $regex: normalized, $options: 'i' } },
			{ $text: { $search: searchTerm } }
		]
	}).limit(20).lean({ virtuals: true });

	let best: any = null;
	let bestScore = 0;
	for (const candidate of candidates) {
		const score = Math.max(
			similarityScore(candidate.name, searchTerm),
			similarityScore(candidate.sku || '', searchTerm)
		);
		if (score > bestScore) {
			bestScore = score;
			best = candidate;
		}
	}

	if (!best || bestScore < 0.3) return null;
	return Product.findById(best._id);
}

function parseCsvRows(buffer: Buffer) {
	const csvText = buffer.toString('utf-8');
	const lines = csvText.split(/\r?\n/).filter(Boolean);
	return lines.map(line => line.split(/,|;|\t/).map(cell => cell.trim()));
}

function parseSpreadsheetRows(buffer: Buffer) {
	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const sheetName = workbook.SheetNames[0];
	const sheet = workbook.Sheets[sheetName];
	return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
}

function extractRfqLines(rows: any[][]) {
	const [header, ...data] = rows;
	const normalizedHeader = header.map((cell: any) => normalizeText(String(cell || '')));
	const productIndex = normalizedHeader.findIndex((col: string) => col.includes('produto') || col.includes('nome') || col.includes('referencia') || col.includes('referência') || col.includes('sku') || col.includes('reference'));
	const quantityIndex = normalizedHeader.findIndex((col: string) => col.includes('quantidade') || col.includes('qty') || col.includes('qtd'));

	return data.map((row: any[]) => {
		const product = productIndex > -1 ? String(row[productIndex] || row[0] || '').trim() : String(row[0] || '').trim();
		const quantity = quantityIndex > -1 ? Number(row[quantityIndex] || 1) : Number(row[1] || 1);
		return {
			product,
			quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
		};
	}).filter((item: any) => item.product);
}

router.post('/upload-rfq', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
	const userId = getUserId(req);
	const file = req.file;
	if (!file) {
		throw new BadRequestError('Ficheiro RFQ é obrigatório');
	}

	const isCsv = file.originalname.toLowerCase().endsWith('.csv');
	const rows = isCsv ? parseCsvRows(file.buffer) : parseSpreadsheetRows(file.buffer);
	const rfqLines = extractRfqLines(rows);
	if (!rfqLines.length) {
		throw new BadRequestError('Ficheiro sem linhas válidas de encomenda');
	}

	const cart = await getOrCreateCart(userId);
	const pricingContext = await getPricingContext(userId);
	const mappedItems: any[] = [];
	const missingItems: any[] = [];

	for (const row of rfqLines) {
		const matchedProduct = await findBestProductMatch(row.product);
		if (!matchedProduct) {
			missingItems.push({ product: row.product, quantity: row.quantity });
			continue;
		}

		const price = calculateB2BPrice(matchedProduct, pricingContext);
		const existingIndex = cart.items.findIndex(item => item.product.toString() === matchedProduct._id.toString());
		if (existingIndex > -1) {
			cart.items[existingIndex].quantity += row.quantity;
		} else {
			cart.items.push({
				product: matchedProduct._id,
				name: matchedProduct.name,
				sku: matchedProduct.sku,
				price,
				quantity: row.quantity,
				image: matchedProduct.images?.[0],
				weight: matchedProduct.weight
			});
		}

		mappedItems.push({
			name: matchedProduct.name,
			sku: matchedProduct.sku,
			quantity: row.quantity,
			productId: matchedProduct._id.toString()
		});
	}

	await cart.save();
	const items = await populateCartItems(cart.items);
	const summary = calculateCartSummary(items);

	res.json({
		success: true,
		message: 'RFQ processado com sucesso e itens adicionados ao carrinho',
		mappedItems,
		missingItems,
		items,
		summary
	});
}));

export default router;