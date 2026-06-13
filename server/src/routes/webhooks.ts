// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export default async function webhookRoutes(fastify: FastInstance) {

  // Override content type parser for application/json inside this router context only.
  // This allows us to receive raw buffers specifically for Stripe webhook signature verification.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      done(null, body);
    } catch (err: any) {
      done(err, null);
    }
  });

  fastify.post('/razorpay', async (request, reply) => {
    const sig = request.headers['x-razorpay-signature'] as string;
    const bodyText = request.body as Buffer;
    
    let event: any;

    if (razorpayWebhookSecret && sig) {
      const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(bodyText.toString('utf8'))
        .digest('hex');

      if (expectedSignature !== sig) {
        console.error(`[RazorpayWebhook ERROR] Signature mismatch.`);
        return reply.code(400).send({ error: { message: 'Invalid signature' } });
      }
    } else {
      console.log('[RazorpayWebhook] Using mock verification (missing secret or signature)');
    }

    try {
      event = JSON.parse(bodyText.toString('utf8'));
    } catch (err: any) {
      console.error(`[RazorpayWebhook ERROR] Invalid JSON payload`);
      return reply.code(400).send({ error: { message: 'Invalid JSON payload' } });
    }

    console.log(`[RazorpayWebhook] Received event: ${event.event}`);

    try {
      switch (event.event) {
        case 'payment.captured':
        case 'subscription.charged': {
          const payload = event.payload.payment.entity;
          // Notes should contain clerk_id or email, and plan_id
          const clerkId = payload.notes?.clerk_id;
          const email = payload.email || payload.notes?.email;
          const planId = payload.notes?.plan_id;
          const razorpayCustomerId = payload.customer_id;
          const razorpaySubscriptionId = payload.subscription_id;

          if (!clerkId && !email) {
            console.error('[RazorpayWebhook] No clerkId or email in notes. Aborting.');
            break;
          }

          const tierMap: Record<string, string> = {
            [process.env.RAZORPAY_STARTER_MONTHLY || 'starter_m']: 'starter',
            [process.env.RAZORPAY_STARTER_ANNUAL || 'starter_a']: 'starter',
            [process.env.RAZORPAY_PRO_MONTHLY || 'pro_m']: 'pro',
            [process.env.RAZORPAY_PRO_ANNUAL || 'pro_a']: 'pro',
            [process.env.RAZORPAY_ENTERPRISE_MONTHLY || 'ent_m']: 'enterprise',
            [process.env.RAZORPAY_ENTERPRISE_ANNUAL || 'ent_a']: 'enterprise',
          };
          const newTier = planId ? (tierMap[planId] || 'pro') : 'pro';

          console.log(`[RazorpayWebhook] Upgrading user clerkId: ${clerkId} / email: ${email} to ${newTier}.`);

          let targetUser = null;
          if (clerkId) {
            const [userByClerk] = await db.select().from(users).where(eq(users.clerkId, clerkId));
            targetUser = userByClerk;
          }
          if (!targetUser && email) {
            const [userByEmail] = await db.select().from(users).where(eq(users.email, email));
            targetUser = userByEmail;
          }

          if (!targetUser) {
            console.error(`[RazorpayWebhook] User not found for clerkId: ${clerkId} or email: ${email}`);
            return reply.code(404).send({ error: { message: 'User not found for upgrade' } });
          }

          await db
            .update(users)
            .set({
              subscriptionTier: newTier,
              subscriptionStatus: 'active',
              razorpayCustomerId,
              razorpaySubscriptionId,
            })
            .where(eq(users.id, targetUser.id));

          console.log(`[RazorpayWebhook] Successfully upgraded user ${targetUser.id} to ${newTier}.`);
          break;
        }

        case 'subscription.cancelled':
        case 'subscription.halted': {
          const payload = event.payload.subscription.entity;
          const razorpaySubscriptionId = payload.id;

          console.log(`[RazorpayWebhook] Downgrading subscription: ${razorpaySubscriptionId}.`);

          const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.razorpaySubscriptionId, razorpaySubscriptionId));

          if (!targetUser) {
            console.error(`[RazorpayWebhook] User not found for subscription ID: ${razorpaySubscriptionId}`);
            break;
          }

          await db
            .update(users)
            .set({
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
              razorpaySubscriptionId: null,
            })
            .where(eq(users.id, targetUser.id));

          console.log(`[RazorpayWebhook] Successfully downgraded user ${targetUser.id} to Free.`);
          break;
        }

        default:
          console.log(`[RazorpayWebhook] Unhandled event type: ${event.event}`);
      }

      return reply.send({ received: true });
    } catch (err: any) {
      console.error('[RazorpayWebhook Exception]', err);
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
