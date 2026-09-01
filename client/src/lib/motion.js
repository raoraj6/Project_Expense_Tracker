// Shared Framer Motion presets so every page animates with the same feel.
export const springy = { type: 'spring', stiffness: 380, damping: 30 };

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springy },
};

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

export const popIn = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: springy },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12 } },
};
