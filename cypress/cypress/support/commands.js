Cypress.Commands.add('api', (method, url, body = null, headers = {}) => {
  return cy.request({
    method,
    url,
    body,
    failOnStatusCode: false,
    headers: {
      Authorization: `Bearer ${Cypress.env('API_KEY')}`,
      ...headers
    }
  });
});

Cypress.Commands.add('pollUntilStatus', (intentId, terminal = ['succeeded','failed'], intervalMs = 300, timeoutMs = 60000) => {
  const started = Date.now();
  function poll() {
    return cy.api('GET', `/payment_intents/${intentId}`).then(res => {
      expect(res.status).to.eq(200);
      const { status } = res.body;
      if (terminal.includes(status)) return res;
      if (Date.now() - started > timeoutMs) throw new Error(`Timeout waiting status. Last=${status}`);
      return cy.wait(intervalMs).then(poll);
    });
  }
  return poll();
});
