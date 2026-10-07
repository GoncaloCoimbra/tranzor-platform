import crypto from 'crypto';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import WebSocket from 'ws';
import { getJwtSecret, parseUserIdFromToken, verifyCommerceToken } from '../src/auth';
import { prisma } from '../src/prismaClient';

jest.mock('../src/redisClient', () => ({
  publishPortfolioEvent: jest.fn().mockResolvedValue(undefined),
}));

let fastify: any;
let wss: any;
let stopServer: (() => Promise<void>) | undefined;
let startServer: (() => Promise<void>) | undefined;
const TEST_JWT_SECRET = 'test-commerce-shared-secret-long-enough-for-hmac';

function createCommerceToken(user: { id: string; email: string; role: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', TEST_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('ChatOps authentication and health', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.PORT = '0';
    const portProbe = createServer();
    await new Promise<void>((resolve, reject) => {
      portProbe.once('error', reject);
      portProbe.listen(0, '127.0.0.1', () => {
        portProbe.off('error', reject);
        resolve();
      });
    });
    const portAddress = portProbe.address();
    if (!portAddress || typeof portAddress === 'string') {
      throw new Error('Could not reserve a test WebSocket port.');
    }
    process.env.WS_PORT = String(portAddress.port);
    await new Promise<void>((resolve, reject) => {
      portProbe.close((error) => error ? reject(error) : resolve());
    });

    const serverModule = await import('../src/server');
    fastify = serverModule.fastify;
    wss = serverModule.wss;
    stopServer = serverModule.stopServer;
    startServer = serverModule.startServer;
    await fastify.ready();
  });

  afterAll(async () => {
    if (stopServer) await stopServer();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createSocket = (token: string) => {
    const socket = new EventEmitter() as EventEmitter & {
      readyState: number;
      send: jest.Mock;
      close: jest.Mock;
    };
    socket.readyState = WebSocket.OPEN;
    socket.send = jest.fn();
    socket.close = jest.fn();
    wss.emit('connection', socket as unknown as WebSocket, {
      headers: { cookie: `chatops_session=${token}` },
    });
    return socket;
  };

  const sendSocketMessage = async (socket: EventEmitter, message: Record<string, unknown>) => {
    const onMessage = socket.listeners('message')[0] as (payload: Buffer) => Promise<void>;
    await onMessage(Buffer.from(JSON.stringify(message)));
  };

  it('returns health metadata including Redis status', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('redis');
    expect(body.redis).toHaveProperty('configured');
    expect(body.redis).toHaveProperty('connected');
    expect(body.redis).toHaveProperty('source');
    expect(body).toHaveProperty('websocket');
    expect(body.websocket).toBe('enabled');
  });

  it('provides authenticated ICE configuration with short-lived TURN credentials', async () => {
    const previousTurnUrls = process.env.TURN_URLS;
    const previousTurnSecret = process.env.TURN_SHARED_SECRET;
    const token = createCommerceToken({
      id: 'ice-config-user',
      email: 'ice-config@example.com',
      role: 'user',
    });
    try {
      delete process.env.TURN_URLS;
      delete process.env.TURN_SHARED_SECRET;
      const stunOnly = await fastify.inject({
        method: 'GET',
        url: '/ice-servers',
        headers: { cookie: `chatops_session=${token}` },
      });
      expect(stunOnly.statusCode).toBe(200);
      expect(JSON.parse(stunOnly.payload)).toMatchObject({
        turnConfigured: false,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });

      const unauthenticated = await fastify.inject({ method: 'GET', url: '/ice-servers' });
      expect(unauthenticated.statusCode).toBe(401);

      const secret = 'short-lived-turn-test-shared-secret';
      process.env.TURN_URLS = 'turn:turn.example.test:3478?transport=udp,turns:turn.example.test:5349';
      process.env.TURN_SHARED_SECRET = secret;
      const withTurn = await fastify.inject({
        method: 'GET',
        url: '/ice-servers',
        headers: { cookie: `chatops_session=${token}` },
      });
      expect(withTurn.statusCode).toBe(200);
      const body = JSON.parse(withTurn.payload);
      const turnServer = body.iceServers.at(-1);
      expect(body.turnConfigured).toBe(true);
      expect(turnServer.urls).toEqual([
        'turn:turn.example.test:3478?transport=udp',
        'turns:turn.example.test:5349',
      ]);
      expect(turnServer.username).toMatch(/^\d+:ice-config-user$/);
      expect(Number(turnServer.username.split(':')[0])).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(turnServer.credential).toBe(
        crypto.createHmac('sha1', secret).update(turnServer.username).digest('base64'),
      );
    } finally {
      if (previousTurnUrls === undefined) delete process.env.TURN_URLS;
      else process.env.TURN_URLS = previousTurnUrls;
      if (previousTurnSecret === undefined) delete process.env.TURN_SHARED_SECRET;
      else process.env.TURN_SHARED_SECRET = previousTurnSecret;
    }
  });

  it('rejects an incomplete TURN configuration', async () => {
    const previousTurnUrls = process.env.TURN_URLS;
    const previousTurnSecret = process.env.TURN_SHARED_SECRET;
    try {
      process.env.TURN_URLS = 'turn:turn.example.test:3478';
      delete process.env.TURN_SHARED_SECRET;
      const token = createCommerceToken({
        id: 'ice-config-user',
        email: 'ice-config@example.com',
        role: 'user',
      });
      const response = await fastify.inject({
        method: 'GET',
        url: '/ice-servers',
        headers: { cookie: `chatops_session=${token}` },
      });
      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.payload).error).toContain('configuração do servidor TURN');
    } finally {
      if (previousTurnUrls === undefined) delete process.env.TURN_URLS;
      else process.env.TURN_URLS = previousTurnUrls;
      if (previousTurnSecret === undefined) delete process.env.TURN_SHARED_SECRET;
      else process.env.TURN_SHARED_SECRET = previousTurnSecret;
    }
  });

  it('authenticates against Commerce and sets an HttpOnly session cookie', async () => {
    const user = { id: 'commerce-user-1', name: 'Pessoa Utilizadora', email: 'person@example.com', role: 'user' };
    const token = createCommerceToken(user);
    jest.spyOn(prisma.chatUser, 'upsert').mockResolvedValue({
      ...user,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { user, token } }),
    } as Response);

    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: 'valid-password' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toContain('HttpOnly');
    expect(res.headers['set-cookie']).toContain('SameSite=Lax');
    expect(JSON.parse(res.payload)).toEqual({ user });
    expect(res.payload).not.toContain(token);
    expect(verifyCommerceToken(token)).toEqual({ id: user.id, email: user.email, role: user.role });
    expect(parseUserIdFromToken(`Bearer ${token}`)).toBe(user.id);
  });

  it('validates an existing Commerce session and protects chat history', async () => {
    const user = { id: 'commerce-user-2', name: 'Utilizador Existente', email: 'user@example.com', role: 'user' };
    const token = createCommerceToken(user);
    jest.spyOn(prisma.chatUser, 'upsert').mockResolvedValue({
      ...user,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { user } }),
    } as Response);

    const session = await fastify.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie: `chatops_session=${token}` },
    });
    expect(session.statusCode).toBe(200);
    expect(JSON.parse(session.payload)).toEqual({ user });

    const history = await fastify.inject({ method: 'GET', url: '/history?channelId=logistica' });
    expect(history.statusCode).toBe(401);
  });

  it('lists ChatOps users from persistent storage for group membership', async () => {
    const user = { id: 'commerce-user-3', email: 'member@example.com', role: 'user' };
    const token = createCommerceToken(user);
    jest.spyOn(prisma.chatUser, 'findMany').mockResolvedValue([
      { id: user.id, name: 'Membro persistido' },
    ] as never);

    const response = await fastify.inject({
      method: 'GET',
      url: '/users',
      headers: { cookie: `chatops_session=${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([{ id: user.id, name: 'Membro persistido' }]);
    expect(prisma.chatUser.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  it('creates private groups using persisted ChatOps members', async () => {
    const owner = { id: 'commerce-owner', email: 'owner@example.com', role: 'user' };
    const member = { id: 'commerce-member', email: 'member@example.com', role: 'user' };
    const token = createCommerceToken(owner);
    jest.spyOn(prisma.chatUser, 'findMany').mockResolvedValue([
      { id: owner.id, name: 'Proprietário' },
      { id: member.id, name: 'Membro' },
    ] as never);
    jest.spyOn(prisma.channel, 'create').mockResolvedValue({
      id: 'private-group-uuid',
      name: 'Equipa',
      ownerId: owner.id,
      groupMembers: [
        { userId: owner.id, displayName: 'Proprietário', role: 'owner' },
        { userId: member.id, displayName: 'Membro', role: 'member' },
      ],
    } as never);

    const response = await fastify.inject({
      method: 'POST',
      url: '/groups',
      headers: { cookie: `chatops_session=${token}` },
      payload: { name: 'Equipa', members: [member.id] },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toMatchObject({
      id: 'private-group-uuid',
      name: 'Equipa',
      ownerId: owner.id,
      members: [
        { id: owner.id, name: 'Proprietário', role: 'owner' },
        { id: member.id, name: 'Membro', role: 'member' },
      ],
    });
    expect(prisma.channel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isPrivate: true,
        ownerId: owner.id,
        groupMembers: { create: expect.arrayContaining([
          expect.objectContaining({ userId: member.id, role: 'member' }),
        ]) },
      }),
    }));
  });

  it('allows a group owner to add a persisted ChatOps user', async () => {
    const owner = { id: 'commerce-owner-2', email: 'owner2@example.com', role: 'user' };
    const token = createCommerceToken(owner);
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'private-group-uuid',
      name: 'Equipa',
      isPrivate: true,
      ownerId: owner.id,
    } as never);
    jest.spyOn(prisma.channelMember, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.chatUser, 'findUnique').mockResolvedValue({
      id: 'commerce-member-2',
      name: 'Membro',
    } as never);
    jest.spyOn(prisma.channelMember, 'create').mockResolvedValue({
      channelId: 'private-group-uuid',
      userId: 'commerce-member-2',
      displayName: 'Membro',
      role: 'member',
      createdAt: new Date(),
    });
    jest.spyOn(prisma.channelMember, 'findMany').mockResolvedValue([
      { userId: owner.id, displayName: 'Proprietário', role: 'owner' },
      { userId: 'commerce-member-2', displayName: 'Membro', role: 'member' },
    ] as never);

    const response = await fastify.inject({
      method: 'PATCH',
      url: '/groups/private-group-uuid/members',
      headers: { cookie: `chatops_session=${token}` },
      payload: { userId: 'commerce-member-2', action: 'add' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).members).toContainEqual({
      id: 'commerce-member-2',
      name: 'Membro',
      role: 'member',
    });
  });

  it('adds an existing ChatOps user to a private group from an email invitation', async () => {
    const owner = { id: 'invite-owner', email: 'owner@example.com', role: 'user' };
    const token = createCommerceToken(owner);
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'invite-group',
      name: 'Operações',
      isPrivate: true,
      ownerId: owner.id,
      groupMembers: [{ userId: owner.id, displayName: 'Proprietário', role: 'owner' }],
    } as never);
    jest.spyOn(prisma.chatUser, 'findFirst').mockResolvedValue({
      id: 'invite-member',
      name: 'Novo membro',
    } as never);
    jest.spyOn(prisma.channelMember, 'create').mockResolvedValue({
      channelId: 'invite-group',
      userId: 'invite-member',
      displayName: 'Novo membro',
      role: 'member',
      createdAt: new Date(),
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/groups/invite-group/invitations',
      headers: { cookie: `chatops_session=${token}` },
      payload: { target: 'member@example.com' },
    });

    expect(response.statusCode).toBe(201);
    expect(prisma.chatUser.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: 'member@example.com' }, { email: { equals: 'member@example.com', mode: 'insensitive' } }] },
    }));
    expect(JSON.parse(response.payload).members).toContainEqual({
      id: 'invite-member',
      name: 'Novo membro',
      role: 'member',
    });
  });

  it('persists pins and scopes them to authorized channels', async () => {
    const user = { id: 'pin-owner', email: 'pin@example.com', role: 'user' };
    const token = createCommerceToken(user);
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'pin-group',
      name: 'Equipa',
      isPrivate: true,
      ownerId: user.id,
      groupMembers: [{ userId: user.id, displayName: 'Pin owner', role: 'owner' }],
    } as never);
    const createdAt = new Date('2026-10-03T10:00:00Z');
    jest.spyOn(prisma.message, 'findFirst').mockResolvedValue({
      id: 'message-to-pin',
      channelId: 'pin-group',
      userId: 'pin-owner',
      text: 'Informação importante',
      createdAt,
    } as never);
    jest.spyOn(prisma.pinnedMessage, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.pinnedMessage, 'create').mockResolvedValue({
      messageId: 'message-to-pin',
      channelId: 'pin-group',
      pinnedByUserId: user.id,
      createdAt,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/channels/pin-group/pins',
      headers: { cookie: `chatops_session=${token}` },
      payload: { messageId: 'message-to-pin' },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toMatchObject({
      id: 'message-to-pin',
      text: 'Informação importante',
      channelId: 'pin-group',
      pinnedByUserId: user.id,
    });
    expect(prisma.pinnedMessage.create).toHaveBeenCalledWith({
      data: { messageId: 'message-to-pin', channelId: 'pin-group', pinnedByUserId: user.id },
    });

    jest.spyOn(prisma.pinnedMessage, 'findMany').mockResolvedValue([{
      messageId: 'message-to-pin',
      channelId: 'pin-group',
      pinnedByUserId: user.id,
      createdAt,
      message: {
        id: 'message-to-pin',
        channelId: 'pin-group',
        userId: user.id,
        text: 'Informação importante',
        createdAt,
      },
    }] as never);
    const listed = await fastify.inject({
      method: 'GET',
      url: '/channels/pin-group/pins',
      headers: { cookie: `chatops_session=${token}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(JSON.parse(listed.payload)).toEqual([expect.objectContaining({
      id: 'message-to-pin',
      pinnedByUserId: user.id,
    })]);

    jest.spyOn(prisma.pinnedMessage, 'findUnique').mockResolvedValue({
      messageId: 'message-to-pin',
      channelId: 'pin-group',
      pinnedByUserId: user.id,
      createdAt,
    } as never);
    jest.spyOn(prisma.pinnedMessage, 'delete').mockResolvedValue({} as never);
    const removed = await fastify.inject({
      method: 'DELETE',
      url: '/channels/pin-group/pins/message-to-pin',
      headers: { cookie: `chatops_session=${token}` },
    });
    expect(removed.statusCode).toBe(204);

    const forbiddenToken = createCommerceToken({
      id: 'pin-outsider',
      email: 'outsider@example.com',
      role: 'user',
    });
    const forbidden = await fastify.inject({
      method: 'GET',
      url: '/channels/pin-group/pins',
      headers: { cookie: `chatops_session=${forbiddenToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('rejects group management by a non-owner', async () => {
    const token = createCommerceToken({
      id: 'commerce-other-user',
      email: 'other@example.com',
      role: 'user',
    });
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'private-group-uuid',
      isPrivate: true,
      ownerId: 'commerce-owner',
    } as never);
    const transactionSpy = jest.spyOn(prisma, '$transaction');

    const response = await fastify.inject({
      method: 'DELETE',
      url: '/groups/private-group-uuid',
      headers: { cookie: `chatops_session=${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('deletes only the authenticated author’s message and broadcasts success', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'delete-group',
      name: 'Equipa',
      isPrivate: true,
      ownerId: 'message-owner',
      groupMembers: [{ userId: 'message-owner', displayName: 'Autor', role: 'owner' }],
    } as never);
    jest.spyOn(prisma.message, 'findFirst')
      .mockResolvedValueOnce({
        id: 'delete-me',
        channelId: 'delete-group',
        userId: 'another-author',
        text: 'not yours',
        createdAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        id: 'delete-me',
        channelId: 'delete-group',
        userId: 'message-owner',
        text: 'remove this',
        createdAt: new Date(),
      } as never);
    jest.spyOn(prisma.auditLog, 'deleteMany').mockResolvedValue({ count: 1 });
    jest.spyOn(prisma.message, 'delete').mockResolvedValue({} as never);
    jest.spyOn(prisma, '$transaction').mockImplementation(async (operations: any) => Promise.all(operations) as never);

    const socket = createSocket(createCommerceToken({
      id: 'message-owner',
      email: 'author@example.com',
      role: 'user',
    }));
    await sendSocketMessage(socket, { type: 'subscribe', channelId: 'delete-group' });
    await sendSocketMessage(socket, {
      type: 'delete_message',
      channelId: 'delete-group',
      messageId: 'delete-me',
    });
    expect(socket.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'message_delete_failed',
    )).toBe(true);
    expect(prisma.message.delete).not.toHaveBeenCalled();

    await sendSocketMessage(socket, {
      type: 'delete_message',
      channelId: 'delete-group',
      messageId: 'delete-me',
    });
    expect(prisma.message.delete).toHaveBeenCalledWith({ where: { id: 'delete-me' } });
    expect(socket.send.mock.calls.some(([payload]) => {
      const event = JSON.parse(String(payload));
      return event.type === 'message_deleted' && event.messageId === 'delete-me';
    })).toBe(true);
    socket.emit('close');
  });

  it('stores read receipts and sends them to the message author', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'receipt-group',
      name: 'Equipa',
      isPrivate: true,
      ownerId: 'receipt-author',
      groupMembers: [
        { userId: 'receipt-author', displayName: 'Autor', role: 'owner' },
        { userId: 'receipt-reader', displayName: 'Leitor', role: 'member' },
      ],
    } as never);
    jest.spyOn(prisma.message, 'findMany').mockResolvedValue([
      { id: 'read-this', userId: 'receipt-author' },
    ] as never);
    jest.spyOn(prisma.messageReadReceipt, 'findMany')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{
        messageId: 'read-this',
        userId: 'receipt-reader',
        readAt: new Date('2026-10-03T10:00:00Z'),
      }] as never);
    jest.spyOn(prisma.messageReadReceipt, 'createMany').mockResolvedValue({ count: 1 });

    const author = createSocket(createCommerceToken({
      id: 'receipt-author',
      email: 'author@example.com',
      role: 'user',
    }));
    const reader = createSocket(createCommerceToken({
      id: 'receipt-reader',
      email: 'reader@example.com',
      role: 'user',
    }));
    await sendSocketMessage(author, { type: 'subscribe', channelId: 'receipt-group' });
    await sendSocketMessage(reader, { type: 'subscribe', channelId: 'receipt-group' });
    await sendSocketMessage(reader, {
      type: 'read_receipts',
      channelId: 'receipt-group',
      messageIds: ['read-this', 'read-this', 'foreign-id'],
    });

    expect(prisma.messageReadReceipt.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ messageId: 'read-this', userId: 'receipt-reader' })],
      skipDuplicates: true,
    }));
    expect(author.send.mock.calls.some(([payload]) => {
      const event = JSON.parse(String(payload));
      return event.type === 'read_receipt' && event.messageId === 'read-this' && event.userId === 'receipt-reader';
    })).toBe(true);
    author.emit('close');
    reader.emit('close');
  });

  it('relays call signalling only between authenticated channel participants', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'private-group-uuid',
      name: 'Equipa privada',
      isPrivate: true,
      ownerId: 'call-caller',
      groupMembers: [
        { userId: 'call-caller', displayName: 'Caller', role: 'owner' },
        { userId: 'call-callee', displayName: 'Callee', role: 'member' },
      ],
    } as never);

    const caller = createSocket(createCommerceToken({
      id: 'call-caller',
      email: 'caller@example.com',
      role: 'user',
    }));
    const callee = createSocket(createCommerceToken({
      id: 'call-callee',
      email: 'callee@example.com',
      role: 'user',
    }));
    const calleeSecondary = createSocket(createCommerceToken({
      id: 'call-callee',
      email: 'callee@example.com',
      role: 'user',
    }));
    const callerSecondary = createSocket(createCommerceToken({
      id: 'call-caller',
      email: 'caller@example.com',
      role: 'user',
    }));
    const outsider = createSocket(createCommerceToken({
      id: 'call-outsider',
      email: 'outsider@example.com',
      role: 'user',
    }));

    await sendSocketMessage(caller, { type: 'subscribe', channelId: 'private-group-uuid' });
    await sendSocketMessage(callerSecondary, { type: 'subscribe', channelId: 'private-group-uuid' });
    await sendSocketMessage(callee, { type: 'subscribe', channelId: 'private-group-uuid' });
    await sendSocketMessage(calleeSecondary, { type: 'subscribe', channelId: 'private-group-uuid' });
    await sendSocketMessage(outsider, { type: 'subscribe', channelId: 'private-group-uuid' });
    await sendSocketMessage(caller, {
      type: 'call_invite',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
      targetUserIds: ['call-callee'],
      media: 'video',
    });
    await sendSocketMessage(callee, {
      type: 'call_accept',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
    });

    const receivedInvite = callee.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_invite',
    );
    const receivedInviteOnSecondarySession = calleeSecondary.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_invite',
    );
    const receivedJoinEvent = caller.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_peer_joined',
    );
    const receivedJoinEventOnSecondarySession = callerSecondary.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_peer_joined',
    );
    expect(receivedInvite).toBe(true);
    expect(receivedInviteOnSecondarySession).toBe(true);
    expect(receivedJoinEvent).toBe(true);
    expect(receivedJoinEventOnSecondarySession).toBe(true);
    expect(callee.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_available' &&
      typeof JSON.parse(String(payload)).startedAt === 'number',
    )).toBe(true);
    expect(callee.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_invite' && typeof message.startedAt === 'number';
    })).toBe(true);

    await sendSocketMessage(outsider, {
      type: 'call_rejoin',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
    });
    expect(outsider.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_error' && message.error === 'Não pode voltar a esta chamada.';
    })).toBe(true);

    await sendSocketMessage(caller, {
      type: 'call_signal',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
      targetUserId: 'call-callee',
      signal: { type: 'offer', sdp: 'test-session-description' },
    });
    expect(callee.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_signal',
    )).toBe(true);

    await sendSocketMessage(caller, {
      type: 'call_signal',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
      targetUserId: 'call-callee',
      signal: {
        type: 'candidate',
        candidate: 'candidate:test 1 udp 123 192.0.2.1 12345 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    });
    expect(callee.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_signal' && message.signal.type === 'candidate';
    })).toBe(true);

    await sendSocketMessage(caller, {
      type: 'call_signal',
      callId: 'call-session-123',
      channelId: 'private-group-uuid',
      targetUserId: 'call-outsider',
      signal: { type: 'offer', sdp: 'unauthorized-description' },
    });
    expect(caller.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_error',
    )).toBe(true);
    expect(outsider.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_signal',
    )).toBe(false);

    for (const socket of [caller, callerSecondary, callee, calleeSecondary, outsider]) socket.emit('close');
  });

  it('lets group call members leave while only the host can end the call for everyone', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'group-call-channel',
      name: 'Chamada de grupo',
      isPrivate: true,
      ownerId: 'group-host',
      groupMembers: [
        { userId: 'group-host', displayName: 'Anfitrião', role: 'owner' },
        { userId: 'group-member-1', displayName: 'Membro 1', role: 'member' },
        { userId: 'group-member-2', displayName: 'Membro 2', role: 'member' },
      ],
    } as never);

    const host = createSocket(createCommerceToken({
      id: 'group-host',
      email: 'host@example.com',
      role: 'user',
    }));
    const member1 = createSocket(createCommerceToken({
      id: 'group-member-1',
      email: 'member1@example.com',
      role: 'user',
    }));
    const member2 = createSocket(createCommerceToken({
      id: 'group-member-2',
      email: 'member2@example.com',
      role: 'user',
    }));

    for (const socket of [host, member1, member2]) {
      await sendSocketMessage(socket, { type: 'subscribe', channelId: 'group-call-channel' });
    }
    await sendSocketMessage(host, {
      type: 'call_invite',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
      targetUserIds: ['group-member-1', 'group-member-2'],
      media: 'audio',
    });
    for (const socket of [member1, member2]) {
      await sendSocketMessage(socket, {
        type: 'call_accept',
        callId: 'group-call-session',
        channelId: 'group-call-channel',
      });
    }

    await sendSocketMessage(member1, {
      type: 'call_end',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(member1.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_error' && message.callId === 'group-call-session';
    })).toBe(true);
    expect(member2.send.mock.calls.some(([payload]) =>
      JSON.parse(String(payload)).type === 'call_ended',
    )).toBe(false);

    await sendSocketMessage(member1, {
      type: 'call_leave',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(host.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_left' && message.userId === 'group-member-1';
    })).toBe(true);
    expect(member2.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_left' && message.userId === 'group-member-1';
    })).toBe(true);
    expect(member1.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_available' &&
        message.participantCount === 2 &&
        message.invitedUserIds.includes('group-member-1') &&
        typeof message.startedAt === 'number';
    })).toBe(true);

    await sendSocketMessage(member1, {
      type: 'call_rejoin',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(member1.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_joined' &&
        message.userId === 'group-host' &&
        typeof message.startedAt === 'number';
    })).toBe(true);
    expect(member2.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_joined' && message.userId === 'group-member-1';
    })).toBe(true);

    await sendSocketMessage(host, {
      type: 'call_leave',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(member2.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_left' && message.userId === 'group-host';
    })).toBe(true);

    await sendSocketMessage(host, {
      type: 'call_rejoin',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(member2.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_peer_joined' && message.userId === 'group-host';
    })).toBe(true);

    await sendSocketMessage(host, {
      type: 'call_end',
      callId: 'group-call-session',
      channelId: 'group-call-channel',
    });
    expect(member2.send.mock.calls.some(([payload]) => {
      const message = JSON.parse(String(payload));
      return message.type === 'call_ended' && message.callId === 'group-call-session';
    })).toBe(true);

    for (const socket of [host, member1, member2]) socket.emit('close');
  });

  it('shares online presence across channels and broadcasts status changes', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'presence-private-group',
      name: 'Presença',
      isPrivate: true,
      ownerId: 'presence-user',
      groupMembers: [
        { userId: 'presence-user', displayName: 'Utilizador', role: 'owner' },
        { userId: 'presence-user-2', displayName: 'Outro membro', role: 'member' },
      ],
    } as never);
    const socket = createSocket(createCommerceToken({
      id: 'presence-user',
      email: 'presence@example.com',
      role: 'user',
    }));
    const otherChatSocket = createSocket(createCommerceToken({
      id: 'presence-user-2',
      email: 'presence2@example.com',
      role: 'user',
    }));

    await sendSocketMessage(socket, { type: 'subscribe', channelId: 'presence-private-group' });
    await sendSocketMessage(otherChatSocket, { type: 'subscribe', channelId: 'another-private-group' });
    const globalPresence = socket.send.mock.calls
      .map(([payload]) => JSON.parse(String(payload)))
      .filter((payload) => payload.type === 'presence')
      .at(-1);
    expect(globalPresence.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'presence-user-2', online: true, presence: 'online' }),
    ]));

    const beforeAway = socket.send.mock.calls.length;
    await sendSocketMessage(socket, { type: 'presence', status: 'away' });

    const presence = socket.send.mock.calls
      .slice(beforeAway)
      .map(([payload]) => JSON.parse(String(payload)))
      .filter((payload) => payload.type === 'presence')
      .at(-1);
    expect(presence.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'presence-user',
        online: true,
        presence: 'away',
        presenceChangedAt: expect.any(Number),
      }),
    ]));
    const otherChatPresence = otherChatSocket.send.mock.calls
      .map(([payload]) => JSON.parse(String(payload)))
      .filter((payload) => payload.type === 'presence')
      .at(-1);
    expect(otherChatPresence.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'presence-user', online: true, presence: 'away' }),
    ]));
    socket.emit('close');
    otherChatSocket.emit('close');
  });

  it('reports message persistence failures so clients can clear pending state', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'message-failure-group',
      name: 'Mensagens',
      isPrivate: true,
      ownerId: 'message-author',
      groupMembers: [{ userId: 'message-author', displayName: 'Utilizador', role: 'owner' }],
    } as never);
    jest.spyOn(prisma.message, 'findMany').mockResolvedValue([] as never);
    jest.spyOn(prisma.message, 'create').mockRejectedValue(new Error('storage failure'));
    const socket = createSocket(createCommerceToken({
      id: 'message-author',
      email: 'author@example.com',
      role: 'user',
    }));

    await sendSocketMessage(socket, { type: 'subscribe', channelId: 'message-failure-group' });
    await sendSocketMessage(socket, {
      type: 'message',
      channelId: 'message-failure-group',
      text: 'Esta mensagem não foi guardada',
      tempId: 'message-failure-temp',
    });

    expect(socket.send.mock.calls.some(([payload]) => {
      const event = JSON.parse(String(payload));
      return event.type === 'message_failed' && event.tempId === 'message-failure-temp';
    })).toBe(true);
    expect(socket.send.mock.calls.some(([payload]) => {
      const event = JSON.parse(String(payload));
      return event.type === 'message' && event.tempId === 'message-failure-temp';
    })).toBe(false);
    socket.emit('close');
  });

  it('only allows users with the configured role to approve credit', async () => {
    const channelId = 'command-private-group';
    const logisticsChannel = 'logistica';
    jest.spyOn(prisma.channel, 'findUnique').mockImplementation(({ where }) => Promise.resolve(
      where.id === channelId
        ? {
          id: channelId,
          name: 'Comandos',
          isPrivate: true,
          ownerId: 'command-user',
          groupMembers: [
            { userId: 'command-user', displayName: 'Utilizador', role: 'member' },
            { userId: 'command-admin', displayName: 'Administrador', role: 'member' },
          ],
        }
        : { id: logisticsChannel, name: 'Logística', isPrivate: false } as never
    ) as never);
    jest.spyOn(prisma.message, 'findMany').mockResolvedValue([] as never);
    jest.spyOn(prisma.message, 'create').mockResolvedValue({} as never);
    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never);
    const updateCredit = jest.spyOn(prisma.b2BClient, 'update').mockResolvedValue({} as never);

    const member = createSocket(createCommerceToken({
      id: 'command-user',
      email: 'member@example.com',
      role: 'user',
    }));
    const admin = createSocket(createCommerceToken({
      id: 'command-admin',
      email: 'admin@example.com',
      role: 'admin',
    }));
    await sendSocketMessage(member, { type: 'subscribe', channelId });
    await sendSocketMessage(admin, { type: 'subscribe', channelId });
    await sendSocketMessage(member, { type: 'subscribe', channelId: logisticsChannel });
    await sendSocketMessage(admin, { type: 'subscribe', channelId: logisticsChannel });

    await sendSocketMessage(member, { type: 'subscribe', channelId });
    await sendSocketMessage(member, {
      type: 'message',
      channelId,
      text: '/approve-credit company-123',
      tempId: 'member-credit-command',
    });
    expect(updateCredit).not.toHaveBeenCalled();
    expect(member.send.mock.calls.some(([payload]) =>
      String(payload).includes('Os comandos de Logística só podem ser usados no canal #Logística.'),
    )).toBe(true);

    await sendSocketMessage(member, {
      type: 'message',
      channelId,
      text: '/stock PROD-001',
      language: 'es',
      tempId: 'member-stock-command-outside-logistics',
    });
    expect(member.send.mock.calls.some(([payload]) =>
      String(payload).includes('Los comandos de logística solo se pueden usar en el canal #Logística.'),
    )).toBe(true);

    await sendSocketMessage(member, {
      type: 'message',
      channelId,
      text: '/low-stock',
      tempId: 'member-low-stock-command-outside-logistics',
    });
    expect(member.send.mock.calls.some(([payload]) =>
      String(payload).includes('Os comandos de Logística só podem ser usados no canal #Logística.'),
    )).toBe(true);

    await sendSocketMessage(member, {
      type: 'message',
      channelId,
      text: '/order 0123456789abcdef01234567',
      tempId: 'member-order-command-outside-logistics',
    });
    expect(member.send.mock.calls.some(([payload]) =>
      String(payload).includes('Os comandos de Logística só podem ser usados no canal #Logística.'),
    )).toBe(true);

    await sendSocketMessage(member, { type: 'subscribe', channelId: logisticsChannel });
    await sendSocketMessage(member, {
      type: 'message',
      channelId: logisticsChannel,
      text: '/approve-credit company-123',
      tempId: 'member-credit-command-in-logistics',
    });
    expect(updateCredit).not.toHaveBeenCalled();
    expect(member.send.mock.calls.some(([payload]) =>
      String(payload).includes('Não tem permissão para aprovar crédito.'),
    )).toBe(true);

    await sendSocketMessage(admin, {
      type: 'message',
      channelId: logisticsChannel,
      text: '/approve-credit company-123',
      language: 'en',
      tempId: 'admin-credit-command',
    });
    expect(updateCredit).toHaveBeenCalledWith({
      where: { id: 'company-123' },
      data: { creditStatus: 'APPROVED' },
    });
    expect(admin.send.mock.calls.some(([payload]) =>
      String(payload).includes('Credit approved for company company-123.'),
    )).toBe(true);

    member.emit('close');
    admin.emit('close');
  });

  it('does not expose development-token authentication', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/auth/dev-token' });
    expect(res.statusCode).toBe(404);
  });

  it('requires a strong shared JWT secret in production and staging', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET é obrigatória');

      process.env.JWT_SECRET = 'change-me';
      expect(() => getJwtSecret()).toThrow('pelo menos 32 caracteres');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('fails application startup before database access when production JWT_SECRET is missing', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      await expect(startServer!()).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });

  it('rejects upload filenames containing path traversal', async () => {
    const token = createCommerceToken({
      id: 'upload-user',
      email: 'upload-user@example.com',
      role: 'user',
    });
    const boundary = '----chatops-upload-test';
    const payload = [
      `--${boundary}\r\nContent-Disposition: form-data; name="channelId"\r\n\r\nlogistica\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../outside.txt"\r\nContent-Type: text/plain\r\n\r\npayload\r\n`,
      `--${boundary}--\r\n`,
    ].join('');

    const response = await fastify.inject({
      method: 'POST',
      url: '/upload',
      headers: {
        cookie: `chatops_session=${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('requires authentication to download channel files', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/channels/private-channel/files/missing-file',
    });

    expect(response.statusCode).toBe(401);
  });

  it('denies file downloads to users outside the channel', async () => {
    const token = createCommerceToken({
      id: 'outside-channel-user',
      email: 'outside-channel@example.com',
      role: 'user',
    });
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'private-channel',
      name: 'Private',
      isPrivate: true,
      groupMembers: [{ userId: 'channel-member', displayName: 'Member' }],
    } as never);

    const response = await fastify.inject({
      method: 'GET',
      url: '/channels/private-channel/files/missing-file',
      headers: { cookie: `chatops_session=${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('ends active calls before a graceful backend shutdown', async () => {
    jest.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'shutdown-group',
      name: 'Chamada durante reinício',
      isPrivate: true,
      ownerId: 'shutdown-host',
      groupMembers: [
        { userId: 'shutdown-host', displayName: 'Anfitrião', role: 'owner' },
        { userId: 'shutdown-invitee', displayName: 'Membro', role: 'member' },
      ],
    } as never);

    await startServer!();
    const host = createSocket(createCommerceToken({
      id: 'shutdown-host',
      email: 'shutdown-host@example.com',
      role: 'user',
    }));
    const invitee = createSocket(createCommerceToken({
      id: 'shutdown-invitee',
      email: 'shutdown-invitee@example.com',
      role: 'user',
    }));
    await sendSocketMessage(host, { type: 'subscribe', channelId: 'shutdown-group' });
    await sendSocketMessage(invitee, { type: 'subscribe', channelId: 'shutdown-group' });
    await sendSocketMessage(host, {
      type: 'call_invite',
      callId: 'shutdown-call-session',
      channelId: 'shutdown-group',
      targetUserIds: ['shutdown-invitee'],
      media: 'audio',
    });

    await stopServer!();

    for (const socket of [host, invitee]) {
      expect(socket.send.mock.calls.some(([payload]) => {
        const event = JSON.parse(String(payload));
        return event.type === 'call_ended'
          && event.callId === 'shutdown-call-session'
          && event.reason === 'server_shutdown';
      })).toBe(true);
      socket.emit('close');
    }
  });

});
