'use strict';

const form = document.getElementById('checkoutForm');
const errorMessage = document.getElementById('formError');
const payButton = document.getElementById('payButton');
const total = document.getElementById('summaryTotal');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
let attempt;

form.elements.amount.addEventListener('input', () => {
  total.textContent = form.elements.amount.value ? dollars.format(form.elements.amount.value) : '—';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorMessage.hidden = true;
  const fields = new FormData(form);
  const value = fields.get('amount').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    errorMessage.textContent = 'Enter an amount with up to two decimal places.';
    errorMessage.hidden = false;
    return;
  }
  const data = {
    type: 'custom', name: fields.get('name'), email: fields.get('email'),
    amountCents: Math.round(Number(value) * 100), purpose: fields.get('purpose'),
    reference: fields.get('reference'), approved: fields.get('approved') === 'on'
  };
  const fingerprint = JSON.stringify(data);
  if (attempt?.fingerprint !== fingerprint) attempt = { fingerprint, id: crypto.randomUUID() };
  payButton.disabled = true;
  payButton.textContent = 'Preparing secure checkout…';
  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, requestId: attempt.id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(result.error || 'Checkout is temporarily unavailable.');
    const target = new URL(result.url);
    if (target.origin !== 'https://checkout.stripe.com') throw Error('Unexpected checkout destination.');
    location.assign(target);
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    reset();
  }
});

function reset() {
  payButton.disabled = false;
  payButton.textContent = 'Continue to secure checkout';
}

window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
form.hidden = false;
