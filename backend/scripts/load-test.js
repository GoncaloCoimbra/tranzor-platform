const { performance } = require('node:perf_hooks');

const options = {
  baseUrl: process.env.LOAD_BASE_URL || 'http://localhost:3001',
  path: process.env.LOAD_PATH || '/api/v1/products',
  method: process.env.LOAD_METHOD || 'GET',
  token: process.env.LOAD_TOKEN || '',
  durationSeconds: Number(process.env.LOAD_DURATION_SECONDS || 30),
  concurrency: Number(process.env.LOAD_CONCURRENCY || 10),
  maxRequests: process.env.LOAD_MAX_REQUESTS ? Number(process.env.LOAD_MAX_REQUESTS) : Infinity,
  timeoutMs: Number(process.env.LOAD_TIMEOUT_MS || 10000),
  body: process.env.LOAD_BODY_JSON ? JSON.parse(process.env.LOAD_BODY_JSON) : undefined,
};

for (const [name, value] of [['concurrency', options.concurrency], ['durationSeconds', options.durationSeconds], ['timeoutMs', options.timeoutMs]]) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
}
if (options.maxRequests !== Infinity && (!Number.isSafeInteger(options.maxRequests) || options.maxRequests <= 0)) {
  throw new Error('maxRequests must be a positive integer');
}

const latencies = [];
const statusCounts = new Map();
let completed = 0;
let dispatched = 0;
let failures = 0;
let timeouts = 0;
let serverErrors = 0;
let stopped = false;

async function request(sequence) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers = { ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) };
  let body = options.body;

  if (options.method !== 'GET' && options.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    if (options.path.endsWith('/checkout')) headers['X-Idempotency-Key'] = `load-${Date.now()}-${sequence}-${Math.random().toString(16).slice(2)}`;
    body = body === undefined ? undefined : JSON.stringify(body);
  }

  try {
    const response = await fetch(new URL(options.path, options.baseUrl), {
      method: options.method,
      headers,
      body,
      signal: controller.signal,
    });
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    completed += 1;
    statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
    if (!response.ok) failures += 1;
    if (response.status >= 500) serverErrors += 1;
  } catch (error) {
    completed += 1;
    failures += 1;
    if (error.name === 'AbortError') timeouts += 1;
  } finally {
    clearTimeout(timer);
  }
}

async function worker() {
  while (!stopped) {
    if (dispatched >= options.maxRequests) {
      stopped = true;
      break;
    }
    const sequence = dispatched++;
    await request(sequence);
  }
}

async function main() {
  console.log(`Teste: ${options.method} ${options.baseUrl}${options.path}`);
  console.log(`Duração: ${options.durationSeconds}s | Concorrência: ${options.concurrency} | Limite: ${options.maxRequests === Infinity ? 'sem limite' : options.maxRequests} pedidos | Timeout: ${options.timeoutMs}ms`);
  const started = performance.now();
  const workers = Array.from({ length: options.concurrency }, () => worker());
  setTimeout(() => { stopped = true; }, options.durationSeconds * 1000);
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
  const elapsedSeconds = (performance.now() - started) / 1000;
  const errorRate = completed ? (failures / completed) * 100 : 0;

  console.log(`Pedidos: ${completed}`);
  console.log(`Falhas: ${failures} (${errorRate}%)`);
  console.log(`Timeouts: ${timeouts}`);
  console.log(`5xx: ${serverErrors}`);
  console.log(`Códigos HTTP: ${[...statusCounts].sort(([a], [b]) => a - b).map(([status, count]) => `${status}=${count}`).join(', ') || 'sem respostas HTTP'}`);
  console.log(`Pedidos/segundo: ${completed / elapsedSeconds}`);
  console.log(`Latência p50/p95/p99: ${percentile(0.5)}/${percentile(0.95)}/${percentile(0.99)} ms`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});