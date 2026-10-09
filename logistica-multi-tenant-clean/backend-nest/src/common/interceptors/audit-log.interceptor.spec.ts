import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';

describe('AuditLogInterceptor', () => {
  it('records only minimal request metadata, not body or IP data', async () => {
    const auditLogService = {
      createLog: jest.fn().mockResolvedValue(undefined),
    };
    const interceptor = new AuditLogInterceptor(auditLogService as any);
    const request = {
      method: 'POST',
      url: '/api/products?email=private@example.com',
      ip: '192.0.2.10',
      body: {
        description: 'ordinary data',
        owner: { name: 'Private Person', email: 'private@example.com' },
        credentials: { password: 'private-password' },
      },
      user: { id: 'user-1', email: 'private@example.com', companyId: 'company-1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    const next = { handle: () => of({ id: 'product-1' }) };

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual({
      id: 'product-1',
    });
    expect(auditLogService.createLog).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'product',
      entityId: 'product-1',
      userId: 'user-1',
      companyId: 'company-1',
      metadata: { method: 'POST' },
    });
    expect(JSON.stringify(auditLogService.createLog.mock.calls)).not.toContain(
      'private@example.com',
    );
    expect(JSON.stringify(auditLogService.createLog.mock.calls)).not.toContain(
      'private-password',
    );
    expect(JSON.stringify(auditLogService.createLog.mock.calls)).not.toContain(
      '192.0.2.10',
    );
  });
});
