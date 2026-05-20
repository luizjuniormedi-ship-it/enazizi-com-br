/**
 * AdminLayout — shell exclusivo das rotas /admin/*.
 *
 * Substitui o DashboardLayout para o painel administrativo, trazendo:
 *  - AdminSidebarEnterprise (categorias, busca, escopos)
 *  - Trigger drawer mobile
 *  - Header limpo com NotificationBell e GlobalSearch
 *
 * Não interfere no layout de /dashboard ou /professor.
 */
import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AdminSidebarEnterprise,
  AdminSidebarMobileTrigger,
} from "@/components/admin/sidebar/AdminSidebarEnterprise";
import NotificationBell from "@/components/dashboard/NotificationBell";

const AdminLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <AdminSidebarEnterprise />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center gap-3 px-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
          <AdminSidebarMobileTrigger />
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
            Voltar
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
