import { ReactNode } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  
  // Sidebar is only for Admin/Professor in this new AI-first era
  const showSidebar = isAdmin || isProfessor;

  return (
    <div className="min-h-screen bg-[#050508] text-white selection:bg-primary/30 selection:text-white antialiased">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      {/* Navigation Layer - Hidden for Students */}
      {showSidebar && (
        <>
          <EnaflixSidebar />
          <EnaflixMobileNav />
        </>
      )}

      {/* Main Content Area - Adjust padding if sidebar is hidden */}
      <main className={`${showSidebar ? 'lg:pl-64' : 'pl-0'} min-h-screen transition-all duration-700 pb-20 lg:pb-0 relative z-10`}>
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
