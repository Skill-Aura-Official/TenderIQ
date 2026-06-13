# Implementation Plan 2: GROWTH ENGINE
## *"The Four Revenue Multipliers"*

**Codename:** Project Shakti (शक्ति — Power)  
**Timeline:** 8 weeks (starts after Plan 1 is live)  
**Goal:** Build the 4 features that turn a ₹10L MRR product into a ₹1 Cr MRR product  
**Outcome:** AI Bid Copilot + L1 Rates + Enterprise Teams + Competitor Intel  

---

## User Review Required

> [!NOTE]
> **LLM architecture finalized:**
> - **Free/Basic Tier:** Google Gemini
> - **Medium/Pro Tier:** OpenAI GPT-4o
> - **Enterprise Tier:** Anthropic Claude 3.5 Sonnet

> [!WARNING]
> **New database tables:** This plan adds 4 new tables to [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts). Run migrations before deploying.
> 
> **New Python dependencies:** `playwright`, `2captcha-python` for results scraping. Add to [requirements.txt](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/scraper/requirements.txt).

---

## Proposed Changes

---

### Feature 1: AI Bid Writing Copilot (₹15-30L/mo revenue)

*The single highest-ROI feature. No Indian competitor offers self-serve AI bid writing.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

Add new tables for copilot:

```typescript
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
```

---

#### [NEW] `server/src/routes/copilot.ts`

The AI Bid Copilot API — streaming chat interface:

```typescript
export default async function copilotRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Paywall: Only Pro+ users can use copilot
  // Starter users get 3 free sessions/month, then ₹499/session
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.authUser!;
    if (user.subscriptionTier === 'free') {
      return reply.code(403).send({ 
        error: { code: 'UPGRADE_REQUIRED', message: 'AI Bid Copilot requires Starter plan or above' }
      });
    }
  });

  /**
   * POST /api/v1/copilot/chat
   * Streaming chat with AI about a specific tender
   * 
   * Body: { tenderId, conversationId?, message }
   * Response: Server-Sent Events (SSE) stream
   */
  fastify.post('/chat', async (request, reply) => {
    // 1. Load tender data (title, rawText, aiSummary, eligibilityCriteria)
    // 2. Load company profile (services, certs, experience, operating states)
    // 3. Load conversation history (last 20 messages for context)
    // 4. Construct system prompt:
    //    "You are TenderIQ Bid Copilot, an expert Indian government tender consultant.
    //     You help businesses prepare winning technical and commercial proposals.
    //     
    //     TENDER CONTEXT: {tender data}
    //     COMPANY PROFILE: {company data}
    //     
    //     RULES:
    //     - Always reference specific tender requirements from the document
    //     - Highlight where the company meets or doesn't meet eligibility
    //     - Use professional Indian government tender language
    //     - Format proposals for Indian government submission standards
    //     - Include sections: Technical Approach, Methodology, Team, Timeline
    //     - Flag missing documents or certifications"
    //
    // 5. Stream response via SSE (text/event-stream)
    // 6. Save messages to DB after stream completes
    // 7. Track token usage for billing
  });

  /**
   * GET /api/v1/copilot/conversations
   * List all copilot conversations for the user
   */

  /**
   * GET /api/v1/copilot/conversations/:id
   * Get full conversation with messages
   */

  /**
   * POST /api/v1/copilot/generate-proposal
   * Generate a structured proposal document from conversation context
   * 
   * Body: { tenderId, conversationId, sections: ['technical_approach', 'methodology', ...] }
   * Response: { proposalId, content (markdown), downloadUrl (docx) }
   */

  /**
   * POST /api/v1/copilot/export
   * Export proposal as Word/PDF
   * Uses server-side docx/pdf generation library
   */
}
```

#### [MODIFY] [app.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/app.ts)

```diff
+ import copilotRoutes from './routes/copilot.js';
  // ...
+ app.register(copilotRoutes, { prefix: '/api/v1/copilot' });
```

#### [NEW] `server/src/services/llm.ts`

Abstraction layer for LLM providers:

```typescript
export interface LLMProvider {
  streamChat(messages: ChatMessage[], options: StreamOptions): AsyncGenerator<string>;
  countTokens(text: string): number;
}

export class GeminiProvider implements LLMProvider { ... }
export class GPTProvider implements LLMProvider { ... }
export class ClaudeProvider implements LLMProvider { ... }

// Factory: returns provider based on user's tier
export function getLLMProvider(tier: string): LLMProvider {
  if (tier === 'enterprise') return new ClaudeProvider();
  if (tier === 'pro') return new GPTProvider();
  return new GeminiProvider();  // For starter/basic
}
```

#### [NEW] `client/src/components/CopilotPanel.tsx`

Slide-in panel UI on the tender detail page:
- Chat interface with markdown rendering
- "Generate Proposal" button with section selector
- Token usage counter
- Export to Word/PDF buttons
- Conversation history sidebar

---

### Feature 2: L1 Rate Intelligence (₹10-20L/mo revenue)

*Historical tender results database — who won, at what price. The #1 requested feature by contractors.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
// Tender Results Table (Historical awards data)
export const tenderResults = pgTable('tender_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id),     // May be null if tender isn't in our DB
  sourceHash: text('source_hash').unique().notNull(),            // Dedup key
  portalSlug: text('portal_slug').notNull(),
  tenderTitle: text('tender_title').notNull(),
  tenderRefNumber: text('tender_ref_number'),
  issuingAuthority: text('issuing_authority').notNull(),
  stateCodes: text('state_codes').notNull(),                     // JSON array
  categoryCodes: text('category_codes'),                         // JSON array
  estimatedValue: numeric('estimated_value'),                    // Original tender value
  awardedAmount: numeric('awarded_amount'),                      // Actual winning amount
  l1Rate: numeric('l1_rate'),                                    // L1 rate percentage (awarded/estimated * 100)
  winnerName: text('winner_name'),
  winnerGstNumber: text('winner_gst_number'),
  numberOfBidders: integer('number_of_bidders'),
  awardDate: timestamp('award_date'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
});
```

#### [NEW] `scraper/results_scraper.py`

Scrapes "Awarded Tenders" / "Results" sections from procurement portals:

```python
"""
L1 Rate Intelligence Scraper

Targets:
1. CPPP Results: eprocure.gov.in/cppp/resultdata
2. GePNIC Results: {portal}/nicgep/app?page=AwardOfContractList
3. GeM Order History: gem.gov.in (public order data)

Extracts:
- Tender title + reference number
- Estimated value vs awarded amount
- Winner name + GST number (if public)
- Number of bidders
- Award date

L1 Rate Calculation:
  l1_rate = (awarded_amount / estimated_value) * 100
  
  If l1_rate < 100: Winner bid BELOW estimated cost (competitive)
  If l1_rate = 100: Winner bid AT estimated cost
  If l1_rate > 100: Winner bid ABOVE estimated cost (rare)

Industry Insights Generated:
- Category-wise average L1 rates (e.g., "Civil Works in MH: avg 87.3% L1")
- Top winners by category (market intelligence)
- Competitive density (avg bidders per tender in category)
"""
```

#### [NEW] `server/src/routes/intelligence.ts`

Premium Intelligence API:

```typescript
export default async function intelligenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /api/v1/intelligence/l1-rates
   * Returns L1 rate analytics for a category/state combination
   * 
   * Query: ?category=civil_works&state=MH&period=12m
   * Response: { avgL1Rate, medianL1Rate, minL1Rate, maxL1Rate, sampleSize, trend }
   * 
   * Paywall: Pro+ only
   */

  /**
   * GET /api/v1/intelligence/tender/:id/similar-results
   * For a specific tender, find historically awarded tenders in same category
   * Shows: "Similar tenders were won at 85-92% of estimated value"
   * 
   * Paywall: Pro+ only (Starter sees blurred preview)
   */

  /**
   * GET /api/v1/intelligence/competitors
   * Competitor analysis: companies that win in user's categories
   * 
   * Query: ?category=it_services&state=DL
   * Response: [{ companyName, winsCount, avgBidAmount, winRate }]
   * 
   * Paywall: Enterprise only
   */

  /**
   * GET /api/v1/intelligence/market-report
   * Weekly aggregated market intelligence report
   * Categories: tender volume trends, price trends, top authorities, emerging categories
   * 
   * Paywall: Enterprise only (Starter/Pro see summary)
   */
}
```

#### [NEW] `client/src/components/L1RateCard.tsx`

Display on tender detail page:
- "Pricing Intelligence" section with gauge chart
- Average L1 rate for the tender's category + state
- "Recommended bid range: ₹X - ₹Y"
- Competitor win history in this category
- Historical trend sparkline chart (using existing Recharts dependency)

---

### Feature 3: Enterprise Team Management (Enables ₹14,999/mo tier)

*Your RBAC is already built. This plan wires it to a UI and adds team invite flows.*

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
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
```

#### [NEW] `server/src/routes/team.ts`

```typescript
export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireRole(['admin', 'tender_manager']));

  /**
   * GET /api/v1/team/members
   * List all members in the user's org with roles and last active dates
   */

  /**
   * POST /api/v1/team/invite
   * Send a team invitation email
   * Body: { email, role }
   * 
   * Enforces seat limits based on subscription tier:
   *   Starter: 1 seat (no invites)
   *   Pro: 1 seat (no invites) — upsell to Enterprise
   *   Enterprise: 5 seats
   *   Enterprise+: Unlimited
   */

  /**
   * POST /api/v1/team/invite/:token/accept
   * Accept an invitation — creates user record linked to the org
   */

  /**
   * PATCH /api/v1/team/members/:userId/role
   * Change a team member's role (admin only)
   */

  /**
   * DELETE /api/v1/team/members/:userId
   * Remove a member from the org (admin only)
   */
}
```

#### [MODIFY] [app.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/app.ts)

```diff
+ import teamRoutes from './routes/team.js';
+ import intelligenceRoutes from './routes/intelligence.js';
  // ...
+ app.register(teamRoutes, { prefix: '/api/v1/team' });
+ app.register(intelligenceRoutes, { prefix: '/api/v1/intelligence' });
```

#### [NEW] `client/src/app/dashboard/team/page.tsx`

Team management dashboard:
- Member list with role badges (Admin 🟣, Manager 🔵, Contributor 🟢, Viewer ⚪)
- "Invite Member" modal with email + role selector
- Seat usage bar: "3/5 seats used"
- Activity feed: who did what, when
- Role permissions matrix display

#### [NEW] `client/src/app/dashboard/settings/page.tsx`

Settings page covering:
- **Profile tab:** Company info, logo upload, operating states
- **Billing tab:** Current plan, usage, invoices, upgrade/downgrade
- **Team tab:** Links to team management
- **Notifications tab:** Email/WhatsApp opt-in/out toggles
- **API tab:** (Enterprise only) API key management

---

### Feature 4: Referral Engine + Growth Mechanics

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

```typescript
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
```

#### [NEW] `server/src/routes/referral.ts`

```typescript
// POST /api/v1/referral/generate    — Generate unique referral link
// GET  /api/v1/referral/stats       — Referral dashboard (sent, signed up, converted, earned)
// POST /api/v1/referral/track       — Track click (called from landing page)
// Webhook integration: When referred user upgrades, credit ₹500 to referrer
```

#### [NEW] `client/src/components/ReferralBanner.tsx`

In-app referral prompt:
- "Invite a colleague, get ₹500 credit"
- Shareable link with copy button
- WhatsApp share button (pre-formatted message)
- Stats: "You've referred 3 people, earned ₹1,500"

---

## Verification Plan

### Automated Tests

```bash
# Copilot streaming test
npm run test -- --grep "copilot"

# L1 rate aggregation test
npm run test -- --grep "intelligence"

# Team invitation flow
npm run test -- --grep "team"

# Results scraper
cd scraper && python -m pytest tests/test_results_scraper.py -v
```

### Manual Verification

- [ ] Open a tender → Click "AI Copilot" → Ask "What are the eligibility requirements?" → Get streaming AI response
- [ ] Ask Copilot to "Generate a technical proposal" → Get structured document → Export as Word
- [ ] View L1 Rate Intelligence on tender detail → See "Similar tenders won at 85-92%"
- [ ] Go to /dashboard/team → Invite a colleague → Colleague accepts → Appears in member list
- [ ] Colleague with "contributor" role can only see assigned tenders
- [ ] Generate referral link → Share → New user signs up → ₹500 credited
- [ ] Enterprise user sees Competitor Intelligence tab → Top winners in their category

---

## Summary: What Plan 2 Delivers

| Metric | Before Plan 2 | After Plan 2 |
|:-------|:-------------|:-------------|
| Revenue features | Subscription only | Copilot add-on + L1 Rates add-on + Enterprise tier |
| ARPU | ₹3,000-5,000/mo | ₹7,000-12,000/mo (with add-ons) |
| Enterprise readiness | RBAC in backend only | Full team UI + invite flow + seat management |
| Competitive moat | AI scoring | AI scoring + Bid writing + Historical data |
| Growth mechanics | Organic only | Referral engine + WhatsApp viral loops |
| **Target MRR** | ₹10L | **₹50L-₹1Cr** |
| **New recurring add-on revenue** | ₹0 | **₹15-50L/mo** |
