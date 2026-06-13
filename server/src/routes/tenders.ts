// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { tenders, userTenderScores, tenderAssignments, recommendationFeedback, users, companyProfiles } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { broadcastToOrg } from '../lib/websocket.js';
import { z } from 'zod';
import { recalculateScoresForNewTender } from '../services/matchEngine.js';

const createTenderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  issuingAuthority: z.string().min(1, 'Issuing authority is required'),
  portalSlug: z.string().min(1, 'Portal slug is required'),
  submissionDeadline: z.number().int('Submission deadline must be a timestamp'),
  portalTenderId: z.string().optional(),
  nitNumber: z.string().optional(),
  categoryCodes: z.array(z.string()).optional(),
  stateCodes: z.array(z.string()).optional(),
  estimatedValue: z.number().optional(),
  emdAmount: z.number().optional(),
  documentOpenDate: z.number().optional(),
  summaryStatus: z.string().optional(),
  aiSummary: z.any().optional(),
  eligibilityCriteria: z.any().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  rawPdfGcsKey: z.string().optional(),
  sourceUrl: z.string().optional(),
});

const assignTenderSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

const feedbackSchema = z.object({
  recommendation_id: z.string().min(1, 'Recommendation ID is required'),
  signal: z.enum(['saved', 'dismissed']),
  tender_id: z.string().min(1, 'Tender ID is required'),
  category_code: z.string().min(1, 'Category code is required'),
});

export default async function tenderRoutes(fastify: FastifyInstance) {

  // All tender routes require authentication
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /api/v1/tenders
   * Returns tenders based on the user's role:
   * - admin/tender_manager: All tenders in the org
   * - contributor/viewer: Only tenders assigned to them
   */
  fastify.get('/tenders', async (request, reply) => {
    const user = request.authUser!;
    const query = request.query as any;

    try {
      let results: any[];

      if (user.role === 'admin' || user.role === 'tender_manager') {
        // Admin and Tender Manager see ALL tenders in their org
        const allTenders = await db
          .select({
            tender: tenders,
            score: userTenderScores.score,
            breakdown: userTenderScores.breakdown,
            missingCriteria: userTenderScores.missingCriteria
          })
          .from(tenders)
          .leftJoin(
            userTenderScores,
            and(eq(userTenderScores.tenderId, tenders.id), eq(userTenderScores.userId, user.userId))
          )
          .where(eq(tenders.orgId, user.orgId));

        results = allTenders.map(item => mapTenderResult(item));
      } else {
        // Contributor and Viewer: only see tenders assigned to them (RLS)
        const assignedTenderIds = await db
          .select({ tenderId: tenderAssignments.tenderId })
          .from(tenderAssignments)
          .where(eq(tenderAssignments.userId, user.userId));

        const ids = assignedTenderIds.map(a => a.tenderId);

        if (ids.length === 0) {
          return reply.send({ data: [], meta: { total: 0 } });
        }

        const assignedTenders = await db
          .select({
            tender: tenders,
            score: userTenderScores.score,
            breakdown: userTenderScores.breakdown,
            missingCriteria: userTenderScores.missingCriteria
          })
          .from(tenders)
          .leftJoin(
            userTenderScores,
            and(eq(userTenderScores.tenderId, tenders.id), eq(userTenderScores.userId, user.userId))
          )
          .where(and(eq(tenders.orgId, user.orgId), inArray(tenders.id, ids)));

        results = assignedTenders.map(item => mapTenderResult(item));
      }

      // Apply search filter
      if (query.search) {
        const search = query.search.toLowerCase();
        results = results.filter(
          (t: any) => t.title.toLowerCase().includes(search) ||
               t.issuingAuthority.toLowerCase().includes(search) ||
               t.portalTenderId.toLowerCase().includes(search)
        );
      }

      // Apply category filter
      if (query.category) {
        results = results.filter((t: any) => t.categoryCodes.includes(query.category));
      }

      // Apply state filter
      if (query.state) {
        results = results.filter((t: any) => t.stateCodes.includes(query.state) || t.stateCodes.includes('ALL'));
      }

      // Apply portal filter
      if (query.portal) {
        results = results.filter((t: any) => t.portalSlug === query.portal);
      }

      // Apply match score grade filter
      if (query.scoreGrade) {
        results = results.filter((t: any) => {
          if (query.scoreGrade === 'excellent') return t.matchScore >= 90;
          if (query.scoreGrade === 'good') return t.matchScore >= 70 && t.matchScore < 90;
          if (query.scoreGrade === 'moderate') return t.matchScore >= 50 && t.matchScore < 70;
          if (query.scoreGrade === 'poor') return t.matchScore < 50;
          return true;
        });
      }

      // Apply value filters
      if (query.minValue) {
        results = results.filter((t: any) => (t.estimatedValue || 0) >= parseInt(query.minValue, 10));
      }
      if (query.maxValue) {
        results = results.filter((t: any) => (t.estimatedValue || 0) <= parseInt(query.maxValue, 10));
      }

      // Sort (default: score DESC)
      const sort = query.sort || 'score';
      if (sort === 'score') {
        results.sort((a: any, b: any) => b.matchScore - a.matchScore);
      } else if (sort === 'deadline') {
        results.sort((a: any, b: any) => a.submissionDeadline - b.submissionDeadline);
      } else if (sort === 'value') {
        results.sort((a: any, b: any) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
      }

      // Apply Paywall Limits & Masking for Free/Starter Tier users
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.userId));
      const tier = dbUser?.subscriptionTier || 'free';
      
      const tierLimits: Record<string, number | null> = {
        free: 3,
        starter: 25,
        pro: null,
        enterprise: null,
      };
      
      let limitCrop = tierLimits[tier] !== undefined ? tierLimits[tier] : 3;

      if (tier === 'free') {
        // Fetch company profile to check verification status for free tier bonus
        const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, user.userId));
        if (profile?.isVerified) {
          limitCrop = 5;
        }
      }

      if (limitCrop !== null) {
        // Cap the total results available to the user based on their tier
        results = results.slice(0, limitCrop);
      }
      
      const maskSensitive = tier === 'free';

      if (maskSensitive) {
        // Mask critical fields for free users
        results = results.map(r => ({
          ...r,
          emdAmount: null, // Mask EMD Amount
          rawPdfGcsKey: null, // Hide PDF key
          sourceUrl: '#', // Hide document links
          aiSummary: {
            physicalWorkRequired: 'Upgrade to Starter or Pro to view AI Match Analysis',
            preQualificationCriteria: 'Upgrade to Starter or Pro to view AI Match Analysis'
          }
        }));
      }

      // Enforce maximum page size to prevent database DOS
      const limit = Math.min(parseInt(query.limit || '100', 10), 100);
      const offset = parseInt(query.offset || '0', 10);
      const paged = results.slice(offset, offset + limit);

      return reply.send({
        data: paged,
        meta: { total: results.length, limit, offset }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * GET /api/v1/tenders/:id
   * Returns a single tender. Enforces org-level and assignment-level access.
   */
  fastify.get('/tenders/:id', async (request, reply) => {
    const user = request.authUser!;
    const { id } = request.params as any;

    try {
      const [item] = await db
        .select({
          tender: tenders,
          score: userTenderScores.score,
          breakdown: userTenderScores.breakdown,
          missingCriteria: userTenderScores.missingCriteria
        })
        .from(tenders)
        .leftJoin(
          userTenderScores,
          and(eq(userTenderScores.tenderId, tenders.id), eq(userTenderScores.userId, user.userId))
        )
        .where(and(eq(tenders.id, id), eq(tenders.orgId, user.orgId)));

      if (!item) {
        return reply.code(404).send({ error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found' } });
      }

      // RLS check for contributor/viewer
      if (user.role === 'contributor' || user.role === 'viewer') {
        const [assignment] = await db
          .select()
          .from(tenderAssignments)
          .where(and(eq(tenderAssignments.tenderId, id), eq(tenderAssignments.userId, user.userId)));

        if (!assignment) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'You are not assigned to this tender' } });
        }
      }

      let mapped = mapTenderResult(item);

      const [dbUser] = await db.select().from(users).where(eq(users.id, user.userId));
      const tier = dbUser?.subscriptionTier || 'free';
      const maskSensitive = tier === 'free';

      if (maskSensitive) {
        mapped = {
          ...mapped,
          emdAmount: null,
          rawPdfGcsKey: null,
          sourceUrl: '#',
          aiSummary: {
            physicalWorkRequired: 'Upgrade to Starter or Pro to view AI Match Analysis',
            preQualificationCriteria: 'Upgrade to Starter or Pro to view AI Match Analysis'
          }
        };
      }

      return reply.send({ data: mapped });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/tenders
   * Creates a new tender. Only tender_manager and admin can do this.
   */
  fastify.post('/tenders', { preHandler: [requireRole(['admin', 'tender_manager'])] }, async (request, reply) => {
    const user = request.authUser!;
    
    let body;
    try {
      body = createTenderSchema.parse(request.body);
    } catch (err: any) {
      return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
    }

    try {
      const tenderId = `tender_${new Date()}_${Math.random().toString(36).substr(2, 9)}`;
      const dedupeHash = `${body.nitNumber || tenderId}_${body.issuingAuthority}_${new Date()}`;

      await db.insert(tenders).values({
        tenderId,
        orgId: user.orgId,
        createdBy: user.userId,
        portalSlug: body.portalSlug,
        portalTenderId: body.portalTenderId || tenderId,
        nitNumber: body.nitNumber || null,
        issuingAuthority: body.issuingAuthority,
        title: body.title,
        categoryCodes: JSON.stringify(body.categoryCodes || []),
        stateCodes: JSON.stringify(body.stateCodes || []),
        estimatedValue: body.estimatedValue || null,
        emdAmount: body.emdAmount || null,
        submissionDeadline: body.submissionDeadline,
        documentOpenDate: body.documentOpenDate || null,
        summaryStatus: body.summaryStatus || 'pending',
        aiSummary: body.aiSummary ? JSON.stringify(body.aiSummary) : null,
        eligibilityCriteria: body.eligibilityCriteria ? JSON.stringify(body.eligibilityCriteria) : null,
        requiredDocuments: JSON.stringify(body.requiredDocuments || []),
        rawPdfGcsKey: body.rawPdfGcsKey || null,
        sourceUrl: body.sourceUrl || '',
        isCancelled: false,
        lastScrapedAt: new Date(),
        dedupeHash,
      });

      await createAuditLog(request, 'create', 'tender', tenderId, { title: body.title });
      
      // Calculate scores for this new tender for all users in the organization
      recalculateScoresForNewTender(tenderId, user.orgId).catch(err => {
        request.log.error(err, `Failed to calculate match scores for new tender ${tenderId}`);
      });
      
      broadcastToOrg(user.orgId, 'tender_created', { tenderId });

      return reply.code(201).send({ data: { success: true, tenderId } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/tenders/:id/assign
   * Assigns a tender to a user. Only tender_manager and admin can do this.
   */
  fastify.post('/tenders/:id/assign', { preHandler: [requireRole(['admin', 'tender_manager'])] }, async (request, reply) => {
    const user = request.authUser!;
    const { id } = request.params as any;
    
    let targetUserId: string;
    try {
      const parsed = assignTenderSchema.parse(request.body);
      targetUserId = parsed.targetUserId;
    } catch (err: any) {
      return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
    }

    try {
      // Verify the tender belongs to the same org
      const [tender] = await db.select().from(tenders).where(and(eq(tenders.id, id), eq(tenders.orgId, user.orgId)));
      if (!tender) {
        return reply.code(404).send({ error: { message: 'Tender not found in your organization' } });
      }

      const assignmentId = `assign_${new Date()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(tenderAssignments).values({
        assignmentId,
        
        userId: targetUserId,
        assignedBy: user.userId,
        assignedAt: new Date(),
      });

      await createAuditLog(request, 'assign', 'tender', id, { targetUserId });

      broadcastToOrg(user.orgId, 'tender_assigned', {  targetUserId });

      return reply.code(201).send({ data: { success: true, assignmentId } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });

  /**
   * POST /api/v1/tenders/feedback
   * Submit feedback (saved/dismissed) for a recommendation
   */
  fastify.post('/tenders/feedback', async (request, reply) => {
    const user = request.authUser!;
    let body;
    try {
      body = feedbackSchema.parse(request.body);
    } catch (err: any) {
      return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
    }

    try {
      await db.insert(recommendationFeedback).values({
        recommendationId: body.recommendation_id,
        userId: user.userId,
        signal: body.signal,
        categoryCode: body.category_code,
        createdAt: new Date()
      });
      return reply.code(201).send({ data: { success: true } });
    } catch (err: any) {
      return reply.code(500).send({ error: { message: err.message } });
    }
  });
}

// Helper to map raw DB results to the API response shape
function mapTenderResult(item: any) {
  return {
    ...item.tender,
    categoryCodes: JSON.parse(item.tender.categoryCodes || '[]'),
    stateCodes: JSON.parse(item.tender.stateCodes || '[]'),
    requiredDocuments: JSON.parse(item.tender.requiredDocuments || '[]'),
    aiSummary: JSON.parse(item.tender.aiSummary || '{}'),
    eligibilityCriteria: JSON.parse(item.tender.eligibilityCriteria || '[]'),
    matchScore: item.score !== null ? item.score : 0,
    breakdown: item.breakdown ? JSON.parse(item.breakdown) : [],
    missingCriteria: item.missingCriteria ? JSON.parse(item.missingCriteria) : []
  };
}
