import { prisma } from './prismaClient';
import { publishPortfolioEvent } from './redisClient';

const LOGISTICS_URL = process.env.LOGISTICS_URL || 'http://logistica-backend:3000';
const COMMERCE_API_URL = (process.env.COMMERCE_API_URL || 'http://backend:3001/api/v1').replace(/\/+$/, '');
const LOGISTICS_FETCH_TIMEOUT_MS = 5000;
const LOGISTICS_FETCH_RETRY_COUNT = 3;
const LOGISTICS_FETCH_RETRY_DELAY_MS = 1000;
const LOGISTICS_CIRCUIT_FAILURE_THRESHOLD = 3;
const LOGISTICS_CIRCUIT_RESET_TIMEOUT_MS = 30_000;
const LOGISTICS_CIRCUIT_SUCCESS_THRESHOLD = 1;

function commandText(
  language: string,
  messages: { pt: string; en: string; es: string },
): string {
  const locale = language.toLowerCase().split('-')[0];
  return locale === 'en' || locale === 'es' ? messages[locale] : messages.pt;
}

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = LOGISTICS_FETCH_TIMEOUT_MS,
  includeLogisticsApiKey = true,
): Promise<Response> {
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
    ...(includeLogisticsApiKey && process.env.LOGISTICS_API_KEY?.trim()
      ? { 'X-API-Key': process.env.LOGISTICS_API_KEY.trim() }
      : {}),
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
  static canApproveCredit(role: string): boolean {
    const approverRoles = (process.env.CHATOPS_CREDIT_APPROVER_ROLES || 'admin')
      .split(',')
      .map((configuredRole) => configuredRole.trim().toLowerCase())
      .filter(Boolean);
    return approverRoles.includes(role.toLowerCase());
  }

  static async handleCommand(
    messageText: string,
    userId: string,
    role = '',
    language = 'pt',
    commerceAccessToken?: string,
  ): Promise<string | null> {
    if (!messageText.startsWith('/')) return null;

    const [command, ...args] = messageText.trim().split(/\s+/);

    switch (command) {
      case '/stock': {
        const sku = args[0];
        if (!sku) return commandText(language, {
          pt: '❗ Especifica um SKU: /stock [sku]',
          en: '❗ Specify an SKU: /stock [sku]',
          es: '❗ Especifica un SKU: /stock [sku]',
        });
        if (!process.env.LOGISTICS_API_KEY?.trim()) {
          return commandText(language, {
            pt: 'Consulta de stock indisponível: configure LOGISTICS_API_KEY no serviço ChatOps.',
            en: 'Stock lookup is unavailable: configure LOGISTICS_API_KEY in the ChatOps service.',
            es: 'La consulta de existencias no está disponible: configura LOGISTICS_API_KEY en el servicio ChatOps.',
          });
        }

        console.log(`[ChatOpsEngine] executing /stock sku=${sku} logisticsUrl=${LOGISTICS_URL}`);
        try {
          const response = await logisticsCircuitBreaker.fire(
            `${LOGISTICS_URL}/api/products/stock?sku=${encodeURIComponent(sku)}`,
          );
          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.message || 'Logistics stock lookup failed');
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

          const result = commandText(language, {
            pt: `📦 Stock atual da Logística: ${data?.description || sku} tem ${data?.stock ?? 'N/A'} unidades.`,
            en: `📦 Live stock via Logistics: ${data?.description || sku} has ${data?.stock ?? 'N/A'} units.`,
            es: `📦 Existencias actuales de Logística: ${data?.description || sku} tiene ${data?.stock ?? 'N/A'} unidades.`,
          });
          console.log(`[ChatOpsEngine] /stock result user=${userId} sku=${sku} response=${result}`);
          return result;
        } catch (error: any) {
          if (error?.name === 'CircuitBreakerError') {
            const message = commandText(language, {
              pt: '❌ Logística está temporariamente indisponível. Tente novamente em alguns segundos.',
              en: '❌ Logistics is temporarily unavailable. Try again in a few seconds.',
              es: '❌ Logistics no está disponible temporalmente. Inténtalo de nuevo en unos segundos.',
            });
            console.warn(`[ChatOpsEngine] /stock circuit breaker prevented logistics request user=${userId} sku=${sku}`);
            return message;
          }

          const message = commandText(language, {
            pt: `❌ SKU ${sku} não encontrado ou logística indisponível.`,
            en: `❌ SKU ${sku} was not found or Logistics is unavailable.`,
            es: `❌ No se encontró el SKU ${sku} o Logistics no está disponible.`,
          });
          console.warn(`[ChatOpsEngine] /stock failed user=${userId} sku=${sku} error=${error?.message}`);
          return message;
        }
      }
      case '/low-stock': {
        if (args.length !== 0) return commandText(language, {
          pt: '❗ Usa /low-stock para listar produtos com 5 ou menos unidades.',
          en: '❗ Use /low-stock to list products with 5 units or fewer.',
          es: '❗ Usa /low-stock para listar productos con 5 unidades o menos.',
        });
        if (!process.env.LOGISTICS_API_KEY?.trim()) {
          return commandText(language, {
            pt: 'Consulta de stock baixo indisponível: configure LOGISTICS_API_KEY no serviço ChatOps.',
            en: 'Low-stock lookup is unavailable: configure LOGISTICS_API_KEY in the ChatOps service.',
            es: 'La consulta de existencias bajas no está disponible: configura LOGISTICS_API_KEY en el servicio ChatOps.',
          });
        }

        try {
          const response = await logisticsCircuitBreaker.fire(`${LOGISTICS_URL}/api/products/low-stock`);
          const data = await response.json().catch(() => null);
          if (!response.ok || !Array.isArray(data?.products) || typeof data?.total !== 'number') {
            throw new Error('Low-stock lookup returned an invalid response');
          }
          if (data.total === 0) return commandText(language, {
            pt: '✅ Não há produtos com 5 ou menos unidades em stock.',
            en: '✅ No products have 5 units or fewer in stock.',
            es: '✅ No hay productos con 5 unidades o menos en existencias.',
          });

          const products = data.products.slice(0, 10).map((product: {
            internalCode?: string;
            description?: string;
            quantity?: number;
            unit?: string;
          }) => {
            if (
              typeof product.internalCode !== 'string' ||
              typeof product.description !== 'string' ||
              typeof product.quantity !== 'number'
            ) {
              throw new Error('Low-stock lookup returned an invalid product');
            }
            return `${product.internalCode} — ${product.description}: ${product.quantity} ${product.unit || ''}`.trim();
          });
          const remaining = data.total - products.length;
          const listing = products.join('\n');
          const suffix = remaining > 0
            ? commandText(language, {
              pt: `\n…e mais ${remaining} produto(s).`,
              en: `\n…and ${remaining} more product(s).`,
              es: `\n…y ${remaining} producto(s) más.`,
            })
            : '';
          return commandText(language, {
            pt: `📦 Produtos com 5 ou menos unidades:\n${listing}${suffix}`,
            en: `📦 Products with 5 units or fewer:\n${listing}${suffix}`,
            es: `📦 Productos con 5 unidades o menos:\n${listing}${suffix}`,
          });
        } catch (error: any) {
          console.warn(`[ChatOpsEngine] /low-stock failed user=${userId} error=${error?.message}`);
          return commandText(language, {
            pt: '❌ Não foi possível consultar o stock baixo da Logística.',
            en: '❌ Could not check low stock with Logistics.',
            es: '❌ No se pudo consultar el nivel bajo de existencias en Logística.',
          });
        }
      }
      case '/order': {
        const orderId = args[0];
        if (!orderId) return commandText(language, {
          pt: '❗ Especifica o ID da encomenda: /order [id]',
          en: '❗ Specify the order ID: /order [id]',
          es: '❗ Especifica el ID del pedido: /order [id]',
        });
        if (args.length !== 1 || !/^[a-f\d]{24}$/i.test(orderId)) {
          return commandText(language, {
            pt: '❗ O ID da encomenda não é válido.',
            en: '❗ The order ID is invalid.',
            es: '❗ El ID del pedido no es válido.',
          });
        }
        if (!commerceAccessToken) return commandText(language, {
          pt: '❌ A sessão expirou. Inicia sessão novamente para consultar encomendas.',
          en: '❌ Your session has expired. Sign in again to check orders.',
          es: '❌ La sesión ha caducado. Inicia sesión de nuevo para consultar pedidos.',
        });

        try {
          const response = await fetchWithTimeout(
            `${COMMERCE_API_URL}/orders/checkout/${encodeURIComponent(orderId)}/status`,
            { headers: { Authorization: `Bearer ${commerceAccessToken}` } },
            LOGISTICS_FETCH_TIMEOUT_MS,
            false,
          );
          if (response.status === 403 || response.status === 404) return commandText(language, {
            pt: '❌ Encomenda não encontrada ou sem permissão para a consultar.',
            en: '❌ Order not found or you do not have permission to view it.',
            es: '❌ Pedido no encontrado o no tienes permiso para consultarlo.',
          });
          if (response.status === 401) return commandText(language, {
            pt: '❌ A sessão expirou. Inicia sessão novamente para consultar encomendas.',
            en: '❌ Your session has expired. Sign in again to check orders.',
            es: '❌ La sesión ha caducado. Inicia sesión de nuevo para consultar pedidos.',
          });
          if (!response.ok) throw new Error(`Commerce returned ${response.status}`);
          const data = await response.json().catch(() => null);
          if (data?.success !== true || typeof data?.status !== 'string' || typeof data?.paymentStatus !== 'string') {
            throw new Error('Order lookup returned an invalid response');
          }

          const statuses: Record<string, { pt: string; en: string; es: string }> = {
            pending: { pt: 'aguarda pagamento', en: 'awaiting payment', es: 'pendiente de pago' },
            confirmed: { pt: 'confirmada', en: 'confirmed', es: 'confirmado' },
            processing: { pt: 'em processamento', en: 'processing', es: 'en preparación' },
            failed: { pt: 'falhou', en: 'failed', es: 'fallido' },
            cancelled: { pt: 'cancelada', en: 'cancelled', es: 'cancelado' },
          };
          const paymentStatuses: Record<string, { pt: string; en: string; es: string }> = {
            pending: { pt: 'pendente', en: 'pending', es: 'pendiente' },
            paid: { pt: 'pago', en: 'paid', es: 'pagado' },
            failed: { pt: 'falhou', en: 'failed', es: 'fallido' },
          };
          const status = statuses[data.status] || { pt: data.status, en: data.status, es: data.status };
          const paymentStatus = paymentStatuses[data.paymentStatus] || {
            pt: data.paymentStatus,
            en: data.paymentStatus,
            es: data.paymentStatus,
          };

          return commandText(language, {
            pt: `📦 Encomenda ${orderId}: ${status.pt}; pagamento ${paymentStatus.pt}.`,
            en: `📦 Order ${orderId}: ${status.en}; payment ${paymentStatus.en}.`,
            es: `📦 Pedido ${orderId}: ${status.es}; pago ${paymentStatus.es}.`,
          });
        } catch (error: any) {
          console.warn(`[ChatOpsEngine] /order failed user=${userId} error=${error?.message}`);
          return commandText(language, {
            pt: '❌ Não foi possível consultar o estado da encomenda.',
            en: '❌ Could not check the order status.',
            es: '❌ No se pudo consultar el estado del pedido.',
          });
        }
      }
      case '/approve-credit': {
        const companyId = args[0];
        if (!companyId) return commandText(language, {
          pt: '❗ Especifica um id de empresa: /approve-credit [id_empresa]',
          en: '❗ Specify a company ID: /approve-credit [company_id]',
          es: '❗ Especifica un ID de empresa: /approve-credit [id_empresa]',
        });
        if (args.length !== 1 || !/^[A-Za-z0-9_-]{1,64}$/.test(companyId)) {
          return commandText(language, {
            pt: '❗ O id da empresa não é válido.',
            en: '❗ The company ID is invalid.',
            es: '❗ El ID de empresa no es válido.',
          });
        }
        if (!this.canApproveCredit(role)) return commandText(language, {
          pt: 'Não tem permissão para aprovar crédito.',
          en: 'You do not have permission to approve credit.',
          es: 'No tienes permiso para aprobar crédito.',
        });

        console.log(`[ChatOpsEngine] executing /approve-credit companyId=${companyId}`);
        try {
          await prisma.b2BClient.update({
            where: { id: companyId },
            data: { creditStatus: 'APPROVED' } as any,
          });
          return commandText(language, {
            pt: `✅ Crédito aprovado para empresa ${companyId}.`,
            en: `✅ Credit approved for company ${companyId}.`,
            es: `✅ Crédito aprobado para la empresa ${companyId}.`,
          });
        } catch (error: any) {
          console.warn(`[ChatOpsEngine] /approve-credit failed companyId=${companyId} error=${error?.message}`);
          return commandText(language, {
            pt: `❌ Não foi possível aprovar crédito para empresa ${companyId}.`,
            en: `❌ Could not approve credit for company ${companyId}.`,
            es: `❌ No se pudo aprobar el crédito para la empresa ${companyId}.`,
          });
        }
      }
      default:
        return commandText(language, {
          pt: '🤖 Comando não reconhecido. Exemplos: /stock [sku], /low-stock, /order [id] ou /approve-credit [id_empresa]',
          en: '🤖 Unknown command. Examples: /stock [sku], /low-stock, /order [id] or /approve-credit [company_id]',
          es: '🤖 Comando desconocido. Ejemplos: /stock [sku], /low-stock, /order [id] o /approve-credit [id_empresa]',
        });
    }
  }
}
