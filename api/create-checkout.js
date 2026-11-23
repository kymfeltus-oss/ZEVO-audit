const { endpoint, json, field, contact, HttpError } = require('../lib/http');
const { checkoutParams, stripe } = require('../lib/payments');

module.exports = endpoint('POST', async req => {
  const body = json(req);
  if (body.type !== 'custom') throw new HttpError(400, 'Select an appointment on the consultation booking page.');
  const { name, email } = contact(body);
  const amount = body.amountCents;
  const description = field(body.purpose, 160);
  const reference = field(body.reference ?? '', 80);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 10000000) {
    throw new HttpError(400, 'Enter an amount between $1 and $100,000.');
  }
  if (description.length < 3 || body.approved !== true || typeof body.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(body.requestId)) {
    throw new HttpError(400, 'Enter a payment description and acknowledge the agreed amount.');
  }
  const session = await stripe().checkout.sessions.create(checkoutParams({
    amount, email, description, title: 'FELTUS LABS — approved custom project payment',
    success: '/checkout-success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel: '/checkout.html',
    metadata: {
      payment_type: 'custom', customer_name: name, project_description: description,
      ...(reference && { invoice_reference: reference, reference_status: 'unverified' })
    }
  }), { idempotencyKey: 'custom-' + body.requestId });
  if (!session.url) throw Error('Checkout URL unavailable');
  return { url: session.url };
});
