import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService public registration', () => {
  it('ignores client-supplied role and tenant and registers an operator in a new company', async () => {
    const company = { id: 'new-company', name: 'New Company' };
    const user = {
      id: 'new-user',
      name: 'New User',
      email: 'new-user@example.test',
      role: Role.OPERATOR,
      companyId: company.id,
      isActive: true,
    };
    const tx = {
      company: { create: jest.fn().mockResolvedValue(company) },
      user: { create: jest.fn().mockResolvedValue(user) },
    };
    const prisma = {
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...user, company }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('test-token'),
    } as unknown as JwtService;
    const service = new AuthService(prisma, jwtService);
    const dto = Object.assign(new RegisterDto(), {
      name: user.name,
      email: user.email,
      password: 'test-password',
      role: Role.SUPER_ADMIN,
      companyId: 'another-company',
    });

    await service.register(dto);

    expect(tx.company.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.OPERATOR,
        companyId: company.id,
      }),
    });
  });
});
