import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client.js';
import { useMoney } from '../hooks/useMoney.js';
import MotionButton from '../components/MotionButton.jsx';
import { fadeUp, staggerContainer } from '../lib/motion.js';

export default function Insights() {
  const money = useMoney();
  const [aiEnabled, setAiEnabled] = useState(null);
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.aiStatus().then(({ enabled }) => setAiEnabled(enabled)).catch(() => setAiEnabled(false));
  }, []);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      setData(await api.aiInsights({ months }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (aiEnabled === false) {
    return (
      <div className="page-stack">
        <div className="page-head"><h1>AI Insights</h1></div>
        <div className="card">
          <h2>AI is not configured</h2>
          <p className="muted">
            Set <code>GROQ_API_KEY</code> in the server environment and restart the API to enable
            spending analysis and auto-categorization. Grab a free key from{' '}
            <code>console.groq.com/keys</code>. Everything else in the app works without it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div className="page-head" variants={fadeUp}>
        <h1>AI Insights</h1>
        <div className="inline">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12].map((m) => (
              <option key={m} value={m}>Last {m} months</option>
            ))}
          </select>
          <MotionButton type="button" className="btn primary" onClick={run} disabled={busy}>
            {busy ? (
              <span className="inline-tight">
                <motion.span
                  className="spinner"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                />
                Analysing…
              </span>
            ) : (
              'Analyse my spending'
            )}
          </MotionButton>
        </div>
      </motion.div>

      <motion.p className="muted small" variants={fadeUp}>
        Only aggregated totals are sent for analysis — never your individual transaction notes.
      </motion.p>

      <AnimatePresence>
        {error && (
          <motion.div
            className="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!data && !busy && (
        <motion.div className="card muted" variants={fadeUp}>
          Run an analysis to see insights and a suggested budget.
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key="results"
            className="page-stack"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <section className="card">
              <h2>{data.headline}</h2>
              <motion.ul
                className="insight-list"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {data.insights.map((it) => (
                  <motion.li key={it.title} className={`insight sev-${it.severity}`} variants={fadeUp}>
                    <strong>{it.title}</strong>
                    <p>{it.detail}</p>
                  </motion.li>
                ))}
              </motion.ul>
            </section>

            {data.suggestedMonthlyBudget.length > 0 && (
              <section className="card">
                <h2>Suggested monthly budget</h2>
                <div className="scroll-x">
                  <table className="table">
                    <thead>
                      <tr><th>Category</th><th className="right">Suggested</th></tr>
                    </thead>
                    <tbody>
                      {data.suggestedMonthlyBudget.map((b) => (
                        <tr key={b.category}>
                          <td>{b.category}</td>
                          <td className="right">{money(b.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
