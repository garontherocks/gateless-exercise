// API Object for Payment Intents
export function create(body, headers = {}) {
  return cy.api('POST', '/payment_intents', body, headers);
}

export function confirm(id, body, headers = {}) {
  return cy.api('PATCH', `/payment_intents/${id}/confirm`, body, headers);
}

export function get(id) {
  return cy.api('GET', `/payment_intents/${id}`);
}

export function listJobs(id) {
  return cy.api('GET', `/payment_intents/${id}/jobs`);
}

export function pollUntilSucceeded(id, terminal = ['succeeded', 'failed']) {
  return cy.pollUntilStatus(id, terminal);
}

