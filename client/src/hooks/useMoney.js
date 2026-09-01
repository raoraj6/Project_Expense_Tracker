import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/** Formats amounts in the signed-in user's currency. */
export function useMoney() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  return useCallback(
    (value) =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value ?? 0),
    [currency]
  );
}
