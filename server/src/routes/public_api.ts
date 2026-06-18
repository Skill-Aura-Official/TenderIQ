import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { apiKeys, webhookSubscriptions, tenders } from '../db/schema.js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';

// In-memory rate limits tracker for API keys
const apiRateLimits = new Map<string, { count: number; resetTime: number }>();
const LIMIT_WINDOW_MS = 60000; // 1 minute sliding window
const MAX_REQUESTS_PER_MINUTE = 60;

// API Key Authentication middleware
const authenticateApiKey = async (request: any, reply: FastifyReply) => {
  // Support both "Authorization: Bearer <key>" and "x-api-key" headers
  let apiKey = request.headers['x-api-key'] as string;
  const authHeader = request.headers['authorization'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7).trim();
  }

  if (!apiKey) {
    return reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing. Provide X-API-Key or Authorization header.'
      }
    });
  }

  // Compute SHA-256 hash of key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!keyRecord || !keyRecord.isActive) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or inactive API key.'
        }
      });
    }

    // Check expiration date
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'This API key has expired.'
        }
      });
    }

    // Assign scope details to request context
    request.orgId = keyRecord.orgId;
    request.apiKeyId = keyRecord.id;
    request.apiKeyHash = keyHash;

    // Async update lastUsedAt in database
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id))
      .catch(err => console.error('[PublicAPI] Error updating key usage timestamp:', err.message));

  } catch (err: any) {
    console.error('[PublicAPI] Auth exception:', err);
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal authorization validation failure.'
      }
    });
  }
};

// Rate-limiting middleware
const enforceRateLimiting = async (request: any, reply: FastifyReply) => {
  const hash = request.apiKeyHash;
  if (!hash) return;

  const now = Date.now();
  let record = apiRateLimits.get(hash);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + LIMIT_WINDOW_MS };
    apiRateLimits.set(hash, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, MAX_REQUESTS_PER_MINUTE - record.count);
  const resetSeconds = Math.ceil(record.resetTime / 1000);

  // Set standard headers
  reply.header('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE);
  reply.header('X-RateLimit-Remaining', remaining);
  reply.header('X-RateLimit-Reset', resetSeconds);

  if (record.count > MAX_REQUESTS_PER_MINUTE) {
    return reply.code(429).send({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Maximum allowed is ${MAX_REQUESTS_PER_MINUTE} requests per minute. Resetting at timestamp ${resetSeconds}.`
      }
    });
  }
};

export default async function publicApiRoutes(fastify: FastifyInstance) {

  // ==========================================
  // SECTION A: User portal management endpoints (requires normal Clerk login)
  // ==========================================

  /**
   * POST /api/v1/public/keys
   * Generates a new API key for the current organization
   */
  fastify.post('/keys', { preHandler: [requireAuth] }, async (request: any, reply) => {
    const user = request.authUser!;
    
    // Ensure only admins can create API keys
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return reply.code(403).send({ error: { message: 'Only organization administrators can generate API keys' } });
    }

    const { name, expiresDays } = request.body as { name?: string; expiresDays?: number };
    if (!name || name.trim() === '') {
      return reply.code(400).send({ error: { message: 'Key name is required' } });
    }

    try {
      // Generate secure high-entropy random key
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const prefix = 'tiq_live_';
      const fullKey = `${prefix}${randomSecret}`;
      
      // Hash the key for secure db storage
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
      const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

      const newKeyId = crypto.randomUUID();
      await db.insert(apiKeys).values({
        id: newKeyId,
        orgId: user.orgId,
        name: name.trim(),
        keyHash,
        prefix,
        isActive: true,
        expiresAt,
        createdAt: new Date()
      });

      // Audit Log
      await createAuditLog({
        userId: user.userId,
        orgId: user.orgId,
        action: 'create',
        resourceType: 'user', // standardizing on User/security scope
        resourceId: newKeyId,
        details: JSON.stringify({ keyName: name, expiresAt }),
        ipAddress: request.ip
      });

      // Return the plaintext key EXACTLY once
      return reply.code(201).send({
        data: {
          id: newKeyId,
          name: name.trim(),
          apiKey: fullKey, //Plaintext returned only on creation
          prefix,
          expiresAt,
          createdAt: new Date()
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/public/keys
   * Lists active metadata for all API keys in the organization
   */
  fastify.get('/keys', { preHandler: [requireAuth] }, async (request: any, reply) => {
    const user = request.authUser!;
    try {
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          isActive: apiKeys.isActive,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt
        })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, user.orgId))
        .orderBy(desc(apiKeys.createdAt));

      return reply.send({ data: keys });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * DELETE /api/v1/public/keys/:id
   * Revokes/deletes an API key
   */
  fastify.delete('/keys/:id', { preHandler: [requireAuth] }, async (request: any, reply) => {
    const user = request.authUser!;
    const { id } = request.params as { id: string };

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return reply.code(403).send({ error: { message: 'Only organization administrators can revoke API keys' } });
    }

    try {
      // Verify the key belongs to the user's organization before deletion (Level 3 protection)
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, user.orgId)))
        .limit(1);

      if (!keyRecord) {
        return reply.code(404).send({ error: { message: 'API key not found in this organization' } });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, id));

      await createAuditLog({
        userId: user.userId,
        orgId: user.orgId,
        action: 'delete',
        resourceType: 'user',
        resourceId: id,
        details: JSON.stringify({ keyName: keyRecord.name }),
        ipAddress: request.ip
      });

      return reply.send({ data: { success: true, message: 'API key successfully revoked' } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });


  // ==========================================
  // SECTION B: Secure Developer API Endpoints (authenticated via API Key)
  // ==========================================

  /**
   * GET /api/v1/public/tenders
   * Enterprise integration: returns list of tenders in the organization workspace
   */
  fastify.get('/tenders', { preHandler: [authenticateApiKey, enforceRateLimiting] }, async (request: any, reply) => {
    const orgId = request.orgId;
    const query = request.query as any;

    const limit = Math.min(100, parseInt(query.limit || '10', 10));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));
    const search = query.q as string;

    try {
      let conditions = [eq(tenders.orgId, orgId)];

      if (search && search.trim() !== '') {
        const term = `%${search.trim().toLowerCase()}%`;
        conditions.push(
          or(
            sql`lower(${tenders.title}) LIKE ${term}`,
            sql`lower(${tenders.rawText}) LIKE ${term}`,
            sql`lower(${tenders.issuingAuthority}) LIKE ${term}`
          ) as any
        );
      }

      const results = await db
        .select()
        .from(tenders)
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(tenders.createdAt));

      // Calculate total for pagination metadata
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tenders)
        .where(and(...conditions));

      const total = countResult ? Number(countResult.count) : 0;

      return reply.send({
        data: results,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    } catch (err: any) {
      console.error('[PublicAPI] GET /tenders error:', err.message);
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve tenders database records' } });
    }
  });

  /**
   * GET /api/v1/public/tenders/:id
   * Fetches specific tender details inside tenancy limits
   */
  fastify.get('/tenders/:id', { preHandler: [authenticateApiKey, enforceRateLimiting] }, async (request: any, reply) => {
    const orgId = request.orgId;
    const { id } = request.params as { id: string };

    try {
      const [tender] = await db
        .select()
        .from(tenders)
        .where(and(eq(tenders.id, id), eq(tenders.orgId, orgId)))
        .limit(1);

      if (!tender) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tender record not found in this organization context' } });
      }

      return reply.send({ data: tender });
    } catch (err: any) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve tender record' } });
    }
  });

  /**
   * POST /api/v1/public/webhooks/subscriptions
   * Registers a webhooks webhook subscription
   */
  fastify.post('/webhooks/subscriptions', { preHandler: [authenticateApiKey, enforceRateLimiting] }, async (request: any, reply) => {
    const orgId = request.orgId;
    const { url, secret, events } = request.body as { url?: string; secret?: string; events?: string[] };

    if (!url || !url.startsWith('http')) {
      return reply.code(400).send({ error: { message: 'A valid http/https destination url is required' } });
    }
    if (!secret || secret.length < 16) {
      return reply.code(400).send({ error: { message: 'A secure shared webhook secret of at least 16 characters is required' } });
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      return reply.code(400).send({ error: { message: 'At least one event subscription topic is required' } });
    }

    // Validate events list
    const ALLOWED_EVENTS = ['tender.matched', 'pipeline.stage_updated'];
    const invalidEvents = events.filter(e => !ALLOWED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return reply.code(400).send({ error: { message: `Invalid subscription topics found: ${invalidEvents.join(', ')}. Allowed topics are: ${ALLOWED_EVENTS.join(', ')}` } });
    }

    try {
      const newSubId = crypto.randomUUID();
      await db.insert(webhookSubscriptions).values({
        id: newSubId,
        orgId,
        url,
        secret,
        events: JSON.stringify(events),
        isActive: true,
        createdAt: new Date()
      });

      return reply.code(201).send({
        data: {
          id: newSubId,
          url,
          events,
          isActive: true,
          createdAt: new Date()
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/public/webhooks/subscriptions
   * Lists registered webhook subscriptions
   */
  fastify.get('/webhooks/subscriptions', { preHandler: [authenticateApiKey, enforceRateLimiting] }, async (request: any, reply) => {
    const orgId = request.orgId;
    try {
      const subs = await db
        .select()
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.orgId, orgId));

      // Parse JSON events array
      const formatted = subs.map(s => ({
        id: s.id,
        url: s.url,
        events: JSON.parse(s.events),
        isActive: s.isActive,
        createdAt: s.createdAt
      }));

      return reply.send({ data: formatted });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * DELETE /api/v1/public/webhooks/subscriptions/:id
   * Deletes a webhook subscription
   */
  fastify.delete('/webhooks/subscriptions/:id', { preHandler: [authenticateApiKey, enforceRateLimiting] }, async (request: any, reply) => {
    const orgId = request.orgId;
    const { id } = request.params as { id: string };

    try {
      const [existing] = await db
        .select()
        .from(webhookSubscriptions)
        .where(and(eq(webhookSubscriptions.id, id), eq(webhookSubscriptions.orgId, orgId)))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: { message: 'Webhook subscription not found in this organization context' } });
      }

      await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));

      return reply.send({ data: { success: true, message: 'Webhook subscription deleted successfully' } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
