import { NextFunction, Request, Response } from 'express';
import { MongoClient } from 'mongodb';
import client from 'prom-client';

const mongoCommandDuration = new client.Histogram({
  name: 'tranzor_mongodb_command_duration_ms',
  help: 'MongoDB driver command duration in milliseconds',
  labelNames: ['command', 'outcome'],
  buckets: [5, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000],
});
const mongoCommandFailures = new client.Counter({
  name: 'tranzor_mongodb_command_failures_total',
  help: 'MongoDB driver command failures',
  labelNames: ['command'],
});
const mongoPoolCheckoutDuration = new client.Histogram({
  name: 'tranzor_mongodb_pool_checkout_duration_ms',
  help: 'MongoDB connection pool checkout duration in milliseconds',
  labelNames: ['outcome'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
});
const mongoPoolCheckoutFailures = new client.Counter({
  name: 'tranzor_mongodb_pool_checkout_failures_total',
  help: 'MongoDB connection pool checkout failures',
});
const monitoredMongoClients = new WeakSet<MongoClient>();

const shopOperationDuration = new client.Histogram({
  name: 'tranzor_shop_operation_duration_ms',
  help: 'Duration of catalog and product-detail operations in milliseconds',
  labelNames: ['operation'],
  buckets: [5, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000],
});

export async function measureShopOperation<T>(operation: string, action: () => Promise<T>): Promise<T> {
  const startedAt = process.hrtime.bigint();
  try {
    return await action();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    shopOperationDuration.observe({ operation }, durationMs);
  }
}

export function monitorMongoClient(client: MongoClient) {
  if (monitoredMongoClients.has(client)) {
    return;
  }

  monitoredMongoClients.add(client);
  client.on('commandSucceeded', event => {
    mongoCommandDuration.observe({ command: event.commandName, outcome: 'success' }, event.duration);
  });
  client.on('commandFailed', event => {
    mongoCommandDuration.observe({ command: event.commandName, outcome: 'failure' }, event.duration);
    mongoCommandFailures.inc({ command: event.commandName });
  });
  client.on('connectionCheckedOut', event => {
    mongoPoolCheckoutDuration.observe({ outcome: 'success' }, event.durationMS);
  });
  client.on('connectionCheckOutFailed', event => {
    mongoPoolCheckoutDuration.observe({ outcome: 'failure' }, event.durationMS);
    mongoPoolCheckoutFailures.inc();
  });
}

interface RouteMetric {
  count: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  lastStatusCode: number;
  lastResponseTimeMs: number;
  statusCodes: Record<string, number>;
}

interface BusinessMetrics {
  cacheHitCount: number;
  cacheMissCount: number;
  checkoutSuccessCount: number;
  checkoutFailureCount: number;
  stripeReconciliationChecks: number;
  saftExports: number;
}

interface MetricsState {
  startedAt: number;
  totalRequests: number;
  totalLatencyMs: number;
  requestsByRoute: Record<string, RouteMetric>;
}

const metricsState: MetricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalLatencyMs: 0,
  requestsByRoute: {},
};

const businessMetrics: BusinessMetrics = {
  cacheHitCount: 0,
  cacheMissCount: 0,
  checkoutSuccessCount: 0,
  checkoutFailureCount: 0,
  stripeReconciliationChecks: 0,
  saftExports: 0,
};

export function getMatchedRoute(req: Request) {
  const matchedPath = req.route?.path;
  const routePath = typeof matchedPath === 'string'
    ? matchedPath
    : Array.isArray(matchedPath)
      ? matchedPath.join('|')
      : matchedPath
        ? String(matchedPath)
        : null;
  return routePath === null ? '<unmatched>' : `${req.baseUrl}${routePath}`;
}

function getRouteKey(req: Request) {
  return `${req.method} ${getMatchedRoute(req)}`;
}

export function incrementBusinessMetric(metric: keyof BusinessMetrics, amount = 1) {
  if (businessMetrics[metric] !== undefined) {
    businessMetrics[metric] += amount;
  }
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const routeKey = getRouteKey(req);
    const routeMetric = metricsState.requestsByRoute[routeKey] ?? {
      count: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      lastStatusCode: 0,
      lastResponseTimeMs: 0,
      statusCodes: {},
    };

    routeMetric.count += 1;
    routeMetric.totalLatencyMs += durationMs;
    routeMetric.averageLatencyMs = routeMetric.totalLatencyMs / routeMetric.count;
    routeMetric.lastStatusCode = res.statusCode;
    routeMetric.lastResponseTimeMs = durationMs;
    routeMetric.statusCodes[String(res.statusCode)] = (routeMetric.statusCodes[String(res.statusCode)] ?? 0) + 1;

    metricsState.totalRequests += 1;
    metricsState.totalLatencyMs += durationMs;
    metricsState.requestsByRoute[routeKey] = routeMetric;
  });

  next();
}

export function getMetricsSnapshot() {
  return {
    startedAt: new Date(metricsState.startedAt).toISOString(),
    uptimeSeconds: Math.max(0, (Date.now() - metricsState.startedAt) / 1000),
    totalRequests: metricsState.totalRequests,
    totalLatencyMs: metricsState.totalLatencyMs,
    averageLatencyMs: metricsState.totalRequests > 0
      ? metricsState.totalLatencyMs / metricsState.totalRequests
      : 0,
    memoryUsage: process.memoryUsage(),
    requestsByRoute: metricsState.requestsByRoute,
    businessMetrics,
  };
}
