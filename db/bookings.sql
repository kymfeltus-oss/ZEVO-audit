BEGIN;

-- Administrators enter actual bookable windows using timestamps with UTC offsets.
CREATE TABLE consultation_openings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE consultations (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  minutes integer NOT NULL,
  amount_cents integer NOT NULL,
  customer_name text NOT NULL,
  email text NOT NULL,
  instructions text NOT NULL,
  state text NOT NULL DEFAULT 'held'
    CHECK (state IN ('held', 'processing', 'confirmed', 'expired', 'failed', 'review')),
  stripe_session text UNIQUE,
  payment_intent text,
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  next_check_at timestamptz NOT NULL,
  livemode boolean NOT NULL,
  CHECK ((minutes = 30 AND amount_cents = 8000) OR (minutes = 60 AND amount_cents = 15000)),
  CHECK (ends_at = starts_at + minutes * interval '1 minute'),
  CHECK ((state = 'confirmed') = (confirmed_at IS NOT NULL)),
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (state IN ('held', 'processing', 'confirmed'))
);

CREATE INDEX consultations_reconcile ON consultations (next_check_at)
  WHERE state IN ('held', 'processing');

CREATE TABLE consultation_deliveries (
  booking_id uuid REFERENCES consultations(id),
  kind text CHECK (kind IN ('customer', 'business', 'calendar')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sent', 'review')),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  provider_id text,
  last_error text,
  PRIMARY KEY (booking_id, kind)
);

COMMIT;
