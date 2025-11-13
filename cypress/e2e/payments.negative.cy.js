// Negative tests for the local mock API
// The mock returns:
// - 401 when Authorization header is missing/invalid
// - 400 for validation errors (e.g., invalid_amount)
// - 400 when confirming without payment_method_id

import { intents, payments } from '../support/api/index.js';

describe('Negative - Mock API', () => {
  it('401 when Authorization header is missing', () => {
    cy.request({
      method: 'POST',
      url: '/payment_intents',
      failOnStatusCode: false,
      body: {
        amount: 1000,
        currency: 'USD',
        customer_id: 'cus_x',
        payment_method_id: 'pm_fake_visa'
      }
    }).then(res => {
      expect(res.status).to.eq(401);
    });
  });

  it('400 invalid_amount when amount is non-positive', () => {
    intents.create({ amount: 0, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' })
      .then(res => {
        expect(res.status).to.eq(400);
        expect(res.body).to.have.property('error');
      });
  });

  it('400 when confirming without payment_method_id', () => {
    intents.create({ amount: 1000, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' })
      .then(r => {
        expect(r.status).to.eq(201);
        const id = r.body.id;
        intents.confirm(id, {})
          .then(r2 => {
            expect(r2.status).to.eq(400);
            expect(r2.body).to.have.property('error');
          });
      });
  });

  it('404 when retrieving payment before processing completes', () => {
    const idem = `early-${Date.now()}`;
    intents.create({ amount: 1888, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': idem })
      .then(r => {
        expect(r.status).to.eq(201);
        const intentId = r.body.id;
        return intents.confirm(intentId, { payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': `${idem}-confirm` })
          .then(() => payments.get(intentId))
          .then(paymentRes => {
            expect(paymentRes.status).to.eq(404);
            expect(paymentRes.body).to.have.property('error', 'not_found');
          });
      });
  });

  it('409 when reusing create Idempotency-Key with conflicting payload', () => {
    const idem = `conflict-${Date.now()}`;
    intents.create({ amount: 1000, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': idem })
      .then(r => {
        expect(r.status).to.eq(201);
        return intents.create({ amount: 2000, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': idem });
      })
      .then(r2 => {
        expect(r2.status).to.eq(409);
        expect(r2.body).to.have.property('error', 'idempotency_conflict');
      });
  });

  it('409 when reusing confirm Idempotency-Key with conflicting payload', () => {
    const idem = `confirm-conflict-${Date.now()}`;
    intents.create({ amount: 1500, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' })
      .then(r => {
        expect(r.status).to.eq(201);
        const intentId = r.body.id;
        return intents.confirm(intentId, { payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': idem })
          .then(resp => {
            expect(resp.status).to.eq(202);
            return intents.confirm(intentId, { payment_method_id: 'pm_fake_mastercard' }, { 'Idempotency-Key': idem });
          });
      })
      .then(conflictRes => {
        expect(conflictRes.status).to.eq(409);
        expect(conflictRes.body).to.have.property('error', 'idempotency_conflict');
      });
  });
});

