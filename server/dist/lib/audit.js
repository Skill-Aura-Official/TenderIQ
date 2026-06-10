import { db } from './db.js';
import { auditLogs } from '../db/schema.js';
/**
 * Creates an immutable audit log entry in the database.
 * Should be called after every successful mutating operation (POST, PUT, PATCH, DELETE).
 */
export async function createAuditLog(request, action, resourceType, resourceId, details) {
    const user = request.authUser;
    if (!user)
        return; // Skip if no auth context (should not happen on protected routes)
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Extract IP address from request
    const ipAddress = request.headers['x-forwarded-for']
        || request.headers['x-real-ip']
        || request.ip
        || 'unknown';
    try {
        await db.insert(auditLogs).values({
            userId: user.userId,
            orgId: user.orgId,
            action,
            resourceType,
            resourceId: resourceId || null,
            details: details ? JSON.stringify(details) : null,
            ipAddress,
            timestamp: new Date(),
        });
    }
    catch (err) {
        // Audit logging should never crash the main request
        request.log.error(err, 'Failed to write audit log');
    }
}
