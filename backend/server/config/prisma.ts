import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';
import Product from '../models/Product';
import Review from '../models/Review';
import { removeProductFromSearch, syncProductsToSearch } from '../services/productSearch';

if (!env.DATABASE_URL) {
  const message = 'DATABASE_URL is not configured. Prisma client will not be initialized and the application will fall back to MongoDB. This is unsafe in production.';
  if (env.NODE_ENV === 'production') {
    logger.error(message);
    process.exit(1);
  }

  logger.warn(message);
}

const primaryPrisma = env.DATABASE_URL ? new PrismaClient() : null;
const replicaPrisma = env.DATABASE_URL_READ_REPLICA
  ? new PrismaClient({
      datasources: {
        db: { url: env.DATABASE_URL_READ_REPLICA },
      },
    })
  : primaryPrisma;

const buildProductQuery = (where: any = {}) => {
  const filter: any = {};

  if (where.status === 'ACTIVE') {
    filter.isActive = true;
  }

  if (where.categoryId) {
    filter.category = where.categoryId;
  }

  if (where.price) {
    filter.price = {};
    if (where.price.gte !== undefined) filter.price.$gte = where.price.gte;
    if (where.price.lte !== undefined) filter.price.$lte = where.price.lte;
  }

  if (where.OR) {
    filter.$or = where.OR.map((clause: any) => {
      const key = Object.keys(clause)[0];
      const value = clause[key];
      if (value.contains) {
        return { [key]: new RegExp(value.contains, 'i') };
      }
      return clause;
    });
  }

  return filter;
};

const createProductAdapter = () => ({
  async findMany({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }: any) {
    const filter = buildProductQuery(where);
    const orderField = Object.keys(orderBy)[0] ?? 'createdAt';
    const orderDirection = Object.values(orderBy)[0] === 'asc' ? 1 : -1;

    const products = await Product.find(filter)
      .populate('category')
      .sort({ [orderField]: orderDirection })
      .skip(skip)
      .limit(take)
      .lean({ virtuals: true });

    return products.map(product => ({
      ...product,
      _count: {
        reviews: product.rating?.count ?? 0,
        orderItems: 0,
      },
    }));
  },

  async count({ where = {} }: any) {
    const filter = buildProductQuery(where);
    return Product.countDocuments(filter).exec();
  },

  async findUnique({ where = {}, include = {} }: any) {
    const product = await Product.findById(where.id).populate('category').lean({ virtuals: true });
    if (!product) return null;

    if (include.reviews) {
      const reviews = await Review.find({ product: product._id as any, isApproved: true } as any)
        .populate('user', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(include.reviews.take ?? 10)
        .lean();

      const productAny = product as any;
      productAny.reviews = reviews;
      productAny._count = {
        reviews: reviews.length,
        orderItems: 0,
      };
    }

    return product;
  },

  async create({ data = {}, include = {} }: any) {
    const product = new Product({
      ...data,
      category: data.categoryId || data.category,
      inStock: data.stockQuantity === undefined ? true : data.stockQuantity > 0,
      rating: { average: 0, count: 0 },
      salesCount: 0,
      viewCount: 0,
      specifications: data.specifications || {},
      lowStockThreshold: data.lowStockThreshold ?? 5,
      isActive: true,
    });

    await product.save();
    await syncProductsToSearch([product]);

    if (include.category) {
      await product.populate('category');
    }

    return product.toObject({ virtuals: true });
  },

  async update({ where = {}, data = {}, include = {} }: any) {
    const updateData = { ...data };
    if (updateData.stock !== undefined) {
      updateData.stockQuantity = updateData.stock;
      delete updateData.stock;
    }
    if (updateData.categoryId) {
      updateData.category = updateData.categoryId;
      delete updateData.categoryId;
    }

    const product = await Product.findByIdAndUpdate(where.id, updateData, { returnDocument: 'after', runValidators: true })
      .populate(include.category ? 'category' : '')
      .lean({ virtuals: true });

    if (product) {
      await syncProductsToSearch([product]);
    }
    return product;
  },

  async delete({ where = {} }: any) {
    const product = await Product.findByIdAndDelete(where.id).lean();
    if (product) {
      await removeProductFromSearch(String(product._id));
    }
    return product;
  }
});

const fallbackAdapter = { product: createProductAdapter() } as any;

export const productAdapter = fallbackAdapter.product;
export const prisma = primaryPrisma ?? fallbackAdapter;
export const readPrisma = replicaPrisma ?? fallbackAdapter;

export async function initializePrismaClients(): Promise<void> {
  if (!primaryPrisma) {
    return;
  }

  try {
    await primaryPrisma.$connect();
    await primaryPrisma.$queryRaw`SELECT 1`;

    if (replicaPrisma && replicaPrisma !== primaryPrisma) {
      await replicaPrisma.$connect();
      await replicaPrisma.$queryRaw`SELECT 1`;
    }

    logger.info('Prisma clients connected successfully');
  } catch (error) {
    logger.warn('Prisma clients unavailable during startup; continuing in degraded mode', error);
  }
}

export async function disconnectPrismaClients() {
  if (primaryPrisma) {
    await primaryPrisma.$disconnect();
  }

  if (replicaPrisma && replicaPrisma !== primaryPrisma) {
    await replicaPrisma.$disconnect();
  }
}
