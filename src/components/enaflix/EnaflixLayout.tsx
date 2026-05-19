import { ReactNode, useState, useEffect } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { EnaflixOverlayNav } from "./EnaflixOverlayNav";
import { useLocation, useNavigate } from "react-router-dom";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { telemetry } from "@/lib/pedagogicalTelemetry";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  
  // Immersive routes: Tutor IA and sessions must occupy full screen
  const immersiveRoutes = ["/dashboard/mentor", "/dashboard/tutor", "/mentor", "/tutor", "/study/tutor", "/dashboard/sessao-estudo", "/dashboard/clinical-simulation", "/dashboard/anamnese"];
  const isImmersive = immersiveRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r + "/"));

  // Sidebar for Admin/Professor or in standard student view
  const showSidebar = !isImmersive || isAdmin || isProfessor;

  // Telemetry: Track page opens
  useEffect(() => {
    telemetry.track('session_progress', { 
      action: 'route_opened', 
      path: location.pathname,
      search: location.search
    });
    
    // Smooth scroll to top on route change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, location.search]);

  // Derive sidebar collapsed state to adjust main padding
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('enazizi_sidebar_collapsed') === 'true';
  });

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsSidebarCollapsed(localStorage.getItem('enazizi_sidebar_collapsed') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also poll slightly because 'storage' event only fires between windows
    const interval = setInterval(handleStorageChange, 500);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Top Nav for subpages or when sidebar is hidden
  const isEnaflixHome = location.pathname === "/enaflix" || location.pathname === "/dashboard" || location.pathname === "/study-hub" || location.pathname === "/";
  const showTopNav = !isEnaflixHome;

  return (
    <div className="min-h-screen bg-[#050508] text-white selection:bg-primary/30 selection:text-white antialiased flex flex-col overflow-x-hidden">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      {/* Navigation Layer */}
      {showSidebar && <EnaflixSidebar />}
      <EnaflixMobileNav />

      {/* Top Navigation */}
      {showTopNav && (
        <EnaflixOverlayNav onClose={() => navigate("/dashboard")} />
      )}

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 min-h-screen transition-all duration-500 ease-in-out relative z-10",
        showSidebar ? (isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64") : "pl-0",
        showTopNav ? "pt-16" : "",
        isImmersive ? "pb-0" : "pb-20 lg:pb-0"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 1.01 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.22, 1, 0.36, 1],
              opacity: { duration: 0.3 }
            }}
            className="w-full min-h-full safe-area-bottom"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Vignette Overlay */}
      {!isImmersive && (
        <div className="fixed inset-0 pointer-events-none z-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.4)] opacity-50" />
      )}
    </div>
  );
}
