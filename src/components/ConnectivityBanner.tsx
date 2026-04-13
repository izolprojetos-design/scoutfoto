import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi } from "lucide-react";
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
    // Check every 15s
    intervalRef.current = setInterval(checkBackend, 15000);
    return () => clearInterval(intervalRef.current);
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
            ? "Sem conexão com a internet. Verifique sua rede."
            : "Não foi possível conectar ao servidor. Tentando reconectar..."}
        </>
      )}
    </div>
  );
};

export default ConnectivityBanner;