class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function endpoint(method, action) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== method) {
      res.setHeader('Allow', method);
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    try {
      return res.status(200).json(await action(req));
    } catch (error) {
      if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
      console.error('Feltus API failure', { name: error.name, code: error.code, status: error.statusCode });
      return res.status(503).json({ error: 'This service is temporarily unavailable. Please try again.' });
    }
  };
}

function json(req) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object' || JSON.stringify(body).length > 4096) throw Error();
    return body;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}

function field(value, max) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value) || value.trim().length > max) {
    throw new HttpError(400, 'Check the information you entered.');
  }
  return value.trim();
}

function contact(body) {
  const name = field(body.name, 100);
  const email = field(body.email, 180);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter your name and a valid email address.');
  }
  return { name, email };
}

module.exports = { HttpError, endpoint, json, field, contact };
