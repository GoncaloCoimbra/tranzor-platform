import { PrismaService } from './prisma.service';
import { TenantContextService } from '../common/tenant-context.service';

describe('Prisma tenant scope middleware', () => {
  it('scopes count, aggregate, groupBy and createMany to the active company', async () => {
    const tenantContext = new TenantContextService();
    const prisma = new PrismaService(tenantContext);
    jest.spyOn(prisma, '$connect').mockResolvedValue();
    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([] as never);
    const useSpy = jest.spyOn(prisma, '$use');
    await prisma.onModuleInit();
    const middleware = useSpy.mock.calls[0][0];
    const forwardedArgs: any[] = [];
    const next = async (params: any) => {
      forwardedArgs.push(params.args);
      return params.args;
    };

    await tenantContext.run(
      { companyId: 'tenant-a', userId: 'user-a' },
      async () => {
        for (const action of ['count', 'aggregate', 'groupBy']) {
          await middleware({
            model: 'Product',
            action,
            args: { where: { status: 'RECEIVED', companyId: 'tenant-b' } },
          } as any, next);
        }
        await middleware({
          model: 'Product',
          action: 'createMany',
          args: { data: [{ internalCode: 'A' }, { internalCode: 'B', companyId: 'tenant-b' }] },
        } as any, next);
      },
    );

    expect(forwardedArgs.slice(0, 3)).toEqual([
      { where: { status: 'RECEIVED', companyId: 'tenant-a' } },
      { where: { status: 'RECEIVED', companyId: 'tenant-a' } },
      { where: { status: 'RECEIVED', companyId: 'tenant-a' } },
    ]);
    expect(forwardedArgs[3].data).toEqual([
      { internalCode: 'A', companyId: 'tenant-a' },
      { internalCode: 'B', companyId: 'tenant-a' },
    ]);
  });
});
