const { database } = require('./storage');
const { ZONE, invite, createCalendarEvent } = require('./calendar');
const { reconcile } = require('./bookings');

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, dateStyle: 'full', timeStyle: 'short'
});
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function sendEmail(job) {
  const customer = job.kind === 'customer';
  const text = [
    customer ? `Hello ${job.customer_name},\n\nYour FELTUS LABS consultation is confirmed.` : 'A paid consultation was booked.',
    `When: ${dateFormat.format(job.starts_at)} (Central Time)`,
    `Duration: ${job.minutes} minutes`,
    `Amount paid: ${dollars.format(job.amount_cents / 100)}`,
    `Confirmation: ${job.id}`,
    customer ? job.instructions : `Customer: ${job.customer_name} <${job.email}>\nStripe payment: ${job.payment_intent}`
  ].join('\n\n');
  const body = {
    from: process.env.BOOKING_FROM_EMAIL,
    to: customer ? job.email : process.env.BOOKING_NOTIFICATION_EMAIL,
    reply_to: process.env.BOOKING_NOTIFICATION_EMAIL,
    subject: customer ? 'FELTUS LABS | Consultation Confirmation' : 'FELTUS LABS | New Consultation Booking',
    text
  };
  if (customer) body.attachments = [{
    filename: 'feltus-labs-consultation.ics', content: Buffer.from(invite(job)).toString('base64')
  }];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': `feltus-${job.kind}-${job.id}`
    },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw Error('Resend HTTP ' + response.status);
  const result = await response.json();
  if (!result.id) throw Error('Resend response missing ID');
  return result.id;
}

async function claim() {
  const { rows: [job] } = await database().query(`
      WITH candidate AS (
        SELECT booking_id, kind FROM consultation_deliveries
        WHERE state='pending' AND next_attempt_at <= now()
        ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED
      ), claimed AS (
        UPDATE consultation_deliveries d SET attempts=d.attempts+1,
          first_attempt_at=coalesce(d.first_attempt_at,now()), next_attempt_at=now()+interval '2 minutes'
        FROM candidate c WHERE d.booking_id=c.booking_id AND d.kind=c.kind
        RETURNING d.booking_id, d.kind, d.attempts
      )
      SELECT b.*, c.kind, c.attempts FROM claimed c JOIN consultations b ON b.id=c.booking_id`);
  return job;
}

async function deliverOne() {
  const job = await claim();
  if (!job) return false;
  try {
    const id = job.kind === 'calendar' ? await createCalendarEvent(job) : await sendEmail(job);
    await database().query(`UPDATE consultation_deliveries SET state='sent', provider_id=$3, last_error=NULL
      WHERE booking_id=$1 AND kind=$2 AND attempts=$4`, [job.id, job.kind, id, job.attempts]);
  } catch (error) {
    const reason = /^(Resend HTTP \d+|Google Calendar event write failed)$/.test(error.message)
      ? error.message : 'Provider request failed';
    await database().query(`UPDATE consultation_deliveries SET last_error=$3,
      next_attempt_at=now() + least(60, power(2, least(attempts,6))) * interval '1 minute'
      WHERE booking_id=$1 AND kind=$2 AND attempts=$4`, [job.id, job.kind, reason, job.attempts]);
  }
  return true;
}

async function maintenance() {
  // Resend deduplicates for 24 hours. Stop automatic retries inside that window.
  await database().query(`UPDATE consultation_deliveries SET state='review'
    WHERE state='pending' AND kind <> 'calendar' AND first_attempt_at < now() - interval '23 hours'
    AND next_attempt_at <= now()`);
  const { rows } = await database().query(`SELECT stripe_session FROM consultations
    WHERE state IN ('held','processing') AND next_check_at <= now()
    AND stripe_session IS NOT NULL ORDER BY next_check_at LIMIT 8`);
  const checks = await Promise.allSettled(rows.map(async ({ stripe_session: session }) => {
    try {
      await reconcile(session);
    } catch (error) {
      await database().query(`UPDATE consultations SET next_check_at=now()+interval '5 minutes'
        WHERE stripe_session=$1 AND next_check_at<=now()`, [session]);
      throw error;
    }
  }));
  const deliveries = await Promise.allSettled(Array.from({ length: 8 }, () => deliverOne()));
  const failures = [...checks, ...deliveries].filter(result => result.status === 'rejected').length;
  if (failures) console.error('Booking maintenance errors', { failures });
  return { checked: checks.length, jobsClaimed: deliveries.filter(result => result.value === true).length, failures };
}

module.exports = { maintenance };
