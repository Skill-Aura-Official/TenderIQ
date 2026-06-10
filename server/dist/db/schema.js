import { pgTable, text, integer, boolean, timestamp, numeric, customType, uuid } from 'drizzle-orm/pg-core';
// Custom type for vector if we don't have direct drizzle support
const vector = customType({
    dataType(config) {
        return `vector(${config?.dimensions ?? 1024})`; // 1024 dimensions for bge-m3
    },
    toDriver(value) {
        return `[${value.join(',')}]`;
    },
    fromDriver(value) {
        return value.replace('[', '').replace(']', '').split(',').map(Number);
    },
});
// Organizations Table (Multi-Tenancy)
export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    banReason: text('ban_reason'),
    allowedFeatures: text('allowed_features'), // JSON array string
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Users Table
export const users = pgTable('users', {
    id: text('id').primaryKey(), // Clerk User ID
    clerkId: text('clerk_id').unique().notNull(), // Clerk external ID
    email: text('email').unique().notNull(),
    role: text('role').notNull().default('viewer'), // 'super_admin' | 'admin' | 'tender_manager' | 'contributor' | 'viewer'
    subscriptionTier: text('subscription_tier').notNull().default('free'), // 'free' | 'pro'
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    whatsappOptIn: boolean('whatsapp_opt_in').default(false).notNull(),
    channelOptOutEmail: boolean('channel_opt_out_email').default(false).notNull(),
    channelOptOutWhatsapp: boolean('channel_opt_out_whatsapp').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Company Profiles Table
export const companyProfiles = pgTable('company_profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    companyName: text('company_name').notNull(),
    gstNumber: text('gst_number'),
    panNumber: text('pan_number'),
    msmeRegistered: boolean('msme_registered').default(false).notNull(),
    incorporationYear: integer('incorporation_year'),
    operatingStates: text('operating_states').array().notNull(), // Array of state codes
    servicesKeywords: text('services_keywords').array().notNull(),
    pastClientTypes: text('past_client_types').array(),
    maxTenderCapacity: numeric('max_tender_capacity').notNull(), // Max value they can bid on
    certifications: text('certifications').array().notNull(),
    // @ts-ignore
    companyEmbedding: vector('company_embedding', { dimensions: 1024 }), // Embedding of services + experience
    scoringVersion: integer('scoring_version').default(1).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// Tenders Table
export const tenders = pgTable('tenders', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    createdBy: text('created_by').references(() => users.id).notNull(),
    portalSlug: text('portal_slug').notNull(), // 'cppp' | 'gem' | 'maharashtra_eprocure' | ...
    portalTenderId: text('portal_tender_id').notNull(),
    nitNumber: text('nit_number'),
    issuingAuthority: text('issuing_authority').notNull(),
    title: text('title').notNull(),
    categoryCodes: text('category_codes').notNull(), // JSON array of strings
    stateCodes: text('state_codes').notNull(), // JSON array of state codes
    estimatedValue: numeric('estimated_value'), // in INR
    emdAmount: numeric('emd_amount'), // in INR
    submissionDeadline: timestamp('submission_deadline').notNull(),
    documentOpenDate: timestamp('document_open_date'),
    summaryStatus: text('summary_status').notNull(), // 'pending' | 'completed' | 'unavailable'
    aiSummary: text('ai_summary'), // JSON string
    eligibilityCriteria: text('eligibility_criteria'), // JSON string array
    requiredDocuments: text('required_documents').notNull(), // JSON array of string tags
    rawPdfGcsKey: text('raw_pdf_gcs_key'), // Google Cloud Storage key
    rawText: text('raw_text'), // Raw description/PQ details
    sourceUrl: text('source_url').notNull(),
    isCancelled: boolean('is_cancelled').default(false).notNull(),
    lastScrapedAt: timestamp('last_scraped_at').defaultNow().notNull(),
    sourceHash: text('source_hash').unique().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // @ts-ignore
    embedding: vector('embedding', { dimensions: 1024 }),
});
// Tender Assignments Table (Row-Level Security)
export const tenderAssignments = pgTable('tender_assignments', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    assignedBy: text('assigned_by').references(() => users.id).notNull(),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});
// User Tender Scores Table
export const userTenderScores = pgTable('user_tender_scores', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
    score: integer('score').notNull(), // 0 to 100
    breakdown: text('breakdown').notNull(), // JSON string
    missingCriteria: text('missing_criteria').notNull(), // JSON array
    scoredAt: timestamp('scored_at').defaultNow().notNull(),
    profileVersion: integer('profile_version').notNull(),
});
// Recommendation Feedback Table
export const recommendationFeedback = pgTable('recommendation_feedback', {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationId: text('recommendation_id').notNull(), // Reference to a recommendation system id
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    signal: text('signal').notNull(), // 'saved' | 'dismissed' | 'clicked'
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Pipeline Entries Table
export const pipelineEntries = pgTable('pipeline_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
    stage: text('stage').notNull(), // 'discovered' | 'under_review' | 'preparing' | 'submitted' | 'won' | 'lost' | 'cancelled'
    notes: text('notes'),
    stageHistory: text('stage_history').notNull(), // JSON string
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
// Vault Documents Table
export const vaultDocuments = pgTable('vault_documents', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    docType: text('doc_type').notNull(), // 'gst' | 'pan' | 'msme' | 'iso_9001' | 'experience' | 'other'
    displayName: text('display_name').notNull(),
    gcsKey: text('gcs_key').notNull(), // Google Cloud Storage key
    fileSize: integer('file_size').notNull(), // bytes
    mimeType: text('mime_type').notNull(),
    isCurrent: boolean('is_current').default(true).notNull(),
    verificationStatus: text('verification_status').default('pending').notNull(), // 'pending', 'verified', 'rejected'
    verificationNotes: text('verification_notes'),
    ocrExtractedData: text('ocr_extracted_data'), // JSON string
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // soft delete timestamp
});
// Notification Log Table
export const notificationLog = pgTable('notification_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(), // 'new_match' | 'deadline_t7' | 'deadline_t2' | 'corrigendum' | 'cancellation'
    channel: text('channel').notNull(), // 'email' | 'whatsapp' | 'sms'
    status: text('status').notNull(), // 'queued' | 'sent' | 'delivered' | 'failed'
    externalId: text('external_id'),
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    failedReason: text('failed_reason'),
});
// Audit Logs Table (Immutable)
export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(), // Who performed the action
    orgId: uuid('org_id').notNull(), // Which org context
    action: text('action').notNull(), // 'create' | 'update' | 'delete' | 'login' | 'assign' | 'approve'
    resourceType: text('resource_type').notNull(), // 'tender' | 'proposal' | 'user' | 'document' | 'pipeline'
    resourceId: text('resource_id'), // The ID of the affected resource
    details: text('details'), // JSON string with extra context
    ipAddress: text('ip_address'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
});
