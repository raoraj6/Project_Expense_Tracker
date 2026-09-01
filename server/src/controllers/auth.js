import { z } from 'zod';
import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  currency: z.string().trim().length(3).toUpperCase().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function register(req, res, next) {
  try {
    const { name, email, password, currency } = req.body;

    if (await User.exists({ email })) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const user = await User.create({
      name,
      email,
      currency: currency ?? 'INR',
      passwordHash: await User.hashPassword(password),
    });

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Same message either way — don't reveal whether the email exists.
    if (!user || !(await user.comparePassword(password))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
