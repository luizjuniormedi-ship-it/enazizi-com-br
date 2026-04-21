import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Target } from "lucide-react";
import { useProfessorPlansList } from "@/hooks/useProfessorPlans";
import CreatePlanDialog from "./proficiencia/CreatePlanDialog";
import PlanListItem from "./proficiencia/PlanListItem";
import { PlanIdsProvider } from "./proficiencia/PlanRiskBadges";

/**
 * Proficiência Guiada — Painel do Professor (Fase 1).
 * Lista, cria e gerencia status dos planos pedagógicos.
 * Estrutura preparada para Fase 2 (planner) e 3 (dashboard do aluno).
 */
const ProfessorProficiencyPlans = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { data: plans, isLoading } = useProfessorPlansList();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Proficiência Guiada
          </h2>
          <p className="text-sm text-muted-foreground">
            Crie planos pedagógicos com data da prova, subtemas estruturais e alunos vinculados.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Target className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <h3 className="font-semibold">Nenhum plano de proficiência criado</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Defina a data da prova, intensidade e selecione subtemas estruturais. O aluno
              executará o cronograma dentro da Proficiência.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-2">
              Criar primeiro plano
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PlanIdsProvider ids={plans.filter((p) => p.status === "active").map((p) => p.id)}>
          <div className="space-y-3">
            {plans.map((p) => (
              <PlanListItem key={p.id} plan={p} />
            ))}
          </div>
        </PlanIdsProvider>
      )}

      <CreatePlanDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

export default ProfessorProficiencyPlans;
