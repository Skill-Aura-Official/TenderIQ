import { db } from '../lib/db.js';
import { pipelineEntries, tenders, userTenderScores, tenderAssignments } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { broadcastToOrg } from '../lib/websocket.js';
import { z } from 'zod';
const addToPipelineSchema = z.object({
    tenderId: z.string().min(1, 'Tender ID is required'),
    stage: z.string().optional(),
});
const updateStageSchema = z.object({
    stage: z.string().min(1, 'Stage is required'),
});
const updateNotesSchema = z.object({
    notes: z.string(),
});
export default async function pipelineRoutes(fastify) {
    // All pipeline routes require authentication
    fastify.addHook('preHandler', requireAuth);
    /**
     * GET /api/v1/pipeline
     * Returns pipeline entries for the authenticated user.
     */
    fastify.get('/', async (request, reply) => {
        const user = request.authUser;
        try {
            const entries = await db
                .select({
                entry: pipelineEntries,
                tender: tenders,
                score: userTenderScores.score
            })
                .from(pipelineEntries)
                .innerJoin(tenders, eq(pipelineEntries.tenderId, tenders.id))
                .leftJoin(userTenderScores, and(eq(userTenderScores.tenderId, tenders.id), eq(userTenderScores.userId, user.userId)))
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.orgId, user.orgId)));
            const results = entries.map(item => ({
                ...item.entry,
                stageHistory: JSON.parse(item.entry.stageHistory || '[]'),
                tender: {
                    ...item.tender,
                    categoryCodes: JSON.parse(item.tender.categoryCodes || '[]'),
                    stateCodes: JSON.parse(item.tender.stateCodes || '[]'),
                    requiredDocuments: JSON.parse(item.tender.requiredDocuments || '[]'),
                    aiSummary: JSON.parse(item.tender.aiSummary || '{}'),
                    eligibilityCriteria: JSON.parse(item.tender.eligibilityCriteria || '[]'),
                    matchScore: item.score !== null ? item.score : 0
                }
            }));
            return reply.send({ data: results });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * POST /api/v1/pipeline
     * Add a tender to the pipeline. Contributors can only add tenders assigned to them.
     */
    fastify.post('/', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        let tenderId;
        let stage;
        try {
            const parsed = addToPipelineSchema.parse(request.body);
            tenderId = parsed.tenderId;
            stage = parsed.stage;
        }
        catch (err) {
            return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
        }
        try {
            // Verify the tender belongs to the same org
            const [tender] = await db.select().from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.orgId, user.orgId)));
            if (!tender) {
                return reply.code(404).send({ error: { message: 'Tender not found in your organization' } });
            }
            // RLS: Contributors can only add assigned tenders
            if (user.role === 'contributor') {
                const [assignment] = await db.select().from(tenderAssignments)
                    .where(and(eq(tenderAssignments.tenderId, tenderId), eq(tenderAssignments.userId, user.userId)));
                if (!assignment) {
                    return reply.code(403).send({ error: { message: 'You are not assigned to this tender' } });
                }
            }
            // Check if already in pipeline
            const [existing] = await db.select().from(pipelineEntries)
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.tenderId, tenderId)));
            if (existing) {
                return reply.code(400).send({ error: { message: 'Tender is already in pipeline' } });
            }
            const targetStage = stage || 'discovered';
            const entryId = `entry_${new Date()}_${Math.random().toString(36).substr(2, 9)}`;
            const history = [{ stage: targetStage, changedAt: new Date(), changedBy: user.userId }];
            await db.insert(pipelineEntries).values({
                entryId,
                userId: user.userId,
                orgId: user.orgId,
                tenderId,
                stage: targetStage,
                notes: '',
                stageHistory: JSON.stringify(history),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await createAuditLog(request, 'create', 'pipeline', entryId, { tenderId, stage: targetStage });
            broadcastToOrg(user.orgId, 'pipeline_updated', { tenderId });
            return reply.code(201).send({ data: { success: true, entryId } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * PATCH /api/v1/pipeline/:tenderId/stage
     * Update the stage of a pipeline entry. Viewers cannot do this.
     */
    fastify.patch('/:tenderId/stage', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { tenderId } = request.params;
        let stage;
        try {
            const parsed = updateStageSchema.parse(request.body);
            stage = parsed.stage;
        }
        catch (err) {
            return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
        }
        try {
            const [existing] = await db.select().from(pipelineEntries)
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.tenderId, tenderId), eq(pipelineEntries.orgId, user.orgId)));
            if (!existing) {
                return reply.code(404).send({ error: { message: 'Pipeline entry not found' } });
            }
            const history = JSON.parse(existing.stageHistory || '[]');
            history.push({ stage, changedAt: new Date(), changedBy: user.userId });
            await db.update(pipelineEntries)
                .set({
                stage,
                stageHistory: JSON.stringify(history),
                updatedAt: new Date()
            })
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.tenderId, tenderId)));
            await createAuditLog(request, 'update', 'pipeline', existing.id, { tenderId, newStage: stage });
            broadcastToOrg(user.orgId, 'pipeline_updated', { tenderId });
            return reply.send({ data: { success: true, message: 'Stage updated' } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * PATCH /api/v1/pipeline/:tenderId/notes
     * Update notes on a pipeline entry. Viewers cannot do this.
     */
    fastify.patch('/:tenderId/notes', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { tenderId } = request.params;
        let notes;
        try {
            const parsed = updateNotesSchema.parse(request.body);
            notes = parsed.notes;
        }
        catch (err) {
            return reply.code(400).send({ error: { message: 'Validation failed', details: err.errors } });
        }
        try {
            await db.update(pipelineEntries)
                .set({
                notes,
                updatedAt: new Date()
            })
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.tenderId, tenderId), eq(pipelineEntries.orgId, user.orgId)));
            await createAuditLog(request, 'update', 'pipeline', tenderId, { action: 'notes_updated' });
            broadcastToOrg(user.orgId, 'pipeline_updated', { tenderId });
            return reply.send({ data: { success: true, message: 'Notes updated' } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * DELETE /api/v1/pipeline/:tenderId
     * Remove a tender from the pipeline. Viewers cannot do this.
     */
    fastify.delete('/:tenderId', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { tenderId } = request.params;
        try {
            await db.delete(pipelineEntries)
                .where(and(eq(pipelineEntries.userId, user.userId), eq(pipelineEntries.tenderId, tenderId), eq(pipelineEntries.orgId, user.orgId)));
            await createAuditLog(request, 'delete', 'pipeline', tenderId);
            broadcastToOrg(user.orgId, 'pipeline_updated', { tenderId });
            return reply.send({ data: { success: true, message: 'Removed from pipeline' } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
}
