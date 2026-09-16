import { Router } from 'express';
import { z } from 'zod';
import { prisma, productAdapter } from '../config/prisma';
import { AuthRequest, authenticate, authorize, optionalAuth } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { clearCacheByPrefix } from '../utils/cache';
import { productCreateSchema } from '../core/validators';
import { logger } from '../config/logger';

const router = Router();
const sortFields = ['createdAt', 'price', 'name', 'salesCount', 'viewCount'] as const;
const productClient = productAdapter ?? prisma.product;

const normalizeSort = (field: string) => {
  return sortFields.includes(field as any) ? field : 'createdAt';
};

const normalizeOrder = (order: string) => {
  return order.toLowerCase() === 'asc' ? 'asc' : 'desc';
};

// Get all products (paginated)
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : null;
    const sortBy = normalizeSort((req.query.sortBy as string) || 'createdAt');
    const order = normalizeOrder((req.query.order as string) || 'desc');

    const where: any = { status: 'ACTIVE' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (minPrice !== null) {
      where.price = { gte: minPrice };
    }

    if (maxPrice !== null) {
      where.price = { ...where.price, lte: maxPrice };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      productClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          images: true,
          category: true,
          _count: {
            select: { reviews: true, orderItems: true },
          },
        },
      }),
      productClient.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch products', error);
    res.status(200).json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await productClient.findUnique({
      where: { id: req.params.id },
      include: {
        images: true,
        category: true,
        reviews: {
          include: { user: { select: { firstName: true, lastName: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { reviews: true, orderItems: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        code: 'NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      code: 'FETCH_FAILED',
    });
  }
});

// Create product (admin only)
router.post('/', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res) => {
  try {
    const data = productCreateSchema.parse(req.body);

    const product = await productClient.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
      include: { category: true },
    });

    await clearCacheByPrefix('catalog:');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      code: 'CREATE_FAILED',
    });
  }
});

// Update product (admin only)
router.put('/:id', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res) => {
  try {
    const product = await productClient.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true },
    });

    await clearCacheByPrefix('catalog:');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        code: 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      code: 'UPDATE_FAILED',
    });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    await productClient.delete({
      where: { id: req.params.id },
    });

    await clearCacheByPrefix('catalog:');

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        code: 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      code: 'DELETE_FAILED',
    });
  }
});

export default router;
