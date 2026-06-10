import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { clerkPlugin } from '@clerk/fastify';
import { initDb } from './lib/db.js';
import { setupWebSockets } from './lib/websocket.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import tenderRoutes from './routes/tenders.js';
import pipelineRoutes from './routes/pipeline.js';
import vaultRoutes from './routes/vault.js';
import adminRoutes from './routes/admin.js';
import scraperRoutes from './routes/scraper.js';
const app = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
// Register CORS - locked down to the specific client origin
app.register(cors, {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
});
// Register Clerk for Auth - MUST be before routes that use getAuth!
app.register(clerkPlugin);
// Register WebSocket plugin FIRST so routes can use `{ websocket: true }`
app.register(websocket);
// Register routes
setupWebSockets(app);
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(profileRoutes, { prefix: '/api/v1/users' });
app.register(tenderRoutes, { prefix: '/api/v1' });
app.register(pipelineRoutes, { prefix: '/api/v1/pipeline' });
app.register(vaultRoutes, { prefix: '/api/v1/vault' });
app.register(adminRoutes, { prefix: '/api/v1' });
app.register(scraperRoutes, { prefix: '/api/scraper' });
// Health check (public, no auth required)
app.get('/health', async () => {
    return { status: 'healthy', timestamp: Date.now() };
});
export const start = async () => {
    try {
        console.log("Initializing database tables...");
        await initDb();
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server is running on http://localhost:${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
if (process.env.NODE_ENV !== 'test') {
    start();
}
export default app;
