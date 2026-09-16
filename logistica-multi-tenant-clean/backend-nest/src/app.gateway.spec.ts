import { AppGateway, StockUpdatedPayload } from './app.gateway';

describe('AppGateway tenant rooms', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('does not deliver company B events to a company A socket', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockImplementation(async (token: string) => ({
        sub: token === 'token-a' ? 'user-a' : 'user-b',
      })),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => ({
          id: where.id,
          email: `${where.id}@example.com`,
          role: 'OPERATOR',
          companyId: where.id === 'user-a' ? 'company-a' : 'company-b',
          isActive: true,
        })),
      },
    };

    const gateway = new AppGateway(jwtService as any, prisma as any);
    const receivedByA: unknown[] = [];
    const receivedByB: unknown[] = [];
    const socketsByRoom = new Map<string, Array<{ receive: jest.Mock }>>();

    const makeSocket = (token: string, received: unknown[]) => {
      const socket = {
        id: `socket-${token}`,
        handshake: {
          auth: { token },
          headers: {},
        },
        data: {},
        join: jest.fn(async (room: string) => {
          const roomSockets = socketsByRoom.get(room) || [];
          roomSockets.push({
            receive: jest.fn((event: unknown, payload: unknown) => {
              received.push({ event, payload });
            }),
          });
          socketsByRoom.set(room, roomSockets);
        }),
        disconnect: jest.fn(),
      };

      return socket;
    };

    const socketA = makeSocket('token-a', receivedByA);
    const socketB = makeSocket('token-b', receivedByB);

    await gateway.handleConnection(socketA as any);
    await gateway.handleConnection(socketB as any);

    gateway.server = {
      to: jest.fn((room: string) => ({
        emit: jest.fn((event: string, payload: unknown) => {
          for (const socket of socketsByRoom.get(room) || []) {
            socket.receive(event, payload);
          }
        }),
      })),
    } as any;

    const payload: StockUpdatedPayload = {
      companyId: 'company-b',
      productId: 'product-1',
      availableQuantity: 4,
      timestamp: new Date().toISOString(),
    };

    gateway.emitToCompany('company-b', 'stock:updated', payload);

    expect(socketA.join).toHaveBeenCalledWith('company:company-a');
    expect(socketB.join).toHaveBeenCalledWith('company:company-b');
    expect(receivedByA).toHaveLength(0);
    expect(receivedByB).toHaveLength(1);
    expect(receivedByB[0]).toEqual({
      event: 'stock:updated',
      payload,
    });
  });
});
