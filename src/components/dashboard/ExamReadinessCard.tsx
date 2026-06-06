import { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, ChevronRight, AlertTriangle, CheckCircle2, Info, BookOpen, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useExamReadiness } from "@/hooks/useExamReadiness";
import { getLabelText, type ExamReadiness, type ReadinessLabel } from "@/lib/examReadiness";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

const LABEL_COLORS: Record<ReadinessLabel, string> = {
  critico: "text-destructive bg-destructive/10",
  risco_alto: "text-orange-600 bg-orange-500/10",
  competitivo: "text-yellow-600 bg-yellow-500/10",
  forte: "text-blue-600 bg-blue-500/10",
  elite: "text-green-600 bg-green-500/10",
};

const PROGRESS_COLORS: Record<ReadinessLabel, string> = {
  critico: "[&>div]:bg-destructive",
  risco_alto: "[&>div]:bg-orange-500",
  competitivo: "[&>div]:bg-yellow-500",
  forte: "[&>div]:bg-blue-500",
  elite: "[&>div]:bg-green-500",
};

export default function ExamReadinessCard() {
  const { data, isLoading } = useExamReadiness();
  const [selectedExam, setSelectedExam] = useState<ExamReadiness | null>(null);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-5 w-40 mb-3" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <>
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Chance por prova</h3>
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <Info className="h-3 w-3" /> Estimativa
            </span>
          </div>

          <div className="space-y-2.5">
            {data.map((exam) => (
              <button
                key={exam.examKey}
                className="w-full text-left rounded-lg p-2.5 hover:bg-muted/50 transition-colors active:scale-[0.98]"
                onClick={() => setSelectedExam(exam)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{exam.examName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{exam.readinessScore}%</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${LABEL_COLORS[exam.readinessLabel]}`}>
                      {getLabelText(exam.readinessLabel)}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <Progress value={exam.readinessScore} className={`h-1.5 ${PROGRESS_COLORS[exam.readinessLabel]}`} />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-muted-foreground line-clamp-1 flex-1">{exam.insight}</p>
                  <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0 flex items-center gap-0.5">
                    <BookOpen className="h-2.5 w-2.5" /> {exam.coverageScore}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedExam} onOpenChange={(o) => !o && setSelectedExam(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[80vh] overflow-y-auto" : "sm:max-w-md overflow-y-auto"}>
          {selectedExam && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  {selectedExam.examName}
                </SheetTitle>
                <SheetDescription>Projeção de aprovação baseada no seu desempenho</SheetDescription>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                {/* Score principal */}
                <div className="text-center py-4">
                  <div className="text-5xl font-black text-primary">{selectedExam.readinessScore}%</div>
                  <Badge className={`mt-2 ${LABEL_COLORS[selectedExam.readinessLabel]}`}>
                    {getLabelText(selectedExam.readinessLabel)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                    Esta é uma estimativa baseada no seu desempenho atual. Continue estudando para melhorar sua projeção.
                  </p>
                </div>

                {/* Insight */}
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm">{selectedExam.insight}</p>
                </div>

                {/* Coverage */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Cobertura do cronograma</h4>
                    <span className="ml-auto text-sm font-bold text-primary">{selectedExam.coverageScore}%</span>
                  </div>
                  <Progress value={selectedExam.coverageScore} className="h-1.5" />
                  <p className="text-[11px] text-muted-foreground">
                    {selectedExam.topicsCovered} de {selectedExam.topicsTotal} temas relevantes para {selectedExam.examName} estudados
                  </p>
                </div>

                {/* Áreas fortes */}
                {selectedExam.strongAreas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Áreas mais fortes
                    </h4>
                    <div className="space-y-1">
                      {selectedExam.strongAreas.map((a) => (
                        <div key={a} className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-sm">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Áreas fracas */}
                {selectedExam.weakAreas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Áreas para melhorar
                    </h4>
                    <div className="space-y-1">
                      {selectedExam.weakAreas.map((a) => (
                        <div key={a} className="flex items-center gap-2 p-2 rounded bg-destructive/10">
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-sm">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fatores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-green-500/5 p-3 text-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground">Maior impulso</p>
                    <p className="text-xs font-medium mt-0.5">{selectedExam.topPositive}</p>
                  </div>
                  <div className="rounded-lg bg-destructive/5 p-3 text-center">
                    <TrendingDown className="h-4 w-4 text-destructive mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground">Maior impacto</p>
                    <p className="text-xs font-medium mt-0.5">{selectedExam.topNegative}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
