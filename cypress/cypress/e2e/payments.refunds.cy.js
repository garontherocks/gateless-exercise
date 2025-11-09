function idem() { return Date.now().toString() + Math.random().toString(16).slice(2); }

function createSucceededIntent() {
  return cy.api('POST','/payment_intents',{
    amount: 5000, currency:'USD', customer_id:'cus_1', payment_method_id:'pm_fake_visa', capture_method:'automatic'
  }, { 'Idempotency-Key': idem() })
  .then(r => {
    const id = r.body.id;
    return cy.api('PATCH', `/payment_intents/${id}/confirm`, { payment_method_id:'pm_fake_visa' },
      { 'Idempotency-Key': idem() }).then(() => cy.pollUntilStatus(id).then(() => id));
  });
}

describe('Refunds', () => {
  it('creates partial refunds and respects remaining amount', () => {
    createSucceededIntent().then(intentId => {
      cy.api('POST','/refunds', { payment_intent_id: intentId, amount: 2000 })
        .then(r1 => expect([201,200]).to.include(r1.status));

      cy.api('POST','/refunds', { payment_intent_id: intentId, amount: 3000 })
        .then(r2 => expect([201,200]).to.include(r2.status));

      // Exceso debe fallar
      cy.api('POST','/refunds', { payment_intent_id: intentId, amount: 1 })
        .then(r3 => expect([400,422]).to.include(r3.status));
    });
  });
});
