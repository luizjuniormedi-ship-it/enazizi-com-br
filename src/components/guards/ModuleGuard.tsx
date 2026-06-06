import { Navigate } from "react-router-dom";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useExperimentGroup } from "@/hooks/useExperimentGroup";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";


interface Props {
  moduleKey: string;
  children: React.ReactNode;
}

/**
 * Route guard that checks module access before rendering children.
 * Redirects to dashboard if user doesn't have access.
 */
export const ModuleGuard = ({ moduleKey, children }: Props) => {
  const { user } = useAuth();
  const { isModuleEnabled, loading } = useModuleAccess();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isControl, isLoading: experimentLoading } = useExperimentGroup();

  if (!user) return <Navigate to="/auth" replace />;

  if (loading || experimentLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se for o Hospital Virtual e o usuário estiver no Grupo Controle do experimento V6.1
  if (moduleKey === "clinical-simulation" && isControl && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Lock className="h-10 w-10 text-amber-500" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter italic">Acesso Restrito (Protocolo V6.1)</h2>
          <p className="text-sm text-muted-foreground">
            Você está participando do **Protocolo de Validação Científica ENAZIZI**. 
            Nesta fase do estudo, seu grupo tem foco no método tradicional de questões e flashcards.
          </p>
        </div>
        <Card className="bg-white/5 border-white/10 w-full max-w-sm">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-black uppercase text-white/40 tracking-widest">Sua Missão Atual</div>
            <p className="text-xs">Maximize seu desempenho no Banco de Questões e no FSRS para gerar dados comparativos precisos.</p>
            <Button asChild className="w-full bg-primary text-black font-bold uppercase tracking-widest text-[10px]">
              <Link to="/dashboard/simulados">Ir para Questões</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isModuleEnabled(moduleKey) && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

