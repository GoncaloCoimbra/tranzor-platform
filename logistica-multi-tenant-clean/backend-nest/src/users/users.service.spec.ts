import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../database/repositories/user.repository';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-123',
    email: 'admin@logistica.com',
    companyId: 'company-1',
    isActive: true,
    role: 'ADMIN',
    name: 'Admin User',
    createdAt: new Date(),
  };

  let mockUserRepository;
  beforeEach(async () => {
    mockUserRepository = {
      findByCompany: jest.fn((companyId) => {
        if (companyId === 'company-1') {
          return Promise.resolve([
            mockUser,
            { ...mockUser, id: 'user-456', email: 'operator@logistica.com' },
          ]);
        }
        return Promise.resolve([]);
      }),
      findById: jest.fn((id) => {
        if (id === 'user-123') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
      findByEmail: jest.fn((email) => {
        if (email === 'admin@logistica.com') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
      findSuperAdmins: jest.fn(() =>
        Promise.resolve([{ ...mockUser, role: 'SUPER_ADMIN' }]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // @ts-expect-error test injects the repository into an otherwise private dependency.
    service['userRepository'] = mockUserRepository;
    jest.clearAllMocks();
  });

  describe('findByCompany', () => {
    it('should return all users for a company', async () => {
      const companyId = 'company-1';
      const users = [
        mockUser,
        { ...mockUser, id: 'user-456', email: 'operator@logistica.com' },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.findByCompany(companyId);

      expect(result).toEqual(users);
    });

    it('should return empty array if no users found', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findByCompany('nonexistent-company');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail('admin@logistica.com');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findSuperAdmins', () => {
    it('should return all super admin users', async () => {
      const superAdmins = [{ ...mockUser, role: 'SUPER_ADMIN' }];

      mockPrismaService.user.findMany.mockResolvedValue(superAdmins);

      const result = await service.findSuperAdmins();

      expect(result).toEqual(superAdmins);
    });
  });
});
