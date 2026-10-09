import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...user, company }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
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

  describe('AuthService avatar uploads', () => {
    it('rejects traversal filenames before writing a file', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      } as unknown as PrismaService;
      const service = new AuthService(prisma, {} as JwtService);

      await expect(
        service.uploadAvatar('user-id', {
          fieldname: 'avatar',
          originalname: '../../avatar.png',
          encoding: '7bit',
          mimetype: 'image/png',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          size: 8,
        }),
      ).rejects.toThrow('Unsupported avatar image format');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('stores uploads under a server-generated UUID filename', async () => {
      const uploadRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'logistica-avatar-'),
      );
      const cwd = jest.spyOn(process, 'cwd').mockReturnValue(uploadRoot);
      const user = {
        id: 'user-id',
        name: 'User',
        email: 'user@example.test',
        role: Role.OPERATOR,
        companyId: 'company-id',
        isActive: true,
        avatarUrl: '/uploads/avatars/00000000-0000-4000-8000-000000000000.png',
      };
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ avatarUrl: null }),
          update: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ ...user, avatarUrl: data.avatarUrl }),
            ),
        },
      } as unknown as PrismaService;
      const service = new AuthService(prisma, {} as JwtService);

      try {
        const result = await service.uploadAvatar('user-id', {
          fieldname: 'avatar',
          originalname: 'profile.png',
          encoding: '7bit',
          mimetype: 'image/png',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          size: 8,
        });

        expect(result.user.avatarUrl).toMatch(
          /^\/uploads\/avatars\/[0-9a-f-]{36}\.png$/,
        );
        expect(
          fs.readdirSync(path.join(uploadRoot, 'uploads', 'avatars')),
        ).toEqual([path.basename(result.user.avatarUrl)]);
      } finally {
        cwd.mockRestore();
        fs.rmSync(uploadRoot, { recursive: true, force: true });
      }
    });
  });
});
