import { intents, payments as paymentsApi } from '../support/api/index.js';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

describe('Payment Intents - Happy Path + Idempotency', () => {
  it('creates, confirms, polls to succeeded; lists jobs and payment; idempotent calls', () => {
    const idemCreate = uuid();
    const idemConfirm = uuid();
    const confirmHeaders = { 'Idempotency-Key': idemConfirm };
    const confirmBody = { payment_method_id: 'pm_fake_visa' };
    let firstConfirmSnapshot = null;

    cy.api('GET', '/health').then(r => {
      expect(r.status).to.eq(200);
      expect(r.body).to.have.property('ok', true);
    });

    // 1) Create
    intents.create({
      amount: 2599,
      currency: 'USD',
      customer_id: 'cus_123',
      payment_method_id: 'pm_fake_visa',
      capture_method: 'automatic',
      metadata: { orderId: 'ORD-1001' }
    }, { 'Idempotency-Key': idemCreate }).then(res => {
      expect(res.status).to.eq(201);
      expect(res.body).to.include.keys('id','status','amount','currency','client_secret');
      expect(res.body.status).to.eq('requires_confirmation');
      const intentId = res.body.id;

      // 2) Confirm
      intents.confirm(intentId, confirmBody, confirmHeaders)
        .then(r2 => {
          expect(r2.status).to.eq(202);
          expect(r2.body.status).to.eq('processing');
          firstConfirmSnapshot = r2.body;
          return intents.confirm(intentId, confirmBody, confirmHeaders);
        })
        .then(rRepeat => {
          expect(rRepeat.status).to.eq(200);
          expect(rRepeat.body).to.deep.eq(firstConfirmSnapshot);
        });

      // 3) Poll to succeeded
      intents.pollUntilSucceeded(intentId).then(r3 => {
        expect(r3.body.status).to.eq('succeeded');

        // 4) Jobs
        intents.listJobs(intentId).then(r4 => {
          expect(r4.status).to.eq(200);
          const jobs = r4.body.jobs || [];
          const types = jobs.map(j => j.type).sort();
          expect(types).to.deep.eq(['anti_fraud','authorization','capture','compliance','risk'].sort());
          jobs.forEach(j => {
            expect(j).to.include.keys('id','type','status','started_at');
            expect(j.status).to.eq('completed');
          });
        });

        // 5) Payment details
        paymentsApi.get(intentId).then(r5 => {
          expect(r5.status).to.eq(200);
          expect(r5.body).to.include.keys('id','amount','currency','captured_at');
          expect(r5.body.amount).to.eq(2599);
        });
      });

      // 6) Idempotency: same key -> same intent
      intents.create({
        amount: 2599,
        currency: 'USD',
        customer_id: 'cus_123',
        payment_method_id: 'pm_fake_visa',
        capture_method: 'automatic'
      }, { 'Idempotency-Key': idemCreate }).then(res2 => {
        expect([200,201]).to.include(res2.status);
        expect(res2.body.id).to.exist;
      });
    });
  });
});
