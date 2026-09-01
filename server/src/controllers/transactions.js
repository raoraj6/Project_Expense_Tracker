import { z } from 'zod';
import { Transaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../models/Transaction.js';
import { HttpError } from '../middleware/error.js';

const amount = z.coerce.number().positive('Amount must be greater than 0').max(1e12);

export const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount,
  category: z.string().trim().min(1).max(60),
  note: z.string().trim().max(280).optional().default(''),
  date: z.coerce.date().optional(),
  aiCategorized: z.boolean().optional().default(false),
  aiConfidence: z.number().min(0).max(1).nullish(),
});

export const updateSchema = createSchema.partial();

export const listSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  sort: z.enum(['date', '-date', 'amount', '-amount']).optional().default('-date'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

function buildFilter(userId, q) {
  const filter = { user: userId };

  if (q.type) filter.type = q.type;
  if (q.category) filter.category = q.category;

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = q.from;
    if (q.to) filter.date.$lte = q.to;
  }

  if (q.minAmount !== undefined || q.maxAmount !== undefined) {
    filter.amount = {};
    if (q.minAmount !== undefined) filter.amount.$gte = q.minAmount;
    if (q.maxAmount !== undefined) filter.amount.$lte = q.maxAmount;
  }

  if (q.search) {
    // Escape the term so user input can't act as a regex.
    const safe = q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ note: rx }, { category: rx }];
  }

  return filter;
}

export async function listTransactions(req, res, next) {
  try {
    const q = req.query;
    const filter = buildFilter(req.user._id, q);
    const skip = (q.page - 1) * q.limit;

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort(q.sort).skip(skip).limit(q.limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      items,
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.max(1, Math.ceil(total / q.limit)),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTransaction(req, res, next) {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!tx) throw new HttpError(404, 'Transaction not found');
    res.json(tx);
  } catch (err) {
    next(err);
  }
}

export async function createTransaction(req, res, next) {
  try {
    const body = req.body;
    const allowed = body.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!allowed.includes(body.category)) {
      throw new HttpError(422, `Invalid category for ${body.type}`, { allowed });
    }

    const tx = await Transaction.create({ ...body, user: req.user._id });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!tx) throw new HttpError(404, 'Transaction not found');

    Object.assign(tx, req.body);

    const allowed = tx.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!allowed.includes(tx.category)) {
      throw new HttpError(422, `Invalid category for ${tx.type}`, { allowed });
    }

    await tx.save();
    res.json(tx);
  } catch (err) {
    next(err);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tx) throw new HttpError(404, 'Transaction not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export function getCategories(req, res) {
  res.json({ income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES });
}
