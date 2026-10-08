import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';

// TEMPLATE: Example test file for any NestJS service
// To use this template:
// 1. Create your service file (e.g., my-feature.service.ts)
// 2. Create tests next to it in __tests__/my-feature.service.spec.ts
// 3. Replace 'ExampleService' below with your actual service name
// 4. Update PrismaService mock with the models your service uses
// 5. Write your test cases following the pattern below

describe('Service Template (Modify for your service)', () => {
  let service: any; // Replace 'any' with your actual service type

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'YourService', // Replace with your actual service
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            // Add models your service uses
            // Example:
            // user: {
            //   create: jest.fn(),
            //   findUnique: jest.fn(),
            // },
          },
        },
      ],
    }).compile();

    service = module.get('YourService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic operations', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    // Add your test cases here
    // Example:
    // it('should create an entity', async () => {
    //   const data = { /* your test data */ };
    //   const result = await service.create(data);
    //   expect(result).toBeDefined();
    // });
  });
});
