export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// The unused `next` is required: Express identifies error handlers by arity.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Mongoose duplicate key (e.g. email already registered).
  if (err.code === 11000) {
    return res.status(409).json({ error: 'That value is already taken', details: err.keyValue });
  }

  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: 'Validation failed',
      details: Object.fromEntries(
        Object.entries(err.errors).map(([field, e]) => [field, e.message])
      ),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
