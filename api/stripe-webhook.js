const { endpoint, HttpError } = require('../lib/http');
const { stripe, liveMode } = require('../lib/payments');
const { reconcile } = require('../lib/bookings');

const events = new Set([
  'checkout.session.completed', 'checkout.session.expired',
  'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'
]);

module.exports = endpoint('POST', async req => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw Error('Webhook secret required');
  const client = stripe();
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 512 * 1024) throw new HttpError(413, 'Event too large.');
    chunks.push(chunk);
  }
  let event;
  try {
    event = client.webhooks.constructEvent(Buffer.concat(chunks), req.headers['stripe-signature'], secret);
  } catch {
    throw new HttpError(400, 'Invalid Stripe signature.');
  }
  if (event.livemode !== liveMode()) throw new HttpError(400, 'Unexpected Stripe mode.');
  if (events.has(event.type) && event.data.object.metadata?.payment_type === 'consultation') {
    await reconcile(event.data.object.id, event.type);
  }
  return { received: true };
});
