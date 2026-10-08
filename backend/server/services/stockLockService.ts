/**
 * STOCK LOCK SERVICE
 * ==================
 * Distributed lock system para garantir linearizabilidade em operações de stock
 * Previne race conditions usando Redis como semaphore distribuído
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

async function getRedisClient(): Promise<Redis | null> {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl || process.env.NODE_ENV === 'test' || process.env.DISABLE_REDIS === 'true' || process.env.JEST_WORKER_ID !== undefined) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });

    redisClient.on('error', (error) => {
      console.error('[STOCK LOCK] Redis client error:', error);
    });
  }

  if (redisClient.status !== 'ready') {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('[STOCK LOCK] Failed to connect to Redis:', error);
      return null;
    }
  }

  return redisClient;
}

const LOCK_PREFIX = 'stock:lock:';
// The 30-second lease bounds abandoned locks after a worker crash. Without renewal,
// checkout work must finish within this lease to retain mutual exclusion.
const LOCK_TTL = 30;
const LOCK_WAIT = 100; // ms entre tentativas

/**
 * Tenta adquirir um lock distribuído para um produto
 * @param productId - ID do produto
 * @param timeoutMs - Tempo máximo para esperar pelo lock (default: 5s)
 * @returns Promise<string | null> - UUID do lock ou null se timeout
 */
export async function acquireStockLock(productId: string, timeoutMs: number = 5000): Promise<string | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const lockKey = `${LOCK_PREFIX}${productId}`;
  const lockId = `${Date.now()}-${Math.random()}`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // SET NX = "Set if Not eXists" (operação atômica)
      const result = await redis.set(lockKey, lockId, 'EX', LOCK_TTL, 'NX');
      
      if (result === 'OK') {
        console.log(`[STOCK LOCK] Lock adquirido para produto ${productId}`);
        return lockId;
      }

      // Lock já existe, aguarda
      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT));
    } catch (error) {
      console.error(`[STOCK LOCK] Erro ao adquirir lock:`, error);
      throw error;
    }
  }

  console.warn(`[STOCK LOCK] TIMEOUT ao adquirir lock para produto ${productId}`);
  return null;
}

/**
 * Liberta um lock distribuído
 * @param productId - ID do produto
 * @param lockId - UUID do lock (verificação de propriedade)
 */
export async function releaseStockLock(productId: string, lockId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  const lockKey = `${LOCK_PREFIX}${productId}`;

  try {
    // Lua script para garantir que apenas o proprietário do lock o liberta
    const result = await redis.eval(
      `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
      `,
      1,
      lockKey,
      lockId
    );

    if (result === 1) {
      console.log(`[STOCK LOCK] Lock libertado para produto ${productId}`);
    } else {
      console.warn(`[STOCK LOCK] Lock não pertence a este processo (já expirou?)`);
    }
  } catch (error) {
    console.error(`[STOCK LOCK] Erro ao libertar lock:`, error);
    throw error;
  }
}

/**
 * Verifica o estado de um lock (para debugging)
 */
export async function getStockLockStatus(productId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  const lockKey = `${LOCK_PREFIX}${productId}`;
  const value = await redis.get(lockKey);
  return value !== null;
}

/**
 * Limpa todos os locks expirados (executar periodicamente)
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) {
    return 0;
  }

  try {
    const keys = await redis.keys(`${LOCK_PREFIX}*`);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) {
        // Chave não existe
        cleaned++;
        await redis.del(key);
      }
    }

    console.log(`[STOCK LOCK] Cleanup completado. ${cleaned} locks expirados removidos.`);
    return cleaned;
  } catch (error) {
    console.error(`[STOCK LOCK] Erro durante cleanup:`, error);
    return 0;
  }
}

// Cleanup automático a cada 5 minutos
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredLocks, 5 * 60 * 1000);
}

export default {
  acquireStockLock,
  releaseStockLock,
  getStockLockStatus,
  cleanupExpiredLocks,
};
