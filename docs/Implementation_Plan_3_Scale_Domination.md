# Implementation Plan 3: SCALE & DOMINATION
## *"From SaaS to Ecosystem"*

**Codename:** Project Vistar (विस्तार — Expansion)  
**Timeline:** 12 weeks (starts after Plan 2)  
**Goal:** Expand addressable market 10x, secure channel partners, and embed into enterprise workflows  
**Outcome:** WhatsApp Bot, White-label Partner Platform, Public API, Regional Languages  

---

## User Review Required

> [!NOTE]
> **Strategic decisions finalized:**
> - **WhatsApp Pricing:** Positioned as an affordable add-on at **₹299/mo** across all non-Enterprise tiers (Enterprise gets it included).
> - **White-label Pricing:** Revenue share model (e.g., 20-30% of their clients' fees) plus a one-time setup fee to cover domain/branding configuration.
> - **API Limits:** Standard 100 req/min for Enterprise tier. "Enterprise+" custom tiers can negotiate higher limits.

---

## Proposed Changes

---

### Feature 1: Interactive WhatsApp Bot (Engagement & Retention)

*Moving from one-way alerts to two-way interactions.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// WhatsApp Interactions
export const whatsappInteractions = pgTable('whatsapp_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id).notNull(),
  phoneNumber: text('phone_number').notNull(),
  messageType: text('message_type').notNull(), // 'incoming' | 'outgoing'
  content: text('content').notNull(),
  intent: text('intent'), // 'search' | 'pipeline_status' | 'help' | 'unknown'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### [NEW] `server/src/routes/whatsapp_webhook.ts`

```typescript
export default async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/webhooks/wati
   * Receives incoming messages from users via Wati
   */
  fastify.post('/wati', async (request, reply) => {
    // 1. Verify Wati webhook signature
    // 2. Extract phone number and message text
    // 3. Look up user by phone number (via Clerk or users table)
    // 4. Parse intent using simple regex or lightweight LLM (e.g., "Find IT tenders in Delhi")
    // 5. Execute action:
    //    - If "Search": Query tenders, format top 3 results, send reply
    //    - If "Pipeline": Query pipeline stages, summarize, send reply
    //    - If "Help": Send menu of commands
    // 6. Log interaction in `whatsappInteractions`
  });
}
```

#### [MODIFY] [app.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/app.ts)

```diff
+ import whatsappWebhookRoutes from './routes/whatsapp_webhook.js';
  // ...
+ app.register(whatsappWebhookRoutes, { prefix: '/api/v1/webhooks/whatsapp' });
```

---

### Feature 2: Partner / White-label Platform (₹50K-₹5L/mo per partner)

*Enabling CA firms and industry associations to resell TenderIQ.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// Partner Organizations (The resellers)
export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').unique(), // Custom domain (e.g., tenders.mycafirm.com)
  brandingConfig: text('branding_config'), // JSON: { logoUrl, primaryColor, name }
  revenueSharePercent: integer('revenue_share_percent').default(20),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Link client organizations to partners
export const organizations = pgTable('organizations', {
  // ... existing fields
  partnerId: uuid('partner_id').references(() => partners.id), // Null if direct customer
});
```

#### [NEW] `server/src/routes/partner.ts`

```typescript
export default async function partnerRoutes(fastify: FastifyInstance) {
  // Require 'partner_admin' role
  
  /**
   * GET /api/v1/partner/dashboard
   * Metrics: Total client orgs, active users, MRR generated, commission earned
   */

  /**
   * POST /api/v1/partner/clients
   * Provision a new client organization under the partner
   */

  /**
   * PATCH /api/v1/partner/branding
   * Update white-label settings (colors, logo, custom domain)
   */
}
```

#### [NEW] `client/src/middleware.ts`

Handle custom domain routing for white-label partners:
- Intercept requests
- Check host domain
- If custom domain, fetch branding config and apply to UI context
- Rewrite request to appropriate tenant path

---

### Feature 3: API & Webhooks for Enterprise Integration

*Embedding TenderIQ into corporate ERPs (SAP, Oracle) and CRMs (Salesforce).*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // Hashed key for security
  prefix: text('prefix').notNull(),    // e.g., 'tiq_live_'
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Webhook Subscriptions (Outbound)
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  url: text('url').notNull(),
  events: text('events').array().notNull(), // ['tender.matched', 'pipeline.updated']
  secret: text('secret').notNull(),         // For payload signature
  isActive: boolean('is_active').default(true),
});
```

#### [NEW] `server/src/routes/public_api.ts`

The developer-facing REST API:

```typescript
export default async function publicApiRoutes(fastify: FastifyInstance) {
  // Middleware to validate API keys (Bearer token)
  
  /**
   * GET /api/public/v1/tenders
   * Search tenders (supports pagination, filtering by state/category/value)
   */

  /**
   * GET /api/public/v1/tenders/:id
   * Get full tender details including AI summary and eligibility
   */

  /**
   * POST /api/public/v1/pipeline
   * Sync a tender to an external CRM
   */
}
```

---

### Feature 4: Regional Language Support (10x Addressable Market)

*Translating the UI and tender summaries to Hindi, Marathi, Tamil, etc.*

#### [NEW] `client/src/i18n/`

Implement Next.js Internationalization (i18n):
- `en.json`, `hi.json`, `mr.json`, `ta.json`
- Wrap text components with translation hooks (`useTranslation`)
- Add language switcher to Navbar

#### [MODIFY] `scraper/workers/summary_worker.py`

Instruct Gemini to generate summaries in the requested language (or store multiple translations):

```diff
- prompt = f"You are a civil engineering bid consultant..."
+ prompt = f"""You are a civil engineering bid consultant. 
+ Extract and summarize:
+ 1. The exact physical work...
+ 2. The most strict technical...
+ 
+ Provide the response in both English and Hindi.
+ Format: {{"en": {{"physicalWork": "...", ...}}, "hi": {{"physicalWork": "...", ...}}}}"""
```

---

## Verification Plan

### Automated Tests
```bash
# Webhook dispatch tests
npm run test -- --grep "webhooks.outbound"

# Public API rate limiting and auth tests
npm run test -- --grep "public_api"
```

### Manual Verification
- [ ] Send "Search IT tenders in UP" to the WhatsApp sandbox number → receive formatted list of 3 tenders
- [ ] Create a Partner org → Configure custom logo and primary color (red) → Access dashboard via partner URL → Verify red theme and custom logo
- [ ] Generate API Key → Make cURL request to `/api/public/v1/tenders` → Verify JSON response
- [ ] Configure outbound webhook URL (e.g., webhook.site) → Trigger a tender match → Verify POST payload arrives with correct HMAC signature
- [ ] Switch UI language to Hindi → Verify navigation, dashboard labels, and AI summaries appear in Hindi

---

## Summary: What Plan 3 Delivers

| Metric | Before Plan 3 | After Plan 3 |
|:-------|:-------------|:-------------|
| Integrations | None | REST API + Outbound Webhooks |
| Channel Sales | Direct sales only | White-label reseller platform |
| Platform Lock-in | Dashboard usage | Integrated deeply into customer ERP/CRM |
| Languages | English only | English + Hindi + Regional |
| Interaction | One-way alerts | Two-way conversational WhatsApp |
| **Market Position** | **SaaS Tool** | **B2B Procurement Ecosystem** |
