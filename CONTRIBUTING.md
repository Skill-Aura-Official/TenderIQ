# Contributing to TenderIQ

First off, thank you for considering contributing to TenderIQ! It's people like you that make this platform a great tool for analyzing and scoring tenders.

## Project Architecture

The project is split into three main components:
1. **`scraper/` (Python)**: Contains background workers and scrapers (e.g., `gepnic_scraper.py`, `recommendation_worker.py`) that fetch and process tender documents.
2. **`server/` (TypeScript / Node.js)**: The backend API and match engine that handles data, user auth, and communicates with the scrapers.
3. **`client/` (Next.js / React)**: The frontend user interface for displaying dashboards, scored tenders, and administrative tools.

## Getting Started

### 1. Fork & Clone
Fork the repository and clone your fork locally:
```bash
git clone https://github.com/Skill-Aura-Official/TenderIQ.git
cd TenderIQ
```

### 2. Local Setup
You will need both Python and Node.js installed.

**For the Scraper (Python):**
```bash
cd scraper
python -m venv venv
source venv/bin/activate # (On Windows: venv\Scripts\activate)
pip install -r requirements.txt
```

**For the Server (TypeScript):**
```bash
cd server
npm install
```

**For the Client (Next.js):**
```bash
cd client
npm install
```

## How to Contribute

### 1. Pick an Issue
Look at the open issues on the GitHub repository or the "What's Next" section in the `README.md`. If you have a new idea, please open an issue first to discuss it.

### 2. Create a Branch
Always create a new branch for your feature or bug fix:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Make Your Changes
- Ensure your code follows the existing style guidelines.
- Add tests if you are creating new scoring logic or match engine features.
- Update documentation if you are adding new environment variables or setup steps.

### 4. Commit and Push
```bash
git add .
git commit -m "Brief description of your change"
git push origin feature/your-feature-name
```

### 5. Open a Pull Request
Open a Pull Request against the `main` branch. Provide a clear description of what the PR does and link to any relevant issues.

## What to Work On?
Check out the `README.md` **What's Next 🚀** section for a detailed roadmap of features that currently need help, including frontend dashboard integration, scraper testing, and database connections!
