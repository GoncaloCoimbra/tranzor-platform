import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';
import { getMongoUri } from './mongo';
import { monitorMongoClient } from '../utils/metrics';

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
		connectTimeoutMS: 5000,
		serverSelectionTimeoutMS: 5000,
		monitorCommands: true,
	};

	try {
		await mongoose.connect(mongoURI, options);
		const database = mongoose.connection.db;
		if (!database) throw new Error('MongoDB connection did not expose a database handle');
		await database.admin().ping();
		monitorMongoClient(mongoose.connection.getClient());
		logger.info('MongoDB connected successfully');
		dbConnected = true;
	} catch (error) {
		dbConnected = false;
		throw error;
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
