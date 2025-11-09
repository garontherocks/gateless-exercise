
Gateless Exercise – QA Technical Interview
This repo contains:

Cypress API tests for a payments-style flow (intents, jobs, payments, refunds).
A local mock API (api-mock.js) with no external deps.
A GitHub Actions workflow to run the suite headlessly.
Test Plan
See docs/test-plan.md for scope, risks, endpoints, idempotency, polling, negative cases, data setup, and exit criteria.

Run locally
# install
npm i

# terminal 1: start local API
npm run start:api

# terminal 2: run tests (headless Electron)
npx cypress run --browser electron

# or open runner interactively
npm run test:open
Postman (manual testing)
Import both files into Postman:

postman/Payment System.postman_collection.json
postman/Local.postman_environment.json
Select the Local environment and run:

Health → 200
Create Intent → 201 (captures intentId)
Confirm Intent → 202
Get Intent / List Jobs → poll until succeeded
Get Payment → 200 when jobs completed
Create Refund → 200/201; repeat partials until remaining is 0
