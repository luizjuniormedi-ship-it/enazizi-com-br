import { memo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingDown, Target, Brain, Users, Download } from "lucide-react";

interface Props {
  results: any[];
  questions_json: any[];
  simuladoTitle?: string;
}

const SimuladoReportInsights = memo(function SimuladoReportInsights({ results, questions_json, simuladoTitle }: Props) {
  const { toast } = useToast();
  const safeResults = Array.isArray(results) ? results : [];
  const completed = safeResults.filter(r => r?.status === "completed");
  if (completed.length === 0) return null;

  // 1. Desempenho por tema
  const topicStats: Record<string, { total: number; correct: number }> = {};
  completed.forEach(r => {
    (r.answers_json || []).forEach((a: any) => {
      const t = a.topic || "Geral";
      if (!topicStats[t]) topicStats[t] = { total: 0, correct: 0 };
      topicStats[t].total++;
      if (a.is_correct) topicStats[t].correct++;
    });
  });

  const sortedTopics = Object.entries(topicStats)
    .map(([name, data]) => ({ name, pct: Math.round((data.correct / data.total) * 100), ...data }))
    .sort((a, b) => a.pct - b.pct);

  const weakestTopic = sortedTopics[0];

  // 2. Questões mais erradas
  const questionErrors: Record<number, number> = {};
  completed.forEach(r => {
    (r.answers_json || []).forEach((a: any) => {
      if (!a.is_correct) {
        const idx = a.question_index ?? 0;
        questionErrors[idx] = (questionErrors[idx] || 0) + 1;
      }
    });
  });

  const mostMistakenIdx = Object.entries(questionErrors)
    .map(([idx, count]) => ({ idx: parseInt(idx), count }))
    .sort((a, b) => b.count - a.count)[0];

  const mostMistakenQuestion = mostMistakenIdx && Array.isArray(questions_json) ? questions_json[mostMistakenIdx.idx] : null;

  // 3. Alunos em risco (score < 50%)
  const atRiskStudents = completed.filter(r => (r.score || 0) < 50);

  const exportCSV = useCallback(() => {
    try {
      console.log("[SimuladoInsights] Exporting CSV...");
    const headers = ["Aluno", "Email", "Nota", "Acertos", "Total", "Tempo (s)", "Status"];
    const rows = safeResults.map(r => [
      r.student_name,
      r.student_email,
      r.score,
      (r.answers_json || []).filter((a: any) => a.is_correct).length,
      (r.answers_json || []).length,
      r.time_spent_seconds,
      r.status
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_simulado_${simuladoTitle || 'professor'}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    } catch (error) {
      console.error("[SimuladoInsights] CSV Export failed", error);
      toast({ title: "Erro na exportação", description: "Falha ao gerar CSV.", variant: "destructive" });
    }
  }, [safeResults, simuladoTitle, toast]);

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-6 mb-8 print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/40">Análise de Performance</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportCSV}
            className="h-8 text-[10px] font-black uppercase tracking-widest border-white/10 bg-white/5 gap-2"
          >
            <Download className="h-3 w-3" /> CSV
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={exportPDF}
            className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 shadow-glow-sm"
          >
            <Download className="h-3 w-3" /> PDF / IMPRIMIR
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tema mais fraco */}
        <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <TrendingDown className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Tema mais Crítico</p>
            </div>
            <p className="text-sm font-bold truncate uppercase">{weakestTopic?.name}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>Taxa de acerto</span>
                <span className="font-bold">{weakestTopic?.pct}%</span>
              </div>
              <Progress value={weakestTopic?.pct} className="h-1 bg-destructive/20" />
            </div>
          </CardContent>
        </Card>

        {/* Questão mais errada */}
        <Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Questão mais Errada</p>
            </div>
            <p className="text-sm font-bold truncate uppercase">Questão {mostMistakenIdx ? mostMistakenIdx.idx + 1 : '?'}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2 italic">
              {mostMistakenQuestion?.statement || 'Carregando enunciado...'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className="text-[9px] h-4">{mostMistakenIdx?.count} erros</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Alunos em risco */}
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Alunos em Risco</p>
            </div>
            <p className="text-sm font-bold uppercase">{atRiskStudents.length} ALUNOS</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2">
              Alunos com pontuação abaixo de 50%. Necessitam de reforço imediato.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recomendações do Tutor */}
      <Card className="card-pixar-static border-primary/30 bg-[#0a0a0e]/60">
        <CardContent className="p-4 flex gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 animate-pulse">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> RECOMENDAÇÃO DO TUTOR IA
            </p>
            <p className="text-sm text-white/90 leading-relaxed">
              A turma demonstrou fragilidade em <span className="text-primary font-bold">"{weakestTopic?.name}"</span>. 
              Recomendamos agendar uma aula de reforço focada em condutas diagnósticas e revisão de protocolos para este tema.
            </p>
            <div className="flex gap-2 mt-2 print:hidden">
              <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px]">REFORÇAR {weakestTopic?.name?.toUpperCase()}</Badge>
              <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px]">VER RANKING COMPLETO</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default SimuladoReportInsights;