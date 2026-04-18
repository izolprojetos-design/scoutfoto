import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ConnectivityBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [backendDown, setBackendDown] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Browser online/offline events
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      checkBackend();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Periodic backend health check
  const checkBackend = async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (!navigator.onLine) {
      setBackendDown(false);
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const { error } = await supabase.from("branches").select("id").limit(1).abortSignal(controller.signal);
      clearTimeout(timeout);
      if (error) throw error;
      if (backendDown) setRecovering(true);
      setBackendDown(false);
    } catch {
      setBackendDown(true);
      setRecovering(false);
    }
  };

  useEffect(() => {
    // Slow poll only when something is wrong; rely on online/offline events otherwise
    const intervalMs = backendDown ? 15000 : 120000;
    intervalRef.current = setInterval(checkBackend, intervalMs);
    const onVisible = () => {
      if (!document.hidden) checkBackend();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [backendDown]);

  // Clear recovering state after animation
  useEffect(() => {
    if (recovering) {
      const t = setTimeout(() => setRecovering(false), 3000);
      return () => clearTimeout(t);
    }
  }, [recovering]);

  const isDisconnected = offline || backendDown;

  if (!isDisconnected && !recovering) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-500",
        recovering
          ? "bg-green-600 text-white"
          : "bg-destructive text-destructive-foreground animate-pulse"
      )}
    >
      {recovering ? (
        <>
          <Wifi className="h-4 w-4" />
          Conexão restabelecida!
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          {offline
            ? "Sem conexão — exibindo dados salvos localmente."
            : "Servidor indisponível — exibindo dados em cache. Reconectando..."}
          <Database className="h-3 w-3 ml-1 opacity-70" />
        </>
      )}
    </div>
  );
};

export default ConnectivityBanner;