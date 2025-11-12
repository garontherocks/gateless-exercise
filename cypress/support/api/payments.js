// API Object for Payments
export function get(id) {
  return cy.api('GET', `/payments/${id}`);
}

