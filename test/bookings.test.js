const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomBytes, randomUUID, generateKeyPairSync } = require('node:crypto');
const { Readable } = require('node:stream');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const nock = require('nock').default;
const { database } = require('../lib/storage');
const { stripe } = require('../lib/payments');
const { isFree } = require('../lib/calendar');

const availability = require('../api/consultation-availability');
const checkout = require('../api/consultation-checkout');
const status = require('../api/consultation-status');
const webhook = require('../api/stripe-webhook');
const maintenance = require('../api/booking-maintenance');
const custom = require('../api/create-checkout');
const paymentStatus = require('../api/payment-status');

const token = () => randomBytes(32).toString('hex');
const start = new Date(Date.now() + 2 * 86400000).setUTCHours(18, 0, 0, 0);
const timeAt = offset => new Date(start + offset * 60000).toISOString();
const month = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit'
}).format(start);
const stripeApi = () => nock('https://api.stripe.com');

let pg;
let server;

before(async () => {
  pg = await PGlite.create();
  await pg.exec(readFileSync('db/bookings.sql', 'utf8'));
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0, maxConnections: 8 });
  await server.start();
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres',
    STRIPE_SECRET_KEY: 'sk_test_local_fixture',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_fixture',
    ENABLE_LIVE_PAYMENTS: 'false',
    PUBLIC_SITE_URL: 'https://feltus.example',
    RESEND_API_KEY: 'resend_local_fixture',
    BOOKING_FROM_EMAIL: 'Feltus Labs <booking@feltus.example>',
    BOOKING_NOTIFICATION_EMAIL: 'office@feltus.example',
    BOOKING_INSTRUCTIONS: 'Join using the details provided by FELTUS LABS.\nReply for scheduling help.',
    CRON_SECRET: 'local_scheduler_fixture'
  });
  for (const name of ['GOOGLE_CALENDAR_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY']) delete process.env[name];
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
});

after(async () => {
  nock.enableNetConnect();
  if (process.env.DATABASE_URL && server) await database().end();
  if (server) await server.stop();
  if (pg) await pg.close();
});

async function call(handler, options = {}) {
  const req = Object.assign(Readable.from(options.raw ? [Buffer.from(options.raw)] : []), {
    method: options.method || 'POST',
    body: options.body,
    headers: options.headers || {},
    query: options.query || {}
  });
  const res = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler(req, res);
  return { code: res.code, body: res.body };
}

function sessionState(row, overrides) {
  return {
    id: row.stripe_session, livemode: false, mode: 'payment', status: 'open',
    payment_status: 'unpaid', currency: 'usd', amount_total: row.amount_cents,
    metadata: { payment_type: 'consultation', booking_id: row.id }, ...overrides
  };
}

function getSession(row, overrides) {
  return stripeApi().get('/v1/checkout/sessions/' + row.stripe_session).query(true)
    .reply(200, sessionState(row, overrides));
}

function event(row, type, invalid = false) {
  const raw = JSON.stringify({
    id: 'evt_local', livemode: false, type, data: { object: sessionState(row) }
  });
  const signature = stripe().webhooks.generateTestHeaderString({ payload: raw, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return call(webhook, { raw, headers: { 'stripe-signature': invalid ? 'invalid' : signature } });
}

async function book(input, id, price) {
  const mock = stripeApi().post('/v1/checkout/sessions', body => {
    assert.equal(Number(body['line_items[0][price_data][unit_amount]']), price);
    assert.match(body.success_url, /consultations\.html#status=[a-f0-9]{64}$/);
    assert.equal(body['metadata[payment_type]'], 'consultation');
    return true;
  }).reply(200, { id, livemode: false, url: 'https://checkout.stripe.com/c/pay/' + id });
  const response = await call(checkout, { body: input });
  assert.equal(response.code, 200, JSON.stringify(response.body));
  assert.ok(mock.isDone());
  return (await database().query('SELECT * FROM consultations WHERE stripe_session=$1', [id])).rows[0];
}

test('actual database availability, server prices, slot holds, signed fulfillment, and delivery retries', async context => {
  const query = { month, minutes: '30' };
  assert.deepEqual(await call(availability, { method: 'GET', query }), {
    code: 200, body: { slots: [], lastMonth: new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit'
    }).format(Date.now() + 120 * 86400000) }
  });
  await database().query('INSERT INTO consultation_openings (starts_at, ends_at) VALUES ($1,$2)', [timeAt(0), timeAt(180)]);
  const available = await call(availability, { method: 'GET', query });
  assert.ok(available.body.slots.some(date => date.toISOString() === timeAt(0)));

  const input = { token: token(), name: 'Casey Test', email: 'casey@example.test', minutes: 30, start: timeAt(0), amountCents: 1 };
  const row = await book(input, 'cs_test_firstcheckout', 8000);
  assert.equal(row.state, 'held');
  const retry = getSession(row, { url: 'https://checkout.stripe.com/c/pay/retry' });
  assert.equal((await call(checkout, { body: input })).body.url, 'https://checkout.stripe.com/c/pay/retry');
  assert.ok(retry.isDone());
  const collision = await call(checkout, { body: { ...input, token: token(), minutes: 60, start: timeAt(15) } });
  assert.equal(collision.code, 409);
  await assert.rejects(database().query(`INSERT INTO consultations
    (id,token_hash,starts_at,ends_at,minutes,amount_cents,customer_name,email,instructions,expires_at,next_check_at,livemode)
    VALUES ($1,$2,$3,$4,60,15000,'test','test@example.test','test',now(),now(),false)`,
  [randomUUID(), token(), timeAt(15), timeAt(75)]), { code: '23P01' });

  assert.deepEqual((await call(status, { body: { token: input.token } })).body, { state: 'held' });
  assert.equal((await event(row, 'checkout.session.completed', true)).code, 400);
  const waiting = getSession(row, { status: 'complete', payment_intent: { id: 'pi_local', status: 'processing' } });
  assert.equal((await event(row, 'checkout.session.completed')).code, 200);
  assert.ok(waiting.isDone());
  assert.deepEqual((await call(status, { body: { token: input.token } })).body, { state: 'processing' });
  const paid = { status: 'complete', payment_status: 'paid', payment_intent: { id: 'pi_local', status: 'succeeded' } };
  for (const type of ['checkout.session.async_payment_succeeded', 'checkout.session.expired']) {
    const current = getSession(row, paid);
    assert.equal((await event(row, type)).code, 200);
    assert.ok(current.isDone());
  }
  const confirmation = (await call(status, { body: { token: input.token } })).body;
  assert.equal(confirmation.state, 'confirmed');
  assert.equal(confirmation.amount, 8000);
  assert.match(confirmation.invite, /BEGIN:VCALENDAR\r\n/);
  assert.equal((await call(status, { body: { token: token() } })).code, 404);

  const second = await book({ ...input, token: token(), minutes: 60, start: timeAt(30) }, 'cs_test_secondcheckout', 15000);
  const expired = getSession(second, { status: 'expired' });
  assert.equal((await event(second, 'checkout.session.expired')).code, 200);
  assert.ok(expired.isDone());
  const latePayment = getSession(second, { ...paid, amount_total: 15000 });
  assert.equal((await event(second, 'checkout.session.async_payment_succeeded')).code, 200);
  assert.ok(latePayment.isDone());
  assert.equal((await database().query('SELECT state FROM consultations WHERE id=$1', [second.id])).rows[0].state, 'review');
  const third = await book({ ...input, token: token(), minutes: 60, start: timeAt(30) }, 'cs_test_thirdcheckout', 15000);
  const pending = getSession(third, { status: 'complete', payment_intent: { id: 'pi_failure', status: 'requires_payment_method' } });
  assert.equal((await event(third, 'checkout.session.async_payment_failed')).code, 200);
  assert.ok(pending.isDone());
  assert.equal((await database().query('SELECT state FROM consultations WHERE id=$1', [third.id])).rows[0].state, 'failed');
  const cancellable = { ...input, token: token(), start: timeAt(30) };
  const fourth = await book(cancellable, 'cs_test_fourthcheckout', 8000);
  getSession(fourth, {});
  stripeApi().post('/v1/checkout/sessions/' + fourth.stripe_session + '/expire').reply(200, { status: 'expired' });
  getSession(fourth, { status: 'expired' });
  assert.deepEqual((await call(status, { body: { token: cancellable.token, cancel: true } })).body, { state: 'expired' });

  const abandoned = await book({ ...input, token: token(), start: timeAt(30) }, 'cs_test_abandonedcheckout', 8000);
  await database().query('UPDATE consultations SET next_check_at=now() WHERE id=$1', [abandoned.id]);
  const missedWebhook = getSession(abandoned, { status: 'expired' });
  const messages = [];
  context.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    messages.push({ body, key: options.headers['Idempotency-Key'] });
    if (body.to === input.email && messages.filter(message => message.body.to === input.email).length === 1) {
      return new Response('{}', { status: 503 });
    }
    return Response.json({ id: 'accepted-' + messages.length });
  });
  const cron = { method: 'GET', headers: { authorization: 'Bearer local_scheduler_fixture' } };
  assert.equal((await call(maintenance, { method: 'GET' })).code, 401);
  assert.equal((await call(maintenance, cron)).code, 200);
  assert.ok(missedWebhook.isDone());
  assert.equal((await database().query('SELECT state FROM consultations WHERE id=$1', [abandoned.id])).rows[0].state, 'expired');
  await database().query("UPDATE consultation_deliveries SET next_attempt_at=now() WHERE state='pending'");
  assert.equal((await call(maintenance, cron)).code, 200);
  assert.equal((await call(maintenance, cron)).body.jobsClaimed, 0);
  const customer = messages.filter(message => message.body.to === input.email);
  assert.equal(customer.length, 2);
  assert.equal(customer[0].key, customer[1].key);
  assert.equal(messages.filter(message => message.body.to === 'office@feltus.example').length, 1);
  assert.ok(customer[1].body.attachments[0].content);
  assert.equal((await database().query("SELECT count(*)::int AS count FROM consultation_deliveries WHERE state='sent'")).rows[0].count, 2);
});

test('custom checkout validates amounts and independently verifies Stripe payment status', async () => {
  const body = {
    type: 'custom', requestId: randomUUID(), name: 'Casey Test', email: 'casey@example.test',
    amountCents: 12500, purpose: 'Agreed deposit', reference: 'FL-001', approved: true
  };
  assert.equal((await call(custom, { body: { ...body, amountCents: 99 } })).code, 400);
  assert.equal((await call(custom, { body: { ...body, approved: false } })).code, 400);
  const id = 'cs_test_customreference';
  const checkoutRequest = stripeApi().post('/v1/checkout/sessions', form => {
    assert.equal(form['metadata[reference_status]'], 'unverified');
    assert.equal(form['metadata[invoice_reference]'], 'FL-001');
    return true;
  }).reply(200, { url: 'https://checkout.stripe.com/c/pay/' + id });
  assert.equal((await call(custom, { body })).code, 200);
  assert.ok(checkoutRequest.isDone());
  for (const [payment, state] of [['unpaid', 'pending'], ['paid', 'paid']]) {
    const mock = stripeApi().get('/v1/checkout/sessions/' + id).query(true)
      .reply(200, { livemode: false, metadata: { payment_type: 'custom' }, payment_status: payment });
    assert.deepEqual((await call(paymentStatus, { method: 'GET', query: { session_id: id } })).body, { state });
    assert.ok(mock.isDone());
  }
});

test('Chicago clock changes preserve UTC slot boundaries and calendar overlap is half-open', async () => {
  const { rows: [offset] } = await database().query(`
    SELECT '2026-11-01T01:30:00-05:00'::timestamptz AS early, '2026-11-01T01:30:00-06:00'::timestamptz AS late,
    '2027-03-14 03:00'::timestamp AT TIME ZONE 'America/Chicago' AS spring`);
  assert.equal(offset.late - offset.early, 3600000);
  assert.equal(offset.spring.toISOString(), '2027-03-14T08:00:00.000Z');
  const busy = [[+offset.early, +offset.late]];
  assert.equal(isFree(busy, offset.early, 30), false);
  assert.equal(isFree(busy, offset.late, 60), true);
});

test('competing checkout requests result in one hold', async () => {
  const mock = stripeApi().post('/v1/checkout/sessions').reply(200, {
    id: 'cs_test_competingcheckout', livemode: false, url: 'https://checkout.stripe.com/c/pay/competing'
  });
  const input = { name: 'Casey Test', email: 'casey@example.test', minutes: 30, start: timeAt(90) };
  const results = await Promise.all([
    call(checkout, { body: { ...input, token: token() } }),
    call(checkout, { body: { ...input, token: token(), minutes: 60, start: timeAt(105) } })
  ]);
  assert.deepEqual(results.map(result => result.code).sort(), [200, 409]);
  assert.ok(mock.isDone());
});

test('connected calendar filters live busy times and receives a single confirmed event', async context => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = {
    GOOGLE_CALENDAR_ID: 'test@example.test',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'calendar@example.test',
    GOOGLE_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
  Object.assign(process.env, config);
  context.after(() => Object.keys(config).forEach(key => delete process.env[key]));
  let written;
  context.mock.method(global, 'fetch', async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'calendar_fixture', expires_in: 3600 });
    if (url.endsWith('/freeBusy')) {
      return Response.json({ calendars: { [config.GOOGLE_CALENDAR_ID]: { busy: [{ start: timeAt(165), end: timeAt(180) }] } } });
    }
    if (url.endsWith('/events')) {
      assert.equal(written, undefined);
      written = JSON.parse(options.body);
      return Response.json({ id: written.id });
    }
    assert.equal(url, 'https://api.resend.com/emails');
    return Response.json({ id: 'local-accepted' });
  });
  const open = await call(availability, { method: 'GET', query: { month, minutes: '30' } });
  assert.equal(open.code, 200);
  assert.ok(!open.body.slots.some(date => date.toISOString() === timeAt(150)));
  const row = await book({ token: token(), name: 'Casey Test', email: 'casey@example.test',
    minutes: 30, start: timeAt(30) }, 'cs_test_calendarcheckout', 8000);
  getSession(row, { status: 'complete', payment_status: 'paid', payment_intent: { id: 'pi_calendar', status: 'succeeded' } });
  assert.equal((await event(row, 'checkout.session.completed')).code, 200);
  const cron = { method: 'GET', headers: { authorization: 'Bearer local_scheduler_fixture' } };
  assert.equal((await call(maintenance, cron)).code, 200);
  assert.equal((await call(maintenance, cron)).body.jobsClaimed, 0);
  assert.equal(written.start.dateTime, timeAt(30));
  assert.equal(written.extendedProperties.private.feltusBooking, row.id);
  assert.equal((await database().query("SELECT state FROM consultation_deliveries WHERE booking_id=$1 AND kind='calendar'", [row.id])).rows[0].state, 'sent');
});
