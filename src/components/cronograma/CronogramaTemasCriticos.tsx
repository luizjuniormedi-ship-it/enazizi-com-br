import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Play, Brain, BookOpen, Lightbulb } from "lucide-react";
import type { TemaComputado, Revisao } from "@/pages/CronogramaInteligente";

interface Props {
  temasComputados: TemaComputado[];
  revisoes: Revisao[];
  onStartRevisao: (revisao: Revisao) => void;
}

const MOTIVOS: Record<string, string> = {
  erro_alto: "Taxa de erro alta recorrente",
  atraso: "Revisões atrasadas",
  sem_revisar: "Muito tempo sem revisar",
  confianca_baixa: "Baixa confiança do aluno",
  reincidencia: "Erro recorrente em múltiplas sessões",
};

function getMotivos(t: TemaComputado): string[] {
  const motivos: string[] = [];
  if (t.taxaErro > 40) motivos.push("erro_alto");
  if (t.revisoesAtrasadas > 0) motivos.push("atraso");
  if (t.diasSemRevisar > 7) motivos.push("sem_revisar");
  if (t.ultimaConfianca === "nao_sei") motivos.push("confianca_baixa");
  if (t.totalQuestoes > 10 && t.taxaErro > 30) motivos.push("reincidencia");
  return motivos;
}

function getAcaoRecomendada(t: TemaComputado): string {
  if (t.revisoesAtrasadas > 0) return "Fazer revisão pendente imediatamente";
  if (t.taxaErro > 60) return "Sessão intensiva com Tutor IA V2 + questões direcionadas";
  if (t.taxaErro > 40) return "Revisar conceitos-chave e praticar questões";
  if (t.ultimaConfianca === "nao_sei") return "Revisão guiada com resumos e flashcards";
  return "Agendar próxima revisão";
}

const CronogramaTemasCriticos = ({ temasComputados, revisoes, onStartRevisao }: Props) => {
  const criticos = temasComputados
    .filter(t => {
      const motivos = getMotivos(t);
      return motivos.length >= 1 && (t.risco === "alto" || t.risco === "critico" || t.prioridade === "urgente" || t.prioridade === "alta");
    })
    .sort((a, b) => b.prioridadeScore - a.prioridadeScore);

  if (criticos.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="font-semibold text-lg">Nenhum tema crítico! 🎉</h3>
        <p className="text-sm text-muted-foreground mt-1">Todos os temas estão com desempenho adequado.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Temas Críticos ({criticos.length})
        </h2>
      </div>

      {criticos.map((t) => {
        const motivos = getMotivos(t);
        const acao = getAcaoRecomendada(t);
        const nextPending = revisoes.find(r => r.tema_id === t.id && r.status === "pendente" && r.data_revisao <= today);

        return (
          <div key={t.id} className="glass-card p-5 border-destructive/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{t.tema}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-[9px]">{t.especialidade}</Badge>
                  <Badge variant={t.taxaErro > 40 ? "destructive" : "outline"} className="text-[9px]">Erro: {t.taxaErro}%</Badge>
                  <Badge variant={t.prioridade === "urgente" ? "destructive" : "secondary"} className="text-[9px]">{t.prioridade}</Badge>
                  <span className={`text-[9px] font-medium ${t.risco === "critico" ? "text-destructive" : "text-orange-500"}`}>
                    Risco: {t.risco}
                  </span>
                </div>
              </div>
              {nextPending && (
                <Button size="sm" variant="destructive" onClick={() => onStartRevisao(nextPending)}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Revisar
                </Button>
              )}
            </div>

            {/* Motivos */}
            <div className="space-y-1.5 mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground">MOTIVOS DE CRITICIDADE:</p>
              {motivos.map(m => (
                <div key={m} className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                  {MOTIVOS[m]}
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-3 text-center">
              <div className="rounded bg-secondary/50 p-1.5">
                <div className="text-xs font-bold">{t.totalQuestoes}</div>
                <div className="text-[8px] text-muted-foreground">Questões</div>
              </div>
              <div className="rounded bg-secondary/50 p-1.5">
                <div className="text-xs font-bold text-destructive">{t.taxaErro}%</div>
                <div className="text-[8px] text-muted-foreground">Erro</div>
              </div>
              <div className="rounded bg-secondary/50 p-1.5">
                <div className="text-xs font-bold">{t.diasSemRevisar}d</div>
                <div className="text-[8px] text-muted-foreground">Sem revisar</div>
              </div>
              <div className="rounded bg-secondary/50 p-1.5">
                <div className="text-xs font-bold">{t.revisoesFeitas}</div>
                <div className="text-[8px] text-muted-foreground">Revisões</div>
              </div>
            </div>

            {/* Recommended action */}
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
              <p className="text-xs font-medium text-primary flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Ação recomendada:
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{acao}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CronogramaTemasCriticos;
