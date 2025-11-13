import { intents, payments, refunds } from '../support/api/index.js';

function idem() { return Date.now().toString() + Math.random().toString(16).slice(2); }

function createSucceededIntent() {
  return intents.create({
    amount: 5000, currency: 'USD', customer_id: 'cus_1', payment_method_id: 'pm_fake_visa', capture_method: 'automatic'
  }, { 'Idempotency-Key': idem() }).then(r => {
    const id = r.body.id;
    return intents
      .confirm(id, { payment_method_id: 'pm_fake_visa' }, { 'Idempotency-Key': idem() })
      .then(() => intents.pollUntilSucceeded(id).then(() => id));
  });
}

describe('Refunds', () => {
  it('creates partial refunds and respects remaining amount', () => {
    createSucceededIntent().then(intentId => {
      const expectRemaining = (expectedAmount) => payments.get(intentId).then(paymentRes => {
        expect(paymentRes.status).to.eq(200);
        expect(paymentRes.body.refundable_remaining).to.eq(expectedAmount);
        return paymentRes.body;
      });

      const createRefund = (amount) => refunds.create({ payment_intent_id: intentId, amount });

      return expectRemaining(5000)
        .then(() => createRefund(2000).then(r1 => {
          expect([201,200]).to.include(r1.status);
          expect(r1.body).to.include({ payment_intent_id: intentId, amount: 2000, currency: 'USD' });
          expect(r1.body.id).to.match(/^re_/);
        }))
        .then(() => expectRemaining(3000))
        .then(() => createRefund(3000).then(r2 => {
          expect([201,200]).to.include(r2.status);
          expect(r2.body).to.include({ payment_intent_id: intentId, amount: 3000, currency: 'USD' });
        }))
        .then(() => expectRemaining(0))
        .then(() => createRefund(1).then(r3 => {
          expect([400,422]).to.include(r3.status);
          expect(r3.body).to.have.property('error').and.match(/amount_exceeds_remaining|invalid_refund/);
        }))
        .then(() => expectRemaining(0));
    });
  });
});
