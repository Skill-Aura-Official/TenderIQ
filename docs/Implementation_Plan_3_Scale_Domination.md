# Implementation Plan 3: SCALE & DOMINATION (Project Vistar)
## *"From SaaS to Ecosystem"*

**Codename:** Project Vistar (विस्तार — Expansion)  
**Timeline:** 12 weeks (starts after Plan 2)  
**Goal:** Expand addressable market 10x, secure channel partners, and embed into enterprise workflows.  
**Outcome:** Secured WhatsApp Bot, Reseller White-label Platform, Enterprise-grade Public API, Outgoing Webhook Engine, Regional Languages.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions for Resellers & APIs:**
> - **Domain Routing & SSL:** Custom domains (e.g., `tenders.mycafirm.com`) require dynamic SSL termination. We will integrate a reverse proxy (e.g., Caddy or Cloudflare for SaaS) to auto-provision Let's Encrypt certificates.
> - **Outbound Webhook Failures:** To prevent blocking main execution threads, outbound webhooks will use an asynchronous queue with exponential backoff. Retries will execute at 1m, 5m, 15m, 1h, and 6h before sending requests to a Dead Letter Queue (DLQ).
> - **On-Demand AI Translation:** To minimize Gemini API token consumption and database bloat, tender summaries will be generated in English and translated to regional languages (Hindi, Marathi, Tamil, etc.) *on-demand* and cached.

---

## Proposed Changes

### Feature 1: Two-Way Interactive WhatsApp Bot (Wati Integration)

*Moving from passive alerts to interactive conversational query resolution.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// WhatsApp Interactions Tracker
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

Handles incoming webhook payloads from Wati (or Meta directly) with strict signature verification:

```typescript
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { users, whatsappInteractions } from '../db/schema.js';
import { rateLimit } from '../lib/rateLimit.js';

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
      // In prod, send a generic template inviting them to subscribe to TenderIQ
      return reply.send({ success: false, message: 'Unrecognized contact number' });
    }

    // 3. Process Intent (輕量 LLM Parser or Regex)
    let intent = 'unknown';
    let replyText = '';
    
    if (/find|search|tender/i.test(messageText)) {
      intent = 'search';
      // Execute query on tenders and build markdown response containing top 3 recommendations
    } else if (/pipeline|status/i.test(messageText)) {
      intent = 'pipeline_status';
      // Query pipelineStages table and summarize
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
```

---

### Feature 2: Reseller / White-label Platform (Tenant Isolation)

*Enabling partners (e.g., CA firms, legal associations) to offer TenderIQ under their own brand.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// Reseller Partners Table
export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').unique(), // e.g., 'tenders.mycafirm.com'
  brandingConfig: text('branding_config'), // JSON: { logoUrl, primaryColor, name }
  revenueSharePercent: integer('revenue_share_percent').default(20),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Modify Organizations to support reseller tenancy
export const organizations = pgTable('organizations', {
  // ... existing fields
  partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }), // Null = direct TenderIQ user
});
```

#### [NEW] `server/src/routes/partner.ts`

Provides resellers access to configure branding and view client statistics:

```typescript
export default async function partnerRoutes(fastify: FastifyInstance) {
  // Enforce preHandler check: Verify user is a partner administrator
  
  /**
   * GET /api/v1/partner/dashboard
   * Summarizes partner revenue, active tenants, and billing cycles
   */
  
  /**
   * PATCH /api/v1/partner/branding
   * Mutates brandingConfig (logo, primaryColor, name) and dynamic domain endpoints
   */
}
```

#### [MODIFY] `client/src/middleware.ts`

- Read incoming request hostname.
- If hostname matches a registered reseller domain, rewrite path header to include the tenant context (e.g., `/partner/[partnerId]/dashboard`).
- Render custom UI styling (colors, title, logo) loaded from partner config caching layers.

---

### Feature 3: Enterprise Public API & Webhook Dispatcher

*Enabling customers to sync tenders, matches, and pipeline events directly to ERPs/CRMs.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// Secure hashed API keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // Hashed key representation (SHA-256)
  prefix: text('prefix').notNull(),    // e.g., 'tiq_live_'
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Outbound Webhook Subscriptions
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // Shared secret for HMAC-SHA256 signatures
  events: text('events').notNull(), // JSON array: e.g., '["tender.matched", "pipeline.stage_updated"]'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### [NEW] `server/src/lib/webhookDispatcher.ts`

Asynchronously dispatches webhook payloads, appending a signature for data integrity:

```typescript
import crypto from 'crypto';
import fetch from 'node-fetch';

export async function dispatchWebhook(url: string, secret: string, event: string, payload: any) {
  const body = JSON.stringify({ event, timestamp: Date.now(), data: payload });
  
  // Compute signature (HMAC-SHA256)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Push to async execution queue or dispatch directly with timeout
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TenderIQ-Signature': signature,
        'User-Agent': 'TenderIQ-Webhook-Bot/1.0'
      },
      body,
      timeout: 5000 // 5-second max wait
    });
    
    return res.ok;
  } catch (err) {
    // Queue retry job on failure (exponential backoff)
    return false;
  }
}
```

#### [NEW] `server/src/routes/public_api.ts`

Exposes search and download capabilities to external platforms:

```typescript
export default async function publicApiRoutes(fastify: FastifyInstance) {
  // Apply api key extraction and verification middleware
  // Track rate limiting: enforce X-RateLimit-Limit, X-RateLimit-Remaining headers
}
```

---

### Feature 4: Regional Language Support & On-Demand Translation

*Expanding the addressable market across India by supporting native languages.*

#### [NEW] `client/src/i18n/`
- Introduce `next-i18next` localized string configurations for English, Hindi (hi), Marathi (mr), and Tamil (ta).
- Navbar UI language toggle.

#### [MODIFY] `server/src/services/translation.ts` (Or worker layers)
- When a regional user requests a tender summary page, check if the summary cache contains their translation locale.
- If not, invoke Gemini to translate the English summary into target language, save translation in DB context, and return:
  ```json
  {
    "tenderId": "...",
    "locale": "hi",
    "translatedSummary": { ... }
  }
  ```

---

## Database Indexing Optimizations

To prepare the database for the scale increase, we will add the following non-breaking indexes in schema initialization:
- `api_keys(key_hash)` for O(1) API credential validation.
- `organizations(partner_id)` for tenant resellers scoping queries.
- `webhook_subscriptions(org_id)` for quick outbound dispatch lookups.

---

## Verification Plan

### Automated Testing Suite
- **Public API Tests:** Assert `401 Unauthorized` for invalid API tokens, assert rate limiting headers on bulk hits.
- **Webhook Dispatch Tests:** Mock local listener, dispatch event, assert validation of signature header matches local secret.

### Manual Verification Checklist
- [ ] Connect a Wati sandbox number, text search query, confirm receipt of formatted markdown matching database results.
- [ ] Set up a white-label partner, map custom domain host header, confirm client portal uses custom resellers branding configurations.
- [ ] Enable outbound webhook subscription, transition a tender pipeline entry stage, assert webhook payload reaches destination with header signature intact.
