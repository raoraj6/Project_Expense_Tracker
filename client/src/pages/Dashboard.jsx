import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useMoney } from '../hooks/useMoney.js';
import { CategoryPie, TrendLine, CategoryBars } from '../components/Charts.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { fadeUp, staggerContainer } from '../lib/motion.js';

const RANGES = [
  { label: 'This month', months: 1 },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last 12 months', months: 12 },
];

export default function Dashboard() {
  const money = useMoney();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
    from.setUTCHours(0, 0, 0, 0);

    let cancelled = false;
    setError('');
    api
      .stats({ from: from.toISOString(), months })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [months]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="muted">Loading dashboard…</div>;

  const { summary, byCategory, monthlyTrend } = data;

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div className="page-head" variants={fadeUp}>
        <h1>Dashboard</h1>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {RANGES.map((r) => (
            <option key={r.months} value={r.months}>{r.label}</option>
          ))}
        </select>
      </motion.div>

      <motion.div className="stat-row" variants={staggerContainer}>
        <Stat label="Income" value={summary.income} format={money} tone="pos" />
        <Stat label="Expenses" value={summary.expense} format={money} tone="neg" />
        <Stat label="Balance" value={summary.balance} format={money} tone={summary.balance >= 0 ? 'pos' : 'neg'} />
        <Stat label="Savings rate" value={summary.savingsRate} format={(v) => `${v.toFixed(2)}%`} />
        <Stat label="Transactions" value={summary.transactionCount} format={(v) => Math.round(v).toLocaleString()} />
      </motion.div>

      <div className="grid-2">
        <motion.section className="card" variants={fadeUp} whileHover={{ y: -2 }}>
          <h2>Income vs expenses</h2>
          <TrendLine data={monthlyTrend} />
        </motion.section>

        <motion.section className="card" variants={fadeUp} whileHover={{ y: -2 }}>
          <h2>Spending by category</h2>
          <CategoryPie data={byCategory} />
        </motion.section>
      </div>

      <motion.section className="card" variants={fadeUp} whileHover={{ y: -2 }}>
        <h2>Top categories</h2>
        <div className="scroll-x">
          <CategoryBars data={byCategory.slice(0, 10)} />
        </div>
      </motion.section>
    </motion.div>
  );
}

function Stat({ label, value, format, tone }) {
  return (
    <motion.div className="card stat" variants={fadeUp} whileHover={{ y: -2, scale: 1.02 }}>
      <span className="muted small">{label}</span>
      <strong className={tone ? `tone-${tone}` : undefined}>
        <AnimatedNumber value={value} format={format} />
      </strong>
    </motion.div>
  );
}
