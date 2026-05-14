import { ReactNode } from "react";
import { EnaflixSidebar } from "./EnaflixSidebar";
import { EnaflixMobileNav } from "./EnaflixMobileNav";
import { EnaflixOverlayNav } from "./EnaflixOverlayNav";
import { useLocation, useNavigate } from "react-router-dom";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
}

export function EnaflixLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  
  // Immersive routes: Tutor IA must occupy full screen, no sidebar/topnav overlap
  const immersiveRoutes = ["/dashboard/mentor", "/dashboard/tutor", "/mentor", "/tutor", "/study/tutor", "/dashboard/sessao-estudo"];
  const isImmersive = immersiveRoutes.some((r) => location.pathname === r || location.pathname.startsWith(r + "/"));

  // Sidebar for everyone in desktop to ensure navigation is always available
  const showSidebar = !isImmersive;

  // For students (no sidebar), we show the OverlayNav consistently if not on the main Enaflix page
  // (Since EnaflixPage already has its own OverlayNav with search logic, we avoid double rendering)
  const isEnaflixHome = location.pathname === "/enaflix" || location.pathname === "/dashboard" || location.pathname === "/study-hub" || location.pathname === "/";
  const showTopNav = !showSidebar && !isEnaflixHome && !isImmersive;

  return (
    <div className="min-h-screen bg-[#050508] text-white selection:bg-primary/30 selection:text-white antialiased flex flex-col">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      {/* Navigation Layer - Sidebar for Admin/Professor, Mobile Nav for everyone */}
      {showSidebar && <EnaflixSidebar />}
      <EnaflixMobileNav />

      {/* Consistente Top Navigation for Students in subpages */}
      {showTopNav && (
        <EnaflixOverlayNav onClose={() => navigate("/enaflix")} />
      )}

      {/* Main Content Area - Adjust padding if sidebar is hidden */}
      <main className={cn(
        "flex-1 min-h-screen transition-all duration-700 relative z-10",
        showSidebar ? "lg:pl-64" : "pl-0",
        showTopNav ? "pt-16" : "",
        isImmersive ? "pb-0" : "pb-20 lg:pb-0"
      )}>
        <div className="w-full min-h-full safe-area-bottom">
          {children}
        </div>
      </main>

      {/* Vignette Overlay for extra depth */}
      {!isImmersive && (
        <div className="fixed inset-0 pointer-events-none z-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.4)] opacity-50" />
      )}
    </div>
  );
}
