import { prisma } from './prismaClient';
import { publishPortfolioEvent } from './redisClient';

const LOGISTICS_URL = process.env.LOGISTICS_URL || 'http://logistica-backend:3000';
// TODO: fill LOGISTICS_API_KEY manually with a generated key until a key management endpoint exists.
const LOGISTICS_API_KEY = process.env.LOGISTICS_API_KEY || '';
const LOGISTICS_FETCH_TIMEOUT_MS = 5000;
const LOGISTICS_FETCH_RETRY_COUNT = 3;
const LOGISTICS_FETCH_RETRY_DELAY_MS = 1000;
const LOGISTICS_CIRCUIT_FAILURE_THRESHOLD = 3;
const LOGISTICS_CIRCUIT_RESET_TIMEOUT_MS = 30_000;
const LOGISTICS_CIRCUIT_SUCCESS_THRESHOLD = 1;

function isRetryableFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; code?: string; cause?: { code?: string }; status?: number };
  const code = err.code || err.cause?.code;
  return (
    err.name === 'AbortError' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    (typeof err.status === 'number' && err.status >= 500 && err.status < 600)
  );
}

class CircuitBreakerError extends Error {
  constructor() {
    super('Circuit breaker is open');
    this.name = 'CircuitBreakerError';
  }
}

class SimpleCircuitBreaker<TArgs extends any[], TResult> {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;

  constructor(
    private action: (...args: TArgs) => Promise<TResult>,
    private options: {
      failureThreshold: number;
      successThreshold: number;
      resetTimeoutMs: number;
    },
  ) {}

  reset() {
    this.state = 'CLOSED';
    this.nextAttempt = 0;
    this.resetCounts();
  }

  async fire(...args: TArgs): Promise<TResult> {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerError();
      }
    }

    try {
      const result = await this.action(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount += 1;
      if (this.successCount >= this.options.successThreshold) {
        this.close();
      }
    } else {
      this.resetCounts();
    }
  }

  private onFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
    this.successCount = 0;
  }

  private close() {
    this.state = 'CLOSED';
    this.resetCounts();
  }

  private resetCounts() {
    this.failureCount = 0;
    this.successCount = 0;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = LOGISTICS_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchFn = (globalThis as any).fetch ?? (global as any).fetch;

  if (typeof fetchFn !== 'function') {
    clearTimeout(timeout);
    throw new Error('fetch is not available');
  }

  const headers =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers as Record<string, string> | undefined) || {};

  const mergedHeaders = {
    ...headers,
    ...(LOGISTICS_API_KEY ? { 'X-API-Key': LOGISTICS_API_KEY } : {}),
  };

  try {
    return await fetchFn(url, { ...options, headers: mergedHeaders, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithRetries(url: string, options: RequestInit = {}): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LOGISTICS_FETCH_RETRY_COUNT; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[ChatOpsEngine] retrying logistics fetch attempt ${attempt}/${LOGISTICS_FETCH_RETRY_COUNT} for ${url}`);
      }
      const response = await fetchWithTimeout(url, options, LOGISTICS_FETCH_TIMEOUT_MS);
      if (!response.ok && response.status >= 500) {
        const error = new Error(`Logistics returned ${response.status}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === LOGISTICS_FETCH_RETRY_COUNT || !isRetryableFetchError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, LOGISTICS_FETCH_RETRY_DELAY_MS * attempt));
    }
  }

  throw lastError;
}

async function fetchLogistics(url: string): Promise<Response> {
  return fetchWithRetries(url);
}

export const logisticsCircuitBreaker = new SimpleCircuitBreaker(fetchLogistics, {
  failureThreshold: LOGISTICS_CIRCUIT_FAILURE_THRESHOLD,
  successThreshold: LOGISTICS_CIRCUIT_SUCCESS_THRESHOLD,
  resetTimeoutMs: LOGISTICS_CIRCUIT_RESET_TIMEOUT_MS,
});

export class ChatOpsEngine {
  static async handleCommand(messageText: string, userId: string): Promise<string | null> {
    if (!messageText.startsWith('/')) return null;

    const [command, ...args] = messageText.trim().split(/\s+/);

    switch (command) {
      case '/stock': {
        const sku = args[0];
        if (!sku) return '❗ Especifica um SKU: /stock [sku]';

        console.log(`[ChatOpsEngine] executing /stock sku=${sku} logisticsUrl=${LOGISTICS_URL}`);
        try {
          const response = await logisticsCircuitBreaker.fire(
            `${LOGISTICS_URL}/api/products/stock?sku=${encodeURIComponent(sku)}`,
          );
          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.message || 'Erro ao consultar stock');
          }

          const eventPayload = {
            type: 'stock_sync',
            sku,
            stock: data?.stock,
            description: data?.description,
            source: 'chatops',
            timestamp: new Date().toISOString(),
          };

          try {
            await publishPortfolioEvent('portfolio:stock-sync', JSON.stringify(eventPayload));
          } catch (redisError: any) {
            console.warn('[ChatOpsEngine] Redis publish failed, continuing anyway:', redisError?.message || redisError);
          }

          const result = `📦 Stock real via Logistics: ${data?.description || sku} tem ${data?.stock ?? 'N/A'} unidades.`;
          console.log(`[ChatOpsEngine] /stock result user=${userId} sku=${sku} response=${result}`);
          return result;
        } catch (error: any) {
          if (error?.name === 'CircuitBreakerError') {
            const message = '❌ Logística está temporariamente indisponível. Tente novamente em alguns segundos.';
            console.warn(`[ChatOpsEngine] /stock circuit breaker prevented logistics request user=${userId} sku=${sku}`);
            return message;
          }

          const message = `❌ SKU ${sku} não encontrado ou logística indisponível: ${error.message}`;
          console.warn(`[ChatOpsEngine] /stock failed user=${userId} sku=${sku} error=${error?.message}`);
          return message;
        }
      }
      case '/approve-credit': {
        const companyId = args[0];
        if (!companyId) return '❗ Especifica um id de empresa: /approve-credit [id_empresa]';

        console.log(`[ChatOpsEngine] executing /approve-credit companyId=${companyId}`);
        try {
          await prisma.b2BClient.update({
            where: { id: companyId },
            data: { creditStatus: 'APPROVED' } as any,
          });
          return `✅ Crédito aprovado para empresa ${companyId}.`;
        } catch (error: any) {
          console.warn(`[ChatOpsEngine] /approve-credit failed companyId=${companyId} error=${error?.message}`);
          return `❌ Não foi possível aprovar crédito para empresa ${companyId}: ${error?.message || 'erro desconhecido'}`;
        }
      }
      default:
        return '🤖 Comando não reconhecido. Exemplos: /stock [sku] /approve-credit [id_empresa]';
    }
  }
}
