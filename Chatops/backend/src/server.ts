import fs from 'fs';
import path from 'path';
import { createHmac, randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import client from 'prom-client';
import { publishPortfolioEvent } from './redisClient';
import { ChatOpsEngine } from './chatOpsEngine';
import { prisma } from './prismaClient';
import { getJwtSecret, verifyCommerceToken, type CommerceIdentity } from './auth';

const HTTP_PORT = Number(process.env.PORT || 3002);
const WS_PORT = Number(process.env.WS_PORT || 9001);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const allowedCorsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3006,http://localhost:5177,http://127.0.0.1:5177')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const commerceApiUrl = (process.env.COMMERCE_API_URL || 'http://backend:3001/api/v1').replace(/\/+$/, '');
const sessionCookieName = 'chatops_session';
const defaultIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const fastify = Fastify({ logger: false });
fastify.addHook('onReady', () => {
  if (!startupError) {
    startupCompleted = true;
  }
});
fastify.register(fastifyCors, {
  origin: allowedCorsOrigins,
  credentials: true,
});
fastify.register(fastifyMultipart);
fastify.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/', decorateReply: false });

interface ChatMessage {
  id: string;
  tempId?: string;
  channelId: string;
  userId: string;
  text: string;
  ts: number;
  pending?: boolean;
  system?: boolean;
  fileUrl?: string;
  replyToId?: string;
  readBy?: Array<{ userId: string; readAt: string }>;
}

interface FileRecord {
  id: string;
  name: string;
  url: string;
  size: number;
}

interface ConnectionMeta {
  userId: string;
  role: string;
  email: string;
  commerceAccessToken?: string;
  channelId?: string;
  presence?: 'online' | 'dnd' | 'away' | 'offline';
  presenceChangedAt?: number;
}

interface ChatUser extends CommerceIdentity {
  name: string;
}

interface CallRoom {
  channelId: string;
  hostUserId: string;
  media: 'audio' | 'video';
  startedAt: number;
  participants: Set<string>;
  pendingInvitees: Set<string>;
  invitedUsers: Set<string>;
  inviteTimeout?: ReturnType<typeof setTimeout>;
}

const activeConnections = new Map<string, Set<WebSocket>>();
const connectionMeta = new Map<WebSocket, ConnectionMeta>();
const messageHistory = new Map<string, ChatMessage[]>();
const knownUsers = new Map<string, ChatUser>();
const channelMemberCache = new Map<string, Array<{ id: string; name: string }>>();
const callRooms = new Map<string, CallRoom>();
const publicChannelIds = new Set(['logistica', 'geral', 'comercial', 'suporte', 'alertas']);
const channelFiles = new Map<string, FileRecord[]>([
  ['logistica', [
    { id: 'file-1', name: 'relatorio-de-estoque.pdf', url: '/uploads/relatorio-de-estoque.pdf', size: 154321 }
  ]],
]);

const metrics = {
  httpRequests: 0,
  websocketConnections: 0,
  commandsExecuted: 0,
  messagesStored: 0,
};

client.collectDefaultMetrics({ prefix: 'chatops_' });

const httpRequestTotal = new client.Counter({
  name: 'chatops_http_requests_total',
  help: 'Total number of ChatOps HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationMs = new client.Histogram({
  name: 'chatops_http_request_duration_ms',
  help: 'ChatOps HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [50, 100, 200, 300, 500, 1000, 2000, 5000],
});

const websocketConnectionsGauge = new client.Gauge({
  name: 'chatops_websocket_connections',
  help: 'Current active ChatOps WebSocket connections',
});

const commandsExecutedCounter = new client.Counter({
  name: 'chatops_commands_executed_total',
  help: 'Total number of ChatOps commands executed',
});

const messagesStoredCounter = new client.Counter({
  name: 'chatops_messages_stored_total',
  help: 'Total number of ChatOps messages stored',
});

const startedAt = Date.now();
let startupCompleted = false;
let startupError: string | null = null;

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function getRequestToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim() || null;
  return getCookieValue(request.headers.cookie, sessionCookieName);
}

function getRequestIdentity(request: FastifyRequest) {
  const token = getRequestToken(request);
  return token ? verifyCommerceToken(token) : null;
}

async function saveKnownUser(user: ChatUser): Promise<void> {
  await prisma.chatUser.upsert({
    where: { id: user.id },
    create: user,
    update: {
      name: user.name,
      email: user.email,
      role: user.role,
      lastSeenAt: new Date(),
    },
  });
  knownUsers.set(user.id, user);
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const cookie = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=86400',
  ];
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') cookie.push('Secure');
  reply.header('Set-Cookie', cookie.join('; '));
}

function clearSessionCookie(reply: FastifyReply) {
  const cookie = [`${sessionCookieName}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') cookie.push('Secure');
  reply.header('Set-Cookie', cookie.join('; '));
}

async function requireAuthentication(request: FastifyRequest, reply: FastifyReply) {
  if (!getRequestIdentity(request)) {
    return reply.code(401).send({ error: 'Autenticação necessária.' });
  }
}

function getHealthSnapshot() {
  return {
    ok: true,
    status: 'ready',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    metrics: {
      activeConnections: activeConnections.size,
      activeChannels: activeConnections.size,
      activeUsers: connectionMeta.size,
      messagesStored: metrics.messagesStored,
    },
  };
}

const ensureChannel = async (channelId: string) => {
  if (messageHistory.has(channelId)) return;

  const existingChannel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!existingChannel) {
    if (!publicChannelIds.has(channelId)) {
      throw new Error('Canal não encontrado.');
    }
    await prisma.channel.create({ data: { id: channelId, name: channelId } });
  } else if (!existingChannel.isPrivate && !publicChannelIds.has(channelId)) {
    throw new Error('Canal não encontrado.');
  }

  const persistedMessages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { readReceipts: { select: { userId: true, readAt: true } } },
  });

  const history = persistedMessages.map((message) => ({
    id: message.id,
    channelId,
    userId: message.userId,
    text: message.text,
    ts: message.createdAt.getTime(),
    system: false,
    readBy: message.readReceipts.map(({ userId, readAt }) => ({ userId, readAt: readAt.toISOString() })),
  }));

  messageHistory.set(channelId, history.length > 0 ? history : [{
    id: `system-${channelId}-1`,
    channelId,
    userId: 'bot',
    text: `Bem-vindo ao canal ${channelId}. Envia uma mensagem para começar.`,
    ts: Date.now(),
    system: true,
  }]);
};

const canAccessChannel = async (channelId: string, userId: string) => {
  if (publicChannelIds.has(channelId)) {
    await ensureChannel(channelId);
    return true;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { groupMembers: true },
  });
  if (!channel?.isPrivate) return false;

  const members = channel.groupMembers.map((member) => ({
    id: member.userId,
    name: member.displayName,
  }));
  channelMemberCache.set(channelId, members);
  return members.some((member) => member.id === userId);
};

const getChannelMembers = (channelId: string) => {
  const activeUsers = new Map<string, ConnectionMeta>();
  for (const meta of connectionMeta.values()) {
    const current = activeUsers.get(meta.userId);
    if (!current || (meta.presenceChangedAt || 0) > (current.presenceChangedAt || 0)) {
      activeUsers.set(meta.userId, meta);
    }
  }

  const members = channelMemberCache.get(channelId) || [...knownUsers.values()];
  return members.map(({ id, name }) => {
    const connection = activeUsers.get(id);
    return {
      id,
      name,
      online: Boolean(connection && connection.presence !== 'offline'),
      presence: connection?.presence || 'offline',
      presenceChangedAt: connection?.presenceChangedAt,
    };
  });
};

const removeSocketFromChannel = (ws: WebSocket, channelId: string) => {
  const set = activeConnections.get(channelId);
  if (!set?.delete(ws)) return;
  const meta = connectionMeta.get(ws);
  if (meta?.channelId === channelId) connectionMeta.set(ws, { ...meta, channelId: undefined });
  if (set.size === 0) activeConnections.delete(channelId);
};

const publishPresenceToActiveChannels = () => {
  for (const channelId of activeConnections.keys()) {
    publishToChannel(channelId, {
      type: 'presence',
      channelId,
      members: getChannelMembers(channelId),
    });
  }
};

const evictChannelMember = (channelId: string, userId: string, type: 'channel_access_revoked' | 'group_deleted') => {
  const set = activeConnections.get(channelId);
  if (!set) return;
  for (const ws of set) {
    const meta = connectionMeta.get(ws);
    if (meta?.userId !== userId) continue;
    set.delete(ws);
    connectionMeta.set(ws, { ...meta, channelId: undefined });
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, channelId }));
  }
  if (set.size === 0) activeConnections.delete(channelId);
};

const addMessageToHistory = async (channelId: string, message: ChatMessage) => {
  await ensureChannel(channelId);
  const list = messageHistory.get(channelId)!;
  await prisma.message.create({
    data: {
      id: message.id,
      text: message.text,
      userId: message.userId,
      channelId,
    },
  });
  list.push(message);
  if (list.length > 200) list.shift();
};

const broadcastToChannel = (channelId: string, payload: any) => {
  const set = activeConnections.get(channelId);
  if (!set) return;
  const message = JSON.stringify(payload);
  for (const ws of set) {
    try { ws.send(message); } catch { /* ignore */ }
  }
};

const publishToChannel = (channelId: string, payload: any) => {
  broadcastToChannel(channelId, payload);
  void publishPortfolioEvent(`channel:${channelId}`, JSON.stringify(payload)).catch((err) => {
    console.warn('Redis publish failed:', err);
  });
};

const publishCallAvailability = (callId: string, room: CallRoom, available = true) => {
  publishToChannel(room.channelId, {
    type: 'call_available',
    callId,
    channelId: room.channelId,
    hostUserId: room.hostUserId,
    hostName: knownUsers.get(room.hostUserId)?.name || room.hostUserId,
    media: room.media,
    startedAt: room.startedAt,
    participantCount: room.participants.size,
    invitedUserIds: [...room.invitedUsers],
    available,
  });
};

const sendToUser = (userId: string, payload: unknown): boolean => {
  const message = JSON.stringify(payload);
  let sent = false;
  for (const [socket, meta] of connectionMeta) {
    if (meta.userId !== userId || meta.presence === 'offline' || socket.readyState !== WebSocket.OPEN) continue;
    try {
      socket.send(message);
      sent = true;
    } catch (error) {
      console.warn(`[WS] failed to send event to user=${userId}:`, error);
    }
  }
  return sent;
};

const isValidCallSignal = (signal: unknown): boolean => {
  if (!signal || typeof signal !== 'object') return false;
  const candidate = signal as Record<string, unknown>;

  if (candidate.type === 'offer' || candidate.type === 'answer') {
    return typeof candidate.sdp === 'string' && candidate.sdp.length > 0 && candidate.sdp.length <= 16000;
  }
  if (candidate.type === 'candidate') {
    return (
      typeof candidate.candidate === 'string' &&
      candidate.candidate.length <= 4096 &&
      (candidate.sdpMid === null || candidate.sdpMid === undefined || typeof candidate.sdpMid === 'string') &&
      (candidate.sdpMLineIndex === null ||
        candidate.sdpMLineIndex === undefined ||
        Number.isInteger(candidate.sdpMLineIndex))
    );
  }
  return false;
};

const closeCallRoomIfEmpty = (callId: string, room: CallRoom) => {
  if (room.participants.size > 0 || room.pendingInvitees.size > 0) return;
  if (room.inviteTimeout) clearTimeout(room.inviteTimeout);
  callRooms.delete(callId);
  publishCallAvailability(callId, room, false);
};

const removeDisconnectedCallParticipant = (userId: string) => {
  for (const [callId, room] of callRooms) {
    const wasParticipant = room.participants.delete(userId);
    const wasInvited = room.pendingInvitees.delete(userId);
    if (!wasParticipant && !wasInvited) continue;

    for (const participantId of room.participants) {
      sendToUser(participantId, {
        type: wasParticipant ? 'call_peer_left' : 'call_invite_rejected',
        callId,
        channelId: room.channelId,
        userId,
      });
    }
    if (room.hostUserId === userId) {
      for (const inviteeId of room.pendingInvitees) {
        sendToUser(inviteeId, { type: 'call_ended', callId, channelId: room.channelId });
      }
      room.pendingInvitees.clear();
    }
    publishCallAvailability(callId, room);
    closeCallRoomIfEmpty(callId, room);
  }
};

const registerConnection = (ws: WebSocket, channelId: string, identity: CommerceIdentity) => {
  const previous = connectionMeta.get(ws);
  if (previous?.channelId && previous.channelId !== channelId) {
    removeSocketFromChannel(ws, previous.channelId);
  }

  const set = activeConnections.get(channelId) || new Set<WebSocket>();
  set.add(ws);
  activeConnections.set(channelId, set);
  const existingPresence = [...connectionMeta.values()]
    .filter((meta) => meta.userId === identity.id)
    .sort((left, right) => (right.presenceChangedAt || 0) - (left.presenceChangedAt || 0))[0];
  connectionMeta.set(ws, {
    userId: identity.id,
    role: identity.role,
    email: identity.email,
    commerceAccessToken: previous?.commerceAccessToken,
    channelId,
    presence: previous?.presence || existingPresence?.presence || 'online',
    presenceChangedAt: previous?.presenceChangedAt || existingPresence?.presenceChangedAt || Date.now(),
  });
  publishPresenceToActiveChannels();
  metrics.websocketConnections += 1;
  websocketConnectionsGauge.set(activeConnections.size);
  console.log(`[WS] subscribe channel=${channelId} user=${identity.id} active=${set.size}`);
  for (const [callId, room] of callRooms) {
    if (room.channelId === channelId && room.participants.size > 0) {
      ws.send(JSON.stringify({
        type: 'call_available',
        callId,
        channelId,
        hostUserId: room.hostUserId,
        hostName: knownUsers.get(room.hostUserId)?.name || room.hostUserId,
        media: room.media,
        startedAt: room.startedAt,
        participantCount: room.participants.size,
        invitedUserIds: [...room.invitedUsers],
        available: true,
      }));
    }
  }
  publishToChannel(channelId, {
    type: 'presence',
    channelId,
    members: getChannelMembers(channelId),
  });
};

const removeConnection = (ws: WebSocket) => {
  const meta = connectionMeta.get(ws);
  if (!meta) return;
  if (meta.channelId) removeSocketFromChannel(ws, meta.channelId);
  websocketConnectionsGauge.set(activeConnections.size);
  console.log(`[WS] unsubscribe channel=${meta.channelId || 'none'} user=${meta.userId}`);
  connectionMeta.delete(ws);
  publishPresenceToActiveChannels();
  if (![...connectionMeta.values()].some((connection) => connection.userId === meta.userId)) {
    removeDisconnectedCallParticipant(meta.userId);
  }
};

fastify.addHook('onRequest', async (request) => {
  (request as any).metricsStartTime = Date.now();
});

fastify.addHook('onResponse', async (request, reply) => {
  const start = (request as any).metricsStartTime || Date.now();
  const durationMs = Date.now() - start;
  const route = (request as any).routerPath || request.raw.url || 'unknown';
  httpRequestTotal.inc({ method: request.method, route, status_code: String(reply.statusCode) }, 1);
  httpRequestDurationMs.observe({ method: request.method, route, status_code: String(reply.statusCode) }, durationMs);
});

fastify.post('/auth/login', async (request, reply) => {
  const credentials = request.body as { email?: unknown; password?: unknown } | undefined;
  if (
    typeof credentials?.email !== 'string' ||
    typeof credentials.password !== 'string' ||
    !credentials.email.trim() ||
    !credentials.password
  ) {
    return reply.code(400).send({ error: 'Introduza o email e a palavra-passe.' });
  }

  let commerceResponse: Response;
  try {
    commerceResponse = await fetch(`${commerceApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });
  } catch (error) {
    console.error('Commerce authentication service unavailable:', error);
    return reply.code(503).send({ error: 'O serviço de autenticação está temporariamente indisponível.' });
  }

  let result: any;
  try {
    result = await commerceResponse.json();
  } catch (error) {
    console.error('Commerce authentication service returned invalid JSON:', error);
    return reply.code(502).send({ error: 'Resposta inválida do serviço de autenticação.' });
  }

  if (!commerceResponse.ok) {
    const status = commerceResponse.status === 401 ? 401 : commerceResponse.status;
    return reply.code(status).send({
      error: commerceResponse.status === 401
        ? 'Email ou palavra-passe incorretos.'
        : 'Não foi possível autenticar a conta.',
    });
  }

  const token = result?.data?.token;
  const account = result?.data?.user;
  const identity = typeof token === 'string' ? verifyCommerceToken(token) : null;
  if (
    !identity ||
    typeof account?.id !== 'string' ||
    account.id !== identity.id ||
    typeof account.name !== 'string'
  ) {
    console.error('Commerce login response did not contain a valid signed user session.');
    return reply.code(502).send({ error: 'Resposta inválida do serviço de autenticação.' });
  }

  try {
    await saveKnownUser({ ...identity, name: account.name });
  } catch (error) {
    console.error('Could not persist authenticated ChatOps user:', error);
    return reply.code(503).send({ error: 'Não foi possível guardar a sessão no ChatOps.' });
  }
  setSessionCookie(reply, token);
  return {
    user: {
      id: identity.id,
      name: account.name,
      email: identity.email,
      role: identity.role,
    },
  };
});

fastify.get('/auth/session', async (request, reply) => {
  const token = getRequestToken(request);
  const identity = token ? verifyCommerceToken(token) : null;
  if (!token || !identity) {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: 'Sessão inválida ou expirada.' });
  }

  let commerceResponse: Response;
  try {
    commerceResponse = await fetch(`${commerceApiUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error('Commerce session verification service unavailable:', error);
    return reply.code(503).send({ error: 'O serviço de autenticação está temporariamente indisponível.' });
  }

  if (commerceResponse.status === 401) {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: 'A conta já não tem uma sessão válida.' });
  }
  if (!commerceResponse.ok) {
    console.error(`Commerce session verification failed with status ${commerceResponse.status}.`);
    return reply.code(503).send({ error: 'Não foi possível validar a sessão.' });
  }

  let result: any;
  try {
    result = await commerceResponse.json();
  } catch (error) {
    console.error('Commerce session verification returned invalid JSON:', error);
    return reply.code(502).send({ error: 'Resposta inválida do serviço de autenticação.' });
  }

  const account = result?.data?.user;
  if (account?.id !== identity.id || typeof account?.name !== 'string') {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: 'A sessão não corresponde à conta autenticada.' });
  }

  try {
    await saveKnownUser({ ...identity, name: account.name });
  } catch (error) {
    console.error('Could not persist authenticated ChatOps user:', error);
    return reply.code(503).send({ error: 'Não foi possível guardar a sessão no ChatOps.' });
  }
  return {
    user: {
      id: identity.id,
      name: account.name,
      email: identity.email,
      role: identity.role,
    },
  };
});

fastify.get('/users', { preHandler: requireAuthentication }, async () => {
  return prisma.chatUser.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
});

fastify.get('/ice-servers', { preHandler: requireAuthentication }, async (request, reply) => {
  const turnUrls = (process.env.TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const turnSharedSecret = process.env.TURN_SHARED_SECRET || '';
  if (
    (turnUrls.length > 0) !== Boolean(turnSharedSecret) ||
    turnUrls.some((url) => !/^turns?:/i.test(url))
  ) {
    return reply.code(503).send({ error: 'A configuração do servidor TURN está incompleta ou inválida.' });
  }

  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    ...defaultIceServers,
  ];
  if (turnUrls.length > 0) {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const username = `${expiresAt}:${getRequestIdentity(request)!.id}`;
    const credential = createHmac('sha1', turnSharedSecret).update(username).digest('base64');
    iceServers.push({ urls: turnUrls, username, credential });
  }

  return { iceServers, turnConfigured: turnUrls.length > 0 };
});

fastify.get('/groups', { preHandler: requireAuthentication }, async (request) => {
  const identity = getRequestIdentity(request)!;
  const groups = await prisma.channel.findMany({
    where: {
      isPrivate: true,
      groupMembers: { some: { userId: identity.id } },
    },
    include: { groupMembers: true },
    orderBy: { name: 'asc' },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    members: group.groupMembers.map((member) => ({
      id: member.userId,
      name: member.displayName,
      role: member.role,
    })),
  }));
});

fastify.post('/groups', { preHandler: requireAuthentication }, async (request, reply) => {
  const identity = getRequestIdentity(request)!;
  const body = request.body as { name?: unknown; members?: unknown } | undefined;
  if (
    typeof body?.name !== 'string' ||
    !body.name.trim() ||
    body.name.trim().length > 80 ||
    !Array.isArray(body.members) ||
    body.members.length === 0 ||
    body.members.some((member) => typeof member !== 'string')
  ) {
    return reply.code(400).send({ error: 'Indique um nome válido e pelo menos um membro.' });
  }

  const memberIds = [...new Set([identity.id, ...(body.members as string[])])];
  const eligibleUsers = await prisma.chatUser.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true },
  });
  if (eligibleUsers.length !== memberIds.length) {
    return reply.code(400).send({ error: 'Só pode adicionar utilizadores que já iniciaram sessão no ChatOps.' });
  }

  const eligibleUsersById = new Map(eligibleUsers.map((user) => [user.id, user]));
  const members = memberIds.map((userId) => {
    const user = eligibleUsersById.get(userId)!;
    return {
      userId,
      displayName: user.name,
      role: userId === identity.id ? 'owner' : 'member',
    };
  });
  const group = await prisma.channel.create({
    data: {
      id: randomUUID(),
      name: body.name.trim(),
      isPrivate: true,
      ownerId: identity.id,
      groupMembers: { create: members },
    },
    include: { groupMembers: true },
  });
  channelMemberCache.set(group.id, members.map(({ userId, displayName }) => ({ id: userId, name: displayName })));
  return reply.code(201).send({
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    members: group.groupMembers.map((member) => ({
      id: member.userId,
      name: member.displayName,
      role: member.role,
    })),
  });
});

fastify.patch('/groups/:channelId/members', { preHandler: requireAuthentication }, async (request, reply) => {
  const identity = getRequestIdentity(request)!;
  const { channelId } = request.params as { channelId: string };
  const body = request.body as { userId?: unknown; action?: unknown } | undefined;
  if (typeof body?.userId !== 'string' || (body.action !== 'add' && body.action !== 'remove')) {
    return reply.code(400).send({ error: 'Indique o utilizador e a operação a executar.' });
  }

  const group = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!group?.isPrivate) return reply.code(404).send({ error: 'Grupo não encontrado.' });
  if (group.ownerId !== identity.id) return reply.code(403).send({ error: 'Só o proprietário pode gerir os membros.' });
  if (body.userId === group.ownerId && body.action === 'remove') {
    return reply.code(400).send({ error: 'O proprietário não pode remover-se do grupo.' });
  }

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: body.userId } },
  });
  if (body.action === 'add') {
    const user = await prisma.chatUser.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true },
    });
    if (!user) return reply.code(404).send({ error: 'O utilizador tem de iniciar sessão no ChatOps antes de ser adicionado.' });
    if (member) return reply.code(409).send({ error: 'O utilizador já pertence ao grupo.' });
    await prisma.channelMember.create({
      data: { channelId, userId: user.id, displayName: user.name, role: 'member' },
    });
  } else {
    if (!member) return reply.code(404).send({ error: 'O utilizador não pertence ao grupo.' });
    await prisma.channelMember.delete({
      where: { channelId_userId: { channelId, userId: body.userId } },
    });
    evictChannelMember(channelId, body.userId, 'channel_access_revoked');
    publishToChannel(channelId, {
      type: 'channel_access_revoked',
      userId: body.userId,
      channelId,
    });
  }

  const groupMembers = await prisma.channelMember.findMany({ where: { channelId } });
  channelMemberCache.set(channelId, groupMembers.map(({ userId, displayName }) => ({ id: userId, name: displayName })));
  return {
    members: groupMembers.map((groupMember) => ({
      id: groupMember.userId,
      name: groupMember.displayName,
      role: groupMember.role,
    })),
  };
});

fastify.delete('/groups/:channelId', { preHandler: requireAuthentication }, async (request, reply) => {
  const identity = getRequestIdentity(request)!;
  const { channelId } = request.params as { channelId: string };
  const group = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!group?.isPrivate) return reply.code(404).send({ error: 'Grupo não encontrado.' });
  if (group.ownerId !== identity.id) return reply.code(403).send({ error: 'Só o proprietário pode eliminar o grupo.' });

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { channelId } }),
    prisma.auditLog.deleteMany({ where: { channelId } }),
    prisma.channel.delete({ where: { id: channelId } }),
  ]);
  const connectedMembers = [...(activeConnections.get(channelId) || [])]
    .map((ws) => connectionMeta.get(ws)?.userId)
    .filter((userId): userId is string => Boolean(userId));
  for (const userId of connectedMembers) evictChannelMember(channelId, userId, 'group_deleted');
  publishToChannel(channelId, { type: 'group_deleted', channelId });
  channelMemberCache.delete(channelId);
  messageHistory.delete(channelId);
  channelFiles.delete(channelId);
  return reply.code(204).send();
});

fastify.post('/auth/logout', async (_request, reply) => {
  clearSessionCookie(reply);
  return reply.code(204).send();
});

fastify.get('/health', async () => {
  const redisHealth = await checkRedisHealth();
  metrics.httpRequests += 1;
  return {
    ok: startupCompleted && !startupError,
    status: startupCompleted ? 'ready' : 'starting',
    startup: {
      completed: startupCompleted,
      error: startupError,
    },
    db: process.env.SKIP_PRISMA
      ? { enabled: false, status: 'skipped' }
      : { enabled: true, status: 'connected' },
    redis: redisHealth,
    websocket: WS_PORT ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    metrics: {
      activeConnections: activeConnections.size,
      activeChannels: activeConnections.size,
      activeUsers: connectionMeta.size,
      messagesStored: metrics.messagesStored,
    },
  };
});

fastify.get('/readyz', async () => {
  metrics.httpRequests += 1;
  return {
    ok: startupCompleted && !startupError,
    status: startupCompleted ? 'ready' : 'starting',
    startup: {
      completed: startupCompleted,
      error: startupError,
    },
    timestamp: new Date().toISOString(),
  };
});

fastify.get('/livez', async () => {
  metrics.httpRequests += 1;
  return {
    ok: true,
    status: 'alive',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
});

fastify.get('/metrics', async () => {
  metrics.httpRequests += 1;
  return {
    counters: {
      httpRequests: metrics.httpRequests,
      websocketConnections: metrics.websocketConnections,
      commandsExecuted: metrics.commandsExecuted,
      messagesStored: metrics.messagesStored,
    },
    runtime: {
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      activeConnections: activeConnections.size,
      activeChannels: activeConnections.size,
      activeUsers: connectionMeta.size,
    },
  };
});

fastify.get('/metrics/prometheus', async (request, reply) => {
  reply.header('Content-Type', client.register.contentType);
  return client.register.metrics();
});

async function checkRedisHealth() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const configured = Boolean(process.env.REDIS_URL);
  const health = {
    configured,
    connected: false,
    source: 'redis',
    latencyMs: null as number | null,
    error: null as string | null,
  };

  if (process.env.DISABLE_REDIS === 'true') {
    health.error = 'disabled';
    return health;
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  redis.on('error', () => {
    // silence expected connection failures so health checks stay stable
  });

  try {
    const start = Date.now();
    await redis.connect();
    const result = await redis.ping();
    health.connected = result === 'PONG';
    health.latencyMs = Date.now() - start;
  } catch (error) {
    health.error = String(error instanceof Error ? error.message : error);
  } finally {
    try {
      await redis.disconnect();
    } catch {
      // ignore disconnect failures
    }
  }

  return health;
}

fastify.get('/history', { preHandler: requireAuthentication }, async (request, reply) => {
  const query = request.query as { channelId?: string; before?: string };
  const channelId = query.channelId;
  if (!channelId) return reply.code(400).send({ error: 'channelId is required' });
  const identity = getRequestIdentity(request)!;
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  await ensureChannel(channelId);
  const before = query.before ? Number(query.before) : undefined;
  const list = messageHistory.get(channelId)!;
  const filtered = before ? list.filter((message) => message.ts < before) : list;
  return filtered.slice(-50);
});

fastify.get('/channels/:channelId/pins', { preHandler: requireAuthentication }, async (request, reply) => {
  const { channelId } = request.params as { channelId: string };
  const identity = getRequestIdentity(request)!;
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  const pins = await prisma.pinnedMessage.findMany({
    where: { channelId },
    include: { message: true },
    orderBy: { createdAt: 'desc' },
  });
  return pins.map(({ message, pinnedByUserId, createdAt }) => ({
    id: message.id,
    text: message.text,
    userId: message.userId,
    ts: message.createdAt.getTime(),
    channelId,
    pinnedByUserId,
    pinnedAt: createdAt.toISOString(),
  }));
});

fastify.post('/channels/:channelId/pins', { preHandler: requireAuthentication }, async (request, reply) => {
  const { channelId } = request.params as { channelId: string };
  const identity = getRequestIdentity(request)!;
  const body = request.body as { messageId?: unknown } | undefined;
  if (typeof body?.messageId !== 'string' || !body.messageId || body.messageId.length > 128) {
    return reply.code(400).send({ error: 'Indique uma mensagem válida para fixar.' });
  }
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  const message = await prisma.message.findFirst({
    where: { id: body.messageId, channelId },
  });
  if (!message) return reply.code(404).send({ error: 'A mensagem não existe neste canal.' });
  if (await prisma.pinnedMessage.findUnique({ where: { messageId: message.id } })) {
    return reply.code(409).send({ error: 'A mensagem já está fixada.' });
  }

  const pin = await prisma.pinnedMessage.create({
    data: { messageId: message.id, channelId, pinnedByUserId: identity.id },
  });
  const result = {
    id: message.id,
    text: message.text,
    userId: message.userId,
    ts: message.createdAt.getTime(),
    channelId,
    pinnedByUserId: pin.pinnedByUserId,
    pinnedAt: pin.createdAt.toISOString(),
  };
  publishToChannel(channelId, { type: 'pin_added', pin: result });
  return reply.code(201).send(result);
});

fastify.delete('/channels/:channelId/pins/:messageId', { preHandler: requireAuthentication }, async (request, reply) => {
  const { channelId, messageId } = request.params as { channelId: string; messageId: string };
  const identity = getRequestIdentity(request)!;
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  const pin = await prisma.pinnedMessage.findUnique({ where: { messageId } });
  if (!pin || pin.channelId !== channelId) return reply.code(404).send({ error: 'A mensagem fixada não existe.' });
  await prisma.pinnedMessage.delete({ where: { messageId } });
  publishToChannel(channelId, { type: 'pin_removed', channelId, messageId });
  return reply.code(204).send();
});

fastify.post('/groups/:channelId/invitations', { preHandler: requireAuthentication }, async (request, reply) => {
  const identity = getRequestIdentity(request)!;
  const { channelId } = request.params as { channelId: string };
  const body = request.body as { target?: unknown } | undefined;
  if (typeof body?.target !== 'string' || !body.target.trim() || body.target.trim().length > 254) {
    return reply.code(400).send({ error: 'Indique o ID ou email de um utilizador registado.' });
  }

  const group = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { groupMembers: true },
  });
  if (!group?.isPrivate) return reply.code(404).send({ error: 'Grupo privado não encontrado.' });
  if (group.ownerId !== identity.id) return reply.code(403).send({ error: 'Só o proprietário pode adicionar membros.' });

  const targetValue = body.target.trim();
  const target = await prisma.chatUser.findFirst({
    where: {
      OR: [
        { id: targetValue },
        { email: { equals: targetValue, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });
  if (!target) return reply.code(404).send({ error: 'Não foi encontrado um utilizador registado com esse ID ou email.' });
  if (target.id === identity.id) return reply.code(400).send({ error: 'Já pertence a este grupo.' });
  if (group.groupMembers.some((member) => member.userId === target.id)) {
    return reply.code(409).send({ error: 'O utilizador já pertence ao grupo.' });
  }

  const member = await prisma.channelMember.create({
    data: { channelId, userId: target.id, displayName: target.name, role: 'member' },
  });
  const members = [...group.groupMembers, member].map(({ userId, displayName, role }) => ({
    id: userId,
    name: displayName,
    role,
  }));
  channelMemberCache.set(channelId, members.map(({ id, name }) => ({ id, name })));
  publishPresenceToActiveChannels();
  sendToUser(target.id, {
    type: 'group_invitation',
    channelId,
    channelName: group.name,
    invitedBy: identity.id,
  });
  return reply.code(201).send({ members });
});

fastify.get('/channels/:channelId/members', { preHandler: requireAuthentication }, async (request, reply) => {
  const channelId = (request.params as { channelId: string }).channelId;
  const identity = getRequestIdentity(request)!;
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  return getChannelMembers(channelId);
});

fastify.get('/channels/:channelId/files', { preHandler: requireAuthentication }, async (request, reply) => {
  const channelId = (request.params as { channelId: string }).channelId;
  const identity = getRequestIdentity(request)!;
  if (!(await canAccessChannel(channelId, identity.id))) {
    return reply.code(403).send({ error: 'Não tem acesso a este canal.' });
  }
  return channelFiles.get(channelId) || [];
});

fastify.post('/upload', { preHandler: requireAuthentication }, async (request, reply) => {
  const data = await request.file();
  if (!data) return reply.code(400).send({ error: 'Nenhum ficheiro enviado' });
  const extension = path.extname(data.filename || '');
  const safeName = `${Date.now()}-${data.filename?.replace(/[^a-zA-Z0-9.\-_/]/g, '_') || 'upload'}${extension}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  await pipeline(data.file, fs.createWriteStream(filePath));
  const stats = await fs.promises.stat(filePath);
  const fileUrl = `/uploads/${safeName}`;
  return {
    url: fileUrl,
    name: data.filename,
    size: stats.size,
  };
});

const httpServer = createServer();
export const wss = new WebSocketServer({ server: httpServer });

let hasStarted = false;
let isShuttingDown = false;

export async function startServer() {
  if (hasStarted) return;
  hasStarted = true;
  startupCompleted = false;
  startupError = null;

  try {
    getJwtSecret();
    // SKIP_PRISMA is a development/test flag only. It skips the database
    // connect step but does not change authentication logic or WebSocket
    // token parsing. Do not set this in production.
    if (!process.env.SKIP_PRISMA) {
      await prisma.$connect();
      console.log('Prisma connected');
    } else {
      console.log('SKIP_PRISMA set — skipping prisma.$connect()');
    }

    await fastify.listen({ host: '0.0.0.0', port: HTTP_PORT });
    console.log(`HTTP server listening on ${HTTP_PORT}`);

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(WS_PORT, '0.0.0.0', () => {
        httpServer.off('error', reject);
        console.log(`WebSocket server listening on ${WS_PORT}`);
        resolve();
      });
    });

    startupCompleted = true;
  } catch (err) {
    hasStarted = false;
    startupError = err instanceof Error ? err.message : String(err);
    console.error('Failed to start ChatOps backend:', err);
    process.exit(1);
  }
}

export async function stopServer() {
  if (!hasStarted) return;
  hasStarted = false;
  isShuttingDown = true;

  for (const [callId, room] of callRooms) {
    if (room.inviteTimeout) clearTimeout(room.inviteTimeout);
    const recipients = new Set([...room.participants, ...room.pendingInvitees]);
    for (const userId of recipients) {
      sendToUser(userId, {
        type: 'call_ended',
        callId,
        channelId: room.channelId,
        reason: 'server_shutdown',
      });
    }
    publishCallAvailability(callId, room, false);
  }
  callRooms.clear();

  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1012, 'ChatOps backend is restarting');
    }
  }

  let shutdownError: unknown;
  try {
    await fastify.close();
  } catch (error) {
    console.error('Could not close the ChatOps HTTP API cleanly:', error);
    shutdownError = error;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      wss.close((error?: Error) => error ? reject(error) : resolve());
    });
  } catch (error) {
    console.error('Could not close the ChatOps WebSocket server cleanly:', error);
    shutdownError ??= error;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close((error) => error ? reject(error) : resolve());
    });
  } catch (error) {
    console.error('Could not close the ChatOps WebSocket listener cleanly:', error);
    shutdownError ??= error;
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Could not disconnect ChatOps from PostgreSQL cleanly:', error);
    shutdownError ??= error;
  }

  if (shutdownError) throw shutdownError;
}

if (process.env.NODE_ENV !== 'test' || process.env.FORCE_START === 'true') {
  void startServer();
  process.once('SIGTERM', () => {
    void stopServer().catch((error) => {
      console.error('ChatOps backend shutdown failed:', error);
      process.exitCode = 1;
    });
  });
  process.once('SIGINT', () => {
    void stopServer().catch((error) => {
      console.error('ChatOps backend shutdown failed:', error);
      process.exitCode = 1;
    });
  });
}

wss.on('connection', (ws: WebSocket, req) => {
  if (isShuttingDown) {
    ws.close(1012, 'ChatOps backend is restarting');
    return;
  }
  const origin = req.headers.origin;
  if (origin && !allowedCorsOrigins.includes(origin)) {
    console.warn(`[WS] rejected connection: origin not allowed (${origin})`);
    ws.close(4003, 'origin not allowed');
    return;
  }

  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? String(rawAuth[0]) : (rawAuth as string | undefined);
  const tokenFromCookie = getCookieValue(req.headers.cookie, sessionCookieName);
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : tokenFromCookie;
  const identity = token ? verifyCommerceToken(token) : null;
  const userId = identity?.id || null;

  // Security decision: require a valid token. Close the socket when the
  // provided token is missing or invalid to avoid silently allowing
  // unauthenticated access under the 'anon' identity.
  if (!userId) {
    console.warn('[WS] rejected connection: invalid token');
    try {
      ws.close(4001, 'invalid token');
    } catch (err) {
      // ignore
    }
    return;
  }

  console.log(`[WS] connection accepted user=${userId}`);
  const existingPresence = [...connectionMeta.values()]
    .filter((meta) => meta.userId === userId)
    .sort((left, right) => (right.presenceChangedAt || 0) - (left.presenceChangedAt || 0))[0];
  connectionMeta.set(ws, {
    userId,
    role: identity?.role || '',
    email: identity?.email || '',
    commerceAccessToken: token ?? undefined,
    presence: existingPresence?.presence || 'online',
    presenceChangedAt: existingPresence?.presenceChangedAt || Date.now(),
  });

  ws.on('message', async (raw: WebSocket.RawData) => {
    const msgStr = raw.toString();
    let data: any;
    try {
      data = JSON.parse(msgStr);
      const authenticatedIdentity = connectionMeta.get(ws);
      if (!authenticatedIdentity) return;

      if (data.type === 'subscribe' && data.channelId) {
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) {
          ws.send(JSON.stringify({ type: 'error', error: 'Não tem acesso a este canal.' }));
          return;
        }
        console.log(`[WS] subscribe request user=${authenticatedIdentity.userId} channel=${data.channelId}`);
        registerConnection(ws, data.channelId, {
          id: authenticatedIdentity.userId,
          email: authenticatedIdentity.email,
          role: authenticatedIdentity.role,
        });
        return;
      }

      if (data.type === 'ping') {
        console.log(`[WS] ping from user=${connectionMeta.get(ws)?.userId ?? 'anon'}`);
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (data.type === 'presence') {
        if (!['online', 'dnd', 'away', 'offline'].includes(data.status)) {
          ws.send(JSON.stringify({ type: 'error', error: 'Estado de presença inválido.' }));
          return;
        }
        const current = connectionMeta.get(ws);
        if (!current) return;
        const presenceChangedAt = Date.now();
        for (const [socket, meta] of connectionMeta) {
          if (meta.userId === current.userId) {
            connectionMeta.set(socket, { ...meta, presence: data.status, presenceChangedAt });
          }
        }
        publishPresenceToActiveChannels();
        return;
      }

      if (data.type === 'delete_message') {
        if (
          typeof data.channelId !== 'string' ||
          typeof data.messageId !== 'string' ||
          !data.messageId ||
          data.messageId.length > 128
        ) {
          return;
        }
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) {
          ws.send(JSON.stringify({
            type: 'message_delete_failed',
            messageId: data.messageId,
            error: 'Não tem autorização para eliminar esta mensagem.',
          }));
          return;
        }
        const message = await prisma.message.findFirst({
          where: { id: data.messageId, channelId: data.channelId },
        });
        if (!message || message.userId !== authenticatedIdentity.userId) {
          ws.send(JSON.stringify({
            type: 'message_delete_failed',
            messageId: data.messageId,
            error: 'Não foi possível eliminar esta mensagem.',
          }));
          return;
        }
        await prisma.$transaction([
          prisma.auditLog.deleteMany({
            where: {
              channelId: data.channelId,
              userId: authenticatedIdentity.userId,
              command: message.text.split(' ')[0] || 'message',
              details: message.text,
            },
          }),
          prisma.message.delete({ where: { id: message.id } }),
        ]);
        const history = messageHistory.get(data.channelId);
        if (history) {
          messageHistory.set(data.channelId, history.filter((entry) => entry.id !== message.id));
        }
        publishToChannel(data.channelId, {
          type: 'message_deleted',
          channelId: data.channelId,
          messageId: message.id,
        });
        return;
      }

      if (data.type === 'read_receipts') {
        const rawMessageIds: unknown[] = Array.isArray(data.messageIds) ? data.messageIds : [];
        const messageIds = [...new Set(rawMessageIds.filter((id): id is string =>
          typeof id === 'string' && id.length > 0 && id.length <= 128,
        ))].slice(0, 100);
        if (typeof data.channelId !== 'string' || messageIds.length === 0) return;
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) return;

        const messages = await prisma.message.findMany({
          where: { id: { in: messageIds }, channelId: data.channelId },
          select: { id: true, userId: true },
        });
        const unreadMessages = messages.filter((message) => message.userId !== authenticatedIdentity.userId);
        if (unreadMessages.length === 0) return;
        const existingReceipts = await prisma.messageReadReceipt.findMany({
          where: {
            messageId: { in: unreadMessages.map(({ id }) => id) },
            userId: authenticatedIdentity.userId,
          },
          select: { messageId: true },
        });
        const existingMessageIds = new Set(existingReceipts.map(({ messageId }) => messageId));
        const newlyReadMessages = unreadMessages.filter((message) => !existingMessageIds.has(message.id));
        if (newlyReadMessages.length === 0) return;
        const readAt = new Date();
        await prisma.messageReadReceipt.createMany({
          data: newlyReadMessages.map(({ id }) => ({
            messageId: id,
            userId: authenticatedIdentity.userId,
            readAt,
          })),
          skipDuplicates: true,
        });
        const receipts = await prisma.messageReadReceipt.findMany({
          where: {
            messageId: { in: newlyReadMessages.map(({ id }) => id) },
            userId: authenticatedIdentity.userId,
          },
        });
        for (const message of newlyReadMessages) {
          const receipt = receipts.find((item) => item.messageId === message.id);
          if (!receipt) continue;
          const readBy = { userId: receipt.userId, readAt: receipt.readAt.toISOString() };
          const history = messageHistory.get(data.channelId);
          if (history) {
            const cachedMessage = history.find((entry) => entry.id === message.id);
            if (cachedMessage) {
              cachedMessage.readBy = [...(cachedMessage.readBy || []).filter((entry) => entry.userId !== readBy.userId), readBy];
            }
          }
          sendToUser(message.userId, {
            type: 'read_receipt',
            channelId: data.channelId,
            messageId: message.id,
            ...readBy,
          });
        }
        return;
      }

      if (data.type === 'typing' && data.channelId) {
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) return;
        publishToChannel(data.channelId, {
          type: 'typing',
          channelId: data.channelId,
          userId: authenticatedIdentity.userId,
        });
        return;
      }

      if (data.type === 'reaction' && data.channelId) {
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) return;
        publishToChannel(data.channelId, {
          type: 'reaction',
          channelId: data.channelId,
          messageId: data.messageId,
          emoji: data.emoji,
          userId: authenticatedIdentity.userId,
        });
        return;
      }

      if (data.type === 'call_invite') {
        const rawTargetUserIds: unknown[] = Array.isArray(data.targetUserIds) ? data.targetUserIds : [];
        const targetUserIds = [...new Set(
          rawTargetUserIds.filter((userId): userId is string => typeof userId === 'string'),
        )];
        if (
          typeof data.callId !== 'string' ||
          data.callId.length < 8 ||
          data.callId.length > 128 ||
          typeof data.channelId !== 'string' ||
          (data.media !== 'audio' && data.media !== 'video') ||
          targetUserIds.length === 0 ||
          rawTargetUserIds.length > 8 ||
          rawTargetUserIds.some((userId) =>
            typeof userId !== 'string' || userId === authenticatedIdentity.userId,
          )
        ) {
          ws.send(JSON.stringify({ type: 'call_error', error: 'Convite de chamada inválido.' }));
          return;
        }
        if (
          connectionMeta.get(ws)?.channelId !== data.channelId ||
          !(await canAccessChannel(data.channelId, authenticatedIdentity.userId))
        ) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Não tem acesso ao canal desta chamada.',
          }));
          return;
        }
        if (callRooms.has(data.callId)) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'O identificador desta chamada já está em uso.',
          }));
          return;
        }

        const room: CallRoom = {
          channelId: data.channelId,
          hostUserId: authenticatedIdentity.userId,
          media: data.media,
          startedAt: Date.now(),
          participants: new Set([authenticatedIdentity.userId]),
          pendingInvitees: new Set(),
          invitedUsers: new Set([authenticatedIdentity.userId]),
        };
        callRooms.set(data.callId, room);
        room.inviteTimeout = setTimeout(() => {
          for (const inviteeId of room.pendingInvitees) {
            sendToUser(inviteeId, {
              type: 'call_ended',
              callId: data.callId,
              channelId: room.channelId,
            });
          }
          room.pendingInvitees.clear();
          room.inviteTimeout = undefined;
          if (room.participants.size === 1) {
            sendToUser(room.hostUserId, {
              type: 'call_ended',
              callId: data.callId,
              channelId: room.channelId,
            });
            callRooms.delete(data.callId);
          }
        }, 45_000);

        for (const targetUserId of targetUserIds) {
          if (
            !(await canAccessChannel(data.channelId, targetUserId)) ||
            !sendToUser(targetUserId, {
              type: 'call_invite',
              callId: data.callId,
              channelId: data.channelId,
              fromUserId: authenticatedIdentity.userId,
              callerName: knownUsers.get(authenticatedIdentity.userId)?.name || authenticatedIdentity.email,
              media: data.media,
              startedAt: room.startedAt,
            })
          ) {
            continue;
          }
          room.pendingInvitees.add(targetUserId);
          room.invitedUsers.add(targetUserId);
        }

        if (room.pendingInvitees.size === 0) {
          callRooms.delete(data.callId);
          if (room.inviteTimeout) clearTimeout(room.inviteTimeout);
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Não há membros autorizados em linha neste canal.',
          }));
          return;
        }
        publishCallAvailability(data.callId, room);
        ws.send(JSON.stringify({ type: 'call_started', callId: data.callId }));
        return;
      }

      if (data.type === 'call_accept' || data.type === 'call_reject') {
        const room = typeof data.callId === 'string' ? callRooms.get(data.callId) : undefined;
        const participantId = authenticatedIdentity.userId;
        if (
          !room ||
          room.channelId !== data.channelId ||
          !(await canAccessChannel(room.channelId, participantId)) ||
          !room.pendingInvitees.has(participantId)
        ) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Este convite de chamada já não está válido.',
          }));
          return;
        }

        room.pendingInvitees.delete(participantId);
        if (data.type === 'call_reject') {
          room.invitedUsers.delete(participantId);
          sendToUser(room.hostUserId, {
            type: 'call_invite_rejected',
            callId: data.callId,
            channelId: room.channelId,
            userId: participantId,
          });
          if (room.pendingInvitees.size === 0 && room.participants.size === 1) {
            if (room.inviteTimeout) clearTimeout(room.inviteTimeout);
            callRooms.delete(data.callId);
            publishCallAvailability(data.callId, room, false);
            sendToUser(room.hostUserId, {
              type: 'call_ended',
              callId: data.callId,
              channelId: room.channelId,
            });
            return;
          }
          closeCallRoomIfEmpty(data.callId, room);
          return;
        }

        const existingParticipants = [...room.participants];
        room.participants.add(participantId);
        if (room.pendingInvitees.size === 0 && room.inviteTimeout) {
          clearTimeout(room.inviteTimeout);
          room.inviteTimeout = undefined;
        }
        for (const existingUserId of existingParticipants) {
          sendToUser(existingUserId, {
            type: 'call_peer_joined',
            callId: data.callId,
            channelId: room.channelId,
            userId: participantId,
            initiatorId: participantId,
            media: room.media,
            startedAt: room.startedAt,
          });
          sendToUser(participantId, {
            type: 'call_peer_joined',
            callId: data.callId,
            channelId: room.channelId,
            userId: existingUserId,
            initiatorId: participantId,
            media: room.media,
            startedAt: room.startedAt,
          });
        }
        publishCallAvailability(data.callId, room);
        return;
      }

      if (data.type === 'call_rejoin') {
        const room = typeof data.callId === 'string' ? callRooms.get(data.callId) : undefined;
        const participantId = authenticatedIdentity.userId;
        if (
          !room ||
          room.channelId !== data.channelId ||
          !room.invitedUsers.has(participantId) ||
          !(await canAccessChannel(room.channelId, participantId))
        ) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Não pode voltar a esta chamada.',
          }));
          return;
        }
        if (room.participants.has(participantId)) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Já está nesta chamada.',
          }));
          return;
        }

        room.pendingInvitees.delete(participantId);
        const existingParticipants = [...room.participants];
        room.participants.add(participantId);
        if (room.pendingInvitees.size === 0 && room.inviteTimeout) {
          clearTimeout(room.inviteTimeout);
          room.inviteTimeout = undefined;
        }
        for (const existingUserId of existingParticipants) {
          sendToUser(existingUserId, {
            type: 'call_peer_joined',
            callId: data.callId,
            channelId: room.channelId,
            userId: participantId,
            initiatorId: participantId,
            media: room.media,
            startedAt: room.startedAt,
          });
          sendToUser(participantId, {
            type: 'call_peer_joined',
            callId: data.callId,
            channelId: room.channelId,
            userId: existingUserId,
            initiatorId: participantId,
            media: room.media,
            startedAt: room.startedAt,
          });
        }
        publishCallAvailability(data.callId, room);
        return;
      }

      if (data.type === 'call_signal') {
        const room = typeof data.callId === 'string' ? callRooms.get(data.callId) : undefined;
        if (
          typeof data.targetUserId !== 'string' ||
          !room ||
          room.channelId !== data.channelId ||
          !room.participants.has(authenticatedIdentity.userId) ||
          !room.participants.has(data.targetUserId) ||
          !(await canAccessChannel(room.channelId, authenticatedIdentity.userId)) ||
          !(await canAccessChannel(room.channelId, data.targetUserId)) ||
          !isValidCallSignal(data.signal)
        ) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Sinal de chamada inválido ou não autorizado.',
          }));
          return;
        }
        sendToUser(data.targetUserId, {
          type: 'call_signal',
          callId: data.callId,
          channelId: room.channelId,
          fromUserId: authenticatedIdentity.userId,
          signal: data.signal,
        });
        return;
      }

      if (data.type === 'call_leave') {
        const room = typeof data.callId === 'string' ? callRooms.get(data.callId) : undefined;
        const participantId = authenticatedIdentity.userId;
        if (
          !room ||
          room.channelId !== data.channelId ||
          !room.participants.has(participantId)
        ) {
          return;
        }
        room.participants.delete(participantId);
        for (const remainingUserId of room.participants) {
          sendToUser(remainingUserId, {
            type: 'call_peer_left',
            callId: data.callId,
            channelId: room.channelId,
            userId: participantId,
          });
        }
        if (room.hostUserId === participantId) {
          for (const inviteeId of room.pendingInvitees) {
            sendToUser(inviteeId, {
              type: 'call_ended',
              callId: data.callId,
              channelId: room.channelId,
            });
          }
          room.pendingInvitees.clear();
        }
        if (room.pendingInvitees.size === 0 && room.inviteTimeout) {
          clearTimeout(room.inviteTimeout);
          room.inviteTimeout = undefined;
        }
        publishCallAvailability(data.callId, room);
        closeCallRoomIfEmpty(data.callId, room);
        return;
      }

      if (data.type === 'call_end') {
        const room = typeof data.callId === 'string' ? callRooms.get(data.callId) : undefined;
        const participantId = authenticatedIdentity.userId;
        if (!room || room.channelId !== data.channelId || !room.participants.has(participantId)) {
          return;
        }
        if (room.hostUserId !== participantId) {
          ws.send(JSON.stringify({
            type: 'call_error',
            callId: data.callId,
            error: 'Só quem iniciou a chamada pode terminá-la para todos.',
          }));
          return;
        }
        for (const userId of room.participants) {
          if (userId === participantId) continue;
          sendToUser(userId, {
            type: 'call_ended',
            callId: data.callId,
            channelId: room.channelId,
          });
        }
        for (const inviteeId of room.pendingInvitees) {
          sendToUser(inviteeId, {
            type: 'call_ended',
            callId: data.callId,
            channelId: room.channelId,
          });
        }
        room.participants.clear();
        room.pendingInvitees.clear();
        if (room.inviteTimeout) clearTimeout(room.inviteTimeout);
        callRooms.delete(data.callId);
        publishCallAvailability(data.callId, room, false);
        return;
      }

      if (
        data.type === 'message' &&
        typeof data.channelId === 'string' &&
        typeof data.text === 'string' &&
        data.text.trim()
      ) {
        if (!(await canAccessChannel(data.channelId, authenticatedIdentity.userId))) {
          ws.send(JSON.stringify({
            type: 'message_failed',
            tempId: data.tempId,
            error: 'Não tem acesso a este canal.',
          }));
          return;
        }
        if (data.text.length > 10_000 || (data.tempId !== undefined && (typeof data.tempId !== 'string' || data.tempId.length > 128))) {
          ws.send(JSON.stringify({
            type: 'message_failed',
            tempId: data.tempId,
            error: 'A mensagem é inválida ou excede o limite permitido.',
          }));
          return;
        }
        const userId = authenticatedIdentity.userId;
        console.log(`[WS] message user=${userId} channel=${data.channelId}`);
        const message: ChatMessage = {
          id: data.tempId || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tempId: data.tempId,
          channelId: data.channelId,
          userId,
          text: data.text,
          ts: Date.now(),
          system: false,
          replyToId: data.replyToId,
        };

        await addMessageToHistory(data.channelId, message);
        metrics.messagesStored += 1;
        messagesStoredCounter.inc();
        publishToChannel(data.channelId, { ...message, messageId: message.id, type: 'message' });

        try {
          await prisma.auditLog.create({
            data: {
              userId,
              channelId: data.channelId,
              command: message.text.split(' ')[0] || 'message',
              details: message.text,
            },
          });
        } catch (auditError) {
          console.error('[ChatOps] failed to persist message audit log:', auditError);
        }

        if (data.text.trim().startsWith('/')) {
          const commandName = data.text.trim().split(/\s+/, 1)[0];
          const requestedLanguage = typeof data.language === 'string'
            ? data.language.trim().toLowerCase().split(/[-_]/)[0]
            : 'pt';
          const language = ['pt', 'en', 'es'].includes(requestedLanguage) ? requestedLanguage : 'pt';
          const isLogisticsCommand = ['/stock', '/low-stock', '/order', '/approve-credit'].includes(commandName);
          const cmdReply = isLogisticsCommand && data.channelId !== 'logistica'
            ? language === 'en'
              ? 'Logistics commands can only be used in the #Logística channel.'
              : language === 'es'
                ? 'Los comandos de logística solo se pueden usar en el canal #Logística.'
                : 'Os comandos de Logística só podem ser usados no canal #Logística.'
            : await ChatOpsEngine.handleCommand(
              data.text,
              userId,
              authenticatedIdentity.role,
              language,
              authenticatedIdentity.commerceAccessToken,
            );
          const systemMessage: ChatMessage = {
            id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            channelId: data.channelId,
            userId: 'bot',
            text: cmdReply || 'Não foi possível executar o comando.',
            ts: Date.now() + 1,
            system: true,
          };
          await addMessageToHistory(data.channelId, systemMessage);
          publishToChannel(data.channelId, { ...systemMessage, messageId: systemMessage.id, type: 'message' });
          if (cmdReply) {
            metrics.commandsExecuted += 1;
            commandsExecutedCounter.inc();
            console.log(`[ChatOps] command reply user=${userId} channel=${data.channelId} command=${commandName}`);
          }
          return;
        }
        return;
      }
    } catch (err) {
      if (data?.type === 'message') {
        try {
          ws.send(JSON.stringify({
            type: 'message_failed',
            tempId: data.tempId,
            error: 'Não foi possível guardar a mensagem. Tente novamente.',
          }));
        } catch (sendError) {
          console.error('[ChatOps] failed to report message persistence error:', sendError);
        }
        console.error('[ChatOps] message processing failed:', err);
        return;
      }
      if (data?.type === 'delete_message') {
        console.error('[ChatOps] message deletion failed:', err);
        ws.send(JSON.stringify({
          type: 'message_delete_failed',
          messageId: data.messageId,
          error: 'Não foi possível eliminar esta mensagem.',
        }));
        return;
      }
      console.warn('WS message processing error:', err);
    }
  });

  ws.on('close', () => { removeConnection(ws); });
  ws.on('error', () => { removeConnection(ws); });
});

if (process.env.NODE_ENV !== 'test') {
  void (async () => {
    try {
      const redis = new (require('ioredis').default)(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        reconnectOnError: () => false,
      });
      redis.on('error', () => undefined);
      await redis.psubscribe('channel:*');
      redis.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const channelId = channel.replace('channel:', '');
        try {
          const payload = JSON.parse(message);
          if (payload.type === 'channel_access_revoked' && typeof payload.userId === 'string') {
            evictChannelMember(channelId, payload.userId, 'channel_access_revoked');
            return;
          }
          if (payload.type === 'group_deleted') {
            const userIds = [...(activeConnections.get(channelId) || [])]
              .map((ws) => connectionMeta.get(ws)?.userId)
              .filter((userId): userId is string => Boolean(userId));
            for (const userId of userIds) evictChannelMember(channelId, userId, 'group_deleted');
            return;
          }
          broadcastToChannel(channelId, payload);
        } catch (err) {
          console.warn('Invalid pubsub payload', err);
        }
      });
    } catch {
      // Ignore Redis subscription errors in local/test environments.
    }
  })();

  console.log('ChatOps server initialized');
}
