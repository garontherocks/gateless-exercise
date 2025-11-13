const http = require('http');
const url = require('url');

const PORT = 3001;
const AUTH = 'Bearer test_key';
const JSON_HDR = { 'Content-Type': 'application/json' };

const intents = new Map();            // id -> intent
const payments = new Map();           // intentId -> payment
const refunds = new Map();            // refundId -> refund
const idemCreate = new Map();         // key -> { intentId, signature }
const idemConfirm = new Map();        // key -> { intentId, signature }

function uuid() {
  return 'pi_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO() { return new Date().toISOString(); }

function canonicalize(val) {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  return Object.keys(val).sort().reduce((acc, key) => {
    acc[key] = canonicalize(val[key]);
    return acc;
  }, {});
}

function bodySignature(body = {}) {
  if (!body || typeof body !== 'object') return '';
  return JSON.stringify(canonicalize(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function authFail(res) {
  res.writeHead(401, JSON_HDR);
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

function notFound(res) {
  res.writeHead(404, JSON_HDR);
  res.end(JSON.stringify({ error: 'not_found' }));
}

function badRequest(res, msg = 'bad_request') {
  res.writeHead(400, JSON_HDR);
  res.end(JSON.stringify({ error: msg }));
}

function conflict(res, msg = 'idempotency_conflict') {
  res.writeHead(409, JSON_HDR);
  res.end(JSON.stringify({ error: msg }));
}

function ok(res, body) {
  res.writeHead(200, JSON_HDR);
  res.end(JSON.stringify(body));
}
function created(res, body) {
  res.writeHead(201, JSON_HDR);
  res.end(JSON.stringify(body));
}
function accepted(res, body) {
  res.writeHead(202, JSON_HDR);
  res.end(JSON.stringify(body));
}

function requireAuth(req, res) {
  const h = req.headers['authorization'];
  if (h !== AUTH) { authFail(res); return false; }
  return true;
}

function scheduleJobs(intent) {
  const jobTypes = ['anti_fraud','authorization','risk','compliance','capture'];
  intent.jobs = jobTypes.map(t => ({
    id: 'job_' + Math.random().toString(36).slice(2),
    type: t,
    status: 'queued',
    started_at: null,
    completed_at: null,
  }));

  // Secuencial “rápido”
  let delay = 80;
  intent.status = 'processing';
  intent.jobs.forEach((job, idx) => {
    setTimeout(() => {
      job.status = 'completed';
      job.started_at = job.started_at || nowISO();
      job.completed_at = nowISO();
      if (idx === jobTypes.length - 1) {
        intent.status = 'succeeded';
        const payment = {
          id: 'pay_' + Math.random().toString(36).slice(2),
          intent_id: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          captured_at: nowISO(),
          refundable_remaining: intent.amount
        };
        payments.set(intent.id, payment);
      }
    }, delay);
    job.started_at = nowISO();
    delay += 80;
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method;
  const path = parsed.pathname || '/';

  // Health (no auth para facilitar)
  if (method === 'GET' && path === '/health') {
    return ok(res, { ok: true, ts: nowISO() });
  }

  // Todo el resto requiere auth
  if (!requireAuth(req, res)) return;

  // POST /payment_intents
  if (method === 'POST' && path === '/payment_intents') {
    const key = req.headers['idempotency-key'];
    const body = await readBody(req);
    const { amount, currency, customer_id, payment_method_id, capture_method } = body;
    const signature = bodySignature(body);

    if (key && idemCreate.has(key)) {
      const existingMapping = idemCreate.get(key);
      if (existingMapping.signature !== signature) return conflict(res);
      const existingId = existingMapping.intentId;
      const existing = intents.get(existingId);
      return ok(res, existing);
    }

    if (typeof amount !== 'number' || amount <= 0) return badRequest(res, 'invalid_amount');
    if (!currency || typeof currency !== 'string') return badRequest(res, 'invalid_currency');
    if (!payment_method_id) return badRequest(res, 'missing_payment_method');

    const id = uuid();
    const intent = {
      id,
      status: 'requires_confirmation',
      amount,
      currency,
      customer_id: customer_id || null,
      payment_method_id,
      capture_method: capture_method || 'automatic',
      client_secret: 'secret_' + Math.random().toString(36).slice(2),
      created_at: nowISO(),
      jobs: []
    };
    intents.set(id, intent);
    if (key) idemCreate.set(key, { intentId: id, signature });
    return created(res, intent);
  }

  // PATCH /payment_intents/:id/confirm
  const confirmMatch = path.match(/^\/payment_intents\/([^/]+)\/confirm$/);
  if (method === 'PATCH' && confirmMatch) {
    const intentId = confirmMatch[1];
    const key = req.headers['idempotency-key'];
    const body = await readBody(req);
    const pm = body.payment_method_id;
    const signature = bodySignature(body);

    if (!intents.has(intentId)) return notFound(res);
    const intent = intents.get(intentId);

    if (key && idemConfirm.has(key)) {
      const existingMapping = idemConfirm.get(key);
      if (existingMapping.intentId !== intentId || existingMapping.signature !== signature) {
        return conflict(res);
      }
      return ok(res, intent);
    }

    if (!pm) return badRequest(res, 'missing_payment_method');

    intent.status = 'processing';
    scheduleJobs(intent);
    if (key) idemConfirm.set(key, { intentId, signature });
    return accepted(res, intent);
  }

  // GET /payment_intents/:id
  const getIntentMatch = path.match(/^\/payment_intents\/([^/]+)$/);
  if (method === 'GET' && getIntentMatch) {
    const id = getIntentMatch[1];
    if (!intents.has(id)) return notFound(res);
    return ok(res, intents.get(id));
  }

  // GET /payment_intents/:id/jobs
  const jobsMatch = path.match(/^\/payment_intents\/([^/]+)\/jobs$/);
  if (method === 'GET' && jobsMatch) {
    const id = jobsMatch[1];
    if (!intents.has(id)) return notFound(res);
    const intent = intents.get(id);
    return ok(res, { intent_id: id, jobs: intent.jobs || [] });
  }

  // GET /payments/:intentId
  const payMatch = path.match(/^\/payments\/([^/]+)$/);
  if (method === 'GET' && payMatch) {
    const id = payMatch[1];
    if (!payments.has(id)) return notFound(res);
    return ok(res, payments.get(id));
  }

  // POST /refunds
  if (method === 'POST' && path === '/refunds') {
    const body = await readBody(req);
    const { payment_intent_id, amount } = body || {};
    if (!payment_intent_id || typeof amount !== 'number' || amount <= 0) {
      return badRequest(res, 'invalid_refund');
    }
    if (!payments.has(payment_intent_id)) return notFound(res);
    const payment = payments.get(payment_intent_id);
    if (payment.refundable_remaining < amount) return badRequest(res, 'amount_exceeds_remaining');

    payment.refundable_remaining -= amount;
    const refund = {
      id: 're_' + Math.random().toString(36).slice(2),
      payment_intent_id,
      amount,
      currency: payment.currency,
      created_at: nowISO()
    };
    refunds.set(refund.id, refund);
    return created(res, refund);
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
});
