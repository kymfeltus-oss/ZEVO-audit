const { createHash, timingSafeEqual } = require('node:crypto');
const { endpoint, HttpError } = require('../lib/http');
const { maintenance } = require('../lib/deliveries');

const hash = value => createHash('sha256').update(value).digest();

module.exports = endpoint('GET', req => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(hash(req.headers.authorization || ''), hash('Bearer ' + secret))) {
    throw new HttpError(401, 'Unauthorized.');
  }
  return maintenance();
});
