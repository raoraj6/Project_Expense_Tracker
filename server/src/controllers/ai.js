import { z } from 'zod';
import { categorizeTransaction, generateInsights, aiEnabled } from '../services/ai.js';
import { getSummary, getByCategory, getMonthlyTrend } from '../services/stats.js';

export const categorizeSchema = z.object({
  description: z.string().trim().min(3).max(280),
  amount: z.coerce.number().positive().optional(),
});

export const insightsSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export function getAiStatus(req, res) {
  res.json({ enabled: aiEnabled });
}

export async function categorize(req, res, next) {
  try {
    res.json(await categorizeTransaction(req.body));
  } catch (err) {
    next(err);
  }
}

export async function insights(req, res, next) {
  try {
    const userId = req.user._id;
    const { months } = req.query;

    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - months);

    const [summary, byCategory, monthlyTrend] = await Promise.all([
      getSummary(userId, { from }),
      getByCategory(userId, { from, type: 'expense' }),
      getMonthlyTrend(userId, { months }),
    ]);

    if (summary.transactionCount === 0) {
      return res.json({
        headline: 'Not enough data yet',
        insights: [
          {
            title: 'Add some transactions',
            detail: 'Record a few income and expense entries and insights will appear here.',
            severity: 'info',
          },
        ],
        suggestedMonthlyBudget: [],
      });
    }

    const result = await generateInsights({
      summary,
      byCategory,
      monthlyTrend,
      currency: req.user.currency,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
