import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';
import { getMongoUri } from './mongo';
import { monitorMongoClient } from '../utils/metrics';

const DEFAULT_RETRY_COUNT = 5;
const DEFAULT_RETRY_DELAY_MS = 3000;

let dbConnected = false;

const connectDB = async (): Promise<void> => {
	if (env.NODE_ENV === 'test') {
		logger.info('Skipping MongoDB connection in test environment');
		return;
	}

	const mongoURI = getMongoUri();
	const options = {
		maxPoolSize: 20,
		minPoolSize: 5,
		connectTimeoutMS: 30000,
		serverSelectionTimeoutMS: 30000,
		monitorCommands: true,
	};

	for (let attempt = 1; attempt <= DEFAULT_RETRY_COUNT; attempt += 1) {
		try {
			await mongoose.connect(mongoURI, options);
			monitorMongoClient(mongoose.connection.getClient());
			logger.info('MongoDB connected successfully');
			dbConnected = true;
			return;
		} catch (error) {
			logger.error(`MongoDB connection attempt ${attempt} failed`, error);
			if (attempt === DEFAULT_RETRY_COUNT) {
				logger.error('MongoDB connection failed after maximum retries');
				// In development allow the server to continue running in degraded mode
				if (env.NODE_ENV === 'development' || (env as any).DEV_ALLOW_NO_DB) {
					logger.warn('Continuing without MongoDB (degraded mode). Some features will be disabled.');
					dbConnected = false;
					return;
				}
				// In production, still fail fast
				process.exit(1);
			}
			await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS));
		}
	}
};

export function getDatabaseStatus() {
	const configured = Boolean(env.MONGODB_URI);
	return {
		configured,
		connected: configured && (dbConnected || mongoose.connection.readyState === 1),
		source: 'mongodb',
	};
}

export { dbConnected };

export default connectDB;
