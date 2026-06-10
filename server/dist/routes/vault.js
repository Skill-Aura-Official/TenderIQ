import { db } from '../lib/db.js';
import { vaultDocuments, companyProfiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { generateUploadUrl, generateDownloadUrl } from '../lib/gcs.js';
import { broadcastToOrg } from '../lib/websocket.js';
export default async function vaultRoutes(fastify) {
    // All vault routes require authentication
    fastify.addHook('preHandler', requireAuth);
    /**
     * GET /api/v1/vault/documents
     * Returns the current user's active documents. Viewers cannot access the vault.
     */
    fastify.get('/documents', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        try {
            const docs = await db.select().from(vaultDocuments)
                .where(and(eq(vaultDocuments.userId, user.userId), eq(vaultDocuments.orgId, user.orgId), eq(vaultDocuments.isCurrent, true)));
            return reply.send({ data: docs });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * POST /api/v1/vault/upload-url
     * Generates a Google Cloud Storage signed URL for direct upload.
     * Only contributors and above can upload.
     */
    fastify.post('/upload-url', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { filename, docType } = request.body;
        if (!filename || !docType) {
            return reply.code(400).send({ error: { message: 'filename and docType are required' } });
        }
        // Validate MIME type from filename extension
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
        const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            return reply.code(400).send({
                error: { message: `File type "${ext}" is not allowed. Allowed: ${allowedExtensions.join(', ')}` }
            });
        }
        const gcsKey = `${user.orgId}/${user.userId}/${new Date()}_${filename}`;
        try {
            const { uploadUrl } = await generateUploadUrl(gcsKey, docType);
            return reply.send({
                data: {
                    uploadUrl,
                    gcsKey,
                }
            });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: 'Failed to generate upload URL', details: err.message } });
        }
    });
    /**
     * POST /api/v1/vault/documents
     * Confirms a file upload and records the document metadata in the database.
     */
    fastify.post('/documents', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { gcsKey, docType, displayName, fileSize, mimeType } = request.body;
        if (!gcsKey || !docType || !displayName) {
            return reply.code(400).send({ error: { message: 'gcsKey, docType, and displayName are required' } });
        }
        try {
            // Deactivate older version of the same docType for this user
            await db.update(vaultDocuments)
                .set({ isCurrent: false })
                .where(and(eq(vaultDocuments.userId, user.userId), eq(vaultDocuments.orgId, user.orgId), eq(vaultDocuments.docType, docType)));
            const docId = `doc_${new Date()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(vaultDocuments).values({
                docId,
                userId: user.userId,
                orgId: user.orgId,
                docType,
                displayName,
                gcsKey,
                fileSize: fileSize || 0,
                mimeType: mimeType || 'application/pdf',
                isCurrent: true,
                uploadedAt: new Date(),
            });
            // Auto-link certifications to company profile
            const [profile] = await db.select().from(companyProfiles)
                .where(eq(companyProfiles.userId, user.userId));
            if (profile) {
                let certs = JSON.parse(profile.certifications || '[]');
                let updated = false;
                const certMap = {
                    'iso_9001': 'ISO_9001',
                    'iso_27001': 'ISO_27001',
                    'msme': 'MSME',
                    'pan': 'PAN',
                    'gst': 'GST',
                };
                const targetCert = certMap[docType];
                if (targetCert && !certs.includes(targetCert)) {
                    certs.push(targetCert);
                    updated = true;
                }
                if (updated) {
                    await db.update(companyProfiles)
                        .set({
                        certifications: JSON.stringify(certs),
                        scoringVersion: profile.scoringVersion + 1,
                        updatedAt: new Date(),
                    })
                        .where(eq(companyProfiles.userId, user.userId));
                }
            }
            await createAuditLog(request, 'create', 'document', docId, { docType, displayName });
            broadcastToOrg(user.orgId, 'vault_updated', { docId });
            return reply.code(201).send({ data: { success: true, docId } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * DELETE /api/v1/vault/documents/:id
     * Soft-deletes a document. Only the owner or an admin can delete.
     */
    fastify.delete('/documents/:id', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { id } = request.params;
        try {
            // Ensure the document belongs to this user and org
            const [doc] = await db.select().from(vaultDocuments)
                .where(and(eq(vaultDocuments.id, id), eq(vaultDocuments.orgId, user.orgId)));
            if (!doc) {
                return reply.code(404).send({ error: { message: 'Document not found' } });
            }
            // Only the owner or an admin can delete
            if (doc.userId !== user.userId && user.role !== 'admin') {
                return reply.code(403).send({ error: { message: 'You can only delete your own documents' } });
            }
            await db.update(vaultDocuments)
                .set({ isCurrent: false, deletedAt: new Date() })
                .where(eq(vaultDocuments.id, id));
            await createAuditLog(request, 'delete', 'document', id);
            broadcastToOrg(user.orgId, 'vault_updated', { id });
            return reply.send({ data: { success: true, message: 'Document archived' } });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
    /**
     * GET /api/v1/vault/documents/:id/download-url
     * Generates a signed download URL from Google Cloud Storage.
     */
    fastify.get('/documents/:id/download-url', { preHandler: [requireRole(['admin', 'tender_manager', 'contributor'])] }, async (request, reply) => {
        const user = request.authUser;
        const { id } = request.params;
        try {
            const [doc] = await db.select().from(vaultDocuments)
                .where(and(eq(vaultDocuments.id, id), eq(vaultDocuments.orgId, user.orgId)));
            if (!doc) {
                return reply.code(404).send({ error: { message: 'Document not found' } });
            }
            // Only owner or admin can download
            if (doc.userId !== user.userId && user.role !== 'admin') {
                return reply.code(403).send({ error: { message: 'Access denied' } });
            }
            // Generate the actual signed download URL using our GCS utility
            const { downloadUrl, expiresAt } = await generateDownloadUrl(doc.gcsKey);
            return reply.send({
                data: { downloadUrl, expiresAt }
            });
        }
        catch (err) {
            return reply.code(500).send({ error: { message: err.message } });
        }
    });
}
