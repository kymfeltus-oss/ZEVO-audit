'use strict';

const get = id => document.getElementById(id);
const zone = 'America/Chicago';
const monthKey = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit' });
const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const appointmentLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: zone });
const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: zone });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const form = get('booking-form');
const pay = get('confirm-pay');
const statusParam = new URLSearchParams(location.hash.slice(1));

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function request(path, body, signal) {
  const response = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(data.error || 'The booking service could not be reached. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function details(node, entries) {
  node.replaceChildren(...entries.map(([label, value]) => {
    const row = element('div');
    row.append(element('dt', label), element('dd', value));
    return row;
  }));
}

function bookingForm() {
  let month = monthKey.format();
  let lastMonth = month;
  let days = new Map();
  let selectedDay;
  let selectedStart;
  let pendingRequest;
  let checkoutAttempt;
  let submitting = false;
  const minutes = () => Number(new FormData(form).get('minutes'));
  const utcDate = key => new Date(key + 'T00:00:00Z');

  function summary() {
    details(get('booking-summary'), [
      ['Name', get('booking-name').value.trim() || 'Enter your name'],
      ['Email', get('booking-email').value.trim() || 'Enter your email address'],
      ['Date and time', selectedStart ? appointmentLabel.format(new Date(selectedStart)) : 'Select an available time'],
      ['Time zone', 'Central Time (America/Chicago)'],
      ['Duration', minutes() + ' minutes'],
      ['Total due', money.format(minutes() === 30 ? 80 : 150)]
    ]);
    pay.disabled = submitting || !selectedStart;
  }

  function chooseDay(key) {
    selectedDay = key;
    selectedStart = undefined;
    document.querySelectorAll('#calendar button[data-date]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.date === key)));
    get('time-title').textContent = 'Times for ' + dayLabel.format(utcDate(key));
    const options = days.get(key).map(slot => {
      const label = element('label');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'start';
      radio.value = slot;
      radio.addEventListener('change', () => {
        selectedStart = slot;
        summary();
      });
      label.append(radio, element('span', timeLabel.format(new Date(slot))));
      return label;
    });
    get('time-options').replaceChildren(...options);
    get('times').hidden = false;
    summary();
  }

  function renderCalendar() {
    const first = utcDate(month + '-01');
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    const count = Math.round((next - first) / 86400000);
    get('month-title').textContent = monthLabel.format(first);
    get('previous-month').disabled = month <= monthKey.format();
    get('next-month').disabled = month >= lastMonth;
    const cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => element('span', day));
    for (let i = 0; i < first.getUTCDay(); i++) cells.push(element('span'));
    for (let day = 1; day <= count; day++) {
      const key = month + '-' + String(day).padStart(2, '0');
      const button = element('button', day);
      button.type = 'button';
      button.dataset.date = key;
      button.disabled = !days.has(key);
      button.setAttribute('aria-label', dayLabel.format(utcDate(key)) + (button.disabled ? ', unavailable' : ''));
      button.setAttribute('aria-pressed', String(selectedDay === key));
      button.addEventListener('click', () => chooseDay(key));
      cells.push(button);
    }
    get('calendar').replaceChildren(...cells);
  }

  async function loadMonth() {
    pendingRequest?.abort();
    const controller = new AbortController();
    pendingRequest = controller;
    days = new Map();
    selectedDay = selectedStart = undefined;
    get('times').hidden = true;
    get('retry-availability').hidden = true;
    get('availability-message').textContent = 'Checking availability…';
    renderCalendar();
    summary();
    try {
      const data = await request('consultation-availability?' + new URLSearchParams({ month, minutes: minutes() }), null, controller.signal);
      if (controller.signal.aborted) return;
      lastMonth = data.lastMonth;
      for (const slot of data.slots) {
        const key = dateKey.format(new Date(slot));
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(slot);
      }
      const count = days.size;
      get('availability-message').textContent = count ? `${count} available ${count === 1 ? 'date' : 'dates'} this month.` : 'No appointments are available this month.';
      renderCalendar();
    } catch (error) {
      if (controller.signal.aborted) return;
      get('availability-message').textContent = error.message;
      get('retry-availability').hidden = false;
    }
  }

  function moveMonth(offset) {
    const date = utcDate(month + '-01');
    date.setUTCMonth(date.getUTCMonth() + offset);
    month = date.toISOString().slice(0, 7);
    loadMonth();
  }

  get('previous-month').addEventListener('click', () => moveMonth(-1));
  get('next-month').addEventListener('click', () => moveMonth(1));
  get('retry-availability').addEventListener('click', loadMonth);
  form.querySelectorAll('[name="minutes"]').forEach(input => input.addEventListener('change', loadMonth));
  get('booking-name').addEventListener('input', summary);
  get('booking-email').addEventListener('input', summary);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedStart || submitting) return;
    const fields = new FormData(form);
    const input = { minutes: minutes(), start: selectedStart, name: fields.get('name').trim(), email: fields.get('email').trim() };
    const fingerprint = JSON.stringify(input);
    if (checkoutAttempt?.fingerprint !== fingerprint) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      checkoutAttempt = { fingerprint, token };
    }
    const message = get('booking-error');
    message.hidden = true;
    submitting = true;
    form.inert = true;
    summary();
    pay.textContent = 'Preparing secure checkout…';
    try {
      const { url } = await request('consultation-checkout', { ...input, token: checkoutAttempt.token });
      if (/^\/consultations\.html#status=[a-f0-9]{64}$/.test(url)) {
        location.replace(url);
        location.reload();
      } else {
        const target = new URL(url);
        if (target.origin !== 'https://checkout.stripe.com') throw Error('Unexpected checkout destination.');
        location.assign(target);
      }
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      submitting = false;
      form.inert = false;
      pay.textContent = 'Confirm & Pay Securely';
      if (error.status === 409) loadMonth();
      summary();
    }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && submitting) {
      submitting = false;
      form.inert = false;
      pay.textContent = 'Confirm & Pay Securely';
      summary();
    }
  });
  form.hidden = false;
  loadMonth();
}

async function showStatus() {
  get('booking-flow').hidden = true;
  get('booking-status').hidden = false;
  const title = get('status-title');
  const message = get('status-message');
  title.focus();
  const token = statusParam.get('cancel') || statusParam.get('status');
  let cancel = statusParam.has('cancel');
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const result = await request('consultation-status', { token, cancel });
      cancel = false;
      if (result.state === 'confirmed') {
        title.textContent = 'Your Consultation Is Confirmed';
        message.textContent = 'Stripe verified your payment and FELTUS LABS confirmed your appointment.';
        const confirmation = get('confirmation-details');
        details(confirmation, [
          ['Name', result.name], ['Confirmation number', result.id],
          ['Appointment', appointmentLabel.format(new Date(result.start))],
          ['Time zone', 'Central Time (' + result.timeZone + ')'],
          ['Duration', result.minutes + ' minutes'],
          ['Amount paid', money.format(result.amount / 100)], ['Payment status', 'Paid'],
          ['Appointment instructions', result.instructions]
        ]);
        confirmation.hidden = false;
        const link = get('add-to-calendar');
        link.href = URL.createObjectURL(new Blob([result.invite], { type: 'text/calendar;charset=utf-8' }));
        link.hidden = false;
        return;
      }
      if (result.state === 'expired' || result.state === 'failed') {
        title.textContent = 'Your booking was not completed';
        message.textContent = 'This appointment hold has been released. You can choose another time.';
        get('start-over').hidden = false;
        return;
      }
      if (result.state === 'review') {
        title.textContent = 'Your booking needs review';
        message.textContent = 'Contact FELTUS LABS for help with this payment and appointment.';
        return;
      }
      title.textContent = 'Awaiting payment confirmation';
      message.textContent = 'We’re waiting for a verified payment status from Stripe.';
    } catch (error) {
      title.textContent = 'Booking status unavailable';
      message.textContent = error.message;
      if (error.status === 404) {
        get('start-over').hidden = false;
        return;
      }
    }
    await new Promise(resolve => window.setTimeout(resolve, 5000));
  }
  message.textContent = 'Check this page again in a few minutes, or contact FELTUS LABS for help.';
}

if (statusParam.has('status') || statusParam.has('cancel')) showStatus();
else bookingForm();
