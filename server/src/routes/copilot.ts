// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { 
  copilotConversations, 
  copilotMessages, 
  generatedProposals, 
  tenders, 
  companyProfiles 
} from '../db/schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';
import { getLLMProvider } from '../services/llm.js';
import { rateLimit } from '../lib/rateLimit.js';

// Simple helper to strip malicious tags to prevent Stored XSS / Word Macro exploits
function sanitizeHtmlForWord(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, ''); // strip inline events
}

export default async function copilotRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Paywall check: Only Starter tier and above can use the copilot
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.authUser!;
    if (user.subscriptionTier === 'free') {
      return reply.code(403).send({ 
        error: { 
          code: 'UPGRADE_REQUIRED', 
          message: 'AI Bid Copilot requires Starter plan or above. Please upgrade.' 
        }
      });
    }
  });

  /**
   * POST /api/v1/copilot/chat
   * Streams chat responses via SSE (Server-Sent Events)
   */
  fastify.post('/chat', { preHandler: [rateLimit(10, 60000)] }, async (request, reply) => {
    const user = request.authUser!;
    const { tenderId, conversationId, message } = request.body as any;

    if (!tenderId || !message) {
      return reply.code(400).send({ error: { message: 'tenderId and message are required' } });
    }

    try {
      // 1. Fetch the tender - scoped to organization to prevent BOLA/IDOR
      const [tender] = await db.select().from(tenders).where(
        and(
          eq(tenders.id, tenderId),
          eq(tenders.orgId, user.orgId)
        )
      );
      if (!tender) {
        return reply.code(404).send({ error: { message: 'Tender not found' } });
      }

      // 2. Fetch company profile (optional context)
      const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.orgId, user.orgId));

      // 3. Retrieve or create conversation
      let activeConversationId = conversationId;
      let isNew = false;
      let convTitle = '';

      if (!activeConversationId) {
        isNew = true;
        convTitle = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        const [newConv] = await db.insert(copilotConversations).values({
          userId: user.userId,
          orgId: user.orgId,
          tenderId,
          title: convTitle,
          messageCount: 0,
          tokensUsed: 0,
        }).returning();
        activeConversationId = newConv.id;
      } else {
        const [existing] = await db.select().from(copilotConversations).where(
          and(
            eq(copilotConversations.id, activeConversationId),
            eq(copilotConversations.orgId, user.orgId)
          )
        );
        if (!existing) {
          return reply.code(404).send({ error: { message: 'Conversation not found' } });
        }
        convTitle = existing.title;
      }

      // 4. Load past messages
      const pastMessages = await db.select()
        .from(copilotMessages)
        .where(eq(copilotMessages.conversationId, activeConversationId))
        .orderBy(asc(copilotMessages.createdAt))
        .limit(20);

      // 5. Construct AI Prompts
      const systemPrompt = `You are TenderIQ Bid Copilot, an expert Indian government tender consultant.
You help businesses prepare winning technical and commercial proposals.

TENDER CONTEXT:
Title: ${tender.title}
NIT/Ref Number: ${tender.nitNumber || 'N/A'}
Issuing Authority: ${tender.issuingAuthority}
Summary: ${tender.aiSummary || 'N/A'}
Eligibility Criteria: ${tender.eligibilityCriteria || 'N/A'}
Raw Snippet: ${(tender.rawText || '').substring(0, 4000)}

${profile ? `COMPANY PROFILE:
Name: ${profile.companyName}
Keywords: ${profile.servicesKeywords?.join(', ') || 'N/A'}
Certifications: ${profile.certifications?.join(', ') || 'N/A'}
Operating States: ${profile.operatingStates?.join(', ') || 'N/A'}
Max Bid Value Capacity: ₹${profile.maxTenderCapacity || 'N/A'}
` : ''}

RULES:
- Always reference specific tender requirements from the document.
- Highlight where the company meets or doesn't meet eligibility.
- Use professional Indian government tender terminology (e.g., L1, EMD, NIT, BG, Corrigendum).
- Format proposals and replies for Indian government submission standards.
- Write sections like Technical Approach, Methodology, Team, and Timeline when asked to draft them.
- Flag missing documents or certifications.
- Reply in clean markdown.`;

      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...pastMessages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      // 6. Save the user's message
      await db.insert(copilotMessages).values({
        conversationId: activeConversationId,
        role: 'user',
        content: message,
      });

      // 7. Initialize LLM Provider by subscription tier
      const llm = getLLMProvider(user.subscriptionTier);
      const stream = await llm.streamChat(formattedMessages);

      // Set headers for Server-Sent Events (SSE)
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send connection metadata as first event
      reply.raw.write(`data: ${JSON.stringify({ 
        metadata: { 
          conversationId: activeConversationId, 
          isNew, 
          title: convTitle 
        } 
      })}\n\n`);

      let responseText = '';
      
      for await (const chunk of stream) {
        responseText += chunk;
        reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Save assistant message to database
      await db.insert(copilotMessages).values({
        conversationId: activeConversationId,
        role: 'assistant',
        content: responseText,
        metadata: JSON.stringify({ model: user.subscriptionTier === 'enterprise' ? 'claude-3-5-sonnet' : user.subscriptionTier === 'pro' ? 'gpt-4o-mini' : 'gemini-1.5-flash' }),
      });

      // Update token tracking
      const inputTokens = llm.countTokens(JSON.stringify(formattedMessages));
      const outputTokens = llm.countTokens(responseText);
      const totalTokens = inputTokens + outputTokens;

      const [conv] = await db.select().from(copilotConversations).where(eq(copilotConversations.id, activeConversationId));
      await db.update(copilotConversations)
        .set({
          messageCount: (conv?.messageCount || 0) + 2,
          tokensUsed: (conv?.tokensUsed || 0) + totalTokens,
          updatedAt: new Date(),
        })
        .where(eq(copilotConversations.id, activeConversationId));

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();

    } catch (err: any) {
      fastify.log.error(err, 'Error in Copilot Chat');
      try {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        reply.raw.end();
      } catch (streamErr) {
        // stream was already closed
      }
    }
  });

  /**
   * GET /api/v1/copilot/conversations
   * Lists all conversations for the organization
   */
  fastify.get('/conversations', async (request, reply) => {
    const user = request.authUser!;
    try {
      const list = await db.select()
        .from(copilotConversations)
        .where(eq(copilotConversations.orgId, user.orgId))
        .orderBy(desc(copilotConversations.updatedAt));
      return reply.send({ data: list });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/copilot/conversations/:id
   * Returns conversation detail with all messages
   */
  fastify.get('/conversations/:id', async (request, reply) => {
    const user = request.authUser!;
    const { id } = request.params as any;

    try {
      const [conv] = await db.select().from(copilotConversations).where(
        and(
          eq(copilotConversations.id, id),
          eq(copilotConversations.orgId, user.orgId)
        )
      );

      if (!conv) {
        return reply.code(404).send({ error: { message: 'Conversation not found' } });
      }

      const messages = await db.select()
        .from(copilotMessages)
        .where(eq(copilotMessages.conversationId, id))
        .orderBy(asc(copilotMessages.createdAt));

      return reply.send({ 
        data: {
          ...conv,
          messages
        } 
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/copilot/generate-proposal
   * Formulates a structured proposal document from a conversation context
   */
  fastify.post('/generate-proposal', async (request, reply) => {
    const user = request.authUser!;
    const { tenderId, conversationId, title } = request.body as any;

    if (!tenderId || !conversationId) {
      return reply.code(400).send({ error: { message: 'tenderId and conversationId are required' } });
    }

    try {
      // 1. Fetch tender and profile - scoped to org to prevent BOLA/IDOR
      const [tender] = await db.select().from(tenders).where(
        and(
          eq(tenders.id, tenderId),
          eq(tenders.orgId, user.orgId)
        )
      );
      if (!tender) return reply.code(404).send({ error: { message: 'Tender not found' } });

      const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.orgId, user.orgId));
      
      // 2. Fetch conversation history
      const convMessages = await db.select()
        .from(copilotMessages)
        .where(eq(copilotMessages.conversationId, conversationId))
        .orderBy(asc(copilotMessages.createdAt));

      // 3. Query LLM to assemble proposal document
      const systemPrompt = `You are a professional proposal writer for high-value Indian government contracts.
Using the following conversation context, compile a formal, structured Tender Proposal.

Format the proposal in clean Markdown with these mandatory sections:
1. Cover Letter / Executive Summary
2. Bidder Profile & Eligibility Compliance (mention certifications and max bid limit if available)
3. Technical Approach & Solution Architecture
4. Project Execution Methodology & Timeline
5. Financial Compliance Notes (mentioning EMD and tender value if available)
6. Annexures / Declared Document Checklists`;

      const promptMessages = [
        { role: 'system', content: systemPrompt },
        ...convMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        { 
          role: 'user', 
          content: `TENDER DETAILS:
Title: ${tender.title}
Issuing Authority: ${tender.issuingAuthority}
Estimated Value: ${tender.estimatedValue ? '₹' + tender.estimatedValue : 'Refer document'}

COMPANY INFORMATION:
Name: ${profile?.companyName || 'Bidder'}
Certs: ${profile?.certifications?.join(', ') || 'N/A'}

Compile the official proposal document. Avoid placeholders or chat preambles. Start directly with the title block.` 
        }
      ];

      const llm = getLLMProvider(user.subscriptionTier);
      const generator = await llm.streamChat(promptMessages);
      
      let proposalText = '';
      for await (const chunk of generator) {
        proposalText += chunk;
      }

      // 4. Save proposal to DB
      const proposalTitle = title || `Proposal - ${tender.title.substring(0, 30)}`;
      const [proposal] = await db.insert(generatedProposals).values({
        userId: user.userId,
        tenderId,
        conversationId,
        title: proposalTitle,
        content: proposalText,
        format: 'markdown',
      }).returning();

      return reply.send({ 
        data: {
          proposalId: proposal.id,
          title: proposal.title,
          content: proposal.content,
        }
      });
    } catch (err: any) {
      fastify.log.error(err, 'Error generating proposal');
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/copilot/export
   * Exports proposal as HTML-packaged Microsoft Word (.doc) file
   */
  fastify.post('/export', async (request, reply) => {
    const { proposalId } = request.body as any;

    if (!proposalId) {
      return reply.code(400).send({ error: { message: 'proposalId is required' } });
    }

    try {
      const user = request.authUser!;
      // Fetch proposal - scoped to user ID to prevent BOLA/IDOR leaks
      const [proposal] = await db.select().from(generatedProposals).where(
        and(
          eq(generatedProposals.id, proposalId),
          eq(generatedProposals.userId, user.userId)
        )
      );
      if (!proposal) {
        return reply.code(404).send({ error: { message: 'Proposal not found' } });
      }

      // Sanitize raw contents before Word compilation to prevent stored HTML/XSS macros
      const sanitizedContent = sanitizeHtmlForWord(proposal.content);

      // Convert simple Markdown headers/paragraphs to HTML elements for MS Word compatibility
      let htmlContent = sanitizedContent
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');

      htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <title>${proposal.title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; margin: 40px; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 30px; font-size: 24pt; }
    h2 { color: #1e293b; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 18pt; }
    h3 { color: #334155; margin-top: 18px; font-size: 14pt; }
    p { margin-bottom: 12px; font-size: 11pt; text-align: justify; }
    li { margin-bottom: 6px; font-size: 11pt; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

      const buffer = Buffer.from(htmlContent, 'utf-8');

      reply.header('Content-Disposition', `attachment; filename="${proposal.title.replace(/[^a-zA-Z0-9]/g, '_')}.doc"`);
      reply.header('Content-Type', 'application/msword');
      reply.header('Content-Length', buffer.length);
      
      return reply.send(buffer);
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}
