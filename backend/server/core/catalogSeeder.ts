import mongoose from 'mongoose';
import { prisma } from '../config/prisma';
import Category from '../models/Category';
import Product from '../models/Product';
import { syncProductsToSearch } from '../services/productSearch';
import type { CatalogImportRow } from './validators';

async function upsertPrismaProduct(row: CatalogImportRow, categorySlug: string, productSlug: string, categoryId: string, productName: string) {
  if (!prisma?.product) {
    return null;
  }

  try {
    return await prisma.product.upsert({
      where: { sku: row.sku_prefix },
      update: {
        name: productName,
        description: row.description,
        longDescription: row.description,
        price: row.unit_price,
        cost: row.unit_price * 0.65,
        stock: row.stock,
        categoryId,
        slug: productSlug,
        status: 'ACTIVE',
        featured: row.featured,
        tags: row.tags,
      },
      create: {
        sku: row.sku_prefix,
        name: productName,
        description: row.description,
        longDescription: row.description,
        price: row.unit_price,
        cost: row.unit_price * 0.65,
        stock: row.stock,
        categoryId,
        slug: productSlug,
        status: 'ACTIVE',
        featured: row.featured,
        tags: row.tags,
      },
    });
  } catch (error) {
    return null;
  }
}

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

export async function importCatalogRows(rows: CatalogImportRow[]) {
  const summary: Array<{ sku: string; mongoId: string; prismaId: string }> = [];
  const batchSize = Number(process.env.BULK_IMPORT_BATCH_SIZE || 250);

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);

    for (const row of batch) {
      const categorySlug = slugify(row.category);
      const productSlug = slugify(`${row.family}-${row.sku_prefix}`);
      const categoryDoc = await Category.findOneAndUpdate(
        { slug: categorySlug },
        {
          $setOnInsert: {
            name: row.category,
            slug: categorySlug,
            description: row.description,
            isActive: true,
            sortOrder: 0,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const mongoProduct = await Product.findOneAndUpdate(
        { sku: row.sku_prefix },
        {
          $set: {
            name: row.family,
            slug: productSlug,
            description: row.description,
            shortDescription: row.description.slice(0, 160),
            price: row.unit_price,
            salePrice: undefined,
            category: categoryDoc._id,
            sku: row.sku_prefix,
            images: [],
            specifications: {
              source: 'seed',
              family: row.family,
            },
            tags: row.tags,
            inStock: row.stock > 0,
            stockQuantity: row.stock,
            lowStockThreshold: 5,
            rating: {
              average: 4.5,
              count: 42,
            },
            isActive: true,
            isFeatured: row.featured,
            isNew: true,
            salesCount: 0,
            viewCount: 0,
            createdBy: new mongoose.Types.ObjectId(),
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
      );

      let prismaId = '';

      try {
        if (prisma?.category) {
          const prismaCategory = await prisma.category.upsert({
            where: { slug: categorySlug },
            update: {
              name: row.category,
              description: row.description,
            },
            create: {
              name: row.category,
              slug: categorySlug,
              description: row.description,
            },
          });

          const prismaProduct = await upsertPrismaProduct(row, categorySlug, productSlug, prismaCategory.id, row.family);
          prismaId = prismaProduct?.id || '';
        }
      } catch (error) {
        prismaId = '';
      }

      summary.push({
        sku: row.sku_prefix,
        mongoId: mongoProduct._id.toString(),
        prismaId,
      });
    }
  }

  const importedProducts = await Product.find({
    _id: { $in: summary.map(item => item.mongoId) },
  })
    .select('_id name description category isActive isDeleted createdAt')
    .lean();
  await syncProductsToSearch(importedProducts);

  return summary;
}
