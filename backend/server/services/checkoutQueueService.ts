/**
 * CHECKOUT QUEUE SERVICE (BullMQ)
 * ================================
 * Fila de processamento para checkouts
 * Garante ordenação e processamento sequencial de pedidos
 * 
 * Padrão: SAGA Pattern com retry automático e compensação
 */

import type { Job as BullJob } from 'bull';
import Order from '../models/Order';
import Product from '../models/Product';
import { acquireStockLock, releaseStockLock } from './stockLockService';

// Configuração da fila
const REDIS_URL = process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
const useRedisQueue = Boolean(process.env.REDIS_URL?.trim()) && process.env.DISABLE_REDIS !== 'true' && process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined;

class MemoryJob<T = any> {
  public id: string;
  public data: T;
  public attemptsMade = 0;
  private finishedPromise: Promise<any>;
  private resolveFinished!: (value: any) => void;
  private rejectFinished!: (reason?: unknown) => void;

  constructor(data: T, id: string) {
    this.data = data;
    this.id = id;
    this.finishedPromise = new Promise((resolve, reject) => {
      this.resolveFinished = resolve;
      this.rejectFinished = reject;
    });
  }

  finished() {
    return this.finishedPromise;
  }

  complete(value: any) {
    this.resolveFinished(value);
  }

  fail(reason: unknown) {
    this.rejectFinished(reason);
  }
}

class MemoryQueue<T = any> {
  private processor?: (job: MemoryJob<T>) => Promise<any>;
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  process(handler: (job: MemoryJob<T>) => Promise<any>) {
    this.processor = handler;
  }

  on(event: string, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  async add(data: T, _opts?: unknown): Promise<MemoryJob<T>> {
    void _opts;
    const job = new MemoryJob<T>(data, `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    if (this.processor) {
      try {
        const result = await this.processor(job);
        job.complete(result);
      } catch (error) {
        job.fail(error);
      }
    } else {
      job.complete(undefined);
    }

    return job;
  }

  async getJobCounts() {
    return {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }
}

let QueueCtor: any;

if (useRedisQueue) {
  QueueCtor = require('bull');
}

const queueImplementation = useRedisQueue ? new QueueCtor('checkout-processing', REDIS_URL) : new MemoryQueue<CheckoutQueueData>();

export const checkoutQueue = queueImplementation as any;

/**
 * Interface para dados do checkout na fila
 */
export interface CheckoutQueueData {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  timestamp: number;
  retryCount?: number;
}

/**
 * Processa um checkout da fila
 * FASES:
 * 1. Adquirir lock distribuído por produto
 * 2. Verificar stock (SELECT...FOR UPDATE equivalente em MongoDB)
 * 3. Decrement stock
 * 4. Se erro: Liberta lock e coloca na dead-letter queue
 */
checkoutQueue.process(async (job: BullJob<CheckoutQueueData> | MemoryJob<CheckoutQueueData>) => {
  const { orderId } = job.data;
  const quantitiesByProduct = new Map<string, number>();
  for (const item of job.data.items) {
    quantitiesByProduct.set(
      item.productId,
      (quantitiesByProduct.get(item.productId) || 0) + item.quantity,
    );
  }
  const items = Array.from(quantitiesByProduct, ([productId, quantity]) => ({
    productId,
    quantity,
  })).sort((left, right) =>
    left.productId < right.productId ? -1 : left.productId > right.productId ? 1 : 0,
  );
  const locks: Map<string, string> = new Map();
  const decrementedItems: Array<{
    productId: string;
    quantity: number;
    previousInStock: boolean;
  }> = [];

  try {
    console.log(`[CHECKOUT QUEUE] Processando ordem ${orderId}...`);

    // FASE 1: Adquirir locks para todos os produtos
    console.log(`[CHECKOUT QUEUE] Adquirindo locks para ${items.length} produtos...`);
    for (const item of items) {
      const lockId = await acquireStockLock(item.productId, 10000); // 10s timeout

      if (!lockId) {
        throw new Error(`TIMEOUT ao adquirir lock para produto ${item.productId}`);
      }

      locks.set(item.productId, lockId);
    }

    // FASE 2: Verificar stock e decrementar atomicamente
    console.log(`[CHECKOUT QUEUE] Verificando stock com locks...`);
    for (const item of items) {
      // MongoDB com Prisma/TypeORM equivalente:
      // SELECT * FROM products WHERE id = ? FOR UPDATE -- (bloqueio pessimista)
      const product = await Product.findById(item.productId);

      if (!product || !product.inStock || product.stockQuantity < item.quantity) {
        throw new Error(
          `Stock insuficiente para ${product?.name || 'produto desconhecido'}. Disponível: ${product?.stockQuantity || 0}, Solicitado: ${item.quantity}`
        );
      }

      // Keep the stock check and decrement in one MongoDB operation so concurrent
      // checkouts cannot both consume the last units.
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          inStock: true,
          stockQuantity: { $gte: item.quantity },
        },
        {
          $inc: {
            stockQuantity: -item.quantity,
            salesCount: item.quantity,
          },
        },
        { returnDocument: 'after' }
      );

      if (!updatedProduct) {
        throw new Error(`Stock insuficiente ou alterado para produto ${item.productId}`);
      }

      decrementedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        previousInStock: product.inStock,
      });

      // Marcar como out-of-stock se necessário
      if (updatedProduct.stockQuantity === 0) {
        updatedProduct.inStock = false;
        await updatedProduct.save();
      }

      console.log(`[CHECKOUT QUEUE] Stock decrementado: ${item.productId} (-${item.quantity})`);
    }

    // FASE 3: Marcar ordem como confirmada
    console.log(`[CHECKOUT QUEUE] Confirmando ordem ${orderId}...`);
    await Order.findByIdAndUpdate(orderId, {
      status: 'confirmed',
      paymentStatus: 'completed',
      processedAt: new Date(),
    });

    console.log(`[CHECKOUT QUEUE] ✅ Ordem ${orderId} processada com sucesso`);
    return { success: true, orderId };
  } catch (error: any) {
    console.error(`[CHECKOUT QUEUE] ❌ Erro ao processar ordem ${orderId}:`, error.message);

    // COMPENSAÇÃO: Reverter stock e marcar ordem como falha
    try {
      console.log(`[CHECKOUT QUEUE] Executando compensação (rollback)...`);

      // Reverter apenas os decrementos confirmados.
      for (const item of decrementedItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            stockQuantity: item.quantity,
            salesCount: -item.quantity,
          },
          $set: { inStock: item.previousInStock },
        });
      }

      // Marcar ordem como falha
      await Order.findByIdAndUpdate(orderId, {
        status: 'failed',
        paymentStatus: 'failed',
        failureReason: error.message,
        compensatedAt: new Date(),
      });

      console.log(`[CHECKOUT QUEUE] ✅ Compensação concluída para ordem ${orderId}`);
    } catch (compensationError) {
      console.error(`[CHECKOUT QUEUE] ❌ Erro durante compensação:`, compensationError);
    }

    throw error;
  } finally {
    // FASE FINAL: Liberar todos os locks
    console.log(`[CHECKOUT QUEUE] Libertando ${locks.size} locks...`);
    for (const [productId, lockId] of locks.entries()) {
      try {
        await releaseStockLock(productId, lockId);
      } catch (error) {
        console.error(`[CHECKOUT QUEUE] Erro ao libertar lock para ${productId}:`, error);
      }
    }
  }
});

/**
 * Event listeners para a fila
 */
checkoutQueue.on('completed', (job: BullJob | MemoryJob) => {
  console.log(`[CHECKOUT QUEUE] ✅ Job ${job.id} concluído com sucesso`);
});

checkoutQueue.on('failed', (job: BullJob | MemoryJob, error: Error) => {
  console.error(`[CHECKOUT QUEUE] ❌ Job ${job.id} falhou:`, error.message);

  // Se falhas > 3, move para dead-letter queue
  if (job.attemptsMade >= 3) {
    console.error(`[CHECKOUT QUEUE] 🚫 Job ${job.id} excedeu tentativas. Enviado para DLQ.`);
  }
});

checkoutQueue.on('stalled', (job: BullJob | MemoryJob) => {
  console.warn(`[CHECKOUT QUEUE] ⚠️ Job ${job.id} travou. Será retentado.`);
});

/**
 * Adiciona um checkout à fila
 * @param data - Dados do checkout
 * @returns Promise<Job>
 */
export async function enqueueCheckout(data: CheckoutQueueData): Promise<BullJob<CheckoutQueueData> | MemoryJob<CheckoutQueueData>> {
  const job = await checkoutQueue.add(data, {
    attempts: 3, // Retenta até 3 vezes
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s...
    },
    removeOnComplete: true, // Remove job completado da memória
  });

  console.log(`[CHECKOUT QUEUE] Job ${job.id} enfileirado para ordem ${data.orderId}`);
  return job;
}

/**
 * Aguarda conclusão de um checkout
 */
export async function waitForCheckout(job: BullJob<CheckoutQueueData> | MemoryJob<CheckoutQueueData>, timeoutMs: number = 30000): Promise<any> {
  void timeoutMs;
  return job.finished();
}

/**
 * Obtém estatísticas da fila
 */
export async function getQueueStats() {
  const counts = await checkoutQueue.getJobCounts();
  return {
    active: counts.active,
    waiting: counts.waiting,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
  };
}

export default {
  checkoutQueue,
  enqueueCheckout,
  waitForCheckout,
  getQueueStats,
};
