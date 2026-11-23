const { createHash, randomUUID } = require('node:crypto');
const { database, transaction } = require('./storage');
const { stripe, liveMode, checkoutParams } = require('./payments');
const { ZONE, busyTimes, isFree, googleCalendar, invite } = require('./calendar');
const { HttpError, contact } = require('./http');

const PRICES = { 30: 8000, 60: 15000 };
const monthFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year: 'numeric', month: '2-digit' });
const slotsQuery = `
  SELECT DISTINCT candidate AS starts_at
  FROM consultation_openings o
  CROSS JOIN LATERAL generate_series(
    greatest(date_bin(interval '15 minutes', o.starts_at, '2000-01-01Z'), $1::timestamptz),
    least(o.ends_at - $3 * interval '1 minute', $2::timestamptz),
    interval '15 minutes'
  ) AS candidate
  WHERE candidate >= o.starts_at AND candidate < $2::timestamptz
    AND candidate >= now() + interval '1 hour' AND candidate <= now() + interval '120 days'
    AND NOT EXISTS (
      SELECT FROM consultations b
      WHERE b.state IN ('held', 'processing', 'confirmed')
      AND tstzrange(b.starts_at, b.ends_at, '[)') &&
          tstzrange(candidate, candidate + $3 * interval '1 minute', '[)')
    )
  ORDER BY starts_at`;

function duration(value) {
  const minutes = Number(value);
  if (!Object.hasOwn(PRICES, minutes)) throw new HttpError(400, 'Choose a consultation duration.');
  return minutes;
}

function tokenHash(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'Booking not found.');
  return createHash('sha256').update(token).digest('hex');
}

function ready() {
  for (const name of ['STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'BOOKING_FROM_EMAIL',
    'BOOKING_NOTIFICATION_EMAIL', 'BOOKING_INSTRUCTIONS', 'CRON_SECRET']) {
    if (!process.env[name]?.trim()) throw Error('Missing booking configuration: ' + name);
  }
  googleCalendar();
  return stripe();
}

async function availability(month, minutes) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month < monthFormat.format() || month > monthFormat.format(Date.now() + 120 * 86400000)) {
    throw new HttpError(400, 'Choose a month within the booking window.');
  }
  ready();
  const { rows: [range] } = await database().query(`
    SELECT ($1::date::timestamp AT TIME ZONE $2) AS starts_at,
           (($1::date + interval '1 month') AT TIME ZONE $2) AS ends_at`, [month + '-01', ZONE]);
  const [{ rows }, busy] = await Promise.all([
    database().query(slotsQuery, [range.starts_at, range.ends_at, minutes]),
    busyTimes(range.starts_at, range.ends_at)
  ]);
  return { slots: rows.filter(row => isFree(busy, row.starts_at, minutes)).map(row => row.starts_at),
    lastMonth: monthFormat.format(Date.now() + 120 * 86400000) };
}

async function reserve(body) {
  const minutes = duration(body.minutes);
  const hash = tokenHash(body.token);
  const { name, email } = contact(body);
  const start = typeof body.start === 'string' ? new Date(body.start) : new Date(NaN);
  if (!Number.isFinite(+start) || +start % 900000 !== 0) throw new HttpError(400, 'Select an available time.');
  const end = new Date(+start + minutes * 60000);
  const client = ready();
  try {
    return await transaction(async db => {
      // Serialize retries of the same browser request, including retries after a lost response.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [hash]);
      const { rows: [existing] } = await db.query('SELECT * FROM consultations WHERE token_hash=$1', [hash]);
      if (existing) {
        if (+existing.starts_at !== +start || existing.minutes !== minutes ||
            existing.customer_name !== name || existing.email !== email) throw new HttpError(409, 'Start a new checkout for changed details.');
        const session = await client.checkout.sessions.retrieve(existing.stripe_session);
        if (existing.state === 'held' && session.status === 'open' && session.url) return { url: session.url };
        return { url: '/consultations.html#status=' + body.token };
      }
      await db.query('LOCK TABLE consultation_openings IN SHARE MODE');
      const { rowCount } = await db.query(slotsQuery, [start, new Date(+start + 1), minutes]);
      if (!rowCount || !isFree(await busyTimes(start, end), start, minutes)) {
        throw new HttpError(409, 'That time is no longer available. Choose another appointment.');
      }
      const id = randomUUID();
      const expiry = Math.floor(Date.now() / 1000) + 32 * 60;
      await db.query(`INSERT INTO consultations
        (id, token_hash, starts_at, ends_at, minutes, amount_cents, customer_name, email, instructions, expires_at, next_check_at, livemode)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10),to_timestamp($10),$11)`,
      [id, hash, start, end, minutes, PRICES[minutes], name, email, process.env.BOOKING_INSTRUCTIONS.trim(), expiry, liveMode()]);
      const session = await client.checkout.sessions.create({
        ...checkoutParams({
          amount: PRICES[minutes], title: `FELTUS LABS — ${minutes}-minute consultation`, email,
          success: '/consultations.html#status=' + body.token,
          cancel: '/consultations.html#cancel=' + body.token,
          metadata: { payment_type: 'consultation', booking_id: id }
        }),
        client_reference_id: id,
        expires_at: expiry
      }, { idempotencyKey: 'booking-' + id });
      if (!session.url || session.livemode !== liveMode()) throw Error('Unexpected Checkout Session');
      await db.query('UPDATE consultations SET stripe_session=$2 WHERE id=$1', [id, session.id]);
      return { url: session.url };
    });
  } catch (error) {
    if (error.code === '23P01' || error.code === '55P03' || error.code === '40P01') {
      throw new HttpError(409, 'That time is being reserved. Refresh availability and try again.');
    }
    throw error;
  }
}

function paymentState(booking, session, eventType, now = Date.now()) {
  if (session.id !== booking.stripe_session || session.livemode !== booking.livemode ||
      session.metadata?.booking_id !== booking.id || session.metadata?.payment_type !== 'consultation' ||
      session.mode !== 'payment') throw Error('Stripe session does not match the reservation');
  if (booking.state === 'confirmed' || booking.state === 'review') return booking.state;
  if (session.payment_status === 'paid') {
    if (session.status !== 'complete' || session.currency !== 'usd' ||
        session.amount_total !== booking.amount_cents || !session.payment_intent ||
        +booking.starts_at <= now || !['held', 'processing'].includes(booking.state)) return 'review';
    return 'confirmed';
  }
  if (booking.state === 'expired' || booking.state === 'failed') return booking.state;
  if (session.status === 'expired') return 'expired';
  if (session.status === 'complete' && (eventType === 'checkout.session.async_payment_failed' ||
      ['requires_payment_method', 'canceled'].includes(session.payment_intent?.status))) return 'failed';
  if (session.status === 'complete') return 'processing';
  return booking.state;
}

async function reconcile(sessionId, eventType) {
  return transaction(async db => {
    const { rows: [booking] } = await db.query('SELECT * FROM consultations WHERE stripe_session=$1 FOR UPDATE', [sessionId]);
    if (!booking) return;
    // Fetch current Stripe state after locking the booking so stale deliveries cannot undo newer state.
    const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    let state = paymentState(booking, session, eventType);
    if (state === 'confirmed' && booking.state !== 'confirmed' &&
        !isFree(await busyTimes(booking.starts_at, booking.ends_at), booking.starts_at, booking.minutes)) {
      state = 'review';
    }
    const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    await db.query(`UPDATE consultations SET state=$2, payment_intent=$3,
      confirmed_at=CASE WHEN $2='confirmed' THEN coalesce(confirmed_at,now()) ELSE NULL END,
      next_check_at=now() + interval '5 minutes' WHERE id=$1`, [booking.id, state, intent || null]);
    if (state === 'confirmed' && booking.state !== 'confirmed') {
      const kinds = ['customer', 'business'];
      if (googleCalendar()) kinds.push('calendar');
      await db.query(`INSERT INTO consultation_deliveries (booking_id, kind)
        SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [booking.id, kinds]);
    }
    return { id: booking.id, state };
  });
}

async function bookingByToken(token) {
  const { rows: [booking] } = await database().query('SELECT * FROM consultations WHERE token_hash=$1', [tokenHash(token)]);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  return booking;
}

async function bookingStatus({ token, cancel }) {
  let booking = await bookingByToken(token);
  if (cancel === true && booking.state === 'held') {
    const client = stripe();
    const session = await client.checkout.sessions.retrieve(booking.stripe_session);
    if (session.status === 'open') {
      try {
        await client.checkout.sessions.expire(session.id, {}, { idempotencyKey: 'cancel-' + booking.id });
      } catch (error) {
        if ((await client.checkout.sessions.retrieve(session.id)).status === 'open') throw error;
      }
    }
    await reconcile(session.id);
    booking = await bookingByToken(token);
  }
  if (booking.state !== 'confirmed') return { state: booking.state };
  return {
    state: booking.state, id: booking.id, name: booking.customer_name,
    start: booking.starts_at, minutes: booking.minutes, amount: booking.amount_cents,
    timeZone: ZONE, instructions: booking.instructions, invite: invite(booking)
  };
}

module.exports = { duration, availability, reserve, paymentState, reconcile, bookingStatus };
