import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query. SSR-safe (returns false before mount). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True at >= 768px (md), i.e. tablet and up. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
