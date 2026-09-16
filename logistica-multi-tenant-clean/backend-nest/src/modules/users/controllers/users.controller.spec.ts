import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { Role } from '@prisma/client';

describe('UsersController role updates', () => {
  it('rejects an ADMIN attempting to promote a user to SUPER_ADMIN', async () => {
    const target = {
      id: 'target-user',
      companyId: 'company-1',
      role: Role.OPERATOR,
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(target),
      update: jest.fn(),
    };
    const controller = new UsersController(usersService as any);

    await expect(
      controller.update(
        target.id,
        { role: Role.SUPER_ADMIN },
        { role: Role.ADMIN, companyId: target.companyId },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.update).not.toHaveBeenCalled();
    expect(target.role).toBe(Role.OPERATOR);
  });
});