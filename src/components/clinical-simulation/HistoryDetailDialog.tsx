import React, { memo } from "react";
import { Trophy, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Award, Syringe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const EVAL_LABELS: Record<string, string> = {
  anamnesis: "Anamnese",
  physical_exam: "Exame Físico",
  complementary_exams: "Exames Complementares",
  diagnosis: "Diagnóstico",
  prescription: "Prescrição",
  management: "Conduta",
  referral: "Parecer/Encaminhamento",
};

const EVAL_MAX_SCORES: Record<string, number> = {
  anamnesis: 15, physical_exam: 15, complementary_exams: 15,
  diagnosis: 15, prescription: 15, management: 15, referral: 10,
};

interface HistoryDetailDialogProps {
  selected: any | null;
  onClose: () => void;
}

const HistoryDetailDialog = memo(function HistoryDetailDialog({ selected, onClose }: HistoryDetailDialogProps) {
  return (
    <Dialog open={!!selected} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {selected.specialty} — Conceito {selected.grade}
              </DialogTitle>
              <DialogDescription>
                {new Date(selected.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {" • "}{selected.difficulty} • {selected.time_total_minutes} min • {selected.final_score}/100 pts • +{selected.xp_earned} XP
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className={`p-3 rounded-lg border ${selected.student_got_diagnosis ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                <p className="text-xs font-semibold mb-1">Diagnóstico Correto</p>
                <p className="text-sm font-bold">{selected.correct_diagnosis}</p>
                <p className="text-xs mt-1">{selected.student_got_diagnosis ? "✅ Você acertou" : "❌ Você não acertou"}</p>
              </div>

              {selected.differential_diagnosis?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-purple-500" /> Diferenciais</p>
                  {selected.differential_diagnosis.map((dd: any, i: number) => (
                    <div key={i} className={`p-2.5 rounded-lg border text-xs ${dd.student_considered ? "bg-green-500/5 border-green-500/30" : "bg-muted/30 border-border/50"}`}>
                      <div className="flex items-center gap-1.5 font-semibold">
                        {dd.student_considered ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                        {dd.diagnosis}
                      </div>
                      <p className="text-muted-foreground mt-1"><strong>Razão:</strong> {dd.reasoning}</p>
                      <p className="text-muted-foreground"><strong>Descartar:</strong> {dd.how_to_rule_out}</p>
                    </div>
                  ))}
                </div>
              )}

              {selected.evaluation && Object.keys(selected.evaluation).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">📊 Avaliação por Categoria</p>
                  {Object.entries(selected.evaluation).map(([key, val]: [string, any]) => {
                    const maxScore = EVAL_MAX_SCORES[key] || 25;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{EVAL_LABELS[key] || key}</span>
                          <span className={`font-bold ${val.score >= maxScore * 0.7 ? "text-green-500" : val.score >= maxScore * 0.5 ? "text-amber-500" : "text-destructive"}`}>
                            {val.score}/{maxScore}
                          </span>
                        </div>
                        <Progress value={(val.score / maxScore) * 100} className="h-1" />
                        <p className="text-[10px] text-muted-foreground">{val.feedback}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selected.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1"><CheckCircle className="h-3 w-3 text-green-500" /> Pontos Fortes</p>
                    <ul className="space-y-0.5">{selected.strengths.map((s: string, i: number) => <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>)}</ul>
                  </div>
                )}
                {selected.improvements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Melhorar</p>
                    <ul className="space-y-0.5">{selected.improvements.map((s: string, i: number) => <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>)}</ul>
                  </div>
                )}
              </div>

              {selected.ideal_approach && (
                <div>
                  <p className="text-xs font-semibold flex items-center gap-1 mb-1"><Award className="h-3 w-3 text-primary" /> Abordagem Ideal</p>
                  <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-3 border border-primary/20">{selected.ideal_approach}</p>
                </div>
              )}

              {selected.ideal_prescription && (
                <div>
                  <p className="text-xs font-semibold flex items-center gap-1 mb-1"><Syringe className="h-3 w-3 text-blue-500" /> Prescrição Modelo</p>
                  <p className="text-xs text-muted-foreground bg-blue-500/5 rounded-lg p-3 border border-blue-500/20 font-mono whitespace-pre-wrap">{selected.ideal_prescription}</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default HistoryDetailDialog;
