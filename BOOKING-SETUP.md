# FELTUS LABS booking and payments

Use a dedicated preview environment for the Stripe sandbox, PostgreSQL database, email recipients, and optional Google Calendar. Start with `npm ci`, `npm test`, and `npm run build`. The Vercel configuration serves the built static pages and the existing site routes, with Node functions under `/api`.

## Preview configuration

Set these values in the server environment. `.env.example` lists the variable names for reference.

- `PUBLIC_SITE_URL` is the reachable HTTPS origin for this deployment, with no path. Stripe redirects customers back to this origin.
- `STRIPE_SECRET_KEY` is a restricted test key where available, with Checkout Session read and write access and any permissions needed to read expanded PaymentIntents. `STRIPE_WEBHOOK_SECRET` is the signing secret for this deployment's endpoint. Leave `ENABLE_LIVE_PAYMENTS=false`.
- `DATABASE_URL` points to a PostgreSQL database dedicated to the environment. Use a TLS connection with certificate verification for a hosted database. Apply `db/bookings.sql` once as the schema owner. Use a separate runtime database role with read access to `consultation_openings` and read, insert, and update access to the booking and delivery tables. The application's `LOCK TABLE ... IN SHARE MODE` requires a privilege beyond SELECT on the openings table in PostgreSQL. Grant UPDATE on the openings table to the runtime role for that lock, or use a DBA-managed definer function if narrower privileges are required.
- `CRON_SECRET` is the bearer secret for a scheduler that sends `GET /api/booking-maintenance` every minute. Use a scheduler that can reach the target environment, including any preview deployment protection. Check scheduler failures and the response's `failures` count. This runner reconciles overdue Stripe sessions and sends appointment notifications.
- `RESEND_API_KEY`, `BOOKING_FROM_EMAIL`, and `BOOKING_NOTIFICATION_EMAIL` configure delivery. Verify the sending domain in Resend. Use controlled addresses in the preview.
- `BOOKING_INSTRUCTIONS` is the customer-facing text shown after payment and included in the email and calendar file. Include the meeting procedure and rescheduling contact details.
- To enable Google Calendar, set `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` together. Enable the Calendar API in the Google project and share a booking calendar with the service account with permission to create events. Store the private key as a server secret. The Calendar API reads busy intervals and writes confirmed bookings. Customers receive the calendar invitation as an attachment, with an additional download on their confirmation page.

Register `POST /api/stripe-webhook` in the sandbox for `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Use a publicly reachable endpoint or an approved deployment-protection bypass configured for Stripe. Configure the sandbox's consultation payment methods for immediate payment confirmation where possible. A completed session that is still unpaid retains its hold until Stripe reports a terminal outcome.

## Manage availability

Insert dated windows approved by the business owner into `consultation_openings` using explicit UTC offsets for the dates entered. The initial schedule is empty. The customer sees eligible starts 15 minutes apart, at least one hour and up to 120 days in advance. Each slot must fit the selected duration. The UI displays Central Time using `America/Chicago`, with CST or CDT on the time choices.

Use the schedule administrator role to add, edit, or remove future windows. Editing a window changes new availability. Existing reservations and confirmed appointments remain in the booking ledger. If Google Calendar is connected, its busy times also filter available windows and are checked before reserving and confirming. PostgreSQL is the authoritative ledger for site bookings. Coordinate edits made directly in Google Calendar with that ledger because Google and PostgreSQL cannot share a transaction.

## Operate and verify

1. In the preview, add a business-approved test window. Go through both durations, verify $80 and $150 respectively, and try reserving an overlapping time from a second browser. Pay with a Stripe sandbox test card and verify the signed webhook, persisted appointment, return page, and calendar file.
2. Test cancel, expiration, declined card, duplicate webhook delivery, and the protected maintenance URL. Check that an expired unpaid Checkout Session releases its slot and that a later payment on a released reservation goes to review.
3. Verify receipt of both emails in controlled inboxes and inspect the provider acceptance IDs in `consultation_deliveries`. If Google is configured, create a busy event and verify that it removes affected slots, then verify a paid booking writes one event.
4. Verify a custom sandbox payment with an approved amount and reference. Stripe records the reference as unverified. FELTUS LABS matches it manually before applying the payment to an invoice.
5. Review bookings in the `review` state and delivery jobs with a `last_error` or `review` state. For a paid booking in review, verify the PaymentIntent in Stripe and arrange a new time or refund through the authorized business account. For an email job that has aged out of automatic retry, check provider logs before resending. A delivery marked `sent` means the provider accepted the request.
6. After sandbox verification and explicit approval, configure a separate production database, authorized FELTUS LABS Stripe credentials and webhook, approved booking windows, sender, scheduler, and any calendar access. Change `ENABLE_LIVE_PAYMENTS` only for the approved production environment. Confirm the account and environment settings before enabling public traffic.

The local suite uses an embedded PostgreSQL runtime and intercepted provider calls. It does not submit payments, deliver real messages, or write to a real calendar.
