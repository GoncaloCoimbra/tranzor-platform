const { performance } = require('node:perf_hooks');

const options = {
  baseUrl: process.env.LOAD_BASE_URL || 'http://localhost:3000',
  path: process.env.LOAD_PATH || '/health',
  token: process.env.LOAD_TOKEN || '',
  durationSeconds: Number(process.env.LOAD_DURATION_SECONDS || 30),
  concurrency: Number(process.env.LOAD_CONCURRENCY || 10),
  timeoutMs: Number(process.env.LOAD_TIMEOUT_MS || 10000),
};

if (process.argv.includes('--help')) {
  console.log('Variáveis: LOAD_BASE_URL, LOAD_PATH, LOAD_TOKEN, LOAD_DURATION_SECONDS, LOAD_CONCURRENCY');
  console.log('Exemplo: LOAD_PATH=/api/dashboard/stats LOAD_TOKEN=jwt npm run load-test');
  process.exit(0);
}

if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
  throw new Error('LOAD_CONCURRENCY deve ser um inteiro maior que zero');
}

if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
  throw new Error('LOAD_DURATION_SECONDS deve ser maior que zero');
}

if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
  throw new Error('LOAD_TIMEOUT_MS deve ser maior que zero');
}

const latencies = [];
let completed = 0;
let failures = 0;
let timeouts = 0;
let serverErrors = 0;
let stopped = false;

async function request() {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers = options.token
    ? { Authorization: `Bearer ${options.token}` }
    : undefined;

  try {
    const response = await fetch(new URL(options.path, options.baseUrl), { headers, signal: controller.signal });
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    completed += 1;
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
  while (!stopped) await request();
}

async function main() {
  console.log(`Teste: ${options.baseUrl}${options.path}`);
  console.log(`Duração: ${options.durationSeconds}s | Concorrência: ${options.concurrency} | Timeout: ${options.timeoutMs}ms`);

  const started = performance.now();
  const workers = Array.from({ length: options.concurrency }, worker);
  setTimeout(() => { stopped = true; }, options.durationSeconds * 1000);
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
  const elapsedSeconds = (performance.now() - started) / 1000;
  const requestsPerSecond = completed / elapsedSeconds;

  console.log(`Pedidos: ${completed}`);
  console.log(`Falhas: ${failures} (${completed ? (failures / completed) * 100 : 0}%)`);
  console.log(`Timeouts: ${timeouts}`);
  console.log(`5xx: ${serverErrors}`);
  console.log(`Pedidos/segundo: ${requestsPerSecond}`);
  console.log(`Latência p50/p95/p99: ${percentile(0.5)}/${percentile(0.95)}/${percentile(0.99)} ms`);

  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});