# TenderIQ

TenderIQ is an advanced platform for managing, analyzing, and scoring tenders. It utilizes intelligent scraping workers and evaluation pipelines to recommend and process tender documents effectively.

## What's Done ✅
- **Scraper Pipeline Structure**: Set up Python workers (`gepnic_scraper.py`, `embed_worker.py`) for extracting and parsing tender data.
- **Scoring & Recommendation Engine**: Initial worker logic implemented (`scorer.py`, `recommendation_worker.py`) for matching and evaluating tender suitability.
- **Server Architecture**: TypeScript/Node.js backend setup with basic routing and database schema.
- **Client Foundation**: Next.js frontend initialized for the upcoming dashboard UI.

## What's Next 🚀 (Roadmap)
We are actively building out the core platform. Here are the immediate priorities for anyone looking to help:

1. **Scraping Pipeline Integration**:
   - Connect the Python scraping workers directly to the backend database to automate continuous ingestion.
   - Implement robust error handling, retries, and rate-limiting for the `gepnic_scraper.py`.

2. **Frontend Dashboard (Next.js)**:
   - Build out the UI in the `client/` folder to display a feed of scored tenders.
   - Create an admin panel to monitor scraper worker health and trigger manual scraping tasks.

3. **Match Engine Refinement**:
   - Improve the accuracy of the recommendation engine (`server/src/services/matchEngine.ts`).
   - Add comprehensive unit tests for the scoring algorithms in `scraper/workers/test_scorer.py`.

4. **Authentication & Document Vault**:
   - Finalize the auth endpoints in the server and protect the frontend dashboard routes.
   - Implement secure document storage logic for the Tender Vault feature.

## Contributing 🤝
We welcome contributions! Whether it's adding a new scraper, fixing a bug, or building out the UI, we'd love your help. 

Please read our **[Contributing Guide](CONTRIBUTING.md)** for detailed instructions on how to set up the project locally, establish the environment, and submit your Pull Requests.

## Setup
*See the [CONTRIBUTING.md](CONTRIBUTING.md) file for detailed local setup instructions for the Scraper, Server, and Client environments.*
