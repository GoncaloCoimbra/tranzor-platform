import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { catalogImportSchema } from '../core/validators';
import { importCatalogRows } from '../core/catalogSeeder';
import { clearCacheByPrefix } from '../utils/cache';

const router = Router();

router.post('/catalog/import', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER), async (req, res) => {
  try {
    const rows = catalogImportSchema.parse(req.body);
    const summary = await importCatalogRows(rows);
    await clearCacheByPrefix('catalog:');

    return res.status(201).json({
      success: true,
      imported: summary.length,
      data: summary,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to import catalog data',
    });
  }
});

export default router;
