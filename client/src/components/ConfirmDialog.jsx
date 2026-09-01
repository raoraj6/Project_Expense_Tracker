import { AnimatePresence, motion } from 'framer-motion';
import MotionButton from './MotionButton.jsx';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="dialog-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dialog-title">{title}</h2>
            <p className="muted">{message}</p>
            <div className="dialog-actions">
              <MotionButton type="button" className="btn ghost" onClick={onCancel}>
                Cancel
              </MotionButton>
              <MotionButton type="button" className="btn danger" onClick={onConfirm}>
                {confirmLabel}
              </MotionButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
