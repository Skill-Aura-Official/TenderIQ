import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { partners, organizations, users, auditLogs } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import crypto from 'crypto';

export default async function partnerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Helper preHandler to ensure the user is an admin of an organization linked to a reseller partner
  const requirePartnerAdmin = async (request: any, reply: any) => {
    const user = request.authUser!;
    if (user.role !== 'admin') {
      return reply.code(403).send({ error: { message: 'Only Partner Administrators can access this route' } });
    }

    // Check if the user's organization has a partnerId
    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId)).limit(1);
    if (!org || !org.partnerId) {
      return reply.code(403).send({ error: { message: 'Organization is not enrolled in the Reseller Partner program' } });
    }

    request.partnerId = org.partnerId;
  };

  /**
   * GET /api/v1/partner/dashboard
   * Metrics: Total client orgs, active users, MRR, reseller commission
   */
  fastify.get('/dashboard', { preHandler: [requirePartnerAdmin] }, async (request: any, reply) => {
    const partnerId = request.partnerId;

    try {
      // Fetch partner info
      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
      if (!partner) {
        return reply.code(404).send({ error: { message: 'Partner details not found' } });
      }

      // Count clients/sub-organizations under this partner
      const clients = await db.select().from(organizations).where(eq(organizations.partnerId, partnerId));
      const clientCount = clients.length;

      // Count total users under all these client organizations
      let userCount = 0;
      if (clientCount > 0) {
        const clientOrgIds = clients.map(c => c.id);
        const subUsers = await db.select().from(users).where(sql`${users.orgId} IN (${sql.join(clientOrgIds, sql`, `)})`);
        userCount = subUsers.length;
      }

      // Generate MRR and commission based on the number of client orgs for reporting
      const simulatedMrr = clientCount * 4999; // assuming ₹4,999 average per client
      const commissionPercent = partner.revenueSharePercent || 20;
      const simulatedCommission = (simulatedMrr * commissionPercent) / 100;

      return reply.send({
        data: {
          partnerName: partner.name,
          domain: partner.domain,
          branding: partner.brandingConfig ? JSON.parse(partner.brandingConfig) : null,
          clientsCount: clientCount,
          activeUsersCount: userCount,
          mrrGenerated: simulatedMrr,
          commissionEarned: simulatedCommission,
          revenueSharePercent: commissionPercent
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * PATCH /api/v1/partner/branding
   * Update white-label settings (colors, logo, custom domain)
   */
  fastify.patch('/branding', { preHandler: [requirePartnerAdmin] }, async (request: any, reply) => {
    const partnerId = request.partnerId;
    const user = request.authUser!;
    const { brandingConfig, domain } = request.body as any;

    try {
      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
      if (!partner) {
        return reply.code(404).send({ error: { message: 'Partner not found' } });
      }

      const updates: any = {};
      if (brandingConfig !== undefined) {
        updates.brandingConfig = JSON.stringify(brandingConfig);
      }
      if (domain !== undefined) {
        updates.domain = domain;
      }

      await db.update(partners).set(updates).where(eq(partners.id, partnerId));

      // Log audit log
      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: user.orgId,
        action: 'update',
        resourceType: 'user', // representing partner configuration
        resourceId: partnerId,
        details: JSON.stringify({ updatedDomain: domain, branding: brandingConfig }),
        ipAddress: request.ip
      });

      return reply.send({ data: { success: true, message: 'Partner branding configurations updated successfully' } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/partner/clients
   * Provision a new client organization under the partner
   */
  fastify.post('/clients', { preHandler: [requirePartnerAdmin] }, async (request: any, reply) => {
    const partnerId = request.partnerId;
    const user = request.authUser!;
    const { orgName } = request.body as any;

    if (!orgName) {
      return reply.code(400).send({ error: { message: 'orgName is required' } });
    }

    try {
      const newOrgId = crypto.randomUUID();
      await db.insert(organizations).values({
        id: newOrgId,
        name: orgName,
        isActive: true,
        partnerId: partnerId,
        createdAt: new Date()
      });

      // Log audit action
      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: user.orgId,
        action: 'create',
        resourceType: 'pipeline',
        resourceId: newOrgId,
        details: JSON.stringify({ createdOrgName: orgName, partnerResellerId: partnerId }),
        ipAddress: request.ip
      });

      return reply.status(201).send({
        data: {
          success: true,
          orgId: newOrgId,
          name: orgName,
          partnerId
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
