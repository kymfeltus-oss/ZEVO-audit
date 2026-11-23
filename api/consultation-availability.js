const { endpoint } = require('../lib/http');
const { availability, duration } = require('../lib/bookings');

module.exports = endpoint('GET', req => availability(req.query.month, duration(req.query.minutes)));
