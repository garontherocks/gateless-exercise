# Test Plan - Payment System (Mock API)

## Overview
This plan covers API-level testing for a mock payments flow: creating and confirming payment intents, tracking async jobs, retrieving payments, and issuing refunds. It verifies correctness, idempotency, and expected failure modes using Cypress API tests and a local mock server.

## Scope
- Happy-path flows: intent create -> confirm -> payment available -> refund(s)
- Idempotency behavior for create and confirm operations
- Async job completion via polling until a terminal state
- Negative and edge cases for validation and auth

Out of scope: UI testing, database persistence, performance/load, and distributed concurrency beyond basic idempotency checks.

## System Under Test & Environments
- Base URL: `http://localhost:3001`
- Auth: `Authorization: Bearer test_key`
- Test runner: Cypress (API tests, headless in CI)
- CI: GitHub Actions with JUnit output in `cypress/results/`

## Endpoints
| Method | Path                          | Purpose                     | Auth | Idempotent |
|-------|-------------------------------|-----------------------------|------|------------|
| GET   | `/health`                      | Service health              | No   | N/A        |
| POST  | `/payment_intents`             | Create payment intent       | Yes  | Via `Idempotency-Key` |
| PATCH | `/payment_intents/:id/confirm` | Confirm payment intent      | Yes  | Via `Idempotency-Key` |
| GET   | `/payment_intents/:id`         | Fetch intent status         | Yes  | N/A        |
| GET   | `/payment_intents/:id/jobs`    | List async jobs for intent  | Yes  | N/A        |
| GET   | `/payments/:intentId`          | Fetch created payment       | Yes  | N/A        |
| POST  | `/refunds`                     | Create refund for a payment | Yes  | N/A        |

## Test Data
- Currency: `USD`
- Typical amount: `2599`
- Payment method: `pm_fake_visa`
- Dynamic IDs produced by API; stored in Cypress state for chaining.

## Strategy
1) Happy-path: Intent -> Confirm -> Jobs/Status -> Payment -> Refund
- Create intent returns `201` with an `id`.
- Confirm intent returns `202` (async start).
- Poll intent status or jobs until terminal state (for example, `succeeded`).
- Get payment returns `200` once jobs complete.
- Refund returns `201` (or `200` for subsequent partials) until remaining amount is `0`.

2) Idempotency (create and confirm)
- Same `Idempotency-Key` -> same resource/state returned (no duplicates).
- Different keys -> new operation.

3) Polling
- Poll `/payment_intents/:id` (or `/jobs`) until a terminal status is reached.
- Use a bounded timeout (aligned with Cypress timeouts) to avoid infinite waits.

4) Negative tests (representative)
- `401` when `Authorization` header missing/invalid.
- `400` for `invalid_amount` and/or `invalid_currency`.
- `400` when confirming without `payment_method_id`.
- `404` for getting a payment before it exists (eventual consistency).
- `409` `idempotency_conflict` when reusing an `Idempotency-Key` with a mismatched payload.
- `400/422` when attempting an over-refund.

## Test Execution
Local
- Start API: `npm run start:api`
- Run tests (headless): `npx cypress run --browser electron`
- Or open runner: `npm run test:open`

CI
- Workflow: `.github/workflows/ci.yml`
- Reporter: `mocha-junit-reporter` -> `cypress/results/junit-[hash].xml`

## Pass/Fail & Exit Criteria
- All happy-path scenarios pass locally and in CI.
- Idempotency replays return original state without duplication.
- Negative tests return expected HTTP codes and error semantics.
- CI artifacts (JUnit XML) are generated without test flakiness.

## Risks & Mitigations
- Async operations can introduce flakiness -> bounded polling with clear timeouts.
- In-memory mock means data resets between runs -> tests set up their own data.
- Static bearer token -> verify presence and format in requests.
- If the system expands into multiple services/queues, enforce distributed idempotency (shared store or database locks) so retries across workers remain safe.
- For future multi-database or multi-region deployments, define cross-service tracing and replay-safe workflows (e.g., outbox pattern) to keep payment/ refund states consistent.

## Traceability (Specs)
- Intents and confirmation: `cypress/e2e/payments.intents.cy.js`
- Refunds: `cypress/e2e/payments.refunds.cy.js`
- Negative and edge cases: `cypress/e2e/payments.negative.cy.js`

For usage instructions and environment details, see `README.md`.
