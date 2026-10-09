import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import XLSX from '@e965/xlsx';
import B2BQuote from '../models/B2BQuote';
import Product from '../models/Product';
import Cart from '../models/Cart';
import ApprovalRequest from '../models/ApprovalRequest';
import AnalyticsEvent from '../models/AnalyticsEvent';
import Order from '../models/Order';
import User from '../models/User';
import { optionalAuth, authenticate, authorize } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

  if (!best || bestScore < 0.3) {
    return null;
  }

  return await Product.findById(best._id);
}

function parseCsvRows(buffer: Buffer) {
  const csvText = buffer.toString('utf-8');
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const rows: string[][] = lines.map(line => line.split(/,|;|\t/).map(cell => cell.trim()));
  return rows;
}

function parseSpreadsheetRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
  return rows;
}

function extractRfqLines(rows: any[][]) {
  const [header, ...data] = rows;
  const normalizedHeader = header.map((cell: any) => normalizeText(String(cell || '')));
  const productIndex = normalizedHeader.findIndex((col: string) => col.includes('produto') || col.includes('nome') || col.includes('referencia') || col.includes('referência') || col.includes('sku') || col.includes('reference'));
  const quantityIndex = normalizedHeader.findIndex((col: string) => col.includes('quantidade') || col.includes('qty') || col.includes('qtd'));

  const items = data.map((row: any[]) => {
    const product = productIndex > -1 ? String(row[productIndex] || row[0] || '').trim() : String(row[0] || '').trim();
    const quantity = quantityIndex > -1 ? Number(row[quantityIndex] || 1) : Number(row[1] || 1);
    return {
      product,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
    };
  }).filter((item: any) => item.product);

  return items;
}

async function logEvent(userId: string, event: string, meta: Record<string, any> = {}) {
  try {
    await AnalyticsEvent.create({
      user: userId ? new Types.ObjectId(userId) : undefined,
      event,
      meta,
    } as any);
  } catch (error) {
    console.error('Analytics log failed:', error);
  }
}

// Create a new B2B quote request (public or authenticated)
router.post('/quotes', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { companyName, contactName, email, phone, category, quantity, description, priority } = req.body;

    if (!companyName || !contactName || !email || !category || !quantity || !description) {
      return res.status(400).json({
        success: false,
        error: 'companyName, contactName, email, category, quantity e description são obrigatórios.'
      });
    }

    const quoteData: any = {
      companyName,
      contactName,
      email,
      phone,
      category,
      quantity: Number(quantity),
      description,
      priority: priority || 'medium'
    };

    if ((req as any).user && (req as any).user.role === 'b2b') {
      quoteData.user = (req as any).user.userId;
    }

    quoteData.quoteNumber = quoteData.quoteNumber || `B2B-${uuidv4()}`;

    const quote = new B2BQuote(quoteData);
    await quote.save();

    res.status(201).json({
      success: true,
      quote
    });
  } catch (error: any) {
    console.error('Create B2B quote error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item: any) => item.message);
      return res.status(400).json({ success: false, error: messages.join(', ') });
    }

    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// Get all quotes for authenticated B2B customer
router.get('/quotes', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;

    const query: any = { user: userId };
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;

    const total = await B2BQuote.countDocuments(query);
    const quotes = await B2BQuote.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

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

// Get quote detail for authenticated B2B customer
router.get('/quotes/:id', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const quote = await B2BQuote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Orçamento não encontrado' });
    }

    if (quote.user && quote.user.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao orçamento' });
    }

    res.json({ success: true, quote });
  } catch (error) {
    console.error('Get B2B quote detail error:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /b2b/orders/:orderId/clone - Clone previous order to cart (1-click reorder)
router.post('/orders/:orderId/clone', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { orderId } = req.params;

    // Fetch original order
    const originalOrder = await Order.findById(orderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, error: 'Encomenda não encontrada' });
    }

    // Verify ownership
    if (originalOrder.user.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta encomenda' });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: userId as any } as any);
    if (!cart) {
      cart = new Cart({ user: userId as any, items: [] });
    }

    // Clone items from order to cart
    const clonedItems: any[] = [];
    for (const orderItem of originalOrder.items) {
      const orderItemData = orderItem as any;
      const existingItemIndex = cart.items.findIndex(
        (item: any) => item.product.toString() === orderItemData.product.toString()
      );

      if (existingItemIndex > -1) {
        // Item already exists, add quantities
        cart.items[existingItemIndex].quantity += orderItemData.quantity;
      } else {
        // Add new item
        cart.items.push({
          product: orderItemData.product as any,
          name: orderItemData.name,
          sku: orderItemData.sku,
          price: orderItemData.price,
          quantity: orderItemData.quantity,
          variants: orderItemData.variants,
          image: orderItemData.image
        });
      }
      clonedItems.push({
        name: orderItem.name,
        quantity: orderItem.quantity
      });
    }

    await cart.save();
    await logEvent(userId, 'one_click_reorder_clicked', { orderId, clonedItemsCount: clonedItems.length });

    res.json({
      success: true,
      message: `Encomenda clonada com sucesso. ${clonedItems.length} produto(s) adicionado(s) ao carrinho.`,
      cart,
      clonedItems
    });
  } catch (error) {
    console.error('Clone order error:', error);
    res.status(500).json({ success: false, error: 'Erro ao clonar encomenda' });
  }
});

// GET /b2b/replenishment-alerts - Predictive reorder alerts for B2B customers
router.get('/replenishment-alerts', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
    if (!orders.length) {
      return res.json({ success: true, alerts: [] });
    }

    const productHistory: Record<string, { lastDate: Date; orderIds: string[]; dates: Date[]; name: string }> = {};
    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      for (const item of order.items) {
        const productId = item.product.toString();
        if (!productHistory[productId]) {
          productHistory[productId] = { lastDate: orderDate, orderIds: [order._id.toString()], dates: [orderDate], name: item.name };
          continue;
        }
        productHistory[productId].dates.push(orderDate);
        if (orderDate > productHistory[productId].lastDate) {
          productHistory[productId].lastDate = orderDate;
        }
        if (!productHistory[productId].orderIds.includes(order._id.toString())) {
          productHistory[productId].orderIds.push(order._id.toString());
        }
      }
    }

    const alerts = Object.entries(productHistory).flatMap(([productId, info]) => {
      if (info.dates.length < 2) return [];
      const sortedDates = info.dates.sort((a, b) => a.getTime() - b.getTime());
      const intervals = [];
      for (let i = 1; i < sortedDates.length; i += 1) {
        intervals.push((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      }
      const averageDays = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const daysSinceLast = (Date.now() - info.lastDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLast >= averageDays * 0.83) {
        return [{
          productId,
          name: info.name,
          averageCycleDays: Number(averageDays.toFixed(1)),
          daysSinceLast: Number(daysSinceLast.toFixed(1)),
          suggestedOrderId: info.orderIds[0],
          message: `Detetámos que o seu stock de ${info.name} pode estar a acabar. Deseja aprovar o clone automático da sua última encomenda?`
        }];
      }
      return [];
    });

    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Replenishment alerts error:', error);
    res.status(500).json({ success: false, error: 'Erro ao calcular alertas de reposição' });
  }
});

// POST /b2b/rfq/upload - Upload Excel/CSV RFQ list and populate cart with fuzzy matching
router.post('/rfq/upload', authenticate, authorize('b2b'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Ficheiro RFQ é obrigatório' });
    }

    const isCsv = file.originalname.toLowerCase().endsWith('.csv');
    const rows = isCsv ? parseCsvRows(file.buffer) : parseSpreadsheetRows(file.buffer);
    const rfqLines = extractRfqLines(rows);
    if (!rfqLines.length) {
      return res.status(400).json({ success: false, error: 'Ficheiro sem linhas válidas de encomenda' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const mappedItems: any[] = [];
    const missingItems: any[] = [];

    for (const row of rfqLines) {
      const productQuery = row.product || '';
      const quantity = row.quantity || 1;
      const matchedProduct = await findBestProductMatch(productQuery);

      if (!matchedProduct) {
        missingItems.push({ product: productQuery, quantity });
        continue;
      }

      const existingIndex = cart.items.findIndex(item => item.product.toString() === matchedProduct._id.toString());
      if (existingIndex > -1) {
        cart.items[existingIndex].quantity += quantity;
      } else {
        cart.items.push({
          product: matchedProduct._id,
          name: matchedProduct.name,
          sku: matchedProduct.sku,
          price: matchedProduct.currentPrice || matchedProduct.price,
          quantity,
          image: matchedProduct.images?.[0]
        });
      }

      mappedItems.push({
        name: matchedProduct.name,
        sku: matchedProduct.sku,
        quantity,
        productId: matchedProduct._id
      });
    }

    await cart.save();
    await logEvent(userId, 'rfq_upload', { totalItems: rfqLines.length, addedItems: mappedItems.length, missingItems: missingItems.length });

    res.json({
      success: true,
      message: 'RFQ processado com sucesso e itens adicionados ao carrinho',
      mappedItems,
      missingItems,
      cart
    });
  } catch (error) {
    console.error('RFQ upload error:', error);
    res.status(500).json({ success: false, error: 'Erro ao processar RFQ' });
  }
});

// POST /b2b/approval-requests - Create approval request from current cart or custom items
router.post('/approval-requests', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'Utilizador não encontrado' });
    }

    const cart = await Cart.findOne({ user: userId });
    const itemPayload = Array.isArray(req.body.items) ? req.body.items : [];
    const rawItems = itemPayload.length > 0 ? itemPayload : cart?.items || [];
    if (!rawItems.length) {
      return res.status(400).json({ success: false, error: 'Não há itens no carrinho ou no payload de aprovação' });
    }

    const approverId = currentUser.parentAccount || currentUser._id;
    const accountId = currentUser.parentAccount || currentUser._id;

    const requestItems = rawItems.map((item: any) => ({
      product: item.product,
      name: item.name,
      sku: item.sku,
      price: item.price,
      quantity: item.quantity,
      image: item.image
    }));

    const approvalRequest = new ApprovalRequest({
      requestor: currentUser._id,
      approver: approverId,
      account: accountId,
      items: requestItems,
      comment: req.body.comment || ''
    });

    await approvalRequest.save();
    await logEvent(userId, 'approval_request_created', { requestId: approvalRequest._id, itemCount: requestItems.length });

    res.status(201).json({ success: true, approvalRequest });
  } catch (error) {
    console.error('Create approval request error:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar pedido de aprovação' });
  }
});

// GET /b2b/approval-requests - Get own approval requests
router.get('/approval-requests', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const requests = await ApprovalRequest.find({ requestor: userId })
      .sort({ createdAt: -1 })
      .populate('approver', 'name email accountRole')
      .lean();

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get approval requests error:', error);
    res.status(500).json({ success: false, error: 'Erro ao carregar pedidos de aprovação' });
  }
});

// GET /b2b/approval-requests/incoming - Get incoming approval requests for approver
router.get('/approval-requests/incoming', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const requests = await ApprovalRequest.find({ approver: userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('requestor', 'name email accountRole')
      .lean();

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get incoming approval requests error:', error);
    res.status(500).json({ success: false, error: 'Erro ao carregar pedidos de aprovação pendentes' });
  }
});

// PATCH /b2b/approval-requests/:id - Approve or reject an approval request
router.patch('/approval-requests/:id', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { action, comment } = req.body;
    const approvalRequest = await ApprovalRequest.findById(req.params.id);
    if (!approvalRequest) {
      return res.status(404).json({ success: false, error: 'Pedido de aprovação não encontrado' });
    }

    if (approvalRequest.approver.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Apenas o aprovador pode tomar esta decisão' });
    }

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Ação inválida. Use "approved" ou "rejected".' });
    }

    approvalRequest.status = action;
    approvalRequest.decisionBy = userId as any;
    approvalRequest.decisionAt = new Date();
    approvalRequest.decisionMessage = comment || '';
    await approvalRequest.save();

    if (action === 'approved') {
      let requesterCart = await Cart.findOne({ user: approvalRequest.requestor as any } as any);
      if (!requesterCart) requesterCart = new Cart({ user: approvalRequest.requestor as any, items: [] });

      for (const item of approvalRequest.items) {
        const itemData = item as any;
        const existingIndex = requesterCart.items.findIndex(cartItem => cartItem.product.toString() === itemData.product.toString());
        if (existingIndex > -1) {
          requesterCart.items[existingIndex].quantity += itemData.quantity;
        } else {
          requesterCart.items.push({
            product: itemData.product as any,
            name: itemData.name,
            sku: itemData.sku,
            price: itemData.price,
            quantity: itemData.quantity,
            image: itemData.image
          });
        }
      }
      await requesterCart.save();
    }

    await logEvent(userId, `approval_request_${action}`, { requestId: approvalRequest._id, comment });

    res.json({ success: true, approvalRequest });
  } catch (error) {
    console.error('Update approval request error:', error);
    res.status(500).json({ success: false, error: 'Erro ao atualizar pedido de aprovação' });
  }
});

// GET /b2b/orders - Get user's order history
router.get('/orders', authenticate, authorize('b2b'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const total = await Order.countDocuments({ user: userId });
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalOrders: total,
        pageSize: limit
      }
    });
  } catch (error) {
    console.error('Get B2B orders error:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;
