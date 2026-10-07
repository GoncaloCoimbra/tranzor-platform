/// <reference types="jest" />
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import request from 'supertest';

const mockUsers: Record<string, any> = {};
const mockUsersById: Record<string, any> = {};

function queryMatches(user: any, query: any) {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && '$gt' in value) {
      return user[key] && user[key] > (value as any).$gt;
    }
    return user[key] === value;
  });
}

class MockUser {
  public _id?: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: string;
  public isActive = true;
  public emailVerified = false;
  public loyaltyPoints = 0;
  public lastLogin?: Date;
  public emailVerificationToken?: string;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;

  constructor(data: any) {
    Object.assign(this, data);
  }

  static findOne(query: any) {
    const foundUser = Object.values(mockUsers).find((user) => queryMatches(user, query));
    const result = foundUser ? new MockUser(foundUser) : null;
    const promise = Promise.resolve(result);

    return {
      select: (_field: string) => promise,
      then: (onFulfilled: any, onRejected: any) => promise.then(onFulfilled, onRejected),
      catch: (onRejected: any) => promise.catch(onRejected),
    } as any;
  }

  static async findById(id: string) {
    const user = mockUsersById[id];
    if (!user) return null;
    return new MockUser(user);
  }

  select(_field: string) {
    return this;
  }

  async comparePassword(candidatePassword: string) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  async save() {
    if (!this._id) {
      this._id = `mock-${Date.now()}-${Math.random()}`;
    }
    mockUsers[this.email] = { ...this, _id: this._id };
    mockUsersById[this._id] = { ...this, _id: this._id };
    return this;
  }
}

jest.mock('../server/models/User', () => ({
  __esModule: true,
  default: MockUser,
}));

jest.mock('../server/services/emailService', () => ({
  sendEmail: jest.fn(async () => undefined),
}));

const sampleProducts = [
  {
    id: 'prod-1',
    sku: 'LAP123',
    name: 'Laptop',
    description: 'High-end laptop',
    price: 1200,
    cost: 800,
    stock: 10,
    categoryId: 'cat-1',
    slug: 'laptop',
    status: 'ACTIVE',
    images: [],
    category: { id: 'cat-1', name: 'Electronics' },
    _count: { reviews: 0, orderItems: 0 },
  },
];

jest.mock('../server/config/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(async ({ skip = 0, take = 20 }) => sampleProducts.slice(skip, skip + take)),
      count: jest.fn(async () => sampleProducts.length),
      findUnique: jest.fn(async ({ where }: any) => sampleProducts.find((product) => product.id === where.id) || null),
      create: jest.fn(async ({ data }: any) => ({ id: 'prod-new', ...data, category: { id: data.categoryId, name: 'Category' } })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
    },
  },
}));

import { app } from '../server/config/app';

const server = app;

describe('Authentication Controller', () => {

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: `test${Date.now()}@example.com`,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          name: 'John Doe',
          agreeTerms: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    it('should accept registration with a plus-addressed email', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: `plus+${Date.now()}@example.com`,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          name: 'John Doe',
          agreeTerms: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          name: 'John Doe',
          agreeTerms: true,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          confirmPassword: 'weak',
          name: 'John Doe',
          agreeTerms: true,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const email = `duplicate${Date.now()}@example.com`;

      // First registration
      await request(server)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          name: 'John Doe',
          agreeTerms: true,
        });

      // Try duplicate
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          name: 'John Doe',
          agreeTerms: true,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.statusCode).toBe(409);
      expect(response.body.error.message).toContain('Email já registado');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testEmail: string;
    let testPassword = 'TestPassword123!';

    beforeAll(async () => {
      testEmail = `login-test${Date.now()}@example.com`;
      await request(server)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          name: 'Test User',
          agreeTerms: true,
        });
    });

    it('should login with correct credentials', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testEmail);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message || response.body.message).toContain('Credenciais inválidas');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message || response.body.message).toContain('Credenciais inválidas');
    });

    it('should reject an existing session when its account is deactivated', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      const setCookie = login.headers['set-cookie'];
      const tokenCookie = Array.isArray(setCookie)
        ? setCookie.find((cookie: string) => cookie.startsWith('token='))
        : setCookie;
      expect(login.status).toBe(200);
      expect(tokenCookie).toBeDefined();
      if (!tokenCookie) throw new Error('Login did not issue a session cookie');

      const account = mockUsers[testEmail];
      const accountId = account._id as string;
      const previousActiveState = account.isActive;
      mockUsers[testEmail].isActive = false;
      mockUsersById[accountId].isActive = false;
      try {
        const response = await request(server)
          .get('/api/v1/auth/me')
          .set('Cookie', tokenCookie.split(';')[0]);

        expect(response.status).toBe(401);
        expect(response.body.error.message || response.body.message).toContain('Conta desativada');
        expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
          expect.stringContaining('token=;'),
        ]));
      } finally {
        mockUsers[testEmail].isActive = previousActiveState;
        mockUsersById[accountId].isActive = previousActiveState;
      }
    });
  });
});

describe('Products Controller', () => {
  describe('GET /api/v1/products', () => {
    it('should fetch all products with pagination', async () => {
      const response = await request(server)
        .get('/api/v1/products')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter products by search term', async () => {
      const response = await request(server)
        .get('/api/v1/products')
        .query({ search: 'laptop' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter products by price range', async () => {
      const response = await request(server)
        .get('/api/v1/products')
        .query({ minPrice: 100, maxPrice: 500 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Error Handling', () => {
  it('should return 404 for non-existent routes', async () => {
    const response = await request(server)
      .get('/api/v1/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return proper error for unauthorized requests', async () => {
    const response = await request(server)
      .post('/api/v1/products')
      .send({ name: 'Test Product' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });
});
