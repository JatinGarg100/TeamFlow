import { useState, useEffect } from 'react';

/**
 * useDebounce
 * -----------
 * Delays updating the debounced value until after the specified delay has passed.
 * Used for search input bars so API requests aren't fired on every single keystroke.
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
