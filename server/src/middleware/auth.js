import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from './error.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing bearer token');
    }

    let payload;
    try {
      payload = jwt.verify(header.slice(7), config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'User no longer exists');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
