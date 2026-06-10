TenderIQ
AI-Powered Tender Discovery & Qualification Platform
Product Requirements Document — V1
May 2026  |  Confidential


Version
Status
Owner
Date
1.0
Draft
Product
May 2026

1. Executive Summary

TenderIQ is a SaaS platform that helps Indian businesses — MSMEs, startups, agencies, contractors, and suppliers — discover, qualify, and track government and private procurement tenders from a single dashboard.

Today, businesses waste significant time manually scanning fragmented procurement portals, reading dense tender documents, and performing eligibility checks by hand. Many relevant opportunities are missed due to limited bandwidth, and many bids are prepared for tenders the company was never qualified to win.

TenderIQ solves this with AI-powered tender aggregation, automated eligibility scoring, concise document summaries, and a lightweight bid pipeline — reducing discovery time from hours to minutes and improving win-rate by focusing effort on the right opportunities.
2. Problem Statement

2.1  The Core Problem
Government and public-sector procurement in India is fragmented across hundreds of portals — GeM, CPPP, state portals, PSU sites, and municipal platforms. Private sector procurement is even more dispersed. Businesses that rely on tender income face three compounding problems:

Discovery overload: Teams spend 2–4 hours per day scanning portals for relevant tenders, most of which are not applicable.
Manual qualification: Eligibility assessment requires reading dense PDF documents line by line, leading to missed disqualifiers and wasted bid effort.
Deadline failures: Corrigendum updates and deadline changes are notified only on the originating portal. Businesses miss changes and submit invalid or late bids.

2.2  Business Impact
Pain Point
Current State
Impact
Tender Discovery
Manual search across 10+ portals daily
2–4 hrs/day lost per staff member
Eligibility Check
Reading 40–150 page PDFs manually
Bids submitted for ineligible tenders
Deadline Tracking
Manual calendar reminders
Missed deadlines, corrigendum blind spots
Document Readiness
Docs stored in email / local drives
Incomplete submissions, last-minute scrambles
3. Target Users

3.1  Primary Segment — MSMEs & SMEs
Annual turnover: ₹1 Cr – ₹100 Cr
Sector: IT services, civil construction, manufacturing, facilities management, marketing
Current tender activity: 5–30 bids per year
Team size for tender work: 1–3 people

3.2  Secondary Segments
Segment
Profile
Key Need
Startups
Early-stage, govt contracts as first revenue
Simple eligibility guidance
Agencies
Marketing, PR, digital — municipal/PSU buyers
Volume discovery across states
Contractors
Civil, infra, facilities — PWD, CPWD, NMMC tenders
EMD tracking, deadline alerts
Consultants
Management, HR, tech advisory — govt projects
Niche keyword discovery
Govt Vendors
Existing GeM sellers expanding to other portals
Cross-portal visibility

3.3  User Personas
Persona A — Priya, Operations Manager at an IT SME
Manages 2 staff who track tenders manually
Spends ~3 hours/day on discovery across GeM, CPPP, and state portals
Pain: Doesn't know which tenders she's missing; submits bids for tenders the company cannot qualify for
Goal: Get a curated, scored list of relevant tenders every morning

Persona B — Rajan, Director at a Civil Contracting Firm
Participates in 20+ tenders annually across PWD and municipal bodies
Key concern: Missing corrigendum updates and EMD deadlines
Goal: Centralised pipeline view + WhatsApp alerts for deadline changes

Persona C — Aisha, Founder of a 15-person Marketing Agency
New to govt tenders; knows opportunities exist but doesn't know where to start
Doesn't understand eligibility criteria or required documents
Goal: Simple onboarding that tells her which tenders she can realistically pursue
4. Core User Flows

Flow 1 — Onboarding & Profile Setup
User signs up with work email or Google OAuth
Completes business profile: industry, services offered, company size, GST/PAN, MSME status, certifications held, states of operation
Sets tender preferences: minimum value threshold, preferred categories, geographic scope
Uploads key documents to the Document Vault (optional at this stage)
System generates initial set of matched tenders within 60 seconds

Flow 2 — Daily Tender Discovery
User lands on the Dashboard, which shows 'New Today' tender recommendations ranked by match score
User browses cards; each card shows: Tender Title, Portal, Value, Deadline, Match Score badge, Category
User clicks a card to view the AI Summary (concise extraction of key requirements, eligibility, EMD, deadlines)
User takes one of three actions: Save to Pipeline, Dismiss, or Open Original Document

Flow 3 — Eligibility Check
On the tender detail page, the user views the Eligibility Score (0–100%) with a breakdown of matched vs. missing criteria
Missing criteria are listed as specific action items: e.g., 'ISO 9001 certification not found in your profile'
User can update their profile or upload a missing document directly from this screen
Score recalculates in real time

Flow 4 — Bid Pipeline Management
User moves a tender through pipeline stages: Discovered → Under Review → Preparing Bid → Submitted → Won / Lost
Each stage shows due dates and assigned team members (Growth plan and above)
Dashboard summary shows counts per stage and upcoming deadlines

Flow 5 — Alerts & Notifications
System monitors saved tenders for corrigendum updates, deadline changes, and new matching tenders
User receives alert via their preferred channel (email by default; WhatsApp/SMS optional)
Alert links directly to the updated tender detail page

Flow 6 — Document Vault
User opens Document Vault from sidebar
Uploads documents with a type tag: GST Certificate, PAN, MSME, ISO, Experience Certificate, etc.
System auto-links documents to eligibility checks (e.g., marks ISO 9001 as 'verified' if the cert is uploaded)
User can download any document directly when preparing a bid submission
5. Feature List

Features are categorised as MVP (V1 launch) or Future (post-V1). Inclusion in MVP is based on whether the product is unusable without it.

5.1  MVP Features
#
Feature
Description
Priority
1
Tender Aggregation
Pull tenders from GeM, CPPP, and 5–8 major state portals. Normalise into a standard data schema.
P0
2
Business Profile
Capture industry, services, size, certifications, and location. Used as the basis for all AI matching.
P0
3
AI Tender Summary
Auto-extract: title, value, deadline, EMD, eligibility criteria, required documents from tender PDFs.
P0
4
Match Score
Single 0–100% score per tender per company profile. Breakdown of matched vs. missing criteria.
P0
5
Tender Dashboard
Searchable, filterable list view with match score badges. Filters: category, state, value range, deadline.
P0
6
Tender Detail Page
Full AI summary, eligibility breakdown, original document link, and pipeline action button.
P0
7
Email Alerts
Daily digest of new matching tenders. Deadline reminders at T-7 and T-2 days. Corrigendum alerts.
P0
8
Document Vault
Upload and tag key documents. Auto-link to eligibility profiles. Download on demand.
P0
9
Bid Pipeline
Kanban-style pipeline: Discovered, Under Review, Preparing, Submitted, Won, Lost.
P0
10
User Auth
Email + Google OAuth sign-up. Password reset. Single user per account in V1.
P0
11
Saved / Dismissed Tenders
Users can save tenders to pipeline or dismiss them. Dismissed tenders do not reappear.
P1
12
WhatsApp Alerts
Optional WhatsApp notifications via WhatsApp Business API as an alternative to email.
P1
13
Manual Tender Search
Keyword search bar with category and location filters independent of AI recommendations.
P1

5.2  Future Features (Post-V1)
#
Feature
Description
Release
1
AI Bid Assistant
Chat interface to answer eligibility, document, and requirement questions about a specific tender.
V1.1
2
Team Collaboration
Invite team members, assign tenders, add internal notes and status comments.
V1.1
3
Analytics Dashboard
Win rate, submission rate, pipeline velocity, value tracked vs. value won over time.
V1.2
4
Tender Value Forecasting
Estimate of upcoming tender volumes by category and state based on historical patterns.
V1.2
5
Competitor Intelligence
Show which companies have previously won similar tenders.
V1.3
6
Bid Document Templates
Pre-filled bid templates using profile data and AI tender summary content.
V1.3
7
API / Integrations
Webhook or API access to tender data for companies using their own CRM or ERP.
V2.0
8
Private Tender Discovery
Scraping and aggregation from private sector and corporate procurement portals.
V2.0
6. Edge Cases & Handling

6.1  Tender Data Quality
Incomplete tender PDFs: Tender portal serves a garbled or password-protected PDF → Show 'Summary unavailable; link to original document only.' Never show a hallucinated summary.
Missing value in tender: Estimated value not disclosed (common in rate contracts) → Show 'Value not specified' instead of ₹0 or a blank.
Duplicate tenders: Same tender appears on multiple portals → Deduplicate by NIT number + issuing authority; show once with multiple portal links.
Tender withdrawn mid-pipeline: User has a tender in 'Preparing Bid' but it gets cancelled → Alert user; move tender to a 'Cancelled' state automatically.

6.2  Eligibility Scoring
New company with no track record: Company created < 3 years ago and tender requires '5 years of experience' → Flag the specific gap explicitly; do not simply lower the score without explanation.
Joint venture scenarios: Tender permits JV bids → Surface this note on the tender detail page; do not penalise eligibility score solely for criteria that JVs can overcome.
Profile data missing: User hasn't uploaded ISO certificate yet → Score reflects missing cert; prompt user to upload with a contextual inline CTA.

6.3  Alerts & Notifications
Portal is down during scraping window: Mark affected tenders as 'Not refreshed since [timestamp]'; do not send stale alerts as fresh.
Corrigendum changes deadline to a past date: System detects this as anomalous → Flag for human review; hold alert until verified.
WhatsApp delivery failure: Fall back to email automatically; log the failure.

6.4  User Account
User changes company profile mid-cycle: Re-run eligibility scores in the background for all active pipeline tenders; surface changes on next login.
User tries to add the same document type twice: Allow it; mark the newer one as 'Current' and retain the old one as 'Archived'.
7. Non-Goals for V1

The following are explicitly out of scope for V1 to maintain focus and ship on schedule.

Non-Goal
Rationale
Bid writing / document generation
High complexity, low trust in AI-generated legal documents at V1.
e-Procurement portal integration (submission)
Portals do not expose APIs; legal and security risk is too high.
Private sector tender discovery
Unstructured and legally complex to scrape; defer to V2.
Team collaboration / multi-user
V1 targets solo operators; adds auth complexity without initial need.
Mobile app (iOS/Android)
Web-responsive is sufficient for V1; native app post-PMF.
Financial analytics (ROI, win-rate modelling)
Requires historical data that doesn't exist at launch.
Auto-submission or form filling on external portals
Out of legal and technical scope.
Competitor intelligence
Requires significant data acquisition; post-V1 roadmap.
8. Success Metrics

8.1  North Star Metric
Qualified Tenders Actioned — the number of tenders moved to 'Preparing Bid' or beyond per active user per month. This single metric reflects discovery quality, eligibility accuracy, and user engagement in one number.

8.2  V1 Launch Targets (90 days post-launch)
Metric
Target
Why It Matters
Activated Users (completed profile + viewed ≥1 tender)
500
Validates onboarding funnel
Weekly Active Users / Total Signups (WAU/Signups)
> 40%
Measures product stickiness
Tender Match Relevance (user-rated 'relevant' on 5-card sample)
> 65%
Validates AI recommendation quality
Alert Click-Through Rate
> 30%
Confirms alerts create action, not noise
Tenders moved to 'Preparing Bid'
> 2 per active user/month
North Star proxy
Paid Conversion (Starter → Growth)
> 8% of activated users
Commercial validation
Document Vault Adoption
> 50% of active users upload ≥ 1 doc
Signals investment in the platform

8.3  Health Metrics (monitored, not targeted)
Tender freshness: % of tenders refreshed within 24 hours of portal update
AI summary accuracy: % of summaries with zero critical errors (spot-checked weekly)
Eligibility score precision: % of scored tenders where company was actually eligible (validated against awarded tenders)
Notification delivery rate: > 98% successful delivery across channels
P95 page load: < 2 seconds for dashboard and tender detail pages
9. Technical Assumptions & Constraints

These are not engineering requirements — they are assumptions the product is built on and constraints the team must plan around.

Portal scraping: Scrapers will be rate-limited and may break when portals change their HTML structure. The team must budget for ongoing scraper maintenance. Begin with the 5 highest-volume portals (GeM, CPPP, and top 3 state portals).
AI summaries: Use a general-purpose LLM with a structured extraction prompt. Summaries must be validated against a held-out set of 100 manually tagged tenders before launch. Hallucinated eligibility criteria are a critical defect.
Match scoring: V1 scoring uses rule-based keyword matching + LLM classification against business profile fields. A more sophisticated model can be layered in post-launch once sufficient user feedback data exists.
Document storage: Documents in the Vault are stored encrypted at rest. PAN, GST numbers are treated as sensitive data and must not appear in logs.
Notification infrastructure: Email via transactional ESP (e.g., SendGrid). WhatsApp via WhatsApp Business API with an approved BSP. SMS via a tier-1 Indian SMS gateway for OTP/critical alerts only.
Single-tenant data: V1 uses a shared database with row-level security. Enterprise multi-tenancy is a V2 architecture concern.
10. Open Questions

These must be resolved before or during V1 development.

#
Question
Decision Needed From
Status
1
Which 5 portals do we launch with? Prioritise by tender volume or user research?
Product + Data Engineering
Open
2
What is the eligibility scoring model — pure rule-based or LLM-assisted from Day 1?
Engineering + AI Lead
Open
3
Do we charge by tender volume tracked or by seats (users)?
Product + Revenue
Open
4
Is WhatsApp Business API approval feasible within the V1 timeline?
Engineering
In Progress
5
What is the SLA commitment to users for tender freshness (e.g., within 24 hrs of portal post)?
Product
Open
6
Do we allow users to report incorrect AI summaries, and what is the correction workflow?
Product + Support
Open
