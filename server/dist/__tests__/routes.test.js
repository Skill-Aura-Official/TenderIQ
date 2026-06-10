import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app.js';
describe('Fastify REST API Route Integration Tests', () => {
    beforeAll(async () => {
        // Initialize database tables
        const { initDb } = await import('../lib/db.js');
        await initDb();
        // Wait for Fastify readiness
        await app.ready();
    });
    afterAll(async () => {
        await app.close();
    });
    it('GET /health returns healthy status indicator', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health'
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('healthy');
    });
    it('GET /api/v1/auth/me without token returns 401', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me'
        });
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Authentication required');
    });
});
