# Required API Keys for Testing TenderIQ

To properly test the TenderIQ SaaS application, you need to replace the dummy keys in your `.env` files with real keys from the third-party providers.

## 1. Clerk Authentication
You must create a project on [Clerk](https://clerk.com) to get these keys.

### Client Environment
File: `client/.env.local`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
- `CLERK_SECRET_KEY=sk_test_...`

### Server Environment
File: `server/.env`
- `CLERK_PUBLISHABLE_KEY=pk_test_...`
- `CLERK_SECRET_KEY=sk_test_...`

---

## 2. Other Services (Currently Mocked / Local)
No keys are needed for these services right now during local testing:
- **Database:** Using local `sqlite` database (`server/sqlite.db`). No database URL or credentials needed.
- **WebSockets:** Handled internally by Fastify. No external PubSub keys needed.
- **Storage:** Google Cloud Storage flows are currently mocked in the backend. No GCS credentials needed yet.

Once you have added the Clerk keys to the files above, you can start both the client and server to test the end-to-end flows.
