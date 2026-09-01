import { z } from 'zod';
import { getSummary, getByCategory, getMonthlyTrend } from '../services/stats.js';

export const statsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(['income', 'expense']).optional().default('expense'),
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export async function getDashboard(req, res, next) {
  try {
    const { from, to, type, months } = req.query;
    const userId = req.user._id;

    const [summary, byCategory, monthlyTrend] = await Promise.all([
      getSummary(userId, { from, to }),
      getByCategory(userId, { from, to, type }),
      getMonthlyTrend(userId, { months }),
    ]);

    res.json({ summary, byCategory, monthlyTrend, currency: req.user.currency });
  } catch (err) {
    next(err);
  }
}
