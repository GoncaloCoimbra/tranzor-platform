"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
let fastify;
let stopServer;
describe('ChatOps /health', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const serverModule = await Promise.resolve().then(() => __importStar(require('../src/server')));
        fastify = serverModule.fastify;
        stopServer = serverModule.stopServer;
        await fastify.ready();
    });
    afterAll(async () => {
        if (stopServer) {
            await stopServer();
        }
    });
    it('should return health metadata including redis status', async () => {
        const res = await fastify.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('redis');
        expect(body.redis).toHaveProperty('configured');
        expect(body.redis).toHaveProperty('connected');
        expect(body.redis).toHaveProperty('source');
        expect(body).toHaveProperty('websocket');
        expect(body.websocket).toBe('enabled');
    });
});
