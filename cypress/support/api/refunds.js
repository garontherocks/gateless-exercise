// API Object for Refunds
export function create(body, headers = {}) {
  return cy.api('POST', '/refunds', body, headers);
}

