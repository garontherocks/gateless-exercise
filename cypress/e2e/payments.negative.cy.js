// Negative tests for the local mock API
describe('Negative – Mock API', () => {
it('401 when Authorization header is missing', () => {
cy.request({
method: 'POST',
url: '/payment_intents',
failOnStatusCode: false,
body: { amount: 1000, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' }
}).then(res => { expect(res.status).to.eq(401); });
});

it('400 invalid_amount when amount is non-positive', () => {
cy.api('POST', '/payment_intents', { amount: 0, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' })
.then(res => { expect(res.status).to.eq(400); expect(res.body).to.have.property('error'); });
});

it('400 when confirming without payment_method_id', () => {
cy.api('POST', '/payment_intents', { amount: 1000, currency: 'USD', customer_id: 'cus_x', payment_method_id: 'pm_fake_visa' })
.then(r => {
expect(r.status).to.eq(201);
const id = r.body.id;
// Avoid template literal; use plain concatenation to prevent CI parse issues
cy.api('PATCH', '/payment_intents/' + id + '/confirm', {}).then(r2 => {
expect(r2.status).to.eq(400);
expect(r2.body).to.have.property('error');
});
});
});
});
