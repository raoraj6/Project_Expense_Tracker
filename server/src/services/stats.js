import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));

function dateMatch(from, to) {
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return Object.keys(range).length ? { date: range } : {};
}

/** Income / expense / balance totals for a period. */
export async function getSummary(userId, { from, to } = {}) {
  const rows = await Transaction.aggregate([
    { $match: { user: toId(userId), ...dateMatch(from, to) } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const income = rows.find((r) => r._id === 'income')?.total ?? 0;
  const expense = rows.find((r) => r._id === 'expense')?.total ?? 0;
  const count = rows.reduce((sum, r) => sum + r.count, 0);

  return {
    income: round(income),
    expense: round(expense),
    balance: round(income - expense),
    savingsRate: income > 0 ? round(((income - expense) / income) * 100) : 0,
    transactionCount: count,
  };
}

/** Expense (or income) breakdown by category, largest first — feeds the pie chart. */
export async function getByCategory(userId, { from, to, type = 'expense' } = {}) {
  const rows = await Transaction.aggregate([
    { $match: { user: toId(userId), type, ...dateMatch(from, to) } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  return rows.map((r) => ({ category: r._id, total: round(r.total), count: r.count }));
}

/** Month-by-month income vs expense — feeds the trend chart. */
export async function getMonthlyTrend(userId, { months = 6 } = {}) {
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
  from.setUTCHours(0, 0, 0, 0);

  const rows = await Transaction.aggregate([
    { $match: { user: toId(userId), date: { $gte: from } } },
    {
      $group: {
        _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  // Emit every month in the window, including empty ones, so the chart has no gaps.
  const buckets = new Map();
  for (let i = 0; i < months; i += 1) {
    const d = new Date(from);
    d.setUTCMonth(from.getUTCMonth() + i);
    buckets.set(d.toISOString().slice(0, 7), { month: d.toISOString().slice(0, 7), income: 0, expense: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(row._id.month);
    if (bucket) bucket[row._id.type] = round(row.total);
  }

  return [...buckets.values()];
}

function round(n) {
  return Math.round(n * 100) / 100;
}
