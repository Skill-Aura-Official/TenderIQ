import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Razorpay from 'razorpay';
import crypto from 'crypto';
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});
export default async function billingRoutes(fastify) {
    fastify.addHook('preHandler', requireAuth);
    fastify.post('/create-order', async (request, reply) => {
        const user = request.authUser;
        const body = request.body;
        if (!body.planId) {
            return reply.code(400).send({ error: { message: 'planId is required' } });
        }
        try {
            const [dbUser] = await db.select().from(users).where(eq(users.id, user.userId));
            // In Razorpay, for subscriptions, we create a subscription directly, not an order
            const subscription = await razorpay.subscriptions.create({
                plan_id: body.planId,
                customer_notify: 1,
                total_count: 120, // max billing cycles
                notes: {
                    clerk_id: user.userId,
                    email: dbUser.email,
                    plan_id: body.planId,
                }
            });
            return reply.send({ data: { subscriptionId: subscription.id } });
        }
        catch (err) {
            console.error('[Billing ERROR]', err);
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    fastify.post('/verify-payment', async (request, reply) => {
        const body = request.body;
        if (!body.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) {
            return reply.code(400).send({ error: { message: 'Missing payment details' } });
        }
        try {
            const text = body.razorpay_payment_id + '|' + body.razorpay_subscription_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
                .update(text)
                .digest('hex');
            if (expectedSignature === body.razorpay_signature) {
                // Payment is valid, webhook will handle the DB update
                return reply.send({ data: { success: true } });
            }
            else {
                return reply.code(400).send({ error: { message: 'Invalid signature' } });
            }
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
}
