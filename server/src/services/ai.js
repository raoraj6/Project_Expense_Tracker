import Groq from 'groq-sdk';
import { config, aiEnabled } from '../config/env.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../models/Transaction.js';
import { HttpError } from '../middleware/error.js';

const client = aiEnabled ? new Groq({ apiKey: config.groqApiKey }) : null;

function assertEnabled() {
  if (!client) {
    throw new HttpError(
      503,
      'AI features are disabled. Set GROQ_API_KEY on the server to enable them.'
    );
  }
}

/**
 * Pulls the JSON payload out of a structured-output completion.
 * Reasoning models put their chain of thought in a separate `reasoning` field,
 * so `message.content` is the schema-conforming JSON on its own.
 */
function parseStructured(completion) {
  const choice = completion.choices?.[0];
  if (!choice) throw new HttpError(502, 'AI returned no choices');

  if (choice.message?.refusal) {
    throw new HttpError(422, 'The model declined to process this request');
  }
  if (choice.finish_reason === 'length') {
    throw new HttpError(502, 'AI response was truncated; try again');
  }

  const text = choice.message?.content;
  if (!text) throw new HttpError(502, 'AI returned no content');

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'AI returned malformed JSON');
  }
}

/**
 * Wraps a schema in Groq's structured-output envelope. `strict: true` enforces
 * the schema rather than merely asking for JSON, which requires every property
 * to be listed in `required` and `additionalProperties: false` on each object.
 */
function jsonSchema(name, schema) {
  return { type: 'json_schema', json_schema: { name, strict: true, schema } };
}

/**
 * Calls the Groq API and translates transport/quota failures into HttpErrors
 * with an actionable message, instead of letting them fall through to a bare
 * 500. Groq's per-minute token limit reserves `max_completion_tokens` against
 * the quota up front (regardless of actual usage), so undersized free-tier
 * limits are a routine, expected failure mode here — not a bug to hide.
 */
async function complete(params) {
  try {
    return await client.chat.completions.create(params);
  } catch (err) {
    if (err instanceof Groq.RateLimitError) {
      const retryAfter = Number(err.headers?.['retry-after']);
      throw new HttpError(
        429,
        'The AI provider is rate limiting this request. Please try again shortly.',
        Number.isFinite(retryAfter) ? { retryAfterSeconds: retryAfter } : undefined
      );
    }
    // Free-tier "request too large for TPM" comes back as a plain 413, which
    // the Groq SDK doesn't have a dedicated subclass for.
    if (err instanceof Groq.APIError && err.status === 413) {
      throw new HttpError(
        429,
        'This request is too large for the current Groq plan/rate limit. Try a shorter ' +
          'time range, or use a smaller model (e.g. openai/gpt-oss-20b).'
      );
    }
    if (err instanceof Groq.APIError) {
      throw new HttpError(502, `AI provider error: ${err.error?.error?.message ?? err.message}`);
    }
    throw err;
  }
}

const CATEGORIZE_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['income', 'expense'] },
    category: {
      type: 'string',
      enum: [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])],
    },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['type', 'category', 'confidence', 'reason'],
  additionalProperties: false,
};

/**
 * Classifies a free-text transaction description into a type + category.
 * e.g. "uber to the airport 480" -> { type: 'expense', category: 'Transport' }
 */
export async function categorizeTransaction({ description, amount }) {
  assertEnabled();

  const completion = await complete({
    model: config.groqModel,
    // Categorization is short and well-scoped — minimal reasoning keeps it fast.
    reasoning_effort: 'low',
    // The output is a handful of short fields; Groq reserves this full amount
    // against the per-minute token quota up front, so keep it tight.
    max_completion_tokens: 512,
    response_format: jsonSchema('transaction_category', CATEGORIZE_SCHEMA),
    messages: [
      {
        role: 'system',
        content:
          'You classify personal-finance transactions. Pick the single best-fitting ' +
          'category from the allowed list. Use "Other" only when nothing else fits. ' +
          'confidence is 0-1. Keep reason under 15 words.',
      },
      {
        role: 'user',
        content: `Description: ${description}\nAmount: ${amount ?? 'unknown'}`,
      },
    ],
  });

  const result = parseStructured(completion);

  // The enum spans both types, so a valid answer can still pair an income
  // category with an expense. Clamp rather than surface a nonsensical row.
  const allowed = result.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!allowed.includes(result.category)) result.category = 'Other';

  // Guard the numeric range that strict JSON Schema can't express.
  result.confidence = Math.min(1, Math.max(0, Number(result.confidence) || 0));

  return result;
}

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'watch', 'alert'] },
        },
        required: ['title', 'detail', 'severity'],
        additionalProperties: false,
      },
    },
    suggestedMonthlyBudget: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['category', 'amount'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'insights', 'suggestedMonthlyBudget'],
  additionalProperties: false,
};

/**
 * Turns aggregated spending numbers into narrative insights and a budget
 * suggestion. Only aggregates are sent — never raw transaction notes.
 */
export async function generateInsights({ summary, byCategory, monthlyTrend, currency }) {
  assertEnabled();

  const completion = await complete({
    model: config.groqModel,
    reasoning_effort: 'medium',
    // Same reservation caveat as categorize — sized for a short JSON payload
    // (3-5 insights + a budget list) plus medium-effort reasoning, while
    // staying comfortably under Groq's free-tier 8000 TPM cap.
    max_completion_tokens: 4096,
    response_format: jsonSchema('spending_insights', INSIGHTS_SCHEMA),
    messages: [
      {
        role: 'system',
        content:
          'You are a pragmatic personal-finance analyst. Ground every claim in the ' +
          'numbers you are given and cite the figure. Give 3-5 insights. Keep each ' +
          'detail under 40 words. Do not invent data that is not present.',
      },
      {
        role: 'user',
        content: [
          `Currency: ${currency}`,
          `Totals: ${JSON.stringify(summary)}`,
          `Spend by category: ${JSON.stringify(byCategory)}`,
          `Monthly trend: ${JSON.stringify(monthlyTrend)}`,
          '',
          'Analyse this and return insights plus a suggested monthly budget per category.',
        ].join('\n'),
      },
    ],
  });

  return parseStructured(completion);
}

export { aiEnabled };
