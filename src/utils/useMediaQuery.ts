import { useSyncExternalStore } from 'react';

// Shared breakpoints — keep in step with the media queries in index.css.
export const PHONE_QUERY = '(max-width: 640px)';

// Live-updating matchMedia. Only reach for this when markup or behaviour has
// to differ; pure styling differences belong in a CSS media query.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
