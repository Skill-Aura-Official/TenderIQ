import { FastifyRequest, FastifyReply } from 'fastify';

// In-memory request tracker
const rateLimits = new Map<string, { count: number; resetTime: number }>();
// Global IP block list (banned scanning hosts)
export const blockedIPs = new Set<string>();

/**
 * Fastify preHandler hook factory for sliding window rate limiting.
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Get client IP address supporting Cloud Run load balancers
    const ip = (request.headers['x-forwarded-for'] as string || request.ip || 'unknown').split(',')[0].trim();

    // Check if IP is globally blocked (banned due to scanner alerts)
    if (blockedIPs.has(ip)) {
      return reply.code(403).send({ 
        error: { 
          code: 'IP_BLOCKED', 
          message: 'Your IP has been permanently or temporarily blocked due to security alerts.' 
        } 
      });
    }

    const key = `${ip}:${(request as any).routerPath || request.url}`;
    const now = Date.now();
    const record = rateLimits.get(key);

    if (!record) {
      rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return;
    }

    // Window expired, reset counter
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return;
    }

    // Increment and check limits
    record.count++;
    if (record.count > maxRequests) {
      return reply.code(429).send({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit exceeded. Allowed: ${maxRequests} requests per ${windowMs / 1000}s. Please retry later.`
        }
      });
    }
  };
}
