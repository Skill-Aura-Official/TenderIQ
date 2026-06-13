# TenderIQ

**The Premium, AI-Powered Tender Discovery and Intelligence Platform.**

TenderIQ is a next-generation SaaS product designed to revolutionize how businesses discover, analyze, and win government and private tenders. By leveraging advanced web scraping, vector embeddings, and LLM-driven insights, TenderIQ removes the manual grunt work from the bidding pipeline, helping contractors generate millions in revenue.

## 🚀 Current Status: Phase 1 (Foundation) Complete!

The core foundation of TenderIQ has been successfully built and rigorously tested.
We have officially completed **Implementation Plan 1 (Foundation)**.

### Features Currently Live in the Codebase:
*   **Comprehensive Scraper Orchestration:** Scrapes 13 distinct state portals + CPPP simultaneously using `Playwright` and dynamic IP bypasses.
*   **Premium Next.js Frontend:** A high-converting, deeply aesthetic landing page, pricing interface, and robust onboarding flow.
*   **Robust Payment & Billing:** Deep integration with Razorpay Webhooks to enforce paywalls and manage subscription tiers (Basic, Pro, Enterprise).
*   **Vector Recommendation Engine:** Fastify backend utilizing BullMQ background workers and Drizzle ORM to match tender embeddings against company profiles.
*   **CI/CD:** Automated Docker builds and Google Cloud Build configurations.

---

## 🔮 What's Next? (Our Master Plan)

We are building a machine designed to generate ₹1Cr+ MRR. Here is our official roadmap:

### ⚡ Implementation Plan 2: GROWTH ENGINE (Up Next)
We are introducing a Multi-Tiered AI Copilot to handle massive data interpretation:
1.  **Tiered AI Models:** Gemini (Free Tier), GPT-4o-mini (Pro Tier), Claude 3.5 Sonnet (Enterprise Tier).
2.  **L1 Rate Intelligence:** Scraping past awarded contracts to automatically predict the optimal winning bid price for any new tender.
3.  **Enterprise Team Workspaces:** Multi-seat billing, granular permissions, and shared pipeline management.

### 📈 Implementation Plan 3: SCALE & DOMINATION
Expanding beyond the core app into a ubiquitous B2B tool:
1.  **WhatsApp AI Bot (₹299/mo Add-On):** Instant tender alerts, deadline reminders, and natural language tender querying directly on WhatsApp.
2.  **Consultant Partner Platform:** White-labeling our tool for established tender consultants to use with their own clients.
3.  **TenderIQ Public API:** Charging enterprise ERP systems per-request to access our cleaned, structured, and vectorized tender database.

---

## 📁 Documentation
For full technical details, please see our master plans stored in the `/docs` folder:
*   [Implementation Plan 1: Foundation](./docs/Implementation_Plan_1_Foundation.md)
*   [Implementation Plan 2: Growth Engine](./docs/Implementation_Plan_2_Growth_Engine.md)
*   [Implementation Plan 3: Scale & Domination](./docs/Implementation_Plan_3_Scale_Domination.md)
