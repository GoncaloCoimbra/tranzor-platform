import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { app } from './server/config/app';
import { logger } from './server/config/logger';
import { disconnectPrismaClients, initializePrismaClients } from './server/config/prisma';
import { disconnectRedis } from './server/utils/cache';
import connectDB from './server/config/db';
import { initializeProductSearch } from './server/services/productSearch';

dotenv.config();

const PORT = process.env.PORT || 3001;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.APP_SHUTDOWN_TIMEOUT_MS || 10000);
let server: ReturnType<typeof app.listen> | null = null;

const shutdown = async (signal: string) => {
  try {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    if (server) {
      logger.info(`Closing HTTP server with ${SHUTDOWN_TIMEOUT_MS}ms timeout`);
      server.closeAllConnections?.();

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('HTTP server shutdown timeout reached, forcing exit');
          resolve();
        }, SHUTDOWN_TIMEOUT_MS);

        server!.close(() => {
          clearTimeout(timeout);
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');
    }

    await disconnectPrismaClients();
    logger.info('Prisma clients disconnected');

    await disconnectRedis();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Graceful shutdown error:', error);
  } finally {
    process.exit(0);
  }
};

const startServer = async () => {
  try {
    dotenv.config();
    await initializePrismaClients();
    await connectDB();
    await initializeProductSearch();

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
