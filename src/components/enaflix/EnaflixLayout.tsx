import { ReactNode } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#050508] text-white selection:bg-primary/30 selection:text-white antialiased">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      {/* Navigation Layer */}
      <EnaflixSidebar />
      <EnaflixMobileNav />

      {/* Main Content Area */}
      <main className="lg:pl-64 min-h-screen transition-all duration-700 pb-20 lg:pb-0 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.16, 1, 0.3, 1] // ease-out-expo
            }}
            className="w-full min-h-screen"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Vignette Overlay for extra depth */}
      <div className="fixed inset-0 pointer-events-none z-[60] shadow-[inset_0_0_150px_rgba(0,0,0,0.4)]" />
    </div>
  );
}
