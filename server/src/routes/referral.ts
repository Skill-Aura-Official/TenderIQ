// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { referrals, users } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import crypto from 'crypto';

export default async function referralRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  /**
   * POST /api/v1/referral/generate
   * Generates a referral link for a colleague's email
   */
  fastify.post('/generate', async (request, reply) => {
    const user = request.authUser!;
    const { referredEmail } = request.body as any;

    if (!referredEmail) {
      return reply.code(400).send({ error: { message: 'referredEmail is required' } });
    }

    try {
      // Check if already referred
      const [existing] = await db.select().from(referrals).where(
        and(
          eq(referrals.referrerUserId, user.userId),
          eq(referrals.referredEmail, referredEmail)
        )
      );

      if (existing) {
        return reply.send({
          data: {
            referralCode: existing.referralCode,
            inviteUrl: `http://localhost:3000/signup?ref=${existing.referralCode}`,
            status: existing.status
          }
        });
      }

      const referralCode = `ref_${crypto.randomBytes(4).toString('hex')}`;
      
      await db.insert(referrals).values({
        referrerUserId: user.userId,
        referredEmail,
        referralCode,
        status: 'pending',
      });

      return reply.status(201).send({
        data: {
          referralCode,
          inviteUrl: `http://localhost:3000/signup?ref=${referralCode}`,
          status: 'pending'
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/referral/stats
   * Retrieves stats on user's referrals (total sent, signed up, converted, total earnings)
   */
  fastify.get('/stats', async (request, reply) => {
    const user = request.authUser!;

    try {
      const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerUserId, user.userId));

      let pending = 0;
      let signedUp = 0;
      let converted = 0;
      let earnedPaise = 0;

      userReferrals.forEach(r => {
        if (r.status === 'pending') pending++;
        else if (r.status === 'signed_up') signedUp++;
        else if (r.status === 'converted' || r.status === 'rewarded') {
          converted++;
          earnedPaise += r.rewardAmount || 50000; // default ₹500 (50000 paise)
        }
      });

      return reply.send({
        data: {
          totalSent: userReferrals.length,
          pending,
          signedUp,
          converted,
          earnedAmountInRupees: earnedPaise / 100,
          referralsList: userReferrals
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/referral/track
   * Links a signing up user to their referrer
   */
  fastify.post('/track', async (request, reply) => {
    const user = request.authUser!;
    const { referralCode } = request.body as any;

    if (!referralCode) {
      return reply.code(400).send({ error: { message: 'referralCode is required' } });
    }

    try {
      // Find matching referral details
      const [referral] = await db.select().from(referrals).where(
        and(
          eq(referrals.referralCode, referralCode),
          eq(referrals.status, 'pending')
        )
      );

      if (!referral) {
        return reply.code(404).send({ error: { message: 'Referral code not found or already processed' } });
      }

      // Update referral record to signed_up
      await db.update(referrals)
        .set({
          status: 'signed_up',
          referredUserId: user.userId,
        })
        .where(eq(referrals.id, referral.id));

      return reply.send({
        data: {
          success: true,
          message: 'Referral successfully tracked'
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
