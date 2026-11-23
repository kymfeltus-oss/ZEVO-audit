const { endpoint, json } = require('../lib/http');
const { bookingStatus } = require('../lib/bookings');

module.exports = endpoint('POST', req => bookingStatus(json(req)));
