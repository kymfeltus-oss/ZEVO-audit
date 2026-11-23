const Stripe = require('stripe');

function liveMode() {
  return process.env.ENABLE_LIVE_PAYMENTS === 'true';
}

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!new RegExp('^(sk|rk)_' + (liveMode() ? 'live' : 'test') + '_').test(key)) {
    throw Error('Stripe key mode does not match configuration');
  }
  return new Stripe(key, { apiVersion: '2026-11-18.endive', timeout: 8000, maxNetworkRetries: 1 });
}

function siteOrigin() {
  const url = new URL(process.env.PUBLIC_SITE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw Error('PUBLIC_SITE_URL must be an HTTPS origin');
  }
  return url.origin;
}

function checkoutParams({ amount, title, email, success, cancel, metadata, description }) {
  const origin = siteOrigin();
  return {
    mode: 'payment',
    integration_identifier: 'feltus-checkout-mqpjvark',
    adaptive_pricing: { enabled: false },
    customer_email: email,
    success_url: origin + success,
    cancel_url: origin + cancel,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: { name: title, ...(description && { description }) }
      }
    }]
  };
}

module.exports = { stripe, liveMode, checkoutParams };
