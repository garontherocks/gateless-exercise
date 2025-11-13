[![ci](https://github.com/garontherocks/gateless-exercise/actions/workflows/ci.yml/badge.svg)](https://github.com/garontherocks/gateless-exercise/actions/workflows/ci.yml)

# Gateless Exercise - QA Technical Interview

## Overview
Short, focused repo for API testing a payments-style flow using Cypress and a local mock API.

What’s inside:
- Cypress API tests for intents, jobs, payments, and refunds
- Local mock API (`api-mock.js`) — no external dependencies
- GitHub Actions workflow to run the suite headlessly
- Test plan with scope, risks, endpoints, idempotency, polling, and negatives

See: `docs/test-plan.md`

## Run Locally
Install dependencies:

```
npm i
```

Start the local API (terminal 1):

```
npm run start:api
```

Run the tests (terminal 2):

```
# headless (Electron)
npx cypress run --browser electron

# or open the interactive runner
npm run test:open
```

Base URL: `http://localhost:3001`

## Example Request

Quick `curl` sample with Authorization and `Idempotency-Key` headers:

```bash
curl -X POST http://localhost:3001/payment_intents \
  -H "Authorization: Bearer test_key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: create-demo-123" \
  -d '{"amount":2599,"currency":"USD","payment_method_id":"pm_fake_visa","customer_id":"cus_demo"}'
```

## Postman (Manual Testing)
Import both files into Postman:
- `postman/Payment System.postman_collection.json`
- `postman/Local.postman_environment.json`

Select the `Local` environment and run, in order:
- Health -> expect 200
- Create Intent -> expect 201 (captures `intentId`)
- Confirm Intent -> expect 202
- Get Intent / List Jobs -> poll until succeeded
- Get Payment -> expect 200 when jobs completed
- Create Refund -> expect 200/201; repeat partials until remaining is 0

## Project Structure
```
cypress/
  e2e/
    payments.intents.cy.js
    payments.refunds.cy.js
    payments.negative.cy.js
  support/
    commands.js
    e2e.js
cypress.config.js
api-mock.js
docs/test-plan.md
```

## Coverage Highlights
- `cypress/e2e/payments.negative.cy.js` exercises unauthorized access and conflicting `Idempotency-Key` scenarios.
- `cypress/e2e/payments.intents.cy.js` verifies confirm idempotency by replaying the same key and asserting the response is unchanged.
- `cypress/e2e/payments.refunds.cy.js` asserts `amount_exceeds_remaining` is returned when attempting to refund more than the remaining balance.

## CI
The badge at the top reflects the GitHub Actions workflow at `.github/workflows/ci.yml`.

