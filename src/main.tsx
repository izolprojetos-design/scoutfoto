import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale dynamic-import chunks after deploys.
// When a lazy()-loaded module fails to fetch (old hash no longer on server),
// clear caches and hard-reload — but only once per session to avoid loops.
const RELOAD_KEY = "scoutfoto_chunk_reload_at";

const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /Importing a module script failed/i.test(msg) ||
  /ChunkLoadError/i.test(msg) ||
  /Loading chunk \d+ failed/i.test(msg);

const recoverFromStaleChunk = async () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  // Avoid reload loops: only auto-reload once every 30s
  if (Date.now() - last < 30_000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore
  }
  window.location.reload();
};

window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e?.reason as any)?.message ?? e?.reason ?? "");
  if (isChunkLoadError(msg)) recoverFromStaleChunk();
});

createRoot(document.getElementById("root")!).render(<App />);
