import { ReactNode } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { EnaflixAmbientParticles } from "./EnaflixAmbientParticles";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white selection:bg-primary/30 selection:text-white">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
        <EnaflixAmbientParticles />
      </div>

      <EnaflixSidebar />
      <EnaflixMobileNav />

      <main className="lg:pl-64 min-h-screen transition-all duration-500 pb-20 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full relative"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
