import { useCallback, useState } from "react";

/**
 * useState that survives restarts: the value is kept in localStorage under "hd.<key>".
 * Sets are stored as arrays. Storage can be missing (private window): the app still works.
 */
export function usePersisted<T>(key: string, initial: T | (() => T)) {
  const k = `hd.${key}`;
  const [value, setValue] = useState<T>(() => {
    const d = typeof initial === "function" ? (initial as () => T)() : initial;
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) return d;
      const v = JSON.parse(raw);
      return (d instanceof Set ? new Set(v) : v) as T;
    } catch { return d; }
  });
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(k, JSON.stringify(v instanceof Set ? [...v] : v)); } catch { /* storage unavailable */ }
      return v;
    });
  }, [k]);
  return [value, set] as const;
}
