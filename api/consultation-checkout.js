const { endpoint, json } = require('../lib/http');
const { reserve } = require('../lib/bookings');

module.exports = endpoint('POST', req => reserve(json(req)));
