import { useEffect, useRef } from 'react';

/**
 * Logs every render of the component, with elapsed time since previous render
 * and (optionally) which dependency changed. Gated by
 * `localStorage.setItem('debug:renders', '1')` so it's zero-cost in production.
 *
 * Also pushes each entry into `window.__renderLog` (capped at 5000 entries)
 * so it can be exported as .txt from the UI toolbar.
 */

type LogEntry = {
  t: number;          // ms since first entry
  name: string;
  count: number;
  delta: number;
  changed: string[];
};

declare global {
  interface Window {
    __renderLog?: LogEntry[];
    __renderLogStart?: number;
    __renderBurst?: { name: string; ts: number }[];
  }
}

const MAX_LOG = 5000;
const BURST_WINDOW_MS = 3000;
const BURST_THRESHOLD = 40; // > 40 renders of same component in 3s => auto-fallback

function pushLog(entry: LogEntry) {
  if (typeof window === 'undefined') return;
  if (!window.__renderLog) {
    window.__renderLog = [];
    window.__renderLogStart = performance.now();
  }
  window.__renderLog.push(entry);
  if (window.__renderLog.length > MAX_LOG) window.__renderLog.shift();
}

function detectBurst(name: string) {
  if (typeof window === 'undefined') return;
  if (window.localStorage?.getItem('ui:no-effects') === '1') return;
  const now = performance.now();
  if (!window.__renderBurst) window.__renderBurst = [];
  window.__renderBurst.push({ name, ts: now });
  window.__renderBurst = window.__renderBurst.filter(
    (e) => now - e.ts < BURST_WINDOW_MS,
  );
  const sameName = window.__renderBurst.filter((e) => e.name === name).length;
  if (sameName > BURST_THRESHOLD) {
    window.localStorage.setItem('ui:no-effects', 'auto');
    // eslint-disable-next-line no-console
    console.warn(
      `[render] Burst detected on ${name} (${sameName} renders / ${BURST_WINDOW_MS}ms). Auto-enabling "no effects" mode.`,
    );
    window.dispatchEvent(new Event('ui:no-effects-changed'));
  }
}

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

  // Burst detection runs always (cheap), so auto-fallback can kick in
  detectBurst(name);

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

    pushLog({
      t: now - (window.__renderLogStart ?? now),
      name,
      count: renderCount.current,
      delta,
      changed,
    });

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

export function exportRenderLog() {
  if (typeof window === 'undefined') return;
  const log = window.__renderLog ?? [];
  const header = `# Render diagnostics export\n# Generated: ${new Date().toISOString()}\n# Total entries: ${log.length}\n\n`;
  const lines = log.map(
    (e) =>
      `[${e.t.toFixed(1).padStart(9, ' ')}ms] ${e.name.padEnd(20)} #${String(e.count).padStart(4, ' ')}  +${e.delta.toFixed(1).padStart(6, ' ')}ms` +
      (e.changed.length ? `  changed: ${e.changed.join(', ')}` : ''),
  );
  const blob = new Blob([header + lines.join('\n') + '\n'], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `render-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearRenderLog() {
  if (typeof window === 'undefined') return;
  window.__renderLog = [];
  window.__renderLogStart = performance.now();
}
