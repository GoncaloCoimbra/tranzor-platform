import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { catalogImportSchema } from '../server/core/validators';
import { importCatalogRows } from '../server/core/catalogSeeder';
import { getMongoUri } from '../server/config/mongo';
import { disconnectPrismaClients } from '../server/config/prisma';
import User from '../server/models/User';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tranzor.pt';

async function ensureAdminUser() {
  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
  if (existingAdmin) {
    return existingAdmin;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is required to create the admin user.');
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const adminUser = new User({
    name: 'Admin Tranzor',
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    emailVerified: true,
    profile: {
      company: 'Tranzor',
      phone: '912345678',
    },
  });

  await adminUser.save();
  return adminUser;
}

async function main() {
  const filePath = process.env.SEED_DATA_PATH || path.resolve(__dirname, '../data/product-families.json');
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const rows = catalogImportSchema.parse(payload);

  await mongoose.connect(getMongoUri());

  const summary = await importCatalogRows(rows);
  const adminUser = await ensureAdminUser();

  console.log(`Seed completed: ${summary.length} product families seeded across MongoDB and PostgreSQL.`);
  console.log(`Admin user ensured: ${adminUser.email}`);
  if (summary.length === 0) {
    console.warn('No catalog rows were imported.');
  }

  await mongoose.disconnect();
  await disconnectPrismaClients();
}

main().catch(async (error) => {
  console.error('Catalog seed failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
