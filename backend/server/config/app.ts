import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from '../routes/auth';
import productsRoutes from '../routes/products';
import shopRoutes from '../routes/shop';
import { loggerMiddleware } from '../middleware/logger';
import { createAuthRateLimiter } from '../middleware/rateLimiter';
import cartRoutes from '../routes/cart';
import accountRoutes from '../routes/account';
import adminRoutes from '../routes/admin';
import b2bRoutes from '../routes/b2b';
import analyticsRoutes from '../routes/analytics';
import ordersRoutes, { handleStripeWebhook } from '../routes/orders';
import importRoutes from '../routes/imports';
import { authenticate } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { env } from './env';
import { getAllowedOrigins } from './cors';
// logger intentionally not imported here to avoid unused variable in this module
import { requestIdMiddleware } from '../utils/handlers';
import client from 'prom-client';
import { getMatchedRoute, getMetricsSnapshot, metricsMiddleware } from '../utils/metrics';
import { getCacheStatus } from '../utils/cache';
import { getDatabaseStatus } from './db';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../docs/swagger';
import feedsRoutes from '../routes/feeds';
import tenantRoutes from '../routes/tenant';
import wmsRoutes from '../routes/wms';

const allowDegradedMode = process.env.ALLOW_DEGRADED_MODE === 'true' || process.env.NODE_ENV === 'development';

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// Request middleware
app.use(compression());
app.use(cookieParser());
app.post('/api/v1/orders/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestIdMiddleware);
app.use(loggerMiddleware);
app.use(metricsMiddleware);

// Security middleware
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'"],
			imgSrc: ["'self'", "data:", "https:"],
		},
	},
}));
app.use(cors({
	origin: (origin, callback) => {
		const allowedOrigins = getAllowedOrigins(env.FRONTEND_URL, process.env.CORS_ORIGIN);
		if (!origin || allowedOrigins.includes(origin)) {
			callback(null, true);
			return;
		}
		callback(new Error(`Origin not allowed by CORS: ${origin}`));
	},
	credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX_REQUESTS,
	message: {
		success: false,
		error: 'Muitas tentativas. Tente novamente mais tarde.'
	}
});
app.use('/api/', limiter);

if (env.NODE_ENV !== 'test') {
	const authLimiter = createAuthRateLimiter();
	app.use('/api/v1/auth/login', authLimiter);
	app.use('/api/v1/auth/register', authLimiter);
}

// Logging
app.use(morgan('combined'));

// Prometheus instrumentation
client.collectDefaultMetrics();

const httpRequestTotal = new client.Counter({
  name: 'tranzor_http_requests_total',
  help: 'Number of HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationMs = new client.Histogram({
  name: 'tranzor_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [50, 100, 200, 300, 500, 1000, 2000, 5000, 10000],
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const route = getMatchedRoute(req);
    const statusCode = String(res.statusCode);

    httpRequestTotal.inc({ method: req.method, route, status_code: statusCode }, 1);
    httpRequestDurationMs.observe({ method: req.method, route, status_code: statusCode }, durationMs);
  });
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/shop', shopRoutes);
app.use('/api/v1/cart', authenticate, cartRoutes);
app.use('/api/v1/account', authenticate, accountRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1', importRoutes);
app.use('/api/v1/admin', authenticate, adminRoutes);
app.use('/api/v1/b2b', b2bRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/feeds', feedsRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/wms', wmsRoutes);
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', async (req, res) => {
	const redis = await getCacheStatus();
	const database = getDatabaseStatus();

	res.json({
		ok: true,
		status: 'ready',
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || 'development',
		database,
		redis,
		degradedMode: allowDegradedMode,
	});
});

app.get('/readyz', async (req, res) => {
	const redis = await getCacheStatus();
	const database = getDatabaseStatus();

	res.json({
		ok: true,
		status: 'ready',
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || 'development',
		database,
		redis,
		degradedMode: allowDegradedMode,
	});
});

app.get('/livez', async (req, res) => {
	res.json({
		ok: true,
		status: 'alive',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

app.get('/api/v1/health', async (req, res) => {
	const redis = await getCacheStatus();
	const database = getDatabaseStatus();

	res.json({
		ok: true,
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || 'development',
		database,
		redis,
		degradedMode: allowDegradedMode,
	});
});

app.get('/metrics', async (req, res) => {
	res.set('Content-Type', client.register.contentType);
	res.send(await client.register.metrics());
});

app.get('/api/v1/metrics', (req, res) => {
	res.json({
		success: true,
		metrics: getMetricsSnapshot(),
	});
});

// API documentation
app.get('/api', (req, res) => {
	res.json({
		name: 'Tranzor.pt API',
		version: '1.0.0',
		description: 'API para e-commerce de materiais de construção',
		endpoints: {
			auth: '/api/v1/auth',
			shop: '/api/v1/shop',
			cart: '/api/v1/cart (requires auth)',
			account: '/api/v1/account (requires auth)',
			admin: '/api/v1/admin (requires admin role)'
		}
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		error: 'Rota não encontrada',
		path: req.originalUrl,
		method: req.method
	});
});

// Global error handler (MUST be last middleware)
app.use(errorHandler);

export { app };
