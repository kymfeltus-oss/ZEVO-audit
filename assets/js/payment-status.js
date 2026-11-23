'use strict';

async function showPaymentStatus() {
  const id = new URLSearchParams(location.search).get('session_id');
  const title = document.getElementById('payment-status-title');
  const message = document.getElementById('payment-status-message');
  try {
    const response = await fetch('/api/payment-status?' + new URLSearchParams({ session_id: id || '' }));
    const status = await response.json();
    if (!response.ok) throw Error(status.error);
    if (status.state === 'paid') {
      title.textContent = 'Payment received';
      message.textContent = 'Stripe verified your payment. FELTUS LABS reviews any invoice or project reference you submitted.';
    } else if (status.state === 'failed') {
      title.textContent = 'Payment incomplete';
      message.textContent = 'Contact FELTUS LABS if you need help retrying this payment.';
    } else {
      title.textContent = 'Payment pending';
      message.textContent = 'Stripe has not reported a successful payment yet. Check this page again later.';
    }
  } catch {
    title.textContent = 'Payment status unavailable';
    message.textContent = 'Try refreshing this page, or contact FELTUS LABS for help.';
  }
}

showPaymentStatus();
