import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Define environment schema with validation
const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
	PORT: z.string().pipe(z.coerce.number()).default('3000'),
	MONGODB_URI: z.string().url('Invalid MongoDB URI').default('mongodb://localhost:27017/tranzor_test'),
	JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters for non-production').default('test_jwt_secret_change_me'),
	JWT_EXPIRE: z.string().default('24h'),
	JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET must be at least 10 characters for non-production').default('test_jwt_refresh_change_me'),
	JWT_REFRESH_EXPIRE: z.string().default('30d'),
	FRONTEND_URL: z.string().default('http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174'),
	BACKEND_URL: z.string().url().optional(),
	DATABASE_URL: z.string().url().optional(),
	DATABASE_URL_READ_REPLICA: z.string().url().optional().or(z.literal('')).transform((value) => value === '' ? undefined : value),
	REDIS_URL: z.string().url().optional(),
	REDIS_MAX_RETRIES: z.string().pipe(z.coerce.number()).default('5'),
	CACHE_TTL_MS: z.string().pipe(z.coerce.number()).default('300000'),
	SAFT_PRIVATE_KEY: z.string().optional(),
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.string().pipe(z.coerce.number()).optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	SMTP_FROM: z.string().email().optional(),
	EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('smtp'),
	SKIP_EMAIL_VERIFICATION: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
	LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
	CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174'),
	RATE_LIMIT_WINDOW_MS: z.string().pipe(z.coerce.number()).default('900000'),
	RATE_LIMIT_MAX_REQUESTS: z.string().pipe(z.coerce.number()).default('100'),
	AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().pipe(z.coerce.number().int().positive()).default('5'),
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	CLICKHOUSE_HTTP_URL: z.string().url().optional(),
	CLICKHOUSE_USER: z.string().optional(),
	CLICKHOUSE_PASSWORD: z.string().optional(),
	JAEGER_ENDPOINT: z.string().url().optional(),
	FIELD_ENCRYPTION_KEY: z.string().optional(),
	BULK_IMPORT_BATCH_SIZE: z.string().pipe(z.coerce.number()).default('250'),
	APP_SHUTDOWN_TIMEOUT_MS: z.string().pipe(z.coerce.number()).default('10000'),
	TENANT_BRAND_NAME: z.string().default('Tranzor'),
	TENANT_LOGO_URL: z.string().default(''),
	TENANT_CURRENCY: z.string().default('EUR'),
	TENANT_TIMEZONE: z.string().default('Europe/Lisbon'),
	PAYMENT_PROVIDER: z.enum(['stripe', 'manual']).default('stripe'),
	WEBHOOK_TARGET_URLS: z.string().default(''),
});

type Env = z.infer<typeof envSchema>;

// Validate environment variables
function validateEnv(): Env {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map(issue => 
				`${issue.path.join('.')}: ${issue.message}`
			);
			throw new Error(`Environment validation failed:\n${issues.join('\n')}`);
		}
		throw error;
	}
}

export const env = validateEnv();

// Enforce stronger secrets in production
if (env.NODE_ENV === 'production') {
	if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
		throw new Error('JWT_SECRET must be set and at least 32 characters in production');
	}
	if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 32) {
		throw new Error('JWT_REFRESH_SECRET must be set and at least 32 characters in production');
	}
}
