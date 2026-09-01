import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

import * as auth from '../controllers/auth.js';
import * as tx from '../controllers/transactions.js';
import * as stats from '../controllers/stats.js';
import * as ai from '../controllers/ai.js';

const router = Router();

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// AI calls cost money — keep them bounded per client.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'AI rate limit reached, please slow down' },
});

router.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ---- Auth ----
router.post('/auth/register', authLimiter, validate(auth.registerSchema), auth.register);
router.post('/auth/login', authLimiter, validate(auth.loginSchema), auth.login);
router.get('/auth/me', requireAuth, auth.me);

// ---- Transactions (CRUD + search/filter) ----
router.get('/categories', tx.getCategories);
router.get('/transactions', requireAuth, validate(tx.listSchema, 'query'), tx.listTransactions);
router.post('/transactions', requireAuth, validate(tx.createSchema), tx.createTransaction);
router.get('/transactions/:id', requireAuth, tx.getTransaction);
router.patch('/transactions/:id', requireAuth, validate(tx.updateSchema), tx.updateTransaction);
router.delete('/transactions/:id', requireAuth, tx.deleteTransaction);

// ---- Charts / dashboard ----
router.get('/stats', requireAuth, validate(stats.statsQuerySchema, 'query'), stats.getDashboard);

// ---- AI ----
router.get('/ai/status', ai.getAiStatus);
router.post('/ai/categorize', requireAuth, aiLimiter, validate(ai.categorizeSchema), ai.categorize);
router.get('/ai/insights', requireAuth, aiLimiter, validate(ai.insightsSchema, 'query'), ai.insights);

export default router;
