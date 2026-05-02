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
import { Outlet } from "react-router-dom";
import {
  AdminSidebarEnterprise,
  AdminSidebarMobileTrigger,
} from "@/components/admin/sidebar/AdminSidebarEnterprise";
import NotificationBell from "@/components/dashboard/NotificationBell";

const AdminLayout = () => {
  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <AdminSidebarEnterprise />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center justify-between px-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
          <AdminSidebarMobileTrigger />
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
