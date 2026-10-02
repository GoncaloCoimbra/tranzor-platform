import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import Fastify from 'fastify';
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
import { createSignedToken, parseUserIdFromToken } from './auth';

const HTTP_PORT = Number(process.env.PORT || 3002);
const WS_PORT = Number(process.env.WS_PORT || 9001);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const allowedCorsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3006')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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
}

interface FileRecord {
  id: string;
  name: string;
  url: string;
  size: number;
}

interface ConnectionMeta {
  userId: string;
  channelId?: string;
}

const activeConnections = new Map<string, Set<WebSocket>>();
const connectionMeta = new Map<WebSocket, ConnectionMeta>();
const messageHistory = new Map<string, ChatMessage[]>();
const channelFiles = new Map<string, FileRecord[]>([
  ['logistica', [
    { id: 'file-1', name: 'relatorio-de-estoque.pdf', url: '/uploads/relatorio-de-estoque.pdf', size: 154321 }
  ]],
]);

const TEAM_MEMBERS = [
  { id: 'goncalo', name: 'Gonçalo Oliveira' },
  { id: 'joao', name: 'João Silva' },
  { id: 'ana', name: 'Ana Costa' },
  { id: 'pedro', name: 'Pedro Martins' },
  { id: 'bot', name: 'ChatBot' },
];

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
    await prisma.channel.create({ data: { id: channelId, name: channelId } });
  }

  const persistedMessages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  const history = persistedMessages.map((message) => ({
    id: message.id,
    channelId,
    userId: message.userId,
    text: message.text,
    ts: message.createdAt.getTime(),
    system: false,
  }));

  messageHistory.set(channelId, history.length > 0 ? history : [{
    id: `system-${channelId}-1`,
    channelId,
    userId: 'bot',
    text: `Bem-vindo ao canal ${channelId}. Use /stock ou /approve-credit para validar comandos ChatOps em tempo real.`,
    ts: Date.now(),
    system: true,
  }]);
};

const getChannelMembers = (channelId: string) => {
  const activeUsers = new Set(
    [...connectionMeta.values()]
      .filter((meta) => meta.channelId === channelId)
      .map((meta) => meta.userId)
  );

  return TEAM_MEMBERS.map((member) => ({
    ...member,
    online: activeUsers.has(member.id),
  }));
};

const addMessageToHistory = async (channelId: string, message: ChatMessage) => {
  await ensureChannel(channelId);
  const list = messageHistory.get(channelId)!;
  list.push(message);
  if (list.length > 200) list.shift();

  await prisma.message.create({
    data: {
      id: message.id,
      text: message.text,
      userId: message.userId,
      channelId,
    },
  });
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
  void publishPortfolioEvent(`channel:${channelId}`, JSON.stringify(payload)).catch((err) => {
    console.warn('Redis publish failed:', err);
  });
};

const registerConnection = (ws: WebSocket, channelId: string, userId: string) => {
  const set = activeConnections.get(channelId) || new Set<WebSocket>();
  set.add(ws);
  activeConnections.set(channelId, set);
  connectionMeta.set(ws, { userId, channelId });
  metrics.websocketConnections += 1;
  websocketConnectionsGauge.set(activeConnections.size);
  console.log(`[WS] subscribe channel=${channelId} user=${userId} active=${set.size}`);
  publishToChannel(channelId, {
    type: 'presence',
    channelId,
    members: getChannelMembers(channelId),
  });
};

const removeConnection = (ws: WebSocket) => {
  const meta = connectionMeta.get(ws);
  if (!meta || !meta.channelId) return;
  const set = activeConnections.get(meta.channelId);
  if (set) { set.delete(ws); }
  websocketConnectionsGauge.set(activeConnections.size);
  console.log(`[WS] unsubscribe channel=${meta.channelId} user=${meta.userId} active=${set?.size ?? 0}`);
  publishToChannel(meta.channelId, {
    type: 'presence',
    channelId: meta.channelId,
    members: getChannelMembers(meta.channelId),
  });
  connectionMeta.delete(ws);
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

fastify.get('/auth/dev-token', async (_request, reply) => {
  if (process.env.NODE_ENV === 'production') {
    return reply.code(404).send({ error: 'Not found' });
  }

  return { token: createSignedToken('goncalo') };
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

fastify.get('/history', async (request, reply) => {
  const query = request.query as { channelId?: string; before?: string };
  const channelId = query.channelId;
  if (!channelId) return reply.code(400).send({ error: 'channelId is required' });
  await ensureChannel(channelId);
  const before = query.before ? Number(query.before) : undefined;
  const list = messageHistory.get(channelId)!;
  const filtered = before ? list.filter((message) => message.ts < before) : list;
  return filtered.slice(-50);
});

fastify.get('/channels/:channelId/members', async (request) => {
  const channelId = (request.params as { channelId: string }).channelId;
  return getChannelMembers(channelId);
});

fastify.get('/channels/:channelId/files', async (request) => {
  const channelId = (request.params as { channelId: string }).channelId;
  return channelFiles.get(channelId) || [];
});

fastify.post('/upload', async (request, reply) => {
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
const wss = new WebSocketServer({ server: httpServer });

let hasStarted = false;

export async function startServer() {
  if (hasStarted) return;
  hasStarted = true;
  startupCompleted = false;
  startupError = null;

  try {
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
    startupError = err instanceof Error ? err.message : String(err);
    console.error('Failed to start ChatOps backend:', err);
    process.exit(1);
  }
}

export async function stopServer() {
  if (!hasStarted) return;
  hasStarted = false;

  try {
    await fastify.close();
  } catch {
    // ignore close errors
  }

  try {
    wss.close();
  } catch {
    // ignore close errors
  }

  try {
    httpServer.close();
  } catch {
    // ignore close errors
  }

  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failures
  }
}

if (process.env.NODE_ENV !== 'test' || process.env.FORCE_START === 'true') {
  void startServer();
}

wss.on('connection', (ws: WebSocket, req) => {
  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? String(rawAuth[0]) : (rawAuth as string | undefined);
  const tokenFromQuery = new URL(req.url || '/', 'http://localhost').searchParams.get('token');
  const userId = parseUserIdFromToken(authHeader || (tokenFromQuery ? `Bearer ${tokenFromQuery}` : undefined));

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
  connectionMeta.set(ws, { userId });

  ws.on('message', async (raw: WebSocket.RawData) => {
    const msgStr = raw.toString();
    try {
      const data = JSON.parse(msgStr);
      if (data.type === 'subscribe' && data.channelId) {
        const effectiveUserId = data.userId || connectionMeta.get(ws)?.userId || 'anon';
        console.log(`[WS] subscribe request user=${effectiveUserId} channel=${data.channelId}`);
        registerConnection(ws, data.channelId, effectiveUserId);
        return;
      }

      if (data.type === 'ping') {
        console.log(`[WS] ping from user=${connectionMeta.get(ws)?.userId ?? 'anon'}`);
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (data.type === 'typing' && data.channelId) {
        publishToChannel(data.channelId, {
          type: 'typing',
          channelId: data.channelId,
          userId: data.userId || 'anon',
        });
        return;
      }

      if (data.type === 'reaction' && data.channelId) {
        publishToChannel(data.channelId, {
          type: 'reaction',
          channelId: data.channelId,
          messageId: data.messageId,
          emoji: data.emoji,
          userId: data.userId || 'anon',
        });
        return;
      }

      if (data.type === 'message' && data.channelId && data.text) {
        const userId = data.userId || connectionMeta.get(ws)?.userId || 'anon';
        console.log(`[WS] message user=${userId} channel=${data.channelId} text=${data.text}`);
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
        publishToChannel(data.channelId, { ...message, type: 'message' });

        await prisma.auditLog.create({
          data: {
            userId,
            channelId: data.channelId,
            command: message.text.split(' ')[0] || 'message',
            details: message.text,
          },
        });

        const cmdReply = await ChatOpsEngine.handleCommand(data.text, userId);
        if (cmdReply) {
          metrics.commandsExecuted += 1;
          commandsExecutedCounter.inc();
          console.log(`[ChatOps] command reply user=${userId} channel=${data.channelId} reply=${cmdReply}`);
          const systemMessage: ChatMessage = {
            id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            channelId: data.channelId,
            userId: 'bot',
            text: cmdReply,
            ts: Date.now() + 1,
            system: true,
          };
          await addMessageToHistory(data.channelId, systemMessage);
          publishToChannel(data.channelId, { ...systemMessage, type: 'message' });
        }
        return;
      }
    } catch (err) {
      console.warn('WS parse error', err);
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
