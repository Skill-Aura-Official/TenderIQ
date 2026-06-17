import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { users, organizations } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/auth/sync
   * Called by the client after a successful Clerk login/signup.
   * Syncs the Clerk user into our local database if they don't exist yet.
   * This is the ONLY way users are created in TenderIQ.
   */
  fastify.post('/sync', { preHandler: [requireAuth] }, async (request, reply) => {
    const authUser = request.authUser!;

    // User already exists in our DB (requireAuth found them), just return their info
    const [existingUser] = await db.select().from(users).where(eq(users.id, authUser.userId));

    if (existingUser) {
      return reply.send({
        data: {
          user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            orgId: existingUser.orgId,
          },
          isNewUser: false,
        }
      });
    }

    // This path should not normally be hit since requireAuth would have returned 403.
    // But as a safety net, return appropriate error.
    return reply.code(403).send({
      error: { code: 'NOT_ONBOARDED', message: 'User has not completed onboarding.' }
    });
  });

  /**
   * POST /api/v1/auth/onboard
   * Called during the first-time setup after Clerk sign-up.
   * Creates the user record and optionally creates a new organization.
   * This endpoint verifies the Clerk JWT but does NOT require an existing DB user.
   */
  fastify.post('/onboard', async (request, reply) => {
    // Use getAuth() from Clerk plugin to verify the JWT
    const { getAuth } = await import('@clerk/fastify');
    const auth = getAuth(request);

    if (!auth.userId) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const clerkUserId = auth.userId;

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
    if (existingUser) {
      return reply.code(400).send({ error: { code: 'ALREADY_ONBOARDED', message: 'User already exists' } });
    }

    const { email, orgName, orgId: existingOrgId } = request.body as {
      email: string;
      orgName?: string;
      orgId?: string;
    };

    if (!email) {
      return reply.code(400).send({ error: { message: 'email is required' } });
    }

    try {
      let orgId: string;

      if (existingOrgId) {
        // Joining an existing organization
        const [org] = await db.select().from(organizations).where(eq(organizations.id, existingOrgId));
        if (!org) {
          return reply.code(404).send({ error: { message: 'Organization not found' } });
        }
        orgId = existingOrgId;
      } else if (orgName) {
        // Creating a new organization - this user becomes admin
        const [org] = await db.insert(organizations).values({
          name: orgName,
          createdAt: new Date(),
        }).returning();
        orgId = org.id;
      } else {
        return reply.code(400).send({ error: { message: 'Either orgName (to create) or orgId (to join) is required' } });
      }

      // Determine role: if joining an existing organization, they are a viewer. If creating a new one, they are admin.
      const role = existingOrgId ? 'viewer' : 'admin';
      const userId = `user_${new Date()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.insert(users).values({
        id: userId,
        clerkId: clerkUserId,
        email,
        role,
        orgId,
        createdAt: new Date(),
      });

      // Log the onboarding
      request.authUser = { userId, clerkId: clerkUserId, email, role: role as any, orgId, subscriptionTier: 'free' };
      await createAuditLog(request, 'create', 'user', userId, { onboarding: true, role });

      return reply.code(201).send({
        data: {
          user: { userId, email, role, orgId },
          isNewUser: true,
        }
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/auth/me
   * Returns the currently authenticated user's info.
   */
  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.authUser!;
    return reply.send({
      data: {
        userId: user.userId,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
      }
    });
  });
}
