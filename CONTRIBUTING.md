# Contributing to TenderIQ

Welcome to the TenderIQ development team! As we scale to become the premier AI-powered tender intelligence platform, we maintain strict standards for our codebase to ensure performance, security, and visual excellence.

---

## 🚀 Development Roadmap

We have successfully completed **Implementation Plan 1 (Foundation)**, **Implementation Plan 2 (Growth Engine)**, and the **Vajra-Shield Security Hardening Sprint**.
We are currently focusing on **Implementation Plan 3 (Scale & Domination)**. 

Please read the official implementation plans located in the `docs/` directory before picking up any task.

---

## 🔒 Security & Coding Standards (CRITICAL)

Because TenderIQ processes high-value corporate bids and sensitive compliance documents, security is our highest priority.

### 1. Database Tenancy Scoping (Prevent IDOR / BOLA)
- **Rule:** Every single backend database query that references user data, company profiles, tenders, proposals, or pipeline cards MUST be scoped to the user's organization or user account.
- **Example (Drizzle ORM):**
  ```typescript
  // SECURE
  const [profile] = await db.select().from(companyProfiles).where(
    and(
      eq(companyProfiles.id, profileId),
      eq(companyProfiles.orgId, user.orgId)
    )
  );
  ```
- **Never** retrieve records using only the route parameter ID (e.g. `eq(table.id, id)`) without verifying tenancy context.

### 2. SQL Injection Mitigation
- **Rule:** Never concatenate strings inside raw database queries. Use Drizzle ORM's parameterized query syntax.
- **Input Sanitization:** Sanitize in-memory user inputs and search filters by stripping comment blocks (`--`, `/*`, `*/`) and special SQL characters.

### 3. AI Prompt Injection & Output Leak Defenses
- **System Isolation:** Isolate system instructions using provider-specific options (`systemInstruction` in Gemini, `system` in Claude) instead of regular user chat messages.
- **Prompt Isolation:** Wrap raw document texts, snippets, and untrusted inputs inside tags/boundaries (`=== BEGIN TENDER DOCUMENT ===` ... `=== END TENDER DOCUMENT ===`) and attach instructions to disregard prompt overrides inside them.
- **Stream Scanners:** If you introduce new streaming LLM responses, wrap the returned async generator with output leak check filters to terminate transmission if prompt instructions are detected in the tokens.

### 4. Scraper Domain Whitelists & Sanitization
- **Rule:** Scrapers (Python and Node) must check target URLs against the `ALLOWED_DOMAINS` whitelist before executing requests.
- **Payload Sanitization:** Before saving scraped text/descriptions to the database, run text content through html classifiers to strip inline scripts, stylesheet attachments, iframes, and dynamic javascript event callbacks.

### 5. Credentials & Secrets Protection
- **Rule: NEVER commit `.env`, `.env.local`, or database `.db` files.**
- Double-check `git status` prior to executing commits to verify no credentials, keys, or private files are staged.

---

## 🎨 Design & Styling Guidelines
- **Premium Themes:** Use harmonic dark mode overlays, glassmorphism card layouts, and subtle borders. Avoid standard saturated primary colors (pure red, green, blue).
- **Google Fonts:** Enforce consistent typography (e.g., Inter, Outfit, Roboto) over default system text styles.
- **Dynamic Elements:** Add smooth transitions on hover effects and responsive layouts optimized down to 320px width viewports.

---

## ⚙️ Git & Workflow Conventions

### 1. Commit Formatting
We use Conventional Commits. Your commit messages must follow this structure:
- `feat:` for new features (e.g., `feat: implement SMS matching webhook`)
- `fix:` for bug fixes (e.g., `fix: scope proposal export to userId`)
- `docs:` for documentation updates (e.g., `docs: add setup instructions`)
- `style:` for CSS, design, and formatting tweaks
- `test:` for writing unit or integration test cases

### 2. Pre-Commit Validation checklist
Before you request pull reviews or push code:
- **TypeScript compiles cleanly:** Run `npm run build` in both `/server` and `/client` to confirm no compiler errors exist.
- **ESLint checks pass:** Run `npm run lint` inside `/client` to ensure zero code-style errors.
- **Unit tests pass:** Run `npm run test` inside `/server` to verify that the Vitest suite passes 100% cleanly.
