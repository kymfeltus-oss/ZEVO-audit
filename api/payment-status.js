const { endpoint, HttpError } = require('../lib/http');
const { stripe, liveMode } = require('../lib/payments');

module.exports = endpoint('GET', async req => {
  const id = req.query.session_id;
  if (typeof id !== 'string' || !/^cs_(test|live)_[a-zA-Z0-9]{10,200}$/.test(id)) {
    throw new HttpError(404, 'Payment session not found.');
  }
  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(id, { expand: ['payment_intent'] });
  } catch (error) {
    if (error.code === 'resource_missing') throw new HttpError(404, 'Payment session not found.');
    throw error;
  }
  if (session.livemode !== liveMode() || session.metadata?.payment_type !== 'custom') {
    throw new HttpError(404, 'Payment session not found.');
  }
  if (session.payment_status === 'paid') return { state: 'paid' };
  if (session.status === 'expired' || (session.status === 'complete' &&
      ['requires_payment_method', 'canceled'].includes(session.payment_intent?.status))) return { state: 'failed' };
  return { state: 'pending' };
});
