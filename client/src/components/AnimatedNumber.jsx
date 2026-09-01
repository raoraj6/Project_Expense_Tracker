import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts a stat tile up/down to `value` instead of snapping to it. */
export default function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString() }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      from.current = value;
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: setDisplay,
    });
    from.current = value;
    return () => controls.stop();
  }, [value]);

  return <>{format(display)}</>;
}
