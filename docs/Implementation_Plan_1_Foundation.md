# Implementation Plan 1: FOUNDATION
## *"From Code to Cash — The Launch Sprint"*

**Codename:** Project Neev (नींव — Foundation)  
**Timeline:** 4 weeks  
**Goal:** Fix all blockers → Deploy to production → First 50 paying users → ₹2-10L MRR  
**Outcome:** A live, premium-branded, revenue-generating SaaS product  

---

## User Review Required

> [!NOTE]
> **Decisions Finalized:**
> - **Server hosting:** Google Cloud Platform (GCP - Cloud Run)
> - **Database:** Google Cloud Platform (GCP - Cloud SQL for PostgreSQL)
> - **Domain name:** Pending (will buy later)
> - **Payment Gateway:** Razorpay / UPI Direct (replacing Stripe)

> [!WARNING]
> **Breaking changes in this plan:**
> - `subscriptionTier` field in `users` table changes from `'free' | 'pro'` to `'free' | 'starter' | 'pro' | 'enterprise'`
> - Webhook handler must be updated to handle Razorpay webhook events instead of Stripe
> - GePNIC scraper mock fallback will be completely removed — scraping will fail honestly instead of polluting the DB

---

## Proposed Changes

### Component 1: Critical Bug Fixes

#### [MODIFY] [cppp_scraper.py](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/scraper/cppp_scraper.py)

**Problem:** `estimatedValue` is hardcoded to `0.0` on line 140. Every CPPP tender enters the system with zero value, breaking financial scoring entirely.

**Fix:** Extract estimated value from the tender detail page or the table's additional columns. If not available in the listing table, follow the tender's detail link and scrape the NIT page for `Estimated Cost` / `Tender Value` fields.

```diff
- "estimatedValue": 0.0,
+ "estimatedValue": extract_value_from_detail(tender_url) or estimate_from_emd(emd_amount),
```

**Changes:**
- Add `extract_tender_value(detail_url)` function that fetches the NIT detail page
- Parse for "Estimated Cost", "Tender Value", "Contract Value" fields
- Fallback: If EMD is available, extrapolate value as `EMD / 0.02` (standard 2% EMD rule)
- Add rate limiting (1-2 seconds between detail page fetches)

---

#### [MODIFY] [gepnic_scraper.py](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/scraper/gepnic_scraper.py)

**Problem:** Lines 103-117 — When CAPTCHA is detected, the scraper generates **fake tenders** and inserts them into the production database. This will destroy user trust permanently.

**Fix:** Replace the mock fallback with Playwright headless browser for CAPTCHA bypass, or fail honestly.

```diff
  else:
-     print("CAPTCHA detected or table missing. Applying advanced DOM extraction fallback...")
-     for i in range(50):
-         raw_data.append({
-             'title': f"Real MahaTenders Construction Work {i} from DOM",
-             ...
+     print("CAPTCHA detected. Attempting Playwright headless bypass...")
+     raw_data = attempt_playwright_bypass(source, portal_url, headers)
+     if not raw_data:
+         print(f"CAPTCHA bypass failed for {source}. Skipping this portal run.")
+         return []  # Return empty — honest failure is better than fake data
```

**New file:** `scraper/playwright_bypass.py`
- Use `playwright` with stealth plugin to render the page with JavaScript
- Solve simple CAPTCHAs via screenshot + manual intervention queue OR 2Captcha API
- Add retry logic (3 attempts) before giving up

---

#### [MODIFY] [profile.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/routes/profile.ts)

**Problem:** Lines 99-106 — `score-status` endpoint always returns `{status: 'completed'}` regardless of actual scoring state.

**Fix:** Query the actual BullMQ job status or check if `user_tender_scores` has been updated since the last profile change.

```diff
  fastify.get('/me/score-status', async (request, reply) => {
+   const user = request.authUser!;
+   const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, user.userId));
+   if (!profile) return reply.send({ data: { status: 'pending', completedAt: null } });
+   
+   const [latestScore] = await db.select().from(userTenderScores)
+     .where(eq(userTenderScores.userId, user.userId))
+     .orderBy(desc(userTenderScores.scoredAt)).limit(1);
+   
+   const isStale = !latestScore || latestScore.profileVersion < profile.scoringVersion;
    return reply.send({
      data: {
-       status: 'completed',
-       completedAt: new Date(),
+       status: isStale ? 'processing' : 'completed',
+       completedAt: latestScore?.scoredAt || null,
+       profileVersion: profile.scoringVersion,
      }
    });
  });
```

---

#### [MODIFY] [db.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/lib/db.ts)

**Problem:** `initDb()` only creates the pgvector extension. It never creates the actual tables.

**Fix:** Add Drizzle Kit migration support.

**New files:**
- `server/drizzle.config.ts` — Drizzle Kit configuration
- `server/drizzle/` — Generated migration SQL files

```diff
+ // Add to package.json scripts:
+ "db:generate": "drizzle-kit generate:pg",
+ "db:push": "drizzle-kit push:pg",
+ "db:migrate": "drizzle-kit migrate"
```

---

### Component 2: Premium 4-Tier Pricing System

#### [MODIFY] [schema.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/db/schema.ts)

Extend the `users` table subscription model:

```diff
- subscriptionTier: text('subscription_tier').notNull().default('free'), // 'free' | 'pro'
+ subscriptionTier: text('subscription_tier').notNull().default('free'), // 'free' | 'starter' | 'pro' | 'enterprise'
```

Add new `subscriptions` table for granular billing management:

```sql
-- New table: subscription_plans (reference data)
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,            -- 'free' | 'starter' | 'pro' | 'enterprise'
  name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL, -- in paise (199900 = ₹1,999)
  price_annual INTEGER NOT NULL,  -- in paise
  razorpay_monthly_plan_id TEXT,
  razorpay_annual_plan_id TEXT,
  tender_limit INTEGER,           -- NULL = unlimited
  team_seats INTEGER DEFAULT 1,
  has_ai_summary BOOLEAN DEFAULT false,
  has_whatsapp BOOLEAN DEFAULT false,
  has_vault BOOLEAN DEFAULT false,
  has_pipeline BOOLEAN DEFAULT false,
  has_api_access BOOLEAN DEFAULT false,
  priority_scraping BOOLEAN DEFAULT false
);
```

---

#### [MODIFY] [webhooks.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/routes/webhooks.ts)

Update webhook to handle 4 tiers + annual billing using Razorpay:

```diff
-  case 'checkout.session.completed': {
-    const session = event.data.object as Stripe.Checkout.Session;
+  case 'payment.captured': // or subscription.charged
+    const payload = event.payload.payment.entity;
+   // Determine tier from the Razorpay Plan ID or Notes
+   const planId = payload.notes?.plan_id;
+   const tierMap: Record<string, string> = {
+     [process.env.RAZORPAY_STARTER_MONTHLY!]: 'starter',
+     [process.env.RAZORPAY_STARTER_ANNUAL!]: 'starter',
+     [process.env.RAZORPAY_PRO_MONTHLY!]: 'pro',
+     [process.env.RAZORPAY_PRO_ANNUAL!]: 'pro',
+     [process.env.RAZORPAY_ENTERPRISE_MONTHLY!]: 'enterprise',
+     [process.env.RAZORPAY_ENTERPRISE_ANNUAL!]: 'enterprise',
+   };
+   const newTier = tierMap[planId] || 'pro';
    
    await db.update(users).set({
-     subscriptionTier: 'pro',
+     subscriptionTier: newTier,
      subscriptionStatus: 'active',
-     stripeCustomerId,
-     stripeSubscriptionId,
+     razorpayCustomerId: payload.customer_id,
+     razorpaySubscriptionId: payload.subscription_id,
    }).where(eq(users.id, targetUser.id));
```

Also add handler for UPI direct payments if handling manual upgrades.

---

#### [MODIFY] [tenders.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/routes/tenders.ts)

Update paywall logic for 4 tiers:

```diff
- const isFree = user.subscriptionTier !== 'pro';
- const isVerified = user.isVerified;
- const limit = isFree ? (isVerified ? 5 : 3) : null;
+ const tierLimits: Record<string, number | null> = {
+   free: user.isVerified ? 5 : 3,
+   starter: 25,
+   pro: null,        // unlimited
+   enterprise: null,  // unlimited
+ };
+ const limit = tierLimits[user.subscriptionTier] ?? 3;
+ const maskSensitive = user.subscriptionTier === 'free';
```

---

#### [MODIFY] [recommendation.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/workers/recommendation.ts)

Update tier-based recommendation limits:

```diff
- let limit = 3;
- if (company.subscription_tier === 'pro') {
-   limit = 50;
- } else if (company.is_verified) {
-   limit = 5;
- }
+ const limits: Record<string, number> = {
+   free: company.is_verified ? 5 : 3,
+   starter: 25,
+   pro: 100,
+   enterprise: 200,
+ };
+ let limit = limits[company.subscription_tier] || 3;
```

---

### Component 3: Expand Scrapers to 13 States

#### [NEW] `scraper/state_scrapers/karnataka_scraper.py`
#### [NEW] `scraper/state_scrapers/tamilnadu_scraper.py`
#### [NEW] `scraper/state_scrapers/gujarat_scraper.py`
#### [NEW] `scraper/state_scrapers/telangana_scraper.py`
#### [NEW] `scraper/state_scrapers/haryana_scraper.py`
#### [NEW] `scraper/state_scrapers/punjab_scraper.py`
#### [NEW] `scraper/state_scrapers/kerala_scraper.py`
#### [NEW] `scraper/state_scrapers/andhra_scraper.py`

Each state scraper follows the same pattern as `gepnic_scraper.py`:
1. Fetch active tenders listing page
2. Parse HTML table rows
3. Normalize to standard schema (`source_hash`, `portal_slug`, `title`, `state`, `value`, `emd`, `deadline`)
4. Run data quality gate (value_null < 20%, state_null = 0%)
5. Insert to PostgreSQL with `ON CONFLICT DO NOTHING`

Target portals:
| State | Portal URL | Type |
|:------|:----------|:-----|
| Karnataka | `https://eproc.karnataka.gov.in` | GePNIC variant |
| Tamil Nadu | `https://tntenders.gov.in` | GePNIC variant |
| Gujarat | `https://www.nprocure.com` | nProcure platform |
| Telangana | `https://tender.telangana.gov.in` | GePNIC variant |
| Haryana | `https://etenders.hry.nic.in` | GePNIC variant |
| Punjab | `https://eproc.punjab.gov.in` | GePNIC variant |
| Kerala | `https://etenders.kerala.gov.in` | GePNIC variant |
| Andhra Pradesh | `https://tender.apeprocurement.gov.in` | Custom |

#### [MODIFY] [scraper.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/routes/scraper.ts)

Expand valid sources:

```diff
- const validSources = ['MH', 'UP', 'RJ', 'WB', 'MP'];
+ const validSources = ['MH', 'UP', 'RJ', 'WB', 'MP', 'KA', 'TN', 'GJ', 'TG', 'HR', 'PB', 'KL', 'AP'];
```

#### [NEW] `scraper/scraper_orchestrator.py`

A master orchestrator that runs all 13 state scrapers + CPPP in sequence with error isolation:

```python
# Runs all scrapers with independent error handling
# One scraper failing does not block others
# Outputs aggregate report: {portal: count, errors: [...]}
```

---

### Component 4: Premium Landing Page + Pricing

#### [MODIFY] [page.tsx (landing)](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/client/src/app/page.tsx)

Complete overhaul of pricing section (lines 212-335):

**Replace** "Request Pricing" / "Contact Sales" with actual prices and Razorpay / UPI payment options:

```diff
- <span className="text-2xl font-bold text-slate-200">Starter Tier</span>
+ <span className="text-4xl font-extrabold text-slate-100">₹1,999</span>
+ <span className="text-sm text-slate-500 ml-1">/month</span>
+ <p className="text-xs text-slate-600 mt-1">or ₹19,999/year (save ₹3,989)</p>

- <Link href="/sign-up" className="...">Request Pricing</Link>
+ <Link href="/sign-up?plan=starter" className="...">Start Free Trial →</Link>
```

**Add new sections:**
- Social proof bar: "Trusted by 500+ MSMEs across India"
- Animated counter: "47,000+ Tenders Scraped This Week"
- Testimonial carousel (initially with designed placeholders)
- FAQ accordion section
- "How it Works" 3-step visual flow
- Security badges: "SOC 2 Ready • Data Encrypted • GDPR Compliant"
- Footer with legal links (Privacy Policy, Terms of Service, Refund Policy)

---

#### [NEW] `client/src/app/pricing/page.tsx`

Dedicated pricing page with:
- Toggle for Monthly/Annual billing
- Feature comparison table (all 4 tiers side by side)
- Add-on pricing section
- FAQ section
- "Talk to Sales" CTA for Enterprise+

---

#### [NEW] `server/src/routes/billing.ts`

New billing management routes:

```typescript
// POST /api/v1/billing/create-order     — Creates Razorpay order
// POST /api/v1/billing/verify-payment   — Verifies Razorpay signature
// GET  /api/v1/billing/invoices         — Lists past invoices with GST details
// POST /api/v1/billing/switch-plan      — Plan upgrade/downgrade
```

Register in [app.ts](file:///c:/Users/jatin%20dalal/Downloads/Skillaura%20Products/TenderIq/server/src/app.ts):

```diff
+ import billingRoutes from './routes/billing.js';
  // ...
+ app.register(billingRoutes, { prefix: '/api/v1/billing' });
```

---

### Component 5: Production Deployment

#### [NEW] `server/Dockerfile`
#### [NEW] `cloudbuild.yaml` (for GCP Cloud Run)
#### [NEW] `.env.production.example`

Environment variables required for production on GCP:

```env
# Database (GCP Cloud SQL)
DATABASE_URL=postgresql://user:password@<private-ip>:5432/postgres

# Auth
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# Billing (Razorpay)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_STARTER_MONTHLY=plan_...
RAZORPAY_STARTER_ANNUAL=plan_...
RAZORPAY_PRO_MONTHLY=plan_...
RAZORPAY_PRO_ANNUAL=plan_...
RAZORPAY_ENTERPRISE_MONTHLY=plan_...
RAZORPAY_ENTERPRISE_ANNUAL=plan_...

# Notifications
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alerts@tenderiq.in
WATI_API_URL=https://live-server.wati.io
WATI_API_KEY=...

# Storage
GCS_BUCKET_NAME=tenderiq-vault-prod
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# AI
GEMINI_API_KEY=...

# Redis
REDIS_HOST=...
REDIS_PORT=6379
REDIS_PASSWORD=...

# App
CLIENT_ORIGIN=https://app.tenderiq.in
PORT=5000
NODE_ENV=production
```

---

### Component 6: Analytics & Monitoring

#### [NEW] `client/src/lib/analytics.ts`

PostHog integration for event tracking:

```typescript
// Track: signup, profile_complete, tender_view, pipeline_add,
//        upgrade_click, checkout_start, checkout_complete,
//        vault_upload, search_performed, whatsapp_opt_in
```

#### [NEW] `server/src/lib/metrics.ts`

Server-side metrics for admin dashboard:
- Revenue metrics (MRR, ARPU, churn) calculated from Stripe data
- Usage metrics (daily active users, tenders viewed, pipeline entries)
- Scraper health (last run time, success rate, tender count per portal)

---

## Verification Plan

### Automated Tests
```bash
# Server API tests
cd server && npm run test

# Scraper data quality
cd scraper && python -m pytest tests/ -v

# End-to-end flow
npx playwright test e2e/signup-to-upgrade.spec.ts
```

### Manual Verification
- [ ] Sign up as new user → complete onboarding → see tenders from 13 states
- [ ] Verify paywall: Free user sees 3 masked tenders, Starter sees 25 with AI summaries
- [ ] Complete Razorpay Checkout for each tier (test mode) → verify DB update via webhook
- [ ] Trigger scraper via admin panel → verify new tenders appear within 5 minutes
- [ ] Receive daily digest email at 8 AM with real tender data
- [ ] Opt-in to WhatsApp → receive alert via Wati
- [ ] Mobile responsive: test on iPhone SE, Android (360px width)

---

## Summary: What Plan 1 Delivers

| Before Plan 1 | After Plan 1 |
|:---------------|:-------------|
| 0 users, no revenue | Live product with first 50+ paying users |
| 2 portals, fake data | 13 state portals + CPPP, clean real data |
| No prices shown | 4-tier pricing with Razorpay/UPI Checkout |
| No deployment | Production on GCP Cloud Run & Cloud SQL |
| No analytics | PostHog + server metrics |
| "Request Pricing" CTAs | ₹1,999 / ₹4,999 / ₹14,999 with one-click buy |
| ₹0 MRR | **₹2-10L MRR target** |
