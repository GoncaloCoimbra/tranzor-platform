import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import Product from '../models/Product';

const COLLECTION_NAME = 'products';
const IMPORT_BATCH_SIZE = 500;

type SearchProduct = {
	_id: { toString(): string } | string;
	name: string;
	description: string;
	category?: { toString(): string } | string | null;
	isActive?: boolean;
	isDeleted?: boolean;
	createdAt?: Date | string | number;
};

type ProductSearchDocument = {
	id: string;
	name: string;
	description: string;
	category?: string;
	isActive: boolean;
	isDeleted: boolean;
	createdAt: number;
};

type ProductSearchResult = {
	ids: string[];
	total: number;
};

let collectionReady = false;
let collectionInitialization: Promise<boolean> | undefined;

function getTypesenseClient(): AxiosInstance | null {
	const host = process.env.TYPESENSE_HOST?.trim();
	const apiKey = process.env.TYPESENSE_API_KEY?.trim();
	if (!host || !apiKey) return null;

	const protocol = process.env.TYPESENSE_PROTOCOL?.trim() || 'http';
	const port = process.env.TYPESENSE_PORT?.trim() || (protocol === 'https' ? '443' : '8108');
	return axios.create({
		baseURL: `${protocol}://${host}:${port}`,
		timeout: 5000,
		headers: { 'X-TYPESENSE-API-KEY': apiKey },
	});
}

function toSearchDocument(product: SearchProduct): ProductSearchDocument {
	const createdAt = product.createdAt ? new Date(product.createdAt).getTime() : Date.now();
	const category = product.category as (SearchProduct['category'] & { _id?: { toString(): string } }) | undefined;
	const document: ProductSearchDocument = {
		id: product._id.toString(),
		name: product.name,
		description: product.description || '',
		isActive: product.isActive !== false,
		isDeleted: product.isDeleted === true,
		createdAt: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : Math.floor(Date.now() / 1000),
	};

	if (product.category) {
		document.category = category?._id?.toString() || product.category.toString();
	}

	return document;
}

async function ensureCollection(client: AxiosInstance): Promise<boolean> {
	if (collectionReady) return false;
	if (collectionInitialization) return collectionInitialization;

	collectionInitialization = (async () => {
		try {
			await client.get(`/collections/${COLLECTION_NAME}`);
			collectionReady = true;
			return false;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status !== 404) {
				throw error;
			}
		}

		await client.post('/collections', {
			name: COLLECTION_NAME,
			fields: [
				{ name: 'name', type: 'string' },
				{ name: 'description', type: 'string' },
				{ name: 'category', type: 'string', optional: true },
				{ name: 'isActive', type: 'bool' },
				{ name: 'isDeleted', type: 'bool' },
				{ name: 'createdAt', type: 'int64' },
			],
			default_sorting_field: 'createdAt',
		});
		collectionReady = true;
		return true;
	})().finally(() => {
		collectionInitialization = undefined;
	});

	return collectionInitialization;
}

async function importDocuments(client: AxiosInstance, documents: ProductSearchDocument[]): Promise<void> {
	if (!documents.length) return;

	const response = await client.post(
		`/collections/${COLLECTION_NAME}/documents/import`,
		documents.map(document => JSON.stringify(document)).join('\n'),
		{ params: { action: 'upsert' }, headers: { 'Content-Type': 'text/plain' } },
	);
	const lines = String(response.data).trim().split('\n').filter(Boolean);
	const failures = lines
		.map(line => JSON.parse(line) as { success?: boolean; error?: string })
		.filter(result => result.success !== true);

	if (failures.length) {
		throw new Error(`Typesense failed to index ${failures.length} of ${documents.length} products: ${failures[0].error || 'unknown error'}`);
	}
}

export async function searchProducts(
	query: string,
	options: { category?: string; page: number; limit: number },
): Promise<ProductSearchResult | null> {
	const client = getTypesenseClient();
	if (!client) return null;

	try {
		const created = await ensureCollection(client);
		if (created) {
			await reindexProductsToSearch();
		}
		const filterParts = ['isActive:=true', 'isDeleted:=false'];
		if (options.category) {
			filterParts.push(`category:=${options.category}`);
		}

		const response = await client.get(`/collections/${COLLECTION_NAME}/documents/search`, {
			params: {
				q: query,
				query_by: 'name,description',
				query_by_weights: '1,1',
				page: options.page,
				per_page: options.limit,
				filter_by: filterParts.join(' && '),
			},
		});
		const hits = Array.isArray(response.data?.hits) ? response.data.hits : [];

		return {
			ids: hits.map((hit: { document?: { id?: string } }) => hit.document?.id).filter((id: unknown): id is string => typeof id === 'string'),
			total: Number(response.data?.found) || 0,
		};
	} catch (error) {
		collectionReady = false;
		logger.warn('Typesense search failed; falling back to MongoDB text search', {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function syncProductsToSearch(products: SearchProduct[]): Promise<boolean> {
	const client = getTypesenseClient();
	if (!client) return false;

	try {
		await ensureCollection(client);
		for (let offset = 0; offset < products.length; offset += IMPORT_BATCH_SIZE) {
			await importDocuments(client, products.slice(offset, offset + IMPORT_BATCH_SIZE).map(toSearchDocument));
		}
		return true;
	} catch (error) {
		logger.warn('Typesense product indexing failed; MongoDB remains the source of truth', {
			error: error instanceof Error ? error.message : String(error),
			products: products.length,
		});
		return false;
	}
}

export async function removeProductFromSearch(productId: string): Promise<boolean> {
	const client = getTypesenseClient();
	if (!client) return false;

	try {
		await ensureCollection(client);
		await client.delete(`/collections/${COLLECTION_NAME}/documents/${encodeURIComponent(productId)}`);
		return true;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404) return true;
		logger.warn('Typesense product removal failed; MongoDB remains the source of truth', {
			error: error instanceof Error ? error.message : String(error),
			productId,
		});
		return false;
	}
}

export async function reindexProductsToSearch(): Promise<number> {
	const client = getTypesenseClient();
	if (!client) {
		throw new Error('TYPESENSE_HOST and TYPESENSE_API_KEY are required to reindex products');
	}

	await ensureCollection(client);
	const cursor = Product.find()
		.select('_id name description category isActive isDeleted createdAt')
		.lean()
		.cursor();
	let batch: SearchProduct[] = [];
	let indexed = 0;

	try {
		for await (const product of cursor) {
			batch.push(product as SearchProduct);
			if (batch.length === IMPORT_BATCH_SIZE) {
				await importDocuments(client, batch.map(toSearchDocument));
				indexed += batch.length;
				batch = [];
			}
		}

		if (batch.length) {
			await importDocuments(client, batch.map(toSearchDocument));
			indexed += batch.length;
		}
	} finally {
		await cursor.close();
	}

	return indexed;
}

export async function initializeProductSearch(): Promise<void> {
	const client = getTypesenseClient();
	if (!client) {
		logger.warn('Typesense is not configured; product search will use MongoDB');
		return;
	}

	try {
		const collectionCreated = await ensureCollection(client);
		if (collectionCreated) {
			const indexed = await reindexProductsToSearch();
			logger.info('Initialized Typesense product index', { indexed });
		}
	} catch (error) {
		collectionReady = false;
		logger.warn('Typesense initialization failed; product search will use MongoDB', {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
