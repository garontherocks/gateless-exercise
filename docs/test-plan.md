
Test Plan – Payment System (Mock API)
Scope
Validate API flows: create/confirm intent, jobs, payment, refunds.
Verify idempotency on create and confirm.
Risks & Assumptions
Async jobs require polling; mock API is in-memory; static bearer token.
Endpoints
GET /health
POST /payment_intents
PATCH /payment_intents/:id/confirm
GET /payment_intents/:id
GET /payment_intents/:id/jobs
GET /payments/:intentId
POST /refunds
Idempotency
Use Idempotency-Key for create/confirm; replays return original state.
Polling
Poll GET /payment_intents/:id until terminal (succeeded/failed) with timeout.
Negative Cases
401 missing/invalid auth
400 invalid_amount / invalid_currency
400 confirm without payment_method_id
400/422 over-refund
Data & Setup
Base: http://localhost:3001
Auth: Bearer test_key
Cypress helpers for requests and polling
Exit Criteria
All happy paths pass locally and in CI; negative cases return expected codes; JUnit results uploaded.
