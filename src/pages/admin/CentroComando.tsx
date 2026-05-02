/**
 * CentroComando — visão executiva unificada do admin.
 *
 * Consolida (sem apagar):
 *  - Dashboard Admin original (gestão de usuários)
 *  - Painel CEO (KPIs de negócio)
 *  - Admin Monitoring (saúde de sistema, alunos em risco, IA, custos)
 *
 * Cada seção é apenas uma tab que renderiza a página existente,
 * preservando todo o código e telemetria.
 */
import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, BarChart3, Activity, Users,
} from "lucide-react";
import { Loader2 } from "lucide-react";

const AdminPage = lazy(() => import("@/pages/Admin"));
const AdminCEO = lazy(() => import("@/pages/AdminCEO"));
const AdminMonitoring = lazy(() => import("@/pages/AdminMonitoring"));

const Fallback = () => (
  <div className="flex items-center justify-center p-12">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

const CentroComando = () => {
  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Centro de Comando
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visão executiva unificada — negócio, alunos, sistema e IA.
        </p>
      </div>

      <Tabs defaultValue="executive" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="executive" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Executivo
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Sistema & Alunos
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive">
          <Suspense fallback={<Fallback />}>
            <AdminCEO />
          </Suspense>
        </TabsContent>
        <TabsContent value="monitoring">
          <Suspense fallback={<Fallback />}>
            <AdminMonitoring />
          </Suspense>
        </TabsContent>
        <TabsContent value="users">
          <Suspense fallback={<Fallback />}>
            <AdminPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CentroComando;
