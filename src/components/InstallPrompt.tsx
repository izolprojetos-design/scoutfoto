import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    const wasDismissed = sessionStorage.getItem("install-dismissed");
    if (wasDismissed) return;

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(isiOS);

    if (isiOS) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 1500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    sessionStorage.setItem("install-dismissed", "true");
  };

  if (dismissed || !showBanner) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg"
        >
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="ScoutFoto"
              className="h-12 w-12 rounded-xl"
            />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                Instalar ScoutFoto
              </h3>
              <p className="text-xs text-muted-foreground">
                {isIos
                  ? "Toque em Compartilhar e depois \"Adicionar à Tela Inicial\""
                  : "Acesse mais rápido direto da tela inicial"}
              </p>
            </div>

            {!isIos && (
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-1.5 rounded-xl"
              >
                <Download className="h-4 w-4" />
                Instalar
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
