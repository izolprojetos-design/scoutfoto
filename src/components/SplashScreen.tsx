import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LogoCircle from "@/components/LogoCircle";

const SplashScreen = ({ onFinished }: { onFinished: () => void }) => {
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Para de girar assim que o carregamento termina, e só então some.
    const stopSpin = setTimeout(() => setLoaded(true), 800);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinished, 300);
    }, 1200);
    return () => {
      clearTimeout(stopSpin);
      clearTimeout(timer);
    };
  }, [onFinished]);


  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ backgroundColor: "#14532d" }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <LogoCircle size="lg" spinning={!loaded} shadowClassName="shadow-2xl" ringClassName="ring-white/20" alt="12º Grupo Escoteiro Monte Caburaí" />
          </motion.div>
          <motion.h1
            className="mt-6 text-3xl font-bold tracking-wide"
            style={{ color: "#d4a843" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            ScoutFoto
          </motion.h1>
          <motion.p
            className="mt-2 text-sm"
            style={{ color: "rgba(255,255,255,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            Banco de Imagens Escoteiro
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
