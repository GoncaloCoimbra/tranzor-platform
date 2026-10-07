import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { LogisticsRedisSubscriber } from './integration/redis-subscriber';
import { verifyStartupDependencies } from './common/startup-dependencies';
import { PrismaService } from './database/prisma.service';
const helmet = require('helmet');

// SERIALIZATION FIX (BigInt/Date)

(BigInt.prototype as any).toJSON = function () {
  const int = Number(this.toString());
  return int > Number.MAX_SAFE_INTEGER ? this.toString() : int;
};

(Date.prototype as any).toJSON = function () {
  return this.toISOString();
};

export async function createApp(): Promise<NestExpressApplication> {
  const logger = new Logger('Bootstrap');

  // CREATE NEST APPLICATION
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // GLOBAL PREFIX (/api) com exclusão do health check raiz

  app.setGlobalPrefix('api', { exclude: ['health', 'readyz', 'livez'] });
  logger.log('📌 Prefixo global configurado: /api (exclui /health)');

  // VALIDATION PIPE

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  logger.log(' Validation Pipe configurado');

  // CORS CONFIGURATION

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';

  app.enableCors({
    origin: [
      corsOrigin,
      'http://localhost:3000',
      'http://localhost:5173', // Vite
      'http://localhost:3001', // Create React App
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });
  logger.log('🌐 CORS enabled for:', corsOrigin);

  // SECURITY HEADERS (Helmet)

  app.use(helmet());
  logger.log('🔒 Security headers configured with Helmet');

  // ADDITIONAL SECURITY HEADERS

  app.use((req, res, next) => {
    // X-Content-Type-Options: Prevents MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // X-Frame-Options: Prevents clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // X-XSS-Protection: Enables XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Strict-Transport-Security: Enforces HTTPS
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    // Content-Security-Policy: Restricts resource loading
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    );
    // Remove X-Powered-By header to prevent fingerprinting
    res.removeHeader('X-Powered-By');
    next();
  });
  logger.log('🔐 Additional security headers configured');

  // SWAGGER / OPENAPI DOCUMENTATION
  const config = new DocumentBuilder()
    .setTitle('Logistics Multi-Tenant API')
    .setDescription(
      'Complete API documentation for multi-tenant logistics management',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
      'tenant-id',
    )
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management')
    .addTag('Products', 'Product management')
    .addTag('Vehicles', 'Vehicle management')
    .addTag('Transports', 'Transport management')
    .addTag('Companies', 'Company management')
    .addTag('Audit', 'Logs de auditoria')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  logger.log('📖 Swagger/OpenAPI available at: /api/docs');

  // STATIC ASSETS (Uploads)

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  logger.log('📁 Pasta de uploads configurada: /uploads/');

  // INITIALIZATION LOGS (just information — `listen` is controlled by the caller)
  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log('✅ NestJS application ready (no listener).');
  logger.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return app;
}

// Only start the server when not in test environment, unless forced for smoke validation.
if (process.env.NODE_ENV !== 'test' || process.env.FORCE_START === 'true') {
  (async () => {
    const logger = new Logger('Bootstrap');
    try {
      const app = await createApp();
      await app.init();
      const redisSubscriber = new LogisticsRedisSubscriber(app.get(PrismaService));
      await verifyStartupDependencies(
        [{ name: 'Redis', check: () => redisSubscriber.start() }],
        {
          onAttemptFailure: (name, attempt, error) => logger.error(
            `Startup dependency ${name} attempt ${attempt} failed`,
            error instanceof Error ? error.stack : String(error),
          ),
          onDegraded: (name, error) => logger.warn(
            `ALLOW_DEGRADED=true: continuing without ${name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        },
      );
      const port = process.env.PORT || 3000;
      await app.listen(port);
    } catch (error) {
      logger.error(
        'Application startup failed; exiting with status 1',
        error instanceof Error ? error.stack : String(error),
      );
      process.exit(1);
    }
  })();
}
