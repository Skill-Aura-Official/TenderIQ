TenderIQ
Technical Requirements Document
Backend Architecture & System Design — V1
May 2026  |  Engineering — Confidential


Version
Status
Author
Based On
1.0
Draft
Engineering
PRD V1.0

1. Scope & Design Principles

This document defines the technical architecture for TenderIQ V1. It covers system design, data models, API contracts, authentication, third-party dependencies, and scalability strategy. It is the authoritative reference for backend, frontend, and infrastructure engineers during V1 build.

1.1  Design Principles
Boring tech where possible: Prefer well-understood tools over cutting-edge ones. PostgreSQL, Redis, standard REST. Novelty goes into the AI layer, not the plumbing.
Async by default for heavy work: Scraping, AI summarisation, eligibility scoring, and notifications all run asynchronously. No user request should block on these.
Isolate the volatile parts: Scrapers and AI calls are the highest failure-surface areas. They run in dedicated workers, not inside the API server process.
Schema-first API design: All API contracts are defined before coding begins. Frontend and backend build against the contract, not each other.
PII handled at the edge: GST numbers, PAN, and user emails are encrypted at rest. They never appear in application logs.
Design for replaceability: Third-party integrations (LLM provider, notification vendor, storage) are wrapped behind internal interfaces so they can be swapped without rewriting business logic.
2. System Architecture Overview

2.1  High-Level Components
V1 is a monorepo split into logical service boundaries. Components communicate via HTTP internally and async queues for background work. No microservices at launch — a modular monolith is the right call until load demands otherwise.

Component
Technology
Responsibility
Web Frontend
Next.js 14 (App Router)
All user-facing UI. SSR for SEO-sensitive pages, CSR for dashboard.
API Server
Node.js + Fastify
REST API, auth, business logic orchestration.
Scraper Workers
Python + Playwright/Scrapy
Headless browser scraping of procurement portals. Runs on a separate worker pool.
AI Pipeline Worker
Python + LLM SDK
PDF parsing, AI summarisation, eligibility scoring. Consumes from job queue.
Job Queue
BullMQ (Redis-backed)
Async task management for scraping, AI, and notification jobs.
Primary Database
PostgreSQL 15
All application state: users, tenders, profiles, pipeline, vault metadata.
Search Index
PostgreSQL full-text search (V1)
Tender keyword search. Migrate to Typesense post-V1 if needed.
Cache Layer
Redis 7
Session tokens, rate limiting, job queue backend, short-TTL tender lists.
File Storage
AWS S3 (or compatible)
Document Vault files, raw tender PDFs, AI input/output artifacts.
Notification Service
Node.js micromodule
Dispatches email, WhatsApp, SMS. Consumes from notification queue.
Reverse Proxy
Nginx
SSL termination, static asset caching, upstream routing.

2.2  Data Flow — Tender Ingestion
Step-by-step pipeline
Scheduler triggers Scraper Worker every 6 hours per portal
Scraper downloads tender listing pages; extracts tender metadata (title, portal ID, issuing authority, deadline, value, PDF URL)
Scraper pushes a `tender.raw_ingested` job to BullMQ with raw metadata + PDF URL
AI Pipeline Worker picks up the job, downloads the PDF from S3 (or directly from portal), runs extraction prompt against LLM
LLM returns structured JSON: summary fields, eligibility criteria list, EMD, required documents
Worker validates the JSON schema; if invalid or PDF was unreadable → marks tender as `summary_unavailable`
Worker writes completed tender record to PostgreSQL; triggers `tender.match_scores_pending` job
Match scoring worker iterates over all active user profiles and writes `user_tender_scores` rows
Notification worker checks for newly scored tenders above user threshold → queues alert messages

2.3  Deployment Topology
Hosting: Single cloud region (Mumbai — ap-south-1) for V1. Indian data residency satisfies likely early enterprise requirements.
Compute: API Server and Frontend on managed container service (Railway, Render, or ECS Fargate). Worker pool on separate instances.
Database: Managed PostgreSQL (RDS or Supabase). Automated daily backups, PITR enabled from Day 1.
Redis: Managed Redis (Upstash or ElastiCache). Persistence enabled for queue durability.
Storage: AWS S3 with server-side encryption (SSE-S3). Separate buckets for user documents vs. raw scraped PDFs.
CI/CD: GitHub Actions → build → test → deploy. Branch-based environments for staging.
Observability: Structured JSON logs → Axiom or Logtail. Error tracking via Sentry. Uptime via BetterStack.
3. Frontend Responsibilities

Frontend owns the UI layer only. It never performs business logic, eligibility calculations, or data transformation. All derived data is computed server-side and served via API.

3.1  Tech Stack
Concern
Library / Tool
Rationale
Framework
Next.js 14 (App Router)
SSR for landing/SEO pages; CSR for authenticated app shell.
Language
TypeScript
Type safety across API contracts reduces integration bugs.
Styling
Tailwind CSS
Utility-first, fast to prototype, easy to maintain.
UI Components
shadcn/ui
Accessible, unstyled components. No lock-in.
State (server)
TanStack Query v5
Server state, caching, background refetch, optimistic updates.
State (local)
Zustand
Lightweight global UI state (sidebar, modal open/close).
Forms
React Hook Form + Zod
Schema-driven validation matching backend Zod schemas.
Drag-and-drop
@dnd-kit/core
Pipeline Kanban board. Lightweight, accessible.
Notifications
Sonner
Toast notifications for async job status updates.
API client
Auto-generated from OpenAPI schema
Ensures frontend types always match backend contracts.

3.2  Page Structure & Rendering Strategy
Route
Render
Notes
/  (landing)
SSG
Static generation. No auth. SEO-optimised.
/login, /signup
SSG
Static pages with client-side form handling.
/onboarding
CSR
Multi-step profile wizard. Auth-gated.
/dashboard
CSR
Primary app shell. Real-time tender feed.
/tenders/[id]
SSR
Tender detail. SSR for shareable links.
/pipeline
CSR
Kanban board. Heavy client interaction.
/vault
CSR
Document management. File upload/download.
/settings/profile
CSR
Edit business profile. Triggers re-scoring on save.
/settings/notifications
CSR
Alert channel preferences.

3.3  Key Frontend Constraints
No business logic on client: Match scores, eligibility breakdowns, and AI summaries are never computed in the browser. Fetch from API only.
Optimistic updates for pipeline: Kanban drag-and-drop updates local state immediately; API call runs in background. Revert on failure.
File upload pattern: Frontend requests a pre-signed S3 URL from the API. File uploads go directly to S3 from the browser — never through the API server.
Polling for async jobs: After profile save, frontend polls `/api/v1/users/me/score-status` every 5 seconds until scoring completes (max 60s).
Sensitive data: PAN and GST numbers are never stored in browser localStorage or sessionStorage.
4. Backend Responsibilities

4.1  API Server (Node.js + Fastify)
The API server handles all authenticated user requests. It is stateless — all state lives in PostgreSQL or Redis. Responsibilities:
Auth: Issue and validate JWTs. Handle Google OAuth callback. Refresh token rotation.
User & Profile: CRUD for user accounts, business profiles, preferences, and notification settings.
Tender Retrieval: Serve paginated, filtered tender lists with precomputed match scores for the authenticated user.
Pipeline Actions: Move tenders between pipeline stages. Record timestamps per stage transition.
Vault Management: Generate pre-signed S3 upload URLs. Write vault metadata to DB post-upload. Serve download links.
Job Dispatch: On profile save, enqueue a `score.recalculate_all` job. Never block the HTTP response.
Search: Execute full-text search queries against PostgreSQL `tenders` table using tsvector indexes.
Webhook Events: Receive delivery receipts from SendGrid and WhatsApp BSP. Update notification log.

4.2  Scraper Workers (Python)
Scrapers are the most brittle part of the system. Design for graceful degradation. A broken scraper should never crash the main application.
Architecture: Each portal has its own scraper class inheriting a base `PortalScraper` interface. Adding a new portal = adding one class.
Scheduling: APScheduler inside the worker triggers each portal scraper on its configured cadence (every 4–8 hours depending on portal update frequency).
Deduplication: On each scrape, compare incoming NIT number + issuing authority hash against the `tenders` table. Insert new; flag changed for re-processing.
PDF handling: Download PDF to a temp path. Upload to S3 raw-pdfs bucket. Pass S3 key (not URL) to the AI pipeline queue. Delete local temp file.
Failure handling: Portal timeout → log error, mark portal `last_scrape_status = failed`, continue to next portal. Do not retry infinitely — max 3 attempts with exponential backoff.
Anti-detection: Randomised request delays (2–5s). Rotate user agents. Respect robots.txt. Use Playwright only where JavaScript rendering is required.

4.3  AI Pipeline Worker (Python)
PDF extraction: Use pdfminer.six for text extraction. If text layer absent (scanned PDF), fall back to `summary_unavailable` — do not attempt OCR in V1.
Prompt strategy: Single structured extraction prompt. Return JSON with fixed schema. Validate with Pydantic before writing to DB. Reject and mark as unavailable on schema mismatch.
LLM provider: Anthropic Claude API (claude-sonnet-4). Wrapped in a `LLMProvider` interface. Can swap to OpenAI without changing business logic.
Rate limiting: Worker respects a concurrency cap of 5 concurrent LLM calls. Controlled via BullMQ concurrency setting.
Cost control: Truncate tender PDF text to 12,000 tokens before sending to LLM. Full document available on S3 for users; summarisation works on the truncated window.

4.4  Match Scoring Worker
Trigger: Fires after any new tender is summarised, OR when a user updates their profile.
Algorithm (V1): Rule-based keyword matching between `tender.eligibility_criteria[]` and `company_profile.services[]` + `certifications[]`. Weighted scoring: certification match = 30pts, service match = 40pts, company age vs. experience req = 20pts, location = 10pts.
Output: Writes one row to `user_tender_scores` per (user_id, tender_id) pair. Stores total score + per-criterion breakdown as JSONB.
Staleness: Scores older than 7 days for active tenders are re-queued for refresh automatically.

4.5  Notification Worker
Channels: Email (SendGrid), WhatsApp (via BSP), SMS (Gupshup/Kaleyra for OTPs only).
Deduplication: Check `notification_log` before dispatching. Never send the same alert to the same user for the same tender+event within a 12-hour window.
Fallback logic: If WhatsApp delivery fails (non-2xx receipt), automatically re-queue as email. Log original failure.
Digest mode: Daily digest jobs aggregate all daily matches per user into one email. Triggered at 07:00 IST daily.
5. Database Schema

All tables use UUID primary keys. Soft deletes via `deleted_at` timestamp. Audit columns: `created_at`, `updated_at` on every table. All timestamps stored as UTC.

5.1  Core Tables
users
Column
Type
Constraints
Notes
id
uuid
PK, default gen_random_uuid()

email
text
UNIQUE, NOT NULL
Encrypted at rest via pgcrypto
email_verified
boolean
default false
Set true on email OTP confirmation
password_hash
text
nullable
Null for OAuth-only accounts
google_oauth_id
text
UNIQUE, nullable

plan
text
default 'starter'
starter | growth | enterprise
created_at
timestamptz
NOT NULL, default now()

deleted_at
timestamptz
nullable
Soft delete

company_profiles
Column
Type
Constraints
Notes
id
uuid
PK

user_id
uuid
FK users, UNIQUE
One profile per user in V1
company_name
text
NOT NULL

gst_number
text
nullable
Encrypted at rest
pan_number
text
nullable
Encrypted at rest
msme_registered
boolean
default false

incorporation_year
integer
nullable
Used in experience gap check
annual_turnover_band
text
nullable
Enum: <1Cr, 1-10Cr, 10-100Cr, 100Cr+
industry_codes
text[]
NOT NULL
Array of NIC codes or internal category codes
services
text[]
NOT NULL
Free-text service tags normalised to lowercase
certifications
text[]
default '{}'
e.g. ISO_9001, CMMI_L3, NSIC
operating_states
text[]
NOT NULL
ISO 3166-2 state codes
min_tender_value
bigint
default 0
In INR paise
preferred_categories
text[]
default '{}'
CPV or internal category tags
scoring_version
integer
default 1
Bump when scoring algorithm changes to invalidate cached scores
updated_at
timestamptz
NOT NULL


tenders
Column
Type
Constraints
Notes
id
uuid
PK

portal_slug
text
NOT NULL
gem | cppp | maharashtra_eprocure | ...
portal_tender_id
text
NOT NULL
ID as assigned by source portal
nit_number
text
nullable
Used for deduplication
issuing_authority
text
NOT NULL

title
text
NOT NULL

category_codes
text[]
NOT NULL
Internal category tags
state_codes
text[]
NOT NULL
States this tender applies to
estimated_value
bigint
nullable
INR paise. NULL = not disclosed.
emd_amount
bigint
nullable
INR paise
submission_deadline
timestamptz
NOT NULL

document_open_date
timestamptz
nullable

summary_status
text
NOT NULL
pending | completed | unavailable
ai_summary
jsonb
nullable
Structured extraction result
eligibility_criteria
jsonb
nullable
Array of {criterion, value, required: bool}
required_documents
text[]
default '{}'

raw_pdf_s3_key
text
nullable

source_url
text
NOT NULL
Original portal URL
is_cancelled
boolean
default false

last_scraped_at
timestamptz
NOT NULL

search_vector
tsvector
generated
GIN index. Auto-generated from title + ai_summary->>'description'
dedupe_hash
text
UNIQUE
SHA256 of nit_number + issuing_authority

user_tender_scores
This table is the heart of personalised discovery. Pre-computed scores mean the dashboard query is a simple indexed lookup, not a real-time LLM call.
Column
Type
Constraints
Notes
id
uuid
PK

user_id
uuid
FK users

tender_id
uuid
FK tenders

score
smallint
NOT NULL
0–100
breakdown
jsonb
NOT NULL
{criterion: string, matched: bool, points: int}[]
missing_criteria
text[]
default '{}'
Human-readable gaps for UI
scored_at
timestamptz
NOT NULL

profile_version
integer
NOT NULL
Snapshot of company_profile.scoring_version at score time

UNIQUE (user_id, tender_id)  — one score row per user per tender
INDEX ON user_tender_scores (user_id, score DESC, tender_id)  — dashboard query

pipeline_entries
Column
Type
Constraints
Notes
id
uuid
PK

user_id
uuid
FK users

tender_id
uuid
FK tenders

stage
text
NOT NULL
discovered | under_review | preparing | submitted | won | lost | cancelled
notes
text
nullable
User internal notes
stage_history
jsonb
NOT NULL
[{stage, changed_at, changed_by}]
created_at
timestamptz
NOT NULL

updated_at
timestamptz
NOT NULL


UNIQUE (user_id, tender_id)  — a tender appears once in a user's pipeline

vault_documents
Column
Type
Constraints
Notes
id
uuid
PK

user_id
uuid
FK users

doc_type
text
NOT NULL
gst | pan | msme | iso_9001 | experience | company_profile | other
display_name
text
NOT NULL
User-provided label
s3_key
text
NOT NULL
Path inside user-docs S3 bucket
file_size
integer
NOT NULL
Bytes
mime_type
text
NOT NULL

is_current
boolean
default true
Latest version for this doc_type
uploaded_at
timestamptz
NOT NULL

deleted_at
timestamptz
nullable
Soft delete

notification_log
Column
Type
Constraints
Notes
id
uuid
PK

user_id
uuid
FK users

tender_id
uuid
FK tenders, nullable
NULL for account-level notifications
event_type
text
NOT NULL
new_match | deadline_t7 | deadline_t2 | corrigendum | cancellation
channel
text
NOT NULL
email | whatsapp | sms
status
text
NOT NULL
queued | sent | delivered | failed
external_id
text
nullable
SendGrid message ID or WhatsApp message ID
sent_at
timestamptz
nullable

delivered_at
timestamptz
nullable

failed_reason
text
nullable


scraper_run_log
Column
Type
Constraints
Notes
id
uuid
PK

portal_slug
text
NOT NULL

started_at
timestamptz
NOT NULL

finished_at
timestamptz
nullable

status
text
NOT NULL
running | completed | failed | partial
tenders_found
integer
default 0

tenders_new
integer
default 0

tenders_changed
integer
default 0

error_message
text
nullable

6. API Structure

All API routes are prefixed with /api/v1. Responses follow a consistent envelope: { data, meta, error }. Pagination uses cursor-based pagination (not page numbers) for stability on large datasets.

6.1  Authentication Endpoints
Method
Path
Auth
Description
POST
/auth/signup
None
Email + password registration. Returns access + refresh tokens.
POST
/auth/login
None
Email + password login.
POST
/auth/logout
Bearer token
Invalidates refresh token in Redis.
POST
/auth/refresh
Refresh token
Issue new access token.
GET
/auth/google
None
Redirect to Google OAuth consent screen.
GET
/auth/google/callback
None
Google OAuth callback. Issues tokens on success.
POST
/auth/password-reset
None
Send password reset email.
PUT
/auth/password-reset/:token
None
Consume reset token; set new password.

6.2  User & Profile Endpoints
Method
Path
Auth
Description
GET
/users/me
Required
Current user + plan info.
DELETE
/users/me
Required
Schedule account deletion (GDPR). 30-day grace.
GET
/users/me/profile
Required
Return company profile.
POST
/users/me/profile
Required
Create profile (onboarding). Enqueues initial scoring.
PUT
/users/me/profile
Required
Update profile. Enqueues re-scoring. Returns job_id.
GET
/users/me/score-status
Required
Poll scoring job status. Returns { status, completed_at }.
GET
/users/me/notification-settings
Required
Fetch alert channel preferences.
PUT
/users/me/notification-settings
Required
Update alert preferences.

6.3  Tender Endpoints
Method
Path
Auth
Description
GET
/tenders
Required
Paginated tender list with per-user match scores. Supports filters: category, state, min_value, max_value, deadline_before, search_query, sort (score|deadline|value).
GET
/tenders/:id
Required
Single tender detail including full AI summary, eligibility breakdown, and user's score for this tender.
POST
/tenders/:id/dismiss
Required
Mark tender as dismissed. Excluded from future recommendations.
DELETE
/tenders/:id/dismiss
Required
Un-dismiss a tender.
GET
/tenders/search
Required
Full-text keyword search. Query param: q. Returns matching tenders ordered by relevance.

6.4  Pipeline Endpoints
Method
Path
Auth
Description
GET
/pipeline
Required
All pipeline entries for current user, grouped by stage.
POST
/pipeline
Required
Add tender to pipeline at stage 'discovered'.
PATCH
/pipeline/:tender_id/stage
Required
Advance or update pipeline stage. Body: { stage }.
PATCH
/pipeline/:tender_id/notes
Required
Update internal notes for a pipeline entry.
DELETE
/pipeline/:tender_id
Required
Remove tender from pipeline entirely.

6.5  Document Vault Endpoints
Method
Path
Auth
Description
GET
/vault/documents
Required
List all vault documents for current user.
POST
/vault/upload-url
Required
Request pre-signed S3 PUT URL. Body: { doc_type, filename, file_size, mime_type }. Returns { upload_url, s3_key }.
POST
/vault/documents
Required
Confirm upload complete. Body: { s3_key, doc_type, display_name }. Creates vault_documents record.
DELETE
/vault/documents/:id
Required
Soft-delete a vault document. Removes S3 object in background.
GET
/vault/documents/:id/download-url
Required
Get short-lived pre-signed S3 GET URL (15 min TTL).

6.6  Response Envelope
Success:  { "data": { ... }, "meta": { "cursor": "...", "total": 142 } }
Error:    { "error": { "code": "TENDER_NOT_FOUND", "message": "..." } }

HTTP status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 429 Too Many Requests, 500 Internal Server Error.
7. Authentication Strategy

7.1  Token Architecture
Access token: Short-lived JWT (15 minutes). Signed with RS256. Contains: user_id, plan, email_verified. Never stored in localStorage — held in memory by the frontend.
Refresh token: Opaque 256-bit random string. 30-day TTL. Stored as HttpOnly, Secure, SameSite=Strict cookie. Stored in Redis with user_id mapping. One active refresh token per user in V1.
Rotation: On every access token refresh, the old refresh token is invalidated and a new one is issued (refresh token rotation). Compromised tokens are therefore self-expiring.

7.2  Google OAuth Flow
User clicks 'Sign in with Google' → frontend redirects to /api/v1/auth/google
API server redirects to Google consent screen with scopes: openid, email, profile
Google redirects to /api/v1/auth/google/callback with auth code
API server exchanges code for Google ID token; extracts email and google_sub
Upsert user record (create if new, link if email already exists from password auth)
Issue access + refresh tokens; redirect to /dashboard

7.3  Password Security
Hashing: bcrypt with cost factor 12. Never store plaintext.
Reset flow: Time-limited token (1 hour) sent via email. Token is a secure random string stored hashed in Redis, not the DB.
Rate limiting: Login endpoint: 10 attempts per IP per 15 minutes. After 5 failures for a specific email, add 1-second artificial delay (not lockout — lockout enables enumeration).

7.4  Authorization
Row-level ownership: Every API handler that touches user data explicitly checks `WHERE user_id = req.user.id`. No reliance on the ORM or middleware alone.
Plan gating: Middleware reads `req.user.plan` from the JWT and enforces feature access. Endpoint returns 403 with `{ code: 'PLAN_REQUIRED', required_plan: 'growth' }` if insufficient.
S3 access: Users never have direct S3 credentials. All file access is via short-lived pre-signed URLs generated by the API server.
8. Third-Party Dependencies

Every third-party is wrapped behind an internal interface. This is not premature abstraction — it makes provider swaps (e.g. SendGrid → Postmark) a one-file change.

Service
Provider (V1)
Internal Interface
Swap Trigger
LLM / AI
Anthropic Claude API
LLMProvider
Cost or rate limit issues
Email
SendGrid
EmailProvider
Deliverability issues or pricing
WhatsApp
Interakt / Gupshup BSP
WhatsAppProvider
BSP approval failure
SMS (OTP only)
Kaleyra / Gupshup
SMSProvider
Delivery rate or cost
File Storage
AWS S3
StorageProvider
Cost or data residency req
Database
PostgreSQL (RDS/Supabase)
—
Unlikely; standard Postgres
Queue
Redis + BullMQ
—
Unlikely for V1 scale
Auth (OAuth)
Google Identity
OAuthProvider
Enterprise SSO requirements
Error Tracking
Sentry
—
Pricing at scale
Log Aggregation
Axiom
—
Cost at scale
Payments
Razorpay
BillingProvider
Stripe if international

8.1  LLM Usage Details
Model: claude-sonnet-4 for tender summarisation (cost-accuracy balance). claude-haiku-4-5 for eligibility criterion extraction where speed matters more.
Prompt caching: Use Anthropic prompt caching for the system prompt + schema definition. Reduces cost by ~80% on repeated similar tender PDFs.
Fallback: If API returns 5xx or rate limit, job is re-queued with a 5-minute delay, up to 3 retries. Tender marked `summary_unavailable` after 3 failures.
Cost cap: Set a hard monthly spend limit in the Anthropic console. Alert at 70% usage. Engineering reviews before cap is raised.

8.2  Scraping Dependencies
Playwright: For JavaScript-rendered portals (GeM, some state portals). Runs headless Chromium inside Docker container.
Scrapy: For HTML-static portals (CPPP, older state portals). Lighter and faster than Playwright.
pdfminer.six: Text extraction from tender PDFs. Pure Python, no system dependencies.
Proxy rotation: Not required in V1 for government portals. Add residential proxy rotation if CAPTCHAs appear at scale.
9. Scalability Considerations

V1 is designed for 0–5,000 active users and 50,000–500,000 tender records. The following design decisions make scaling to 10x this range straightforward without architectural rewrites.

9.1  Database
Indexes: GIN index on `tenders.search_vector` (full-text search). Composite index on `user_tender_scores(user_id, score DESC)`. Partial index on `tenders WHERE is_cancelled = false AND submission_deadline > now()`.
Partitioning: Partition `notification_log` by month (range partitioning on `sent_at`) when row count exceeds ~10M. No other tables need partitioning at V1 scale.
Read replicas: Add a PostgreSQL read replica for dashboard queries (tender list + scores) once API server CPU shows sustained >40% load from DB reads. Route reads to replica; writes stay on primary.
Connection pooling: Use PgBouncer in transaction mode from Day 1. Prevents connection exhaustion when worker count grows.

9.2  Worker Scaling
Horizontal workers: Scraper and AI pipeline workers are stateless containers. Scale by increasing replica count in ECS/Render. BullMQ distributes jobs across all workers automatically.
Queue priorities: BullMQ supports job priorities. Set priority: user-initiated jobs (profile save → rescore) > system jobs (daily digest) > background jobs (bulk re-scoring).
Scoring fan-out: When a new tender arrives, scoring must run for all active users. For 5,000 users and 1 tender, that's 5,000 score rows. Fan this out as a batch job (one job = 500 users) to avoid queue saturation.

9.3  Caching Strategy
Data
Cache TTL
Strategy
Dashboard tender list (per user)
5 min
Redis key: `dash:{user_id}`. Invalidated on new score write.
Tender detail page
1 hour
Redis key: `tender:{id}`. Invalidated on scraper update.
User profile
Session
Loaded once per session into API server memory. Invalidated on PUT /profile.
Pre-signed S3 URLs
14 min
Not cached. Generate fresh on each request (15-min URL lifetime).
Notification dedup check
12 hours
Redis SET: `notif_sent:{user_id}:{tender_id}:{event_type}`. Prevents duplicate alerts.

9.4  Future Scaling Path (Post-V1)
Search (>500K tenders): Migrate from PostgreSQL full-text search to Typesense. Postgres FTS is sufficient up to ~500K rows; beyond that, query latency becomes noticeable.
Multi-tenancy (Enterprise): Add `org_id` column to users, company_profiles, and pipeline_entries. Enforce `org_id` in all queries. Row-level security policy per org.
Event sourcing for pipeline: Replace `stage_history` JSONB column with a dedicated `pipeline_events` table when team collaboration (multi-user) launches. Enables proper audit trail and conflict resolution.
CDN for assets: Add CloudFront in front of S3 for frequently downloaded vault documents. Not needed in V1 (document access is sporadic).

9.5  Security Hardening (V1 Baseline)
Input validation: All API inputs validated with Zod schemas before any DB query. Reject unknowns. No raw SQL — use parameterised queries only via Drizzle ORM.
Rate limiting: Per-IP rate limit via Redis sliding window on all public endpoints. Tighter limits on auth routes.
SSRF prevention: Scrapers run in a separate network with no access to internal VPC. PDF download URLs are validated against an allowlist of government portal domains.
Secrets management: No secrets in environment variables committed to source. Use AWS Secrets Manager or Doppler. Rotate API keys quarterly.
Dependency scanning: Dependabot on GitHub. Block merges with critical CVEs.
Logging hygiene: Structured logs with pino. Deny-list fields: `email`, `gst_number`, `pan_number`, `password_hash`, `access_token`. Log sampling at 10% for high-volume endpoints in production.
10. Development Guidelines

10.1  Monorepo Structure
/apps
  /web          — Next.js frontend
  /api          — Fastify API server
/workers
  /scraper      — Python portal scrapers
  /ai-pipeline  — Python AI summarisation + scoring
  /notifier     — Node.js notification dispatcher
/packages
  /db           — Drizzle ORM schema + migrations
  /queue        — BullMQ job definitions (shared types)
  /types        — Shared TypeScript types

10.2  Key Engineering Decisions
Decision
Choice
Alternative Considered
ORM
Drizzle ORM
Prisma — rejected: runtime overhead, migration inflexibility at schema iteration speed
API framework
Fastify
Express — rejected: slower, no built-in schema validation; NestJS — rejected: too heavy for V1
Background jobs
BullMQ
Celery — rejected: adds Python infra to Node.js stack unnecessarily
Full-text search (V1)
PostgreSQL tsvector
Elasticsearch — rejected: operational complexity far exceeds V1 need
Python PDF extraction
pdfminer.six
PyMuPDF — considered; pdfminer has no native dep, easier to containerise
Auth tokens
JWT (RS256) + Redis
Sessions only — rejected: stateless JWT reduces DB round-trips; pure JWT — rejected: no revocation
Scraper orchestration
APScheduler in worker
Airflow — rejected: heavy ops overhead for 5–8 scrapers

10.3  V1 Definition of Done (per feature)
API contract documented in OpenAPI schema before coding begins
Unit tests for all business logic functions (scoring algorithm, dedup hash, notification dedup)
Integration test for happy path of each core user flow
No PII in application logs — verified by log review before merge
API latency P95 < 300ms for all list endpoints (measured in staging)
Scraper tested against a recorded HTML snapshot of each portal (not live portal) in CI
AI pipeline tested against 20 sample tenders with manually verified expected outputs
