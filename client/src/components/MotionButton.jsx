import { motion } from 'framer-motion';

// Thin wrapper so every button in the app shares the same tactile hover/tap
// feel without repeating the motion props at each call site.
export default function MotionButton({ disabled, ...props }) {
  return (
    <motion.button
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      {...props}
    />
  );
}
