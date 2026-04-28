import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale dynamic-import chunks after deploys.
// When a lazy()-loaded module fails to fetch (old hash no longer on server),
// clear caches and hard-reload — but only once per session to avoid loops.
const RELOAD_KEY = "scoutfoto_chunk_reload_at";
const RELOAD_FLAG = "scoutfoto_chunk_reload_pending";

const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /Importing a module script failed/i.test(msg) ||
  /ChunkLoadError/i.test(msg) ||
  /Loading chunk \d+ failed/i.test(msg);

const hardReload = async () => {
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

const showManualReloadToast = () => {
  toast.error("Não foi possível carregar parte do app", {
    id: "chunk-load-failed",
    description: "Pode haver uma nova versão disponível. Recarregue para atualizar.",
    duration: Infinity,
    action: {
      label: "Recarregar agora",
      onClick: () => {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        void hardReload();
      },
    },
  });
};

const recoverFromStaleChunk = async () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  // Avoid reload loops: if we already auto-reloaded recently, show a manual fallback
  if (Date.now() - last < 30_000) {
    showManualReloadToast();
    return;
  }
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  sessionStorage.setItem(RELOAD_FLAG, "1");
  await hardReload();
};

window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e?.reason as any)?.message ?? e?.reason ?? "");
  if (isChunkLoadError(msg)) recoverFromStaleChunk();
});

// After an auto-recovery reload, inform the user it was due to a new version.
if (sessionStorage.getItem(RELOAD_FLAG) === "1") {
  sessionStorage.removeItem(RELOAD_FLAG);
  // Defer until after Toaster mounts
  setTimeout(() => {
    toast.success("Página atualizada", {
      id: "chunk-reload-success",
      description: "Carregamos a versão mais recente do ScoutFoto.",
      duration: 5000,
    });
  }, 800);
}

createRoot(document.getElementById("root")!).render(<App />);
