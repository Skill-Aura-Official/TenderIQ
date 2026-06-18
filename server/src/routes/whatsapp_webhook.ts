import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { users, whatsappInteractions, tenders } from '../db/schema.js';
import { rateLimit } from '../lib/rateLimit.js';
import { eq } from 'drizzle-orm';

export default async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/webhooks/whatsapp/wati
   * Receives incoming messages from users via Wati
   */
  fastify.post('/wati', { preHandler: [rateLimit(20, 60000)] }, async (request, reply) => {
    // 1. Secure Hook: Verify Wati webhook HMAC SHA-256 signature
    const signature = request.headers['x-wati-signature'] as string;
    const signingSecret = process.env.WATI_SIGNING_SECRET;
    
    if (signingSecret && signature) {
      const computed = crypto
        .createHmac('sha256', signingSecret)
        .update(JSON.stringify(request.body))
        .digest('hex');
      if (computed !== signature) {
        return reply.code(401).send({ error: 'Invalid webhook signature' });
      }
    }

    const { senderNumber, text: messageText } = request.body as any;
    if (!senderNumber || !messageText) {
      return reply.code(400).send({ error: 'Missing payload parameters' });
    }

    // 2. Identify Tenant User
    const normalizedPhone = senderNumber.replace(/[^0-9]/g, '');
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, normalizedPhone)).limit(1);
    if (!user) {
      return reply.send({ success: false, message: 'Unrecognized contact number' });
    }

    // 3. Process Intent
    let intent = 'unknown';
    let replyText = '';
    
    if (/find|search|tender/i.test(messageText)) {
      intent = 'search';
      const terms = messageText.replace(/find|search|tender/gi, '').trim().split(/\s+/).filter(Boolean);
      let queryTenders = [];
      
      const allTenders = await db.select().from(tenders).where(eq(tenders.orgId, user.orgId)).limit(50);
      if (terms.length > 0) {
        queryTenders = allTenders.filter(t => 
          terms.some(term => 
            t.title.toLowerCase().includes(term.toLowerCase()) || 
            (t.rawText && t.rawText.toLowerCase().includes(term.toLowerCase()))
          )
        ).slice(0, 3);
      } else {
        queryTenders = allTenders.slice(0, 3);
      }

      if (queryTenders.length > 0) {
        replyText = `Found ${queryTenders.length} tenders matching your request:\n\n` +
          queryTenders.map((t, idx) => 
            `${idx + 1}. *${t.title}*\n   Authority: ${t.issuingAuthority}\n   Deadline: ${new Date(t.submissionDeadline).toLocaleDateString()}\n   Value: ₹${t.estimatedValue || 'Refer document'}`
          ).join('\n\n');
      } else {
        replyText = `Sorry, no tenders found matching those keywords in your organization workspace.`;
      }

    } else if (/pipeline|status/i.test(messageText)) {
      intent = 'pipeline_status';
      replyText = `Your active pipeline status:\nNo active pipelines configured in WhatsApp beta mode.`;
    } else {
      intent = 'help';
      replyText = 'TenderIQ Bot Menu:\n1. Reply with "Search <keywords>" to find tenders\n2. Reply "Pipeline" to view active pipeline matches.';
    }

    // 4. Log Interaction for Audits & Analytics
    await db.insert(whatsappInteractions).values({
      userId: user.id,
      phoneNumber: normalizedPhone,
      messageType: 'incoming',
      content: messageText,
      intent
    });

    return reply.send({ success: true, response: replyText });
  });
}
