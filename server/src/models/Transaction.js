import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Housing & Rent',
  'Utilities',
  'Health',
  'Shopping',
  'Entertainment',
  'Education',
  'Travel',
  'Subscriptions',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investments',
  'Gift',
  'Refund',
  'Other',
];

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true },
    note: { type: String, trim: true, maxlength: 280, default: '' },
    date: { type: Date, required: true, default: () => new Date() },
    // Set when the category came from the AI categorizer rather than the user.
    aiCategorized: { type: Boolean, default: false },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
  },
  { timestamps: true }
);

// Dashboard and list queries always scope by user and sort by date.
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
// Text index powers the free-text search on note + category.
transactionSchema.index({ note: 'text', category: 'text' });

transactionSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    type: this.type,
    amount: this.amount,
    category: this.category,
    note: this.note,
    date: this.date,
    aiCategorized: this.aiCategorized,
    aiConfidence: this.aiConfidence,
    createdAt: this.createdAt,
  };
};

export const Transaction = mongoose.model('Transaction', transactionSchema);
