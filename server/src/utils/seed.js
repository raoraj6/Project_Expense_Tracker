/**
 * Seeds a demo account with ~6 months of transactions.
 *   node src/utils/seed.js
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Transaction, EXPENSE_CATEGORIES } from '../models/Transaction.js';

const DEMO = { name: 'Demo User', email: 'demo@example.com', password: 'demo1234' };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;

export async function seed() {
  await connectDB();

  await User.deleteOne({ email: DEMO.email });
  const user = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    currency: 'INR',
    passwordHash: await User.hashPassword(DEMO.password),
  });

  await Transaction.deleteMany({ user: user._id });

  const docs = [];
  const now = new Date();

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {
    const base = new Date(now);
    base.setUTCMonth(now.getUTCMonth() - monthsAgo, 1);

    docs.push({
      user: user._id,
      type: 'income',
      amount: between(70000, 85000),
      category: 'Salary',
      note: 'Monthly salary',
      date: new Date(base.getFullYear(), base.getMonth(), 1),
    });

    if (Math.random() > 0.5) {
      docs.push({
        user: user._id,
        type: 'income',
        amount: between(5000, 20000),
        category: 'Freelance',
        note: 'Side project',
        date: new Date(base.getFullYear(), base.getMonth(), 12),
      });
    }

    for (let i = 0; i < 18; i += 1) {
      docs.push({
        user: user._id,
        type: 'expense',
        amount: between(120, 6500),
        category: pick(EXPENSE_CATEGORIES),
        note: pick(['Weekend outing', 'Monthly bill', 'Online order', 'Cab ride', 'Coffee run', '']),
        date: new Date(base.getFullYear(), base.getMonth(), 1 + Math.floor(Math.random() * 27)),
      });
    }
  }

  await Transaction.insertMany(docs);
  console.log(`Seeded ${docs.length} transactions for ${DEMO.email} / ${DEMO.password}`);
  await disconnectDB();
}

// Only auto-run when invoked directly, so importers can await it themselves.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
