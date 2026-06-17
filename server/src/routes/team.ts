// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { users, teamInvitations, organizations, auditLogs } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../lib/auth.js';
import crypto from 'crypto';

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /api/v1/team/members
   * List all members in the user's organization
   */
  fastify.get('/members', async (request, reply) => {
    const user = request.authUser!;
    try {
      const members = await db.select().from(users).where(eq(users.orgId, user.orgId));
      return reply.send({ data: members });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/team/invite
   * Send a team invitation. Only Admin and Tender Managers can invite.
   */
  fastify.post('/invite', { preHandler: [requireRole(['admin', 'tender_manager'])] }, async (request, reply) => {
    const user = request.authUser!;
    const { email, role } = request.body as any;

    if (!email || !role) {
      return reply.code(400).send({ error: { message: 'email and role are required fields' } });
    }

    const tier = user.subscriptionTier;
    let seatLimit = 1;
    if (tier === 'enterprise') seatLimit = 5;
    else if (tier === 'enterprise_plus') seatLimit = 9999; // Unlimited

    if (seatLimit <= 1) {
      return reply.code(403).send({
        error: {
          code: 'UPGRADE_REQUIRED',
          message: `Your current subscription plan (${tier.toUpperCase()}) does not support adding team members. Please upgrade to ENTERPRISE.`
        }
      });
    }

    try {
      // Count existing members
      const activeMembersCount = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.orgId, user.orgId));
      
      const pendingInvitesCount = await db.select({ count: sql<number>`count(*)` })
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.orgId, user.orgId),
            eq(teamInvitations.status, 'pending')
          )
        );

      const totalSeatsUsed = Number(activeMembersCount[0]?.count || 0) + Number(pendingInvitesCount[0]?.count || 0);

      if (totalSeatsUsed >= seatLimit) {
        return reply.code(400).send({
          error: {
            message: `Seat limit reached. Your Enterprise plan allows up to ${seatLimit} team seats (currently using ${totalSeatsUsed}).`
          }
        });
      }

      // Create invite token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      const [newInvite] = await db.insert(teamInvitations).values({
        orgId: user.orgId,
        invitedByUserId: user.userId,
        email,
        role,
        token,
        status: 'pending',
        expiresAt,
      }).returning();

      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: user.orgId,
        action: 'create',
        resourceType: 'user',
        resourceId: newInvite?.id ? String(newInvite.id) : email,
        details: JSON.stringify({ invitedEmail: email, assignedRole: role }),
        ipAddress: request.ip
      });

      // Simple print for logging (in production, we'd send email via Resend/SMTP)
      fastify.log.info(`[TEAM INVITE] Invitation link: http://localhost:3000/invite/accept?token=${token}`);

      return reply.status(201).send({
        data: {
          success: true,
          message: `Invitation successfully queued for ${email}`,
          inviteUrl: `http://localhost:3000/invite/accept?token=${token}`
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/team/invite/:token/accept
   * Accept an invitation token. Creates or updates user record linked to organization.
   */
  fastify.post('/invite/:token/accept', async (request, reply) => {
    const user = request.authUser!;
    const { token } = request.params as any;

    try {
      const [invite] = await db.select().from(teamInvitations).where(
        and(
          eq(teamInvitations.token, token),
          eq(teamInvitations.status, 'pending')
        )
      );

      if (!invite) {
        return reply.code(404).send({ error: { message: 'Invitation token is invalid or has already been accepted.' } });
      }

      if (new Date() > new Date(invite.expiresAt)) {
        await db.update(teamInvitations).set({ status: 'expired' }).where(eq(teamInvitations.id, invite.id));
        return reply.code(400).send({ error: { message: 'Invitation has expired.' } });
      }

      // Update user matching the Clerk ID or email in the DB
      const [targetUser] = await db.select().from(users).where(eq(users.id, user.userId));

      if (targetUser) {
        await db.update(users).set({
          orgId: invite.orgId,
          role: invite.role,
        }).where(eq(users.id, user.userId));
      }

      await db.update(teamInvitations).set({ status: 'accepted' }).where(eq(teamInvitations.id, invite.id));

      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: invite.orgId,
        action: 'update',
        resourceType: 'user',
        resourceId: user.userId,
        details: JSON.stringify({ acceptedInviteId: invite.id, role: invite.role }),
        ipAddress: request.ip
      });

      return reply.send({
        data: {
          success: true,
          message: 'Invitation accepted successfully. Welcome to your team workspace!',
          orgId: invite.orgId,
          role: invite.role
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * PATCH /api/v1/team/members/:userId/role
   * Adjust a member's role (admin only)
   */
  fastify.patch('/members/:userId/role', { preHandler: [requireRole(['admin'])] }, async (request, reply) => {
    const user = request.authUser!;
    const { userId } = request.params as any;
    const { role } = request.body as any;

    if (!role) {
      return reply.code(400).send({ error: { message: 'role is required' } });
    }

    try {
      const [target] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.orgId, user.orgId)));
      if (!target) {
        return reply.code(404).send({ error: { message: 'Member not found in your organization' } });
      }

      await db.update(users).set({ role }).where(eq(users.id, userId));

      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: user.orgId,
        action: 'update',
        resourceType: 'user',
        resourceId: userId,
        details: JSON.stringify({ oldRole: target.role, newRole: role }),
        ipAddress: request.ip
      });

      return reply.send({ data: { success: true, message: `Role updated to ${role} successfully` } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * DELETE /api/v1/team/members/:userId
   * Remove a member from the organization (admin only)
   */
  fastify.delete('/members/:userId', { preHandler: [requireRole(['admin'])] }, async (request, reply) => {
    const user = request.authUser!;
    const { userId } = request.params as any;

    if (userId === user.userId) {
      return reply.code(400).send({ error: { message: 'You cannot remove yourself from the organization' } });
    }

    try {
      const [target] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.orgId, user.orgId)));
      if (!target) {
        return reply.code(404).send({ error: { message: 'Member not found in your organization' } });
      }

      // Revert user to default personal organization or just unlink/delete
      // In this system, we soft delete/reset them to a personal personal default organization
      const personalOrgId = crypto.randomUUID();
      await db.insert(organizations).values({
        id: personalOrgId,
        name: `${target.email}'s Workspace`,
        createdAt: new Date(),
      });

      await db.update(users).set({
        orgId: personalOrgId,
        role: 'admin',
        subscriptionTier: 'free',
      }).where(eq(users.id, userId));

      await db.insert(auditLogs).values({
        userId: user.userId,
        orgId: user.orgId,
        action: 'delete',
        resourceType: 'user',
        resourceId: userId,
        details: JSON.stringify({ removedUserEmail: target.email, newPersonalOrgId: personalOrgId }),
        ipAddress: request.ip
      });

      return reply.send({ data: { success: true, message: 'Member successfully removed and unlinked' } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
