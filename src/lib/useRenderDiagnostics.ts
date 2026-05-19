import { useEffect, useRef } from 'react';

/**
 * Logs every render of the component, with elapsed time since previous render
 * and (optionally) which dependency changed. Output is gated by
 * `localStorage.setItem('debug:renders', '1')` so it's zero-cost in production.
 *
 * Usage:
 *   useRenderDiagnostics('Events');
 *   useRenderDiagnostics('EventDetail', { user, eventId, images });
 */
export function useRenderDiagnostics(
  name: string,
  watched?: Record<string, unknown>,
) {
  const enabled =
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('debug:renders') === '1';

  const renderCount = useRef(0);
  const lastTime = useRef<number>(performance.now());
  const lastWatched = useRef<Record<string, unknown> | undefined>(watched);

  renderCount.current += 1;

  if (enabled) {
    const now = performance.now();
    const delta = now - lastTime.current;
    lastTime.current = now;

    const changed: string[] = [];
    if (watched && lastWatched.current) {
      for (const key of Object.keys(watched)) {
        if (!Object.is(watched[key], lastWatched.current[key])) {
          changed.push(key);
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `%c[render] ${name} #${renderCount.current} (+${delta.toFixed(1)}ms)` +
        (changed.length ? `  changed: ${changed.join(', ')}` : ''),
      'color:#0ea5e9;font-weight:bold',
    );
  }

  useEffect(() => {
    lastWatched.current = watched;
  });
}
