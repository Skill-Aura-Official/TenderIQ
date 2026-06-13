import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { companyProfiles, userTenderScores } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';

export default async function profileRoutes(fastify: FastifyInstance) {

  // All profile routes require authentication
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /api/v1/users/me/profile
   * Returns the company profile for the authenticated user.
   */
  fastify.get('/me/profile', async (request, reply) => {
    const user = request.authUser!;

    try {
      const [profile] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.userId, user.userId));

      if (!profile) {
        return reply.code(404).send({ error: { code: 'PROFILE_NOT_FOUND', message: 'No profile found' } });
      }

      return reply.send({
        data: profile
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/users/me/profile
   * Create or update the company profile for the authenticated user.
   */
  fastify.post('/me/profile', async (request, reply) => {
    const user = request.authUser!;
    const body = request.body as any;

    try {
      const existing = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.userId, user.userId));

      const payload = {
        companyName: body.companyName,
        gstNumber: body.gstNumber || null,
        panNumber: body.panNumber || null,
        msmeRegistered: !!body.msmeRegistered,
        incorporationYear: body.incorporationYear ? parseInt(body.incorporationYear, 10) : null,
        operatingStates: Array.isArray(body.operatingStates) ? body.operatingStates : [],
        servicesKeywords: Array.isArray(body.servicesKeywords) ? body.servicesKeywords.map((s: string) => s.toLowerCase()) : [],
        pastClientTypes: Array.isArray(body.pastClientTypes) ? body.pastClientTypes : [],
        maxTenderCapacity: body.maxTenderCapacity ? body.maxTenderCapacity.toString() : '0',
        certifications: Array.isArray(body.certifications) ? body.certifications : [],
        scoringVersion: existing.length > 0 ? (existing[0].scoringVersion + 1) : 1,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        const [updatedProfile] = await db.update(companyProfiles)
          .set(payload)
          .where(eq(companyProfiles.userId, user.userId))
          .returning();

        if (updatedProfile) {
          await createAuditLog(request, 'update', 'profile', updatedProfile.id);
        }
      } else {
        const [newProfile] = await db.insert(companyProfiles).values({
          userId: user.userId,
          orgId: user.orgId,
          ...payload,
        }).returning();

        if (newProfile) {
           await createAuditLog(request, 'create', 'profile', newProfile.id);
        }
      }

      return reply.send({
        data: {
          success: true,
          message: 'Profile updated successfully.',
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/users/me/score-status
   * Returns the scoring status for the authenticated user.
   */
  fastify.get('/me/score-status', async (request, reply) => {
    const user = request.authUser!;
    try {
      const [profile] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.userId, user.userId));
        
      if (!profile) {
        return reply.send({ data: { status: 'pending', completedAt: null } });
      }
      
      const [latestScore] = await db.select().from(userTenderScores)
        .where(eq(userTenderScores.userId, user.userId))
        .orderBy(desc(userTenderScores.scoredAt))
        .limit(1);
        
      const isStale = !latestScore || latestScore.profileVersion < profile.scoringVersion;
      
      return reply.send({
        data: {
          status: isStale ? 'processing' : 'completed',
          completedAt: latestScore?.scoredAt || null,
          profileVersion: profile.scoringVersion,
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
