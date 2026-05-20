
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on the main landing page or core dashboards where it might be redundant
  const hideOnPaths = ["/", "/dashboard", "/enaflix", "/login", "/register"];
  const isHidden = hideOnPaths.includes(location.pathname);

  if (isHidden) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        onClick={() => navigate(-1)}
        className={cn(
          "fixed top-4 left-4 z-[100] h-10 px-4 rounded-full flex items-center gap-2",
          "bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white",
          "transition-all duration-300 hover:bg-black/60 hover:scale-105 active:scale-95",
          "lg:top-6 lg:left-6 shadow-2xl"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voltar</span>
      </motion.button>
    </AnimatePresence>
  );
}
