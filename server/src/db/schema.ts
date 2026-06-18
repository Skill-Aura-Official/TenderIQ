import { pgTable, text, integer, boolean, timestamp, numeric, customType, uuid, index } from 'drizzle-orm/pg-core';

// Custom type for vector if we don't have direct drizzle support
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as any)?.dimensions ?? 1024})`; // 1024 dimensions for bge-m3
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.replace('[', '').replace(']', '').split(',').map(Number);
  },
});

// Reseller Partners Table (Phase 2)
export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').unique(), // Custom domain (e.g., tenders.mycafirm.com)
  brandingConfig: text('branding_config'), // JSON: { logoUrl, primaryColor, name }
  revenueSharePercent: integer('revenue_share_percent').default(20),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Organizations Table (Multi-Tenancy)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  banReason: text('ban_reason'),
  allowedFeatures: text('allowed_features'), // JSON array string
  partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }), // Null if direct customer
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    partnerIdIdx: index('organizations_partner_id_idx').on(table.partnerId),
  };
});

// Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk User ID
  clerkId: text('clerk_id').unique().notNull(), // Clerk external ID
  email: text('email').unique().notNull(),
  phoneNumber: text('phone_number'), // Optional phone number for WhatsApp bot
  role: text('role').notNull().default('viewer'), // 'super_admin' | 'admin' | 'tender_manager' | 'contributor' | 'viewer'
  subscriptionTier: text('subscription_tier').notNull().default('free'), // 'free' | 'starter' | 'pro' | 'enterprise'
  razorpayCustomerId: text('razorpay_customer_id'),
  razorpaySubscriptionId: text('razorpay_subscription_id'),
  subscriptionStatus: text('subscription_status').notNull().default('free'), // 'free' | 'active' | 'trialing' | 'canceled' | 'unpaid'
  trialEndsAt: timestamp('trial_ends_at'),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  whatsappOptIn: boolean('whatsapp_opt_in').default(false).notNull(),
  channelOptOutEmail: boolean('channel_opt_out_email').default(false).notNull(),
  channelOptOutWhatsapp: boolean('channel_opt_out_whatsapp').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Subscription Plans Table
export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(),            // 'free' | 'starter' | 'pro' | 'enterprise'
  name: text('name').notNull(),
  priceMonthly: integer('price_monthly').notNull(), // in paise (199900 = ₹1,999)
  priceAnnual: integer('price_annual').notNull(),  // in paise
  razorpayMonthlyPlanId: text('razorpay_monthly_plan_id'),
  razorpayAnnualPlanId: text('razorpay_annual_plan_id'),
  tenderLimit: integer('tender_limit'),           // NULL = unlimited
  teamSeats: integer('team_seats').default(1),
  hasAiSummary: boolean('has_ai_summary').default(false),
  hasWhatsapp: boolean('has_whatsapp').default(false),
  hasVault: boolean('has_vault').default(false),
  hasPipeline: boolean('has_pipeline').default(false),
  hasApiAccess: boolean('has_api_access').default(false),
  priorityScraping: boolean('priority_scraping').default(false)
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
  isVerified: boolean('is_verified').default(false).notNull(),
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
  categoryCode: text('category_code'), // Used for future penalties
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Recommendations Table (Matches generated by worker)
export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companyProfiles.id, { onDelete: 'cascade' }).notNull(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
  score: integer('score').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'ready'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Recommendation Batches Table (For Notification Worker)
export const recommendationBatches = pgTable('recommendation_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companyProfiles.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull(), // 'pending' | 'ready'
  notifiedAt: timestamp('notified_at'),
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

// Copilot Conversations
export const copilotConversations = pgTable('copilot_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),         // Auto-generated from first message
  messageCount: integer('message_count').default(0).notNull(),
  tokensUsed: integer('tokens_used').default(0).notNull(),  // For usage billing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Copilot Messages
export const copilotMessages = pgTable('copilot_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => copilotConversations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),            // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  metadata: text('metadata'),              // JSON: {model, tokensIn, tokensOut, latencyMs}
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Generated Proposals (exportable documents)
export const generatedProposals = pgTable('generated_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => copilotConversations.id),
  title: text('title').notNull(),
  content: text('content').notNull(),       // Markdown content of the proposal
  format: text('format').notNull(),         // 'markdown' | 'docx' | 'pdf'
  gcsKey: text('gcs_key'),                  // Exported file in GCS
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tender Results Table (Historical awards data)
export const tenderResults = pgTable('tender_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id),     // May be null if tender isn't in our DB
  sourceHash: text('source_hash').unique().notNull(),            // Dedup key
  portalSlug: text('portal_slug').notNull(),
  tenderTitle: text('tender_title').notNull(),
  tenderRefNumber: text('tender_ref_number'),
  issuingAuthority: text('issuing_authority').notNull(),
  stateCodes: text('state_codes').notNull(),                     // JSON array string
  categoryCodes: text('category_codes'),                         // JSON array string
  estimatedValue: numeric('estimated_value'),                    // Original tender value
  awardedAmount: numeric('awarded_amount'),                      // Actual winning amount
  l1Rate: numeric('l1_rate'),                                    // L1 rate percentage (awarded/estimated * 100)
  winnerName: text('winner_name'),
  winnerGstNumber: text('winner_gst_number'),
  numberOfBidders: integer('number_of_bidders'),
  awardDate: timestamp('award_date'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
});

// Team Invitations
export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  invitedByUserId: text('invited_by_user_id').references(() => users.id).notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),             // 'tender_manager' | 'contributor' | 'viewer'
  token: text('token').unique().notNull(),  // Secure invite token
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'expired'
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Referral tracking
export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerUserId: text('referrer_user_id').references(() => users.id).notNull(),
  referredEmail: text('referred_email').notNull(),
  referralCode: text('referral_code').unique().notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'signed_up' | 'converted' | 'rewarded'
  referredUserId: text('referred_user_id').references(() => users.id),
  rewardAmount: integer('reward_amount'),  // paise
  rewardType: text('reward_type'),         // 'credit' | 'extension' | 'cash'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  convertedAt: timestamp('converted_at'),
});

// WhatsApp Interactions (Phase 1)
export const whatsappInteractions = pgTable('whatsapp_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id).notNull(),
  phoneNumber: text('phone_number').notNull(),
  messageType: text('message_type').notNull(), // 'incoming' | 'outgoing'
  content: text('content').notNull(),
  intent: text('intent'), // 'search' | 'pipeline_status' | 'help' | 'unknown'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Secure API keys (Phase 3)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // SHA-256 hashed API key
  prefix: text('prefix').notNull(),    // e.g., 'tiq_live_'
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  };
});

// Outbound Webhook Subscriptions (Phase 3)
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // Shared secret for HMAC-SHA256 signatures
  events: text('events').notNull(), // JSON array string
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    orgIdIdx: index('webhook_subscriptions_org_id_idx').on(table.orgId),
  };
});

