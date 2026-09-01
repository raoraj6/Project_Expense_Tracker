import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client.js';
import { useMoney } from '../hooks/useMoney.js';
import TransactionForm from '../components/TransactionForm.jsx';
import MotionButton from '../components/MotionButton.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { fadeUp, staggerContainer } from '../lib/motion.js';

const EMPTY_FILTERS = {
  search: '',
  type: '',
  category: '',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
  sort: '-date',
};

export default function Transactions() {
  const money = useMoney();

  const [categories, setCategories] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
    api.aiStatus().then(({ enabled }) => setAiEnabled(enabled)).catch(() => {});
  }, []);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters]);

  const load = useCallback(() => {
    setError('');
    api
      .listTransactions({ ...debounced, page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [debounced, page]);

  useEffect(load, [load]);

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    if (debounced.type === 'income') return categories.income;
    if (debounced.type === 'expense') return categories.expense;
    return [...new Set([...categories.expense, ...categories.income])];
  }, [categories, debounced.type]);

  const confirmDelete = async () => {
    const tx = pendingDelete;
    setPendingDelete(null);
    try {
      await api.deleteTransaction(tx.id);
      if (editing?.id === tx.id) setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div className="page-head" variants={fadeUp}>
        <h1>Transactions</h1>
      </motion.div>

      <motion.div variants={fadeUp}>
        <TransactionForm
          categories={categories}
          editing={editing}
          aiEnabled={aiEnabled}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      </motion.div>

      <motion.section className="card" variants={fadeUp}>
        <h2>Search &amp; filter</h2>
        <div className="filter-grid">
          <label>
            Search
            <input
              placeholder="note or category"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </label>
          <label>
            Type
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, category: '' })}>
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label>
            Category
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </label>
          <label>
            Min amount
            <input type="number" min="0" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} />
          </label>
          <label>
            Max amount
            <input type="number" min="0" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} />
          </label>
          <label>
            Sort
            <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              <option value="-date">Newest first</option>
              <option value="date">Oldest first</option>
              <option value="-amount">Amount: high to low</option>
              <option value="amount">Amount: low to high</option>
            </select>
          </label>
        </div>
        <MotionButton type="button" className="btn ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
          Reset filters
        </MotionButton>
      </motion.section>

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

      <motion.section className="card" variants={fadeUp}>
        <h2>
          {data ? `${data.total} result${data.total === 1 ? '' : 's'}` : 'Loading…'}
        </h2>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Note</th>
                <th className="right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted center">No transactions match these filters.</td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {data?.items.map((tx) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td>
                      <span className={`pill ${tx.type}`}>{tx.type}</span>
                    </td>
                    <td>
                      {tx.category}
                      {tx.aiCategorized && <span className="tag" title="Categorized by AI">AI</span>}
                    </td>
                    <td className="muted">{tx.note || '—'}</td>
                    <td className={`right tone-${tx.type === 'income' ? 'pos' : 'neg'}`}>
                      {tx.type === 'income' ? '+' : '−'}{money(tx.amount)}
                    </td>
                    <td className="right nowrap">
                      <MotionButton type="button" className="btn small" onClick={() => setEditing(tx)}>Edit</MotionButton>
                      <MotionButton type="button" className="btn small danger" onClick={() => setPendingDelete(tx)}>Delete</MotionButton>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="pager">
            <MotionButton type="button" className="btn small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </MotionButton>
            <span className="muted small">Page {data.page} of {data.pages}</span>
            <MotionButton type="button" className="btn small" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </MotionButton>
          </div>
        )}
      </motion.section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete transaction?"
        message={pendingDelete ? `This ${pendingDelete.type} of ${money(pendingDelete.amount)} will be permanently deleted.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </motion.div>
  );
}
