const mongoose = require('mongoose');
const { execFile, spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const axios = require('axios');
const Redis = require('ioredis');
const execFileAsync = promisify(execFile);

const sourceUri = process.env.CAPACITY_SOURCE_MONGODB_URI || process.env.MONGODB_URI;
const capacityUri = process.env.MONGODB_URI;
if (!sourceUri || !capacityUri) throw new Error('MONGODB_URI and optional CAPACITY_SOURCE_MONGODB_URI are required');

const sourceUrl = new URL(sourceUri);
const capacityUrl = new URL(capacityUri);
if (!['localhost', '127.0.0.1'].includes(sourceUrl.hostname) || !['localhost', '127.0.0.1'].includes(capacityUrl.hostname)) {
  throw new Error(`Refusing to copy data from non-local MongoDB host: ${sourceUrl.hostname}`);
}
if (capacityUrl.port !== '27018' || capacityUrl.port === sourceUrl.port) {
  throw new Error('MONGODB_URI must point to the isolated capacity MongoDB on local port 27018');
}

if (!sourceUrl.pathname.slice(1)) throw new Error('CAPACITY_SOURCE_MONGODB_URI must include a database name');
if (!capacityUrl.pathname.slice(1)) throw new Error('MONGODB_URI must include a database name');

const testDatabase = process.env.CAPACITY_TEST_DATABASE || `TranzorCapacity_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const testUrl = new URL(capacityUri);
testUrl.pathname = `/${testDatabase}`;
const soakSeconds = Number(process.env.CAPACITY_SOAK_SECONDS ?? 1800);
const soakUsers = Number(process.env.CAPACITY_SOAK_USERS || 10);
const soakP95TargetMs = process.env.CAPACITY_SLO_P95_MS === undefined
  ? undefined
  : Number(process.env.CAPACITY_SLO_P95_MS);
const soakErrorTargetPercent = process.env.CAPACITY_SLO_MAX_ERROR_RATE_PERCENT === undefined
  ? undefined
  : Number(process.env.CAPACITY_SLO_MAX_ERROR_RATE_PERCENT);
const targets = [10_000, 50_000, 100_000];
const skipCatalogBenchmarks = process.env.CAPACITY_SKIP_CATALOG === 'true';
const skipSyntheticProducts = process.env.CAPACITY_SKIP_SYNTHETIC === 'true';
const skipUserRamp = process.env.CAPACITY_SKIP_RAMP === 'true';
const userLevels = (process.env.CAPACITY_USER_LEVELS || '25,50,100,200').split(',').map(Number);
const explainPlans = process.env.CAPACITY_EXPLAIN === 'true';
const appEntryPoint = process.env.CAPACITY_APP_PATH || '/app/dist/server.js';
const externalApiUrl = process.env.CAPACITY_EXTERNAL_API_URL;
const apiBaseUrl = externalApiUrl || 'http://127.0.0.1:3002';
const typesenseUrl = process.env.CAPACITY_TYPESENSE_URL || 'http://127.0.0.1:8109';
const typesenseApiKey = process.env.TYPESENSE_API_KEY;
const composeProject = process.env.CAPACITY_COMPOSE_PROJECT || 'tranzor-capacity';
const composeFile = path.resolve(__dirname, '../../docker-compose.capacity.yml');
const composeArgs = ['compose', '-p', composeProject, '-f', composeFile];
const capacityRedisUrl = process.env.CAPACITY_REDIS_URL;
if (!capacityRedisUrl) {
  throw new Error('CAPACITY_REDIS_URL must point to the isolated capacity Redis service');
}
const capacityRedis = new URL(capacityRedisUrl);
if (!['localhost', '127.0.0.1'].includes(capacityRedis.hostname) || capacityRedis.port !== '6380') {
  throw new Error('CAPACITY_REDIS_URL must point to the isolated capacity Redis on local port 6380');
}
if (externalApiUrl && !process.env.CAPACITY_REDIS_PASSWORD) {
  throw new Error('CAPACITY_REDIS_PASSWORD is required when using isolated Compose services');
}
if (externalApiUrl && decodeURIComponent(capacityRedis.password) !== process.env.CAPACITY_REDIS_PASSWORD) {
  throw new Error('CAPACITY_REDIS_URL password must match the isolated Compose Redis password');
}
const overallCounters = { completed: 0, failed: 0, statusCounts: new Map() };
const resourceSamples = [];
const resourceSamplingFailures = [];
let catalogId = new mongoose.Types.ObjectId();
const creatorId = new mongoose.Types.ObjectId();
let testDatabaseCreated = false;
let apiProcess;
let stopRequested = false;

if (!Number.isSafeInteger(soakSeconds) || soakSeconds < 0) throw new Error('CAPACITY_SOAK_SECONDS must be a non-negative integer');
if (!Number.isSafeInteger(soakUsers) || soakUsers <= 0) throw new Error('CAPACITY_SOAK_USERS must be a positive integer');
if (userLevels.some(value => !Number.isSafeInteger(value) || value <= 0)) throw new Error('CAPACITY_USER_LEVELS must contain positive integers');
if ((soakP95TargetMs === undefined) !== (soakErrorTargetPercent === undefined)) {
  throw new Error('CAPACITY_SLO_P95_MS and CAPACITY_SLO_MAX_ERROR_RATE_PERCENT must be set together');
}
if (soakP95TargetMs !== undefined && (!Number.isFinite(soakP95TargetMs) || soakP95TargetMs <= 0)) {
  throw new Error('CAPACITY_SLO_P95_MS must be a positive number');
}
if (soakErrorTargetPercent !== undefined
  && (!Number.isFinite(soakErrorTargetPercent) || soakErrorTargetPercent < 0 || soakErrorTargetPercent > 100)) {
  throw new Error('CAPACITY_SLO_MAX_ERROR_RATE_PERCENT must be a number between 0 and 100');
}

process.on('SIGINT', () => { stopRequested = true; });
process.on('SIGTERM', () => { stopRequested = true; });

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function summary(samples) {
  return {
    count: samples.length,
    p50Ms: Number(percentile(samples, 0.5).toFixed(1)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(1)),
    p99Ms: Number(percentile(samples, 0.99).toFixed(1)),
    maxMs: Number(samples.reduce((maximum, value) => Math.max(maximum, value), 0).toFixed(1)),
  };
}

function phaseMetrics(startedAt, completedBefore, failedBefore, statusesBefore) {
  const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const completed = overallCounters.completed - completedBefore;
  const failed = overallCounters.failed - failedBefore;
  const statusCounts = Object.fromEntries(Array.from(overallCounters.statusCounts, ([status, count]) => [
    status,
    count - (statusesBefore.get(status) || 0),
  ]).filter(([, count]) => count > 0));
  return {
    durationSeconds: Number(elapsedSeconds.toFixed(1)),
    requests: completed + failed,
    requestsPerSecond: Number((completed / elapsedSeconds).toFixed(2)),
    failedRequests: failed,
    errorRatePercent: Number((100 * failed / Math.max(1, completed + failed)).toFixed(2)),
    statusCounts,
  };
}

function runCompose(args) {
  const result = spawnSync('docker', [...composeArgs, ...args], { encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout.trim();
}

function parseMiB(value) {
  const match = value.match(/([\d.]+)\s*(B|KiB|MiB|GiB)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'gib') return amount * 1024;
  if (unit === 'kib') return amount / 1024;
  if (unit === 'b') return amount / (1024 * 1024);
  return amount;
}

async function sampleDockerResources() {
  let result;
  try {
    result = await execFileAsync(
      'docker',
      ['stats', '--no-stream', '--format', '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}'],
      { encoding: 'utf8', timeout: 15_000, windowsHide: true, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    const detail = error.stderr || error.message || String(error);
    throw new Error(`Unable to collect Docker resource metrics: ${detail}`);
  }

  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const [name, cpu, memory] = line.split('|');
    if (!name.startsWith(`${composeProject}-`)) continue;
    const [used, limit] = (memory || '').split('/').map(part => parseMiB(part.trim()));
    const sample = {
      at: Date.now(),
      service: name,
      cpuPercent: Number.parseFloat(cpu) || 0,
      memoryMiB: Number((used || 0).toFixed(1)),
      memoryLimitMiB: Number((limit || 0).toFixed(1)),
    };
    resourceSamples.push(sample);
  }
}

function summarizeResources(samples) {
  const byService = new Map();
  for (const sample of samples) {
    if (!byService.has(sample.service)) byService.set(sample.service, []);
    byService.get(sample.service).push(sample);
  }

  return Object.fromEntries(Array.from(byService, ([service, values]) => [service, {
    samples: values.length,
    averageCpuPercent: Number((values.reduce((sum, value) => sum + value.cpuPercent, 0) / values.length).toFixed(2)),
    peakCpuPercent: Number(Math.max(...values.map(value => value.cpuPercent)).toFixed(2)),
    averageMemoryMiB: Number((values.reduce((sum, value) => sum + value.memoryMiB, 0) / values.length).toFixed(1)),
    peakMemoryMiB: Number(Math.max(...values.map(value => value.memoryMiB)).toFixed(1)),
    memoryLimitMiB: values[0].memoryLimitMiB,
  }]));
}

async function indexSyntheticProducts(documents) {
  if (!typesenseApiKey) throw new Error('TYPESENSE_API_KEY is required to index synthetic products');
  const response = await axios.post(
    `${typesenseUrl}/collections/products/documents/import`,
    documents.map(document => JSON.stringify(document)).join('\n'),
    { params: { action: 'upsert' }, headers: { 'X-TYPESENSE-API-KEY': typesenseApiKey, 'Content-Type': 'text/plain' }, timeout: 30_000 },
  );
  const lines = String(response.data).trim().split('\n').filter(Boolean);
  const failed = lines.map(line => JSON.parse(line)).filter(result => result.success !== true);
  if (failed.length) throw new Error(`Typesense could not index ${failed.length} synthetic products: ${failed[0].error || 'unknown error'}`);
}

async function copyCollection(source, target, name, filter = {}) {
  const sourceCollection = source.collection(name);
  const count = await sourceCollection.countDocuments(filter);
  if (!count) return 0;

  const targetCollection = target.collection(name);
  const cursor = sourceCollection.find(filter);
  let batch = [];
  while (await cursor.hasNext()) {
    batch.push(await cursor.next());
    if (batch.length === 1000) {
      await targetCollection.insertMany(batch, { ordered: false });
      batch = [];
    }
  }
  if (batch.length) await targetCollection.insertMany(batch, { ordered: false });
  return count;
}

async function createIndexes(db) {
  const products = db.collection('products');
  await products.createIndexes([
    { key: { sku: 1 }, name: 'sku_1', unique: true },
    { key: { slug: 1 }, name: 'slug_1', unique: true },
    { key: { name: 'text', description: 'text' }, name: 'name_text_description_text' },
    { key: { category: 1 }, name: 'category_1' },
    { key: { isActive: 1 }, name: 'isActive_1' },
    { key: { isFeatured: 1 }, name: 'isFeatured_1' },
    { key: { price: 1 }, name: 'price_1' },
    { key: { 'rating.average': -1 }, name: 'rating.average_-1' },
    { key: { createdAt: -1 }, name: 'createdAt_-1' },
    { key: { isActive: 1, isDeleted: 1, createdAt: -1 }, name: 'isActive_1_isDeleted_1_createdAt_-1' },
    { key: { isActive: 1, isDeleted: 1, category: 1, createdAt: -1 }, name: 'isActive_1_isDeleted_1_category_1_createdAt_-1' },
    { key: { isActive: 1, isDeleted: 1, isFeatured: 1, createdAt: -1 }, name: 'isActive_1_isDeleted_1_isFeatured_1_createdAt_-1' },
  ]);
}

async function reportQueryPlans(db) {
  const products = db.collection('products');
  const catalogQuery = { isActive: true, isDeleted: false };
  const searchQuery = { ...catalogQuery, $text: { $search: 'capacity' } };
  const [catalogPlan, searchPlan, catalogCountPlan, searchCountPlan] = await Promise.all([
    products.find(catalogQuery).sort({ createdAt: -1 }).limit(20).explain('executionStats'),
    products.find(searchQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } }).limit(20).explain('executionStats'),
    products.aggregate([{ $match: catalogQuery }, { $count: 'total' }]).explain('executionStats'),
    products.aggregate([{ $match: searchQuery }, { $count: 'total' }]).explain('executionStats'),
  ]);

  const summarize = plan => {
    const cursor = plan.stages?.find(stage => stage.$cursor)?.$cursor;
    const executionStats = plan.executionStats || cursor?.executionStats;
    const queryPlanner = plan.queryPlanner || cursor?.queryPlanner;
    return {
      executionTimeMillis: executionStats?.executionTimeMillis,
      nReturned: executionStats?.nReturned,
      totalKeysExamined: executionStats?.totalKeysExamined,
      totalDocsExamined: executionStats?.totalDocsExamined,
      winningPlan: queryPlanner?.winningPlan,
    };
  };

  console.log(JSON.stringify({
    phase: 'query-plans',
    catalog: summarize(catalogPlan),
    search: summarize(searchPlan),
    catalogCount: summarize(catalogCountPlan),
    searchCount: summarize(searchCountPlan),
  }));
}

async function addSyntheticProducts(db, from, to) {
  const products = db.collection('products');
  for (let start = from; start < to; start += 1000) {
    if (stopRequested) throw new Error('Capacity test interrupted');
    const end = Math.min(start + 1000, to);
    const batch = Array.from({ length: end - start }, (_, offset) => {
      const id = start + offset;
      const date = new Date(Date.UTC(2024, 0, 1) + id * 60_000);
      return {
        name: `Capacity office paper product ${id}`,
        slug: `capacity-office-paper-${id}`,
        description: `Synthetic office paper product for isolated catalog capacity testing, item ${id}.`,
        shortDescription: `Capacity test item ${id}`,
        price: 1 + (id % 500),
        salePrice: null,
        category: catalogId,
        brand: `Test Brand ${id % 25}`,
        sku: `CAP${id}`,
        images: [],
        variants: [],
        specifications: {},
        tags: ['capacity-test', 'office-paper'],
        inStock: true,
        stockQuantity: 100,
        lowStockThreshold: 5,
        rating: { average: (id % 50) / 10, count: id % 100 },
        isActive: true,
        isDeleted: false,
        isFeatured: id % 100 === 0,
        isNew: id % 10 === 0,
        salesCount: id % 1000,
        viewCount: id % 5000,
        createdBy: creatorId,
        volumeDiscounts: [],
        authorizedB2BCompanies: [],
        createdAt: date,
        updatedAt: date,
      };
    });
    const inserted = await products.insertMany(batch, { ordered: false });
    await indexSyntheticProducts(batch.map((product, offset) => ({
      id: inserted.insertedIds[offset].toString(),
      name: product.name,
      description: product.description,
      category: product.category.toString(),
      isActive: product.isActive,
      isDeleted: product.isDeleted,
      createdAt: Math.floor(product.createdAt.getTime() / 1000),
    })));
  }
}

async function waitForApi(baseUrl) {
  const end = Date.now() + 60_000;
  let lastError;
  while (Date.now() < end && !stopRequested) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const health = await response.json();
        if (health.database?.connected && health.database?.source === 'mongodb') return health;
        lastError = new Error(`Test API is not connected to MongoDB: ${JSON.stringify(health.database)}`);
      } else {
        lastError = new Error(`Test API health returned HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw lastError || new Error('Timed out waiting for isolated API');
}

async function request(baseUrl, path, samples, statusCounts) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15_000) });
    const responseText = await response.text();
    const elapsed = performance.now() - started;
    samples.push(elapsed);
    statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
    overallCounters.statusCounts.set(response.status, (overallCounters.statusCounts.get(response.status) || 0) + 1);
    let body;
    try {
      body = JSON.parse(responseText);
    } catch {
      const contentType = response.headers.get('content-type') || 'no content type';
      throw new Error(`${path} returned non-JSON HTTP ${response.status} (${contentType}): ${responseText.slice(0, 200)}`);
    }
    if (!response.ok || body.success === false) {
      throw new Error(`${path} failed with HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
    }
    overallCounters.completed += 1;
    return body;
  } catch (error) {
    overallCounters.failed += 1;
    throw error;
  }
}

async function benchmarkCatalog(baseUrl, total, sampleCount = 20) {
  const list = [];
  const search = [];
  const detail = [];
  const statusCounts = new Map();
  let detailId;
  const searchTerm = `capacity -catalogtarget${total}`;

  for (let index = 0; index < sampleCount && !stopRequested; index += 1) {
    const page = index + 1;
    const body = await request(
      baseUrl,
      `/api/v1/shop/products?limit=20&page=${page}&minPrice=-${total}`,
      list,
      statusCounts,
    );
    const products = body.products || [];
    if (!body.pagination || body.pagination.totalProducts !== total) {
      throw new Error(`Expected ${total} catalog products, API reported ${body.pagination?.totalProducts}`);
    }
    if (products[0]) detailId = products[0]._id || products[0].id;
    await request(baseUrl, `/api/v1/shop/search?q=${encodeURIComponent(searchTerm)}&limit=20&page=${page}`, search, statusCounts);
    if (detailId) await request(baseUrl, `/api/v1/shop/products/${detailId}`, detail, statusCounts);
  }

  return {
    totalProducts: total,
    list: summary(list),
    search: summary(search),
    detail: summary(detail),
    statusCounts: Object.fromEntries(statusCounts),
  };
}

async function runUserJourneys(baseUrl, users) {
  const requestSamples = { list: [], detail: [], search: [] };
  const failures = [];
  const categorySamples = [];
  let completedUsers = 0;

  await Promise.all(Array.from({ length: users }, async (_, user) => {
    try {
      const list = await request(baseUrl, `/api/v1/shop/products?limit=20&page=${(user % 100) + 1}&view=summary`, requestSamples.list, new Map());
      const product = (list.products || [])[user % Math.max(1, (list.products || []).length)];
      if (!product) throw new Error('Product listing returned no products');
      const productId = product._id || product.id;
      await request(baseUrl, '/api/v1/shop/categories', categorySamples, new Map());
      await request(baseUrl, `/api/v1/shop/products/${productId}`, requestSamples.detail, new Map());
      await request(baseUrl, '/api/v1/shop/search?q=capacity&limit=20', requestSamples.search, new Map());
      completedUsers += 1;
    } catch (error) {
      failures.push(error.message);
    }
  }));

  return {
    virtualUsers: users,
    completedJourneys: completedUsers,
    failedJourneys: failures.length,
    failures: failures.slice(0, 5),
    apiRequestLatency: Object.fromEntries(Object.entries(requestSamples).map(([route, samples]) => [route, summary(samples)])),
    categoriesLatency: summary(categorySamples),
  };
}

async function verifyImmediateViewCount(baseUrl) {
  const samples = [];
  const statusCounts = new Map();
  const listing = await request(baseUrl, '/api/v1/shop/products?limit=1&page=1', samples, statusCounts);
  const product = listing.products?.[0];
  const productId = product?._id || product?.id;
  if (!productId) throw new Error('Unable to select a product for view-count verification');

  const path = `/api/v1/shop/products/${productId}`;
  const first = await request(baseUrl, path, samples, statusCounts);
  const second = await request(baseUrl, path, samples, statusCounts);
  const firstViewCount = first.data?.product?.viewCount;
  const secondViewCount = second.data?.product?.viewCount;
  if (!Number.isInteger(firstViewCount) || secondViewCount !== firstViewCount + 1) {
    throw new Error(`Expected detail viewCount to increment immediately by one; observed ${firstViewCount} then ${secondViewCount}`);
  }
  const preservedResponseShape = Boolean(second.data?.product?._id && Array.isArray(second.data.reviews) && second.data.ratingStats);
  if (!preservedResponseShape) throw new Error('Detail response is missing its established product, reviews, or ratingStats fields');

  console.log(JSON.stringify({
    phase: 'detail-cache-check',
    productId,
    firstViewCount,
    secondViewCount,
    preservedResponseShape,
  }));
}

async function runSoak(baseUrl) {
  const started = performance.now();
  const end = started + soakSeconds * 1000;
  const routeSamples = { list: [], categories: [], detail: [], search: [] };
  const allFailures = [];
  const users = Array.from({ length: soakUsers }, async () => {
    let iteration = 0;
    while (!stopRequested && performance.now() < end) {
      try {
        const list = await request(baseUrl, `/api/v1/shop/products?limit=20&page=${(iteration % 100) + 1}&view=summary`, routeSamples.list, new Map());
        const product = (list.products || [])[0];
        if (!product) throw new Error('Product listing returned no products');
        if (performance.now() >= end) break;
        const productId = product._id || product.id;
        await request(baseUrl, '/api/v1/shop/categories', routeSamples.categories, new Map());
        if (performance.now() >= end) break;
        await request(baseUrl, `/api/v1/shop/products/${productId}`, routeSamples.detail, new Map());
        if (performance.now() >= end) break;
        await request(baseUrl, '/api/v1/shop/search?q=capacity&limit=20', routeSamples.search, new Map());
      } catch (error) {
        allFailures.push(error.message);
      }
      iteration += 1;
      const remaining = end - performance.now();
      if (remaining > 0) await delay(Math.min(2500, remaining));
    }
  });

  const reportInterval = setInterval(() => {
    const elapsedMinutes = Math.floor((performance.now() - started) / 60_000);
    console.log(JSON.stringify({
      phase: 'soak-progress',
      elapsedMinutes,
      requests: Object.values(routeSamples).reduce((sum, samples) => sum + samples.length, 0),
      failures: allFailures.length,
      listP95Ms: Number(percentile(routeSamples.list, 0.95).toFixed(1)),
      searchP95Ms: Number(percentile(routeSamples.search, 0.95).toFixed(1)),
    }));
  }, 60_000);

  await Promise.all(users);
  clearInterval(reportInterval);
  const allLatencies = Object.values(routeSamples).flat();
  return {
    durationSeconds: Number(((performance.now() - started) / 1000).toFixed(1)),
    virtualUsers: soakUsers,
    requests: allLatencies.length,
    failedRequests: allFailures.length,
    failureSamples: allFailures.slice(0, 5),
    latency: summary(allLatencies),
    latencyByRoute: Object.fromEntries(Object.entries(routeSamples).map(([route, samples]) => [route, summary(samples)])),
  };
}

async function waitForApiRecovery(baseUrl) {
  const end = Date.now() + 90_000;
  let lastError;
  while (Date.now() < end) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const health = await response.json();
        if (health.database?.connected) return;
        lastError = new Error(`Health reports database disconnected: ${JSON.stringify(health.database)}`);
      } else {
        lastError = new Error(`Health returned HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw lastError || new Error('Timed out waiting for API recovery');
}

async function runColdCacheCheck(baseUrl) {
  if (!externalApiUrl && apiProcess) {
    throw new Error('Cold cache check requires an externally managed API process so it can be restarted safely');
  }

  const coldSamples = [];
  const warmSamples = [];
  const engineSamples = [];
  const searchUrl = '/api/v1/shop/search?q=capacity%20office%20paper&limit=20&page=1';
  for (let sample = 0; sample < 10; sample += 1) {
    runCompose(['restart', 'capacity-api']);
    await waitForApiRecovery(baseUrl);

    const redis = new Redis(process.env.CAPACITY_REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
      await redis.flushdb();
    } finally {
      await redis.quit().catch(() => redis.disconnect());
    }

    await request(baseUrl, searchUrl, coldSamples, new Map());
    const metricsResponse = await fetch(`${baseUrl}/metrics`, { signal: AbortSignal.timeout(10_000) });
    if (!metricsResponse.ok) throw new Error(`Unable to read cold-search metrics: HTTP ${metricsResponse.status}`);
    const metricsText = await metricsResponse.text();
    const engineSum = metricsText.match(/^tranzor_shop_operation_duration_ms_sum\{operation="search\.engine_query"\}\s+([\d.eE+-]+)$/m);
    const engineCount = metricsText.match(/^tranzor_shop_operation_duration_ms_count\{operation="search\.engine_query"\}\s+([\d.eE+-]+)$/m);
    if (!engineSum || !engineCount || Number(engineCount[1]) !== 1) {
      throw new Error(`Expected one cold search-engine operation after API restart; got ${engineCount?.[1] ?? 'no metric'}`);
    }
    engineSamples.push(Number(engineSum[1]));
    await request(baseUrl, searchUrl, warmSamples, new Map());
  }

  console.log(JSON.stringify({
    phase: 'cold-cache-check',
    samples: coldSamples.length,
    coldApiCacheSearch: summary(coldSamples),
    searchEngineQuery: summary(engineSamples),
    typesenseRestarted: false,
    warmSearch: summary(warmSamples),
    coldCacheCleared: true,
    backendRestartedForEachColdSample: Boolean(externalApiUrl),
  }));
}

async function verifyListingViews(baseUrl) {
  const [fullResponse, summaryResponse] = await Promise.all([
    fetch(`${baseUrl}/api/v1/shop/products?limit=5&page=1`),
    fetch(`${baseUrl}/api/v1/shop/products?limit=5&page=1&view=summary`),
  ]);
  if (!fullResponse.ok || !summaryResponse.ok) {
    throw new Error(`Product-list view check failed: full=${fullResponse.status}, summary=${summaryResponse.status}`);
  }

  const [fullText, summaryText] = await Promise.all([fullResponse.text(), summaryResponse.text()]);
  const fullPayload = JSON.parse(fullText);
  const summaryPayload = JSON.parse(summaryText);
  if (!Array.isArray(fullPayload.products) || !Array.isArray(summaryPayload.products) || !fullPayload.products.length) {
    throw new Error('Product-list view check expected at least one product in both responses');
  }
  if (fullPayload.products.length !== summaryPayload.products.length
    || JSON.stringify(fullPayload.pagination) !== JSON.stringify(summaryPayload.pagination)) {
    throw new Error('Summary product-list view changed product count or pagination');
  }
  if (JSON.stringify(fullPayload.products.map(product => product._id))
    !== JSON.stringify(summaryPayload.products.map(product => product._id))) {
    throw new Error('Summary product-list view changed product ordering');
  }
  if (!('description' in fullPayload.products[0])) {
    throw new Error('Default product-list response no longer includes the full product fields');
  }

  const summaryProduct = summaryPayload.products[0];
  for (const field of ['_id', 'name', 'slug', 'price', 'currentPrice', 'sku']) {
    if (!(field in summaryProduct)) {
      throw new Error(`Summary product-list view omitted required UI field: ${field}`);
    }
  }
  for (const field of ['description', 'specifications', 'variants', 'volumeDiscounts', 'seo', 'dimensions']) {
    if (field in summaryProduct) {
      throw new Error(`Summary product-list view unexpectedly includes detail field: ${field}`);
    }
  }

  console.log(JSON.stringify({
    phase: 'catalog-view-check',
    products: summaryPayload.products.length,
    fullResponseBytes: Buffer.byteLength(fullText),
    summaryResponseBytes: Buffer.byteLength(summaryText),
    payloadReductionPercent: Number((100 * (1 - Buffer.byteLength(summaryText) / Buffer.byteLength(fullText))).toFixed(1)),
    paginationPreserved: true,
    summaryFieldsPreserved: true,
    detailFieldsOmitted: true,
  }));
}

async function reportShopOperationMetrics(baseUrl) {
  const response = await fetch(`${baseUrl}/metrics`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Unable to read API metrics: HTTP ${response.status}`);

  const samples = new Map();
  const routeSamples = new Map();
  const mongoSamples = new Map();
  const bucketPattern = /^tranzor_shop_operation_duration_ms_bucket\{le="([^"]+)",operation="([^"]+)"\}\s+([\d.eE+-]+)$/;
  const summaryPattern = /^tranzor_shop_operation_duration_ms_(sum|count)\{operation="([^"]+)"\}\s+([\d.eE+-]+)$/;
  const routeBucketPattern = /^tranzor_http_request_duration_ms_bucket\{le="([^"]+)",method="([^"]+)",route="([^"]+)",status_code="([^"]+)"\}\s+([\d.eE+-]+)$/;
  const routeSummaryPattern = /^tranzor_http_request_duration_ms_(sum|count)\{method="([^"]+)",route="([^"]+)",status_code="([^"]+)"\}\s+([\d.eE+-]+)$/;
  const mongoPattern = /^tranzor_mongodb_(command|pool_checkout)_duration_ms_(bucket|sum|count)\{([^}]*)\}\s+([\d.eE+-]+)$/;
  const metricsText = await response.text();
  for (const line of metricsText.split(/\r?\n/)) {
    const bucketMatch = bucketPattern.exec(line);
    if (bucketMatch) {
      const [, bucket, operation, rawValue] = bucketMatch;
      if (!samples.has(operation)) samples.set(operation, { buckets: {}, sumMs: 0, count: 0 });
      samples.get(operation).buckets[bucket] = Number(rawValue);
      continue;
    }
    const summaryMatch = summaryPattern.exec(line);
    if (!summaryMatch) continue;
    const [, kind, operation, rawValue] = summaryMatch;
    if (!samples.has(operation)) samples.set(operation, { buckets: {}, sumMs: 0, count: 0 });
    const sample = samples.get(operation);
    if (kind === 'sum') sample.sumMs = Number(rawValue);
    if (kind === 'count') sample.count = Number(rawValue);
  }

  for (const line of metricsText.split(/\r?\n/)) {
    const match = mongoPattern.exec(line);
    if (!match) continue;
    const [, metric, kind, rawLabels, rawValue] = match;
    const labels = Object.fromEntries(Array.from(rawLabels.matchAll(/(\w+)="([^"]*)"/g), label => [label[1], label[2]]));
    const key = `${metric}:${labels.command || 'pool'}:${labels.outcome}`;
    if (!mongoSamples.has(key)) mongoSamples.set(key, { buckets: {}, sumMs: 0, count: 0 });
    const sample = mongoSamples.get(key);
    const value = Number(rawValue);
    if (kind === 'bucket') sample.buckets[labels.le] = value;
    if (kind === 'sum') sample.sumMs = value;
    if (kind === 'count') sample.count = value;
  }

  for (const line of metricsText.split(/\r?\n/)) {
    const bucketMatch = routeBucketPattern.exec(line);
    if (bucketMatch) {
      const [, bucket, method, path, , rawValue] = bucketMatch;
      const route = `${method} ${path}`;
      if (!routeSamples.has(route)) routeSamples.set(route, { buckets: {}, sumMs: 0, count: 0 });
      const sample = routeSamples.get(route);
      sample.buckets[bucket] = (sample.buckets[bucket] || 0) + Number(rawValue);
      continue;
    }
    const summaryMatch = routeSummaryPattern.exec(line);
    if (!summaryMatch) continue;
    const [, kind, method, path, , rawValue] = summaryMatch;
    const route = `${method} ${path}`;
    if (!routeSamples.has(route)) routeSamples.set(route, { buckets: {}, sumMs: 0, count: 0 });
    const sample = routeSamples.get(route);
    if (kind === 'sum') sample.sumMs += Number(rawValue);
    if (kind === 'count') sample.count += Number(rawValue);
  }

  for (const sample of routeSamples.values()) {
    const sortedBuckets = Object.entries(sample.buckets)
      .map(([upperBound, count]) => ({ upperBound: Number(upperBound), count }))
      .sort((left, right) => left.upperBound - right.upperBound);
    sample.p95UpperBoundMs = sortedBuckets.find(bucket => bucket.count >= sample.count * 0.95)?.upperBound ?? null;
    sample.p99UpperBoundMs = sortedBuckets.find(bucket => bucket.count >= sample.count * 0.99)?.upperBound ?? null;
  }

  for (const sample of mongoSamples.values()) {
    const sortedBuckets = Object.entries(sample.buckets)
      .map(([upperBound, count]) => ({ upperBound: Number(upperBound), count }))
      .sort((left, right) => left.upperBound - right.upperBound);
    sample.p95UpperBoundMs = sortedBuckets.find(bucket => bucket.count >= sample.count * 0.95)?.upperBound ?? null;
    sample.p99UpperBoundMs = sortedBuckets.find(bucket => bucket.count >= sample.count * 0.99)?.upperBound ?? null;
  }
  if (!Array.from(mongoSamples.entries()).some(([key, sample]) => key.startsWith('command:') && sample.count > 0)
    || !Array.from(mongoSamples.entries()).some(([key, sample]) => key.startsWith('pool_checkout:pool:success') && sample.count > 0)) {
    const observedMetrics = metricsText.split(/\r?\n/)
      .filter(line => line.startsWith('# HELP tranzor_mongodb_') || line.startsWith('tranzor_mongodb_'))
      .join('\n');
    throw new Error(`MongoDB command or connection-pool metrics were not observed:\n${observedMetrics || 'no MongoDB metric lines were exposed'}`);
  }

  console.log(JSON.stringify({
    phase: 'shop-operation-metrics',
    operations: Object.fromEntries(samples),
    httpRoutes: Object.fromEntries(routeSamples),
    mongodb: Object.fromEntries(mongoSamples),
  }));
}

async function runDependencyFailureChecks(baseUrl) {
  const results = [];
  const probeSearch = async label => {
    const started = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/shop/search?q=absentcapacitytokenxyz&limit=10&page=1`, {
      signal: AbortSignal.timeout(15_000),
    });
    results.push({ service: label, status: response.status, elapsedMs: Date.now() - started });
    if (!response.ok) throw new Error(`${label} outage probe returned HTTP ${response.status}`);
    await response.json();
  };

  if (!externalApiUrl) {
    console.log(JSON.stringify({ phase: 'dependency-failure-checks', skipped: true, reason: 'Requires isolated Compose services' }));
    return;
  }

  runCompose(['stop', 'typesense']);
  try {
    await probeSearch('typesense');
  } finally {
    runCompose(['start', 'typesense']);
  }
  await delay(3000);

  runCompose(['stop', 'redis']);
  try {
    const samples = [];
    await request(baseUrl, '/api/v1/shop/products?limit=20&page=1', samples, new Map());
    results.push({ service: 'redis', status: 200, elapsedMs: Number(samples[0].toFixed(1)) });
  } finally {
    runCompose(['start', 'redis']);
  }
  runCompose(['restart', 'capacity-api']);
  await waitForApiRecovery(baseUrl);

  runCompose(['stop', 'mongo']);
  try {
    const response = await fetch(`${baseUrl}/api/v1/shop/products?limit=19&page=777`, {
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    results.push({ service: 'mongo', status: response?.status || 0, elapsedMs: null });
    if (response?.ok) throw new Error('MongoDB outage probe unexpectedly succeeded');
  } finally {
    runCompose(['start', 'mongo']);
  }
  await waitForApiRecovery(baseUrl);
  const recovery = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
  if (!recovery.ok) throw new Error(`API did not recover after MongoDB restart: HTTP ${recovery.status}`);
  console.log(JSON.stringify({ phase: 'dependency-failure-checks', results, mongoRecovered: true }));
}

async function main() {
  console.log(JSON.stringify({
    phase: 'capacity-test-config',
    composeProject,
    mongoCpuLimit: Number(process.env.CAPACITY_MONGO_CPUS || 1.5),
    apiCpuLimit: Number(process.env.CAPACITY_API_CPUS || 1),
    soakSeconds,
    soakUsers,
    p95TargetMs: soakP95TargetMs ?? null,
    maxErrorRatePercent: soakErrorTargetPercent ?? null,
  }));
  const source = await mongoose.createConnection(sourceUri).asPromise();
  const test = await mongoose.createConnection(testUrl.toString()).asPromise();
  testDatabaseCreated = true;
  const sourceDb = source.db;
  const testDb = test.db;

  try {
    const categoriesCopied = await copyCollection(sourceDb, testDb, 'categories');
    const productsCopied = await copyCollection(sourceDb, testDb, 'products', {
      isActive: true,
      isDeleted: { $ne: true },
    });
    await testDb.collection('products').updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } },
    );

    if (!categoriesCopied) {
      await testDb.collection('categories').insertOne({
        _id: catalogId,
        name: 'Capacity Test',
        slug: 'capacity-test',
        isActive: true,
      });
    } else {
      const firstCategory = await testDb.collection('categories').findOne({});
      catalogId = firstCategory._id;
    }

    console.log(JSON.stringify({
      phase: 'isolated-database-created',
      database: testDatabase,
      copied: { activeProducts: productsCopied, categories: categoriesCopied },
    }));

    await createIndexes(testDb);

    const initialProductCount = await testDb.collection('products').countDocuments();
    if (!externalApiUrl) {
      const childEnv = {
        ...process.env,
        PORT: '3002',
        MONGODB_URI: testUrl.toString(),
        REDIS_URL: process.env.CAPACITY_REDIS_URL,
        TYPESENSE_HOST: process.env.CAPACITY_TYPESENSE_HOST || '127.0.0.1',
        TYPESENSE_PORT: process.env.CAPACITY_TYPESENSE_PORT || '8109',
        TYPESENSE_PROTOCOL: 'http',
        TYPESENSE_API_KEY: typesenseApiKey,
        RATE_LIMIT_MAX_REQUESTS: '500000',
        RATE_LIMIT_WINDOW_MS: '900000',
        APP_SHUTDOWN_TIMEOUT_MS: '5000',
      };
      apiProcess = spawn(process.execPath, [appEntryPoint], {
        cwd: process.env.CAPACITY_APP_CWD || '/app',
        env: childEnv,
        stdio: 'ignore',
      });
      apiProcess.on('exit', (code, signal) => {
        if (!stopRequested && code !== 0) console.error(`Isolated API exited unexpectedly: code=${code}, signal=${signal}`);
      });
    }

    const baseUrl = apiBaseUrl;
    const health = await waitForApi(baseUrl);
    console.log(JSON.stringify({ phase: 'isolated-api-ready', database: health.database }));
    const reindexResult = runCompose(['exec', '-T', 'capacity-api', 'node', 'scripts/reindex-product-search.js']);
    console.log(JSON.stringify({ phase: 'source-products-indexed', result: reindexResult }));
    await verifyListingViews(baseUrl);
    let resourceSamplePending = false;
    const sampleDockerResourcesSafely = async () => {
      if (resourceSamplePending) return;
      resourceSamplePending = true;
      try {
        await sampleDockerResources();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        resourceSamplingFailures.push(message);
        console.warn(JSON.stringify({ phase: 'docker-resource-sampling-warning', error: message }));
      } finally {
        resourceSamplePending = false;
      }
    };
    await sampleDockerResourcesSafely();
    const resourceInterval = setInterval(() => {
      void sampleDockerResourcesSafely();
    }, 15_000);

    try {
    const catalogTargets = skipSyntheticProducts
      ? []
      : skipCatalogBenchmarks ? [targets[targets.length - 1]] : targets;
    for (const target of catalogTargets) {
      if (stopRequested) break;
      const current = await testDb.collection('products').countDocuments();
      if (current < target) await addSyntheticProducts(testDb, current, target);
      if (!skipCatalogBenchmarks) {
        console.log(JSON.stringify({
          phase: 'catalog-size',
          ...await benchmarkCatalog(baseUrl, target),
        }));
      }
    }

    await verifyImmediateViewCount(baseUrl);
    if (explainPlans) await reportQueryPlans(testDb);

    await runColdCacheCheck(baseUrl);
    await runDependencyFailureChecks(baseUrl);
    if (externalApiUrl) {
      runCompose(['restart', 'capacity-api']);
      await waitForApiRecovery(baseUrl);
    }

    for (const users of (skipUserRamp ? [] : userLevels)) {
      if (stopRequested) break;
      const phaseStartedAt = Date.now();
      const completedBefore = overallCounters.completed;
      const failedBefore = overallCounters.failed;
      const statusesBefore = new Map(overallCounters.statusCounts);
      const resourceStart = resourceSamples.length;
      console.log(JSON.stringify({ phase: 'user-journey', ...await runUserJourneys(baseUrl, users) }));
      console.log(JSON.stringify({
        phase: 'ramp-metrics',
        virtualUsers: users,
        ...phaseMetrics(phaseStartedAt, completedBefore, failedBefore, statusesBefore),
        resourceMetrics: summarizeResources(resourceSamples.slice(resourceStart)),
      }));
    }

    if (!stopRequested && soakSeconds > 0) {
      const phaseStartedAt = Date.now();
      const completedBefore = overallCounters.completed;
      const failedBefore = overallCounters.failed;
      const statusesBefore = new Map(overallCounters.statusCounts);
      const resourceStart = resourceSamples.length;
      console.log(JSON.stringify({
        phase: 'soak-started',
        durationSeconds: soakSeconds,
        virtualUsers: soakUsers,
        ...(soakP95TargetMs === undefined ? {} : {
          acceptanceTargets: {
            p95MsPerRoute: soakP95TargetMs,
            maxErrorRatePercent: soakErrorTargetPercent,
          },
        }),
      }));
      const soakResult = await runSoak(baseUrl);
      const soakPhaseMetrics = phaseMetrics(phaseStartedAt, completedBefore, failedBefore, statusesBefore);
      const p95ByRoute = Object.fromEntries(
        Object.entries(soakResult.latencyByRoute).map(([route, metrics]) => [route, metrics.p95Ms]),
      );
      const errorRatePercent = 100 * soakResult.failedRequests
        / Math.max(1, soakResult.requests);
      console.log(JSON.stringify({
        phase: 'soak-result',
        ...soakResult,
        ...soakPhaseMetrics,
        ...(soakP95TargetMs === undefined ? {} : {
          acceptance: {
            targets: {
              p95MsPerRoute: soakP95TargetMs,
              maxErrorRatePercent: soakErrorTargetPercent,
            },
            p95ByRoute,
            p95WithinTarget: Object.values(p95ByRoute).every(value => value <= soakP95TargetMs),
            errorRatePercent,
            errorRateWithinTarget: errorRatePercent <= soakErrorTargetPercent,
            passed: Object.values(p95ByRoute).every(value => value <= soakP95TargetMs)
              && errorRatePercent <= soakErrorTargetPercent,
          },
        }),
        resourceMetrics: summarizeResources(resourceSamples.slice(resourceStart)),
      }));
    }
    await request(baseUrl, '/api/v1/shop/products?limit=1&page=1&view=summary', [], new Map());
    await reportShopOperationMetrics(baseUrl);
    } finally {
      clearInterval(resourceInterval);
    }

    await sampleDockerResourcesSafely();
    console.log(JSON.stringify({
      phase: 'docker-resource-summary',
      samples: resourceSamples.length,
      services: summarizeResources(resourceSamples),
      samplingFailures: resourceSamplingFailures,
      complete: resourceSamplingFailures.length === 0 && resourceSamples.length > 0,
    }));
    const stats = await testDb.command({ dbStats: 1, scale: 1024 * 1024 });
    const finalProductCount = await testDb.collection('products').countDocuments();
    console.log(JSON.stringify({
      phase: 'isolated-database-size',
      products: finalProductCount,
      dataSizeMiB: Number(stats.dataSize.toFixed(1)),
      indexSizeMiB: Number(stats.indexSize.toFixed(1)),
      originalProductsCopied: productsCopied,
      syntheticProductsAdded: Math.max(0, finalProductCount - initialProductCount),
    }));
  } finally {
    if (apiProcess && apiProcess.exitCode === null) {
      apiProcess.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => apiProcess.once('exit', resolve)),
        delay(7000),
      ]);
      if (apiProcess.exitCode === null) apiProcess.kill('SIGKILL');
    }
    if (testDatabaseCreated && testDatabase.startsWith('TranzorCapacity_')) {
      await testDb.dropDatabase();
      console.log(JSON.stringify({ phase: 'isolated-database-removed', database: testDatabase }));
    }
    await test.close();
    await source.close();
  }
}

main().catch(error => {
  console.error(`Capacity load test failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
