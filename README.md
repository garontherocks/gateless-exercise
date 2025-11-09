# Gateless Exercise – QA Technical Interview

This repo contains:
- **Cypress API tests** for a payments-style flow (intents, jobs, payments, refunds).
- A **local mock API** (`api-mock.js`) with no external deps.
- A **GitHub Actions** workflow to run the suite headlessly.

## Run locally

```bash
npm i
npm run start:api
# in another terminal
npm run test:open   # or: npm run test:e2e
