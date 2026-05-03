import { ReactNode } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { EnaflixOverlayNav } from "./EnaflixOverlayNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  
  // Sidebar is only for Admin/Professor in this new AI-first era
  const showSidebar = isAdmin || isProfessor;
  
  // For students (no sidebar), we show the OverlayNav consistently if not on the main Enaflix page
  // (Since EnaflixPage already has its own OverlayNav with search logic, we avoid double rendering)
  const isEnaflixHome = location.pathname === "/enaflix" || location.pathname === "/dashboard";
  const showTopNav = !showSidebar && !isEnaflixHome;

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

      {/* Consistente Top Navigation for Students in subpages */}
      {showTopNav && (
        <EnaflixOverlayNav onClose={() => navigate("/enaflix")} />
      )}

      {/* Main Content Area - Adjust padding if sidebar is hidden */}
      <main className={`${showSidebar ? 'lg:pl-64' : 'pl-0'} ${showTopNav ? 'pt-16' : ''} min-h-screen transition-all duration-700 pb-20 lg:pb-0 relative z-10`}>
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
