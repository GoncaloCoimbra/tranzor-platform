import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding database with demo data...\n');

  try {
    // 1. Find or create demo company
    let company = await prisma.company.findFirst({
      where: { email: 'admin@logistica.com' },
    });

    if (!company) {
      console.log('❌ Company admin@logistica.com not found!');
      console.log('⚠️ Please sign up first at http://localhost:3001');
      return;
    }

    console.log(`✅ Using company: ${company.name} (${company.id})`);

    // 2. Get or create users
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@logistica.com', companyId: company.id },
    });

    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log(`✅ Admin user: ${adminUser.name}`);

    // 2.5 Create or verify demo user for portfolio testing
    let demoUser = await prisma.user.findFirst({
      where: { email: 'demo@logistica.com', companyId: company.id },
    });

    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          name: 'Demo User',
          email: 'demo@logistica.com',
          password: 'demo123',
          role: 'OPERATOR',
          isActive: true,
          companyId: company.id,
        },
      });
      console.log(`✅ Created demo user: demo@logistica.com`);
    } else {
      console.log(`✅ Demo user already exists: demo@logistica.com`);
    }

    // 3. Create suppliers (10 different ones)
    const supplierNames = [
      'Supplier Alpha Ltd',
      'Beta Trading Company',
      'Global Logistics Partners',
      'Premium Distributors Inc',
      'EuroGoods Holdings',
      'Pacific Import Corp',
      'Quality Goods Ltd',
      'Swift Delivery Partners',
      'Eco Trade Solutions',
      'Premium Select Wholesale',
    ];

    const suppliers: Array<{ id: string; name: string; companyId: string }> = [];
    for (const name of supplierNames) {
      let supplier = await prisma.supplier.findFirst({
        where: { name, companyId: company.id },
      });

      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            name,
            nif: `${Math.floor(Math.random() * 900000000) + 100000000}`,
            email: `contact@${name.toLowerCase().replace(/\s+/g, '')}.com`,
            phone: `+351 ${Math.floor(Math.random() * 900000000)}`,
            address: `Street ${Math.floor(Math.random() * 100)}, City, Portugal`,
            companyId: company.id,
          },
        });
      }
      suppliers.push(supplier as { id: string; name: string; companyId: string });
    }

    console.log(`✅ Created/Found ${suppliers.length} suppliers`);

    // 4. Create products with realistic data
    const productTemplates = [
      {
        code: 'ELEC-001',
        description: 'Industrial Control Panel 2000W',
        quantity: 45,
        weight: 2500,
        volume: 120,
      },
      {
        code: 'MECH-001',
        description: 'Hydraulic Pump Assembly',
        quantity: 12,
        weight: 850,
        volume: 45,
      },
      {
        code: 'CHEM-001',
        description: 'Industrial Grade Lubricant 25L Barrel',
        quantity: 120,
        weight: 25000,
        volume: 45,
      },
      {
        code: 'PLAST-001',
        description: 'High-Density Polyethylene Sheets',
        quantity: 500,
        weight: 5000,
        volume: 250,
      },
      {
        code: 'METAL-001',
        description: 'Stainless Steel Fasteners Kit',
        quantity: 300,
        weight: 1500,
        volume: 80,
      },
      {
        code: 'ELEC-002',
        description: 'LED Panel Lights 600x600mm',
        quantity: 80,
        weight: 800,
        volume: 320,
      },
      {
        code: 'MECH-002',
        description: 'Electric Motor 5HP 3-Phase',
        quantity: 15,
        weight: 2200,
        volume: 60,
      },
      {
        code: 'CHEM-002',
        description: 'Protective Coating Paint 20L',
        quantity: 200,
        weight: 20000,
        volume: 120,
      },
      {
        code: 'PLAST-002',
        description: 'Polycarbonate Sheets 2mm',
        quantity: 150,
        weight: 3000,
        volume: 180,
      },
      {
        code: 'METAL-002',
        description: 'Aluminum Extrusion Profiles',
        quantity: 400,
        weight: 8000,
        volume: 200,
      },
      {
        code: 'ELEC-003',
        description: 'Network Cable CAT6 1000m',
        quantity: 25,
        weight: 4500,
        volume: 150,
      },
      {
        code: 'MECH-003',
        description: 'Gearbox Reducer 1:10 Ratio',
        quantity: 8,
        weight: 1200,
        volume: 35,
      },
    ];

    const existingProducts = await prisma.product.findMany({
      where: { companyId: company.id },
    });

    const productsToCreate = productTemplates.filter(
      (t) => !existingProducts.some((p) => p.internalCode === t.code),
    );

    for (const template of productsToCreate) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const productStatuses: Array<'RECEIVED' | 'IN_ANALYSIS' | 'IN_STORAGE' | 'APPROVED' | 'DISPATCHED'> = [
        'RECEIVED',
        'IN_ANALYSIS',
        'IN_STORAGE',
        'APPROVED',
        'DISPATCHED',
      ];
      const status = productStatuses[Math.floor(Math.random() * productStatuses.length)];

      const product = await prisma.product.create({
        data: {
          internalCode: template.code,
          description: template.description,
          quantity: template.quantity,
          unit: 'UN',
          totalWeight: template.weight,
          totalVolume: template.volume,
          currentLocation: ['Warehouse A', 'Warehouse B', 'Loading Dock', 'Customs'][
            Math.floor(Math.random() * 4)
          ],
          status: status,
          supplierId: supplier.id,
          companyId: company.id,
        },
      });

      // Create 2-3 movements for each product
      const movements: Array<{ from: 'RECEIVED' | 'IN_ANALYSIS' | 'IN_STORAGE' | 'APPROVED' | 'DISPATCHED'; to: 'RECEIVED' | 'IN_ANALYSIS' | 'IN_STORAGE' | 'APPROVED' | 'DISPATCHED' }> = [];
      let previousStatus: 'RECEIVED' | 'IN_ANALYSIS' | 'IN_STORAGE' | 'APPROVED' | 'DISPATCHED' =
        'RECEIVED';

      for (let i = 0; i < 2; i++) {
        const statusTransitions: Array<'RECEIVED' | 'IN_ANALYSIS' | 'IN_STORAGE' | 'APPROVED' | 'DISPATCHED'> = [
          'RECEIVED',
          'IN_ANALYSIS',
          'APPROVED',
          'IN_STORAGE',
          'DISPATCHED',
        ];
        const newStatus = statusTransitions[(i + 1) % statusTransitions.length];

        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - (2 - i));

        await prisma.productMovement.create({
          data: {
            productId: product.id,
            companyId: company.id,
            previousStatus: previousStatus,
            newStatus: newStatus,
            quantity: product.quantity,
            location: ['Warehouse A', 'Warehouse B', 'Loading Dock', 'Customs'][i % 4],
            reason: [
              'Product received from supplier',
              'Moved to analysis',
              'Product approved for storage',
              'Dispatched for delivery',
            ][i],
            userId: adminUser.id,
            createdAt,
          },
        });

        previousStatus = newStatus;
        movements.push({ from: previousStatus, to: newStatus });
      }

      console.log(`✅ Created product: ${template.code} with ${movements.length} movements`);
    }

    const totalProducts = await prisma.product.count({
      where: { companyId: company.id },
    });
    console.log(`\n📦 Total products in database: ${totalProducts}`);

    // 5. Create additional users (operators)
    const existingUsers = await prisma.user.findMany({
      where: { companyId: company.id },
    });

    if (existingUsers.length < 3) {
      const operatorNames = ['João Silva', 'Maria Santos', 'Pedro Oliveira'];

      for (let i = 0; i < operatorNames.length; i++) {
        const existsUser = existingUsers.some((u) => u.name === operatorNames[i]);

        if (!existsUser) {
          const user = await prisma.user.create({
            data: {
              name: operatorNames[i],
              email: `${operatorNames[i].toLowerCase().replace(/\s+/g, '.')}@demo.com`,
              password: 'demo123', // Should be hashed in real app
              role: i === 0 ? 'ADMIN' : 'OPERATOR',
              isActive: true,
              companyId: company.id,
            },
          });

          console.log(`✅ Created user: ${user.name} (${user.role})`);
        }
      }
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📊 Demo Data Summary:');
    console.log(`   - Company: ${company.name}`);
    console.log(`   - Suppliers: ${suppliers.length}`);
    console.log(`   - Products: ${totalProducts}`);
    console.log(`   - Users: ${existingUsers.length + (existingUsers.length < 3 ? 3 - existingUsers.length : 0)}`);
    console.log('\n🎉 Ready for demo!\n');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
