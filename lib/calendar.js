const { sign } = require('node:crypto');

const ZONE = 'America/Chicago';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
let access;

function googleCalendar() {
  const { GOOGLE_CALENDAR_ID: id, GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: key } = process.env;
  if (!id && !email && !key) return null;
  if (!id || !email || !key) throw Error('Incomplete Google Calendar configuration');
  return { id, email, key: key.replace(/\\n/g, '\n') };
}

async function googleToken({ email, key }) {
  const now = Math.floor(Date.now() / 1000);
  if (access?.expires > now + 60) return access.token;
  const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  const claims = encode({
    iss: email, aud: TOKEN_URL, iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/calendar'
  });
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + claims;
  const assertion = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw Error('Google authentication failed');
  const data = await response.json();
  access = { token: data.access_token, expires: now + data.expires_in };
  return access.token;
}

async function googleRequest(config, path, body) {
  return fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + await googleToken(config), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000)
  });
}

async function busyTimes(start, end) {
  const config = googleCalendar();
  if (!config) return [];
  const response = await googleRequest(config, '/freeBusy', {
    timeMin: start, timeMax: end, items: [{ id: config.id }]
  });
  if (!response.ok) throw Error('Google free/busy request failed');
  const calendar = (await response.json()).calendars?.[config.id];
  if (calendar?.errors?.length || !Array.isArray(calendar?.busy)) throw Error('Google availability unavailable');
  return calendar.busy.map(({ start, end }) => [Date.parse(start), Date.parse(end)]);
}

function isFree(busy, startsAt, minutes) {
  const start = new Date(startsAt).getTime();
  return busy.every(([from, to]) => to <= start || from >= start + minutes * 60000);
}

async function createCalendarEvent(booking) {
  const config = googleCalendar();
  if (!config) throw Error('Google Calendar configuration required');
  const path = '/calendars/' + encodeURIComponent(config.id) + '/events';
  const id = 'feltus' + booking.id.replaceAll('-', '');
  const response = await googleRequest(config, path, {
    id,
    summary: 'FELTUS LABS consultation',
    description: 'Booking reference ' + booking.id,
    start: { dateTime: booking.starts_at.toISOString(), timeZone: ZONE },
    end: { dateTime: booking.ends_at.toISOString(), timeZone: ZONE },
    extendedProperties: { private: { feltusBooking: booking.id } }
  });
  if (response.status === 409) {
    const existing = await googleRequest(config, path + '/' + id);
    if (existing.ok) {
      const event = await existing.json();
      if (event.status !== 'cancelled' && event.extendedProperties?.private?.feltusBooking === booking.id &&
          Date.parse(event.start.dateTime) === +booking.starts_at && Date.parse(event.end.dateTime) === +booking.ends_at) return id;
    }
  }
  if (!response.ok) throw Error('Google Calendar event write failed');
  return id;
}

function invite(booking) {
  const date = value => value.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const escape = value => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[;,]/g, '\\$&');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FELTUS LABS//Consultations//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:' + booking.id + '@feltuslabs.com', 'DTSTAMP:' + date(booking.confirmed_at),
    'DTSTART:' + date(booking.starts_at), 'DTEND:' + date(booking.ends_at), 'STATUS:CONFIRMED',
    'SUMMARY:FELTUS LABS Consultation', 'DESCRIPTION:' + escape(booking.instructions), 'END:VEVENT', 'END:VCALENDAR'
  ];
  return lines.map(line => {
    let result = '';
    let bytes = 0;
    for (const unit of line) {
      const size = Buffer.byteLength(unit);
      if (bytes + size > 75) {
        result += '\r\n ';
        bytes = 1;
      }
      result += unit;
      bytes += size;
    }
    return result;
  }).join('\r\n') + '\r\n';
}

module.exports = { ZONE, googleCalendar, busyTimes, isFree, createCalendarEvent, invite };
