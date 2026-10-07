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
describe('ChatOps observability endpoints', () => {
    let fastify;
    let stopServer;
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
    it('returns readiness and runtime health details', async () => {
        const res = await fastify.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('status', 'ready');
        expect(body).toHaveProperty('uptimeSeconds');
        expect(body).toHaveProperty('metrics');
        expect(body.metrics).toHaveProperty('activeConnections');
        expect(body.metrics).toHaveProperty('activeChannels');
    });
    it('exposes a metrics endpoint with counters', async () => {
        const res = await fastify.inject({ method: 'GET', url: '/metrics' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body).toHaveProperty('counters');
        expect(body.counters).toHaveProperty('httpRequests');
        expect(body.counters).toHaveProperty('websocketConnections');
        expect(body.counters).toHaveProperty('commandsExecuted');
    });
    it('exposes readiness and liveness endpoints for operational probes', async () => {
        const readyRes = await fastify.inject({ method: 'GET', url: '/readyz' });
        expect(readyRes.statusCode).toBe(200);
        const liveRes = await fastify.inject({ method: 'GET', url: '/livez' });
        expect(liveRes.statusCode).toBe(200);
        const readyBody = JSON.parse(readyRes.payload);
        expect(readyBody).toHaveProperty('ok', true);
        expect(readyBody).toHaveProperty('status', 'ready');
    });
});
