import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de teste...');

  try {
    // Primeiro, buscar a empresa admin
    const company = await prisma.company.findFirst({
      where: {
        email: 'admin@logistica.com',
      },
    });

    if (!company) {
      console.error('❌ Empresa admin não encontrada! Faça login primeiro ou crie uma conta.');
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

    // Buscar ou criar um supplier
    let supplier = await prisma.supplier.findFirst({
      where: { companyId: company.id },
    });

    if (!supplier) {
      console.log('📦 Criando supplier de teste...');
      supplier = await prisma.supplier.create({
        data: {
          name: 'Supplier Teste',
          nif: '123456789',
          email: 'supplier@test.com',
          phone: '912345678',
          address: 'Rua Teste, 123',
          companyId: company.id,
        },
      });
      console.log(`✅ Supplier criado: ${supplier.name}`);
    } else {
      console.log(`✅ Supplier encontrado: ${supplier.name}`);
    }

    // Buscar o usuário admin
    const user = await prisma.user.findFirst({
      where: { email: 'admin@logistica.com', companyId: company.id },
    });

    if (!user) {
      console.error('❌ Usuário admin não encontrado!');
      return;
    }

    console.log(`✅ Usuário encontrado: ${user.name}`);

    // Criar 5 produtos de teste
    const productCodes = ['PROD-001', 'PROD-002', 'PROD-003', 'PROD-004', 'PROD-005'];
    const descriptions = [
      'Eletrônicos - Smartphone',
      'Peças Automotivas - Motor',
      'Alimentos - Café Premium',
      'Têxteis - Algodão 100%',
      'Químicos - Solvente Industrial',
    ];

    for (let i = 0; i < productCodes.length; i++) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          internalCode: productCodes[i],
          companyId: company.id,
        },
      });

      if (!existingProduct) {
        const product = await prisma.product.create({
          data: {
            internalCode: productCodes[i],
            description: descriptions[i],
            quantity: Math.floor(Math.random() * 100) + 10,
            unit: 'UN',
            totalWeight: Math.floor(Math.random() * 1000) + 100,
            totalVolume: Math.floor(Math.random() * 500) + 50,
            currentLocation: 'Warehouse A',
            status: 'RECEIVED',
            supplierId: supplier.id,
            companyId: company.id,
          },
        });

        // Criar movimento inicial
        await prisma.productMovement.create({
          data: {
            productId: product.id,
            companyId: company.id,
            previousStatus: 'RECEIVED',
            newStatus: 'RECEIVED',
            quantity: product.quantity,
            location: 'Warehouse A',
            reason: 'Produto recebido do fornecedor',
            userId: user.id,
          },
        });

        console.log(`✅ Produto criado: ${product.internalCode} - ${product.description}`);
      } else {
        console.log(`⏭️ Produto já existe: ${productCodes[i]}`);
      }
    }

    console.log('\n✅ Seed concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
