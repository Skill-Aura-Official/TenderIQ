import { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from '@clerk/fastify';
import { db } from './db.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Type for the authenticated user context attached to the request
export interface AuthUser {
  userId: string;       // Our internal user ID
  clerkId: string;      // Clerk's user ID
  email: string;
  role: 'admin' | 'tender_manager' | 'contributor' | 'viewer';
  orgId: string;
}

// Extend Fastify request to include our auth context
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/**
 * Pre-handler hook: Uses Clerk's getAuth() to verify the session JWT,
 * looks up the user in our database, and attaches the AuthUser to the request.
 * Rejects with 401 if unauthenticated.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    // getAuth() automatically verifies the JWT via the clerkPlugin registered on the app
    const auth = getAuth(request);

    if (!auth.userId) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const clerkUserId = auth.userId;

    // Look up the user in our database
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return reply.code(403).send({ error: { code: 'USER_NOT_FOUND', message: 'User not registered in TenderIQ. Please complete onboarding.' } });
    }

    // Attach the authenticated user context to the request
    request.authUser = {
      userId: user.id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role as AuthUser['role'],
      orgId: user.orgId,
    };
  } catch (err: any) {
    request.log.error(err, 'Authentication error');
    return reply.code(500).send({ error: { code: 'AUTH_ERROR', message: 'Authentication service error' } });
  }
}

/**
 * Pre-handler hook factory: Checks if the authenticated user has one of the
 * allowed roles. Must be used AFTER requireAuth.
 * Rejects with 403 if the user's role is not in the allowed list.
 */
export function requireRole(allowedRoles: AuthUser['role'][]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.authUser;
    if (!user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${user.role}`
        }
      });
    }
  };
}
