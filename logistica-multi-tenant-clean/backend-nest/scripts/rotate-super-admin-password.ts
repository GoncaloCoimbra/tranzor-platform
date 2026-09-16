import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isStrongPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password || !isStrongPassword(password)) {
    throw new Error('SUPER_ADMIN_EMAIL and a strong SUPER_ADMIN_PASSWORD are required');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== Role.SUPER_ADMIN) {
    throw new Error(`No SUPER_ADMIN user found for ${email}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(password, 12) },
  });

  console.log(`Rotated password for ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());