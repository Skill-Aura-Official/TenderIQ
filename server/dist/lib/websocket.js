import { verifyToken } from '@clerk/backend';
import { db } from './db.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
// Store active connections grouped by orgId
// Structure: Map<orgId, Set<WebSocket>>
const activeConnections = new Map();
export function setupWebSockets(app) {
    // In @fastify/websocket v11, the handler receives the raw WebSocket object directly as the first argument
    app.get('/api/v1/ws', { websocket: true }, async (ws, req) => {
        try {
            // Authenticate the WebSocket connection using the Clerk session token
            let token = undefined;
            if (req.query && typeof req.query === 'object') {
                token = req.query.token;
            }
            if (!token && req.url) {
                try {
                    const parsedUrl = new URL(req.url, 'http://localhost');
                    token = parsedUrl.searchParams.get('token') || undefined;
                }
                catch (_) { }
            }
            if (!token) {
                ws.close(1008, 'Token required');
                return;
            }
            // We need CLERK_SECRET_KEY in environment for verifyToken to work without network, 
            // or it will fetch JWKS if possible.
            const verifiedToken = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });
            const clerkUserId = verifiedToken.sub;
            if (!clerkUserId) {
                ws.close(1008, 'Unauthorized');
                return;
            }
            const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
            if (!user) {
                ws.close(1008, 'User not found');
                return;
            }
            const orgId = user.orgId;
            // Add connection to the organization's pool
            if (!activeConnections.has(orgId)) {
                activeConnections.set(orgId, new Set());
            }
            activeConnections.get(orgId).add(ws);
            // Handle disconnection
            ws.on('close', () => {
                const orgConnections = activeConnections.get(orgId);
                if (orgConnections) {
                    orgConnections.delete(ws);
                    if (orgConnections.size === 0) {
                        activeConnections.delete(orgId);
                    }
                }
            });
            // Send a welcome/connection-success message
            ws.send(JSON.stringify({ type: 'connected', orgId }));
        }
        catch (err) {
            req.log.error(err, 'WebSocket connection error');
            try {
                ws.close(1011, 'Internal Server Error');
            }
            catch (_) { }
        }
    });
}
/**
 * Broadcast an event to all connected clients in a specific organization.
 * @param orgId The organization ID to broadcast to
 * @param eventType The type of event (e.g., 'tender_created', 'pipeline_updated')
 * @param payload The data associated with the event
 */
export function broadcastToOrg(orgId, eventType, payload = {}) {
    const orgConnections = activeConnections.get(orgId);
    if (!orgConnections)
        return; // No active connections for this org
    const message = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
    orgConnections.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}
