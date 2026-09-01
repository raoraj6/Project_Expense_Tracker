import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client.js';
import MotionButton from './MotionButton.jsx';

const today = () => new Date().toISOString().slice(0, 10);

const blank = {
  type: 'expense',
  amount: '',
  category: '',
  note: '',
  date: today(),
  aiCategorized: false,
  aiConfidence: null,
};

export default function TransactionForm({ categories, editing, onSaved, onCancel, aiEnabled }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        type: editing.type,
        amount: String(editing.amount),
        category: editing.category,
        note: editing.note ?? '',
        date: new Date(editing.date).toISOString().slice(0, 10),
        aiCategorized: editing.aiCategorized,
        aiConfidence: editing.aiConfidence,
      });
    } else {
      setForm(blank);
    }
    setError('');
    setAiNote('');
  }, [editing]);

  const options = categories?.[form.type] ?? [];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        category: form.category,
        note: form.note,
        date: form.date,
        aiCategorized: form.aiCategorized,
        aiConfidence: form.aiConfidence,
      };
      const saved = editing
        ? await api.updateTransaction(editing.id, payload)
        : await api.createTransaction(payload);
      setForm(blank);
      setAiNote('');
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Ask the model to infer type + category from the note text.
  const autoCategorize = async () => {
    if (!form.note.trim()) {
      setError('Write a short note first, then let AI categorize it.');
      return;
    }
    setError('');
    setAiBusy(true);
    try {
      const result = await api.aiCategorize({
        description: form.note,
        amount: form.amount ? Number(form.amount) : undefined,
      });
      setForm((f) => ({
        ...f,
        type: result.type,
        category: result.category,
        aiCategorized: true,
        aiConfidence: result.confidence,
      }));
      setAiNote(`${result.category} · ${Math.round(result.confidence * 100)}% — ${result.reason}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>{editing ? 'Edit transaction' : 'Add transaction'}</h2>

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

      <div className="field-row">
        <label>
          Type
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value, category: '', aiCategorized: false })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label>
          Amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </label>

        <label>
          Date
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
      </div>

      <label>
        Note
        <input
          maxLength={280}
          placeholder="e.g. uber to the airport"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </label>

      <label>
        Category
        <div className="inline">
          <select
            required
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value, aiCategorized: false, aiConfidence: null })
            }
          >
            <option value="">Select a category…</option>
            {options.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {aiEnabled && (
            <MotionButton type="button" className="btn ghost" onClick={autoCategorize} disabled={aiBusy}>
              {aiBusy ? 'Thinking…' : '✨ AI categorize'}
            </MotionButton>
          )}
        </div>
        <AnimatePresence>
          {aiNote && (
            <motion.span
              className="hint"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              AI: {aiNote}
            </motion.span>
          )}
        </AnimatePresence>
      </label>

      <div className="inline">
        <MotionButton className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
        </MotionButton>
        {editing && (
          <MotionButton className="btn ghost" type="button" onClick={onCancel}>
            Cancel
          </MotionButton>
        )}
      </div>
    </form>
  );
}
