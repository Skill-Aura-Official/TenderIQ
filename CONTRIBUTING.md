# Contributing to TenderIQ

Welcome to the TenderIQ development team! As we scale to become the premier AI-powered tender intelligence platform, we maintain strict standards for our codebase to ensure premium performance, extreme security, and massive scalability.

## 🚀 Development Roadmap

We have successfully completed **Implementation Plan 1 (Foundation)**. 
We are currently focusing on **Implementation Plan 2 (Growth Engine)** and **Implementation Plan 3 (Scale & Domination)**. 

Please read the official implementation plans located in the `docs/` directory before picking up any task.

### High Priority Areas
1. **Multi-LLM Integration**: Integrating Gemini, OpenAI, and Anthropic APIs seamlessly.
2. **Scraper Expansion**: Hardening the `Playwright` bypasses for extremely strict government portals.
3. **WhatsApp Bot Infrastructure**: Building the Twilio/WhatsApp Business API microservice.

## 🛠 Setup Instructions

1. **Prerequisites**:
   - Node.js v20+
   - Python 3.10+
   - PostgreSQL 16+ (with `pgvector` extension installed)
   - Redis 6+ (or equivalent cloud instance)

2. **Installation**:
   - Run `npm install` in both `/client` and `/server`.
   - Run `pip install -r requirements.txt` in `/scraper`.

3. **Database Setup**:
   - We use Drizzle ORM. Run `npm run db:push` in the server directory. **Note: You must have the `pgvector` extension enabled in your Postgres instance for the schemas to generate correctly.**

## 🔒 Security & Data Leaks (CRITICAL)

We handle extremely sensitive B2B data, API keys (Razorpay, OpenAI, Claude), and production database credentials.
**UNDER NO CIRCUMSTANCES should any `.env` file, database backup, or raw credential be committed to this repository.**

- Always check your `git status` before committing.
- Ensure `.env`, `.env.local`, and `*.db` files are strictly ignored in `.gitignore`.
- If you accidentally leak a key, instantly rotate it in the respective provider's dashboard and notify the team lead.

## 🎨 Design Philosophy
*   **Aesthetics Matter**: If the UI doesn't look like a premium, $10,000/year enterprise tool, it's not ready. Avoid generic colors; use glassmorphism, micro-animations, and highly curated typography.
*   **Performance is Key**: Tender documents are huge. Use pagination, lazy loading, and background workers (BullMQ) extensively to ensure the main thread never blocks.
