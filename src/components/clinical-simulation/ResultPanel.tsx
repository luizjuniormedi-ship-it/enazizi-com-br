import React, { memo } from "react";
import { Trophy, CheckCircle, XCircle, Target, ShieldAlert, AlertTriangle, Star, Syringe, Stethoscope, Eye, Hand, Ear, Bone, HeartPulse, Award, BookOpen, Download, ClipboardCheck, Clock, Activity, Skull, MessageSquareQuote, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";

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

interface DifferentialDiagnosis {
  diagnosis: string;
  reasoning: string;
  how_to_rule_out: string;
  student_considered: boolean;
}

interface EvalCategory { score: number; feedback: string }

export interface FinalEval {
  final_score: number;
  grade: string;
  correct_diagnosis: string;
  student_got_diagnosis: boolean;
  time_total_minutes: number;
  evaluation: Record<string, EvalCategory>;
  differential_diagnosis?: DifferentialDiagnosis[];
  strengths: string[];
  improvements: string[];
  ideal_approach: string;
  ideal_prescription?: string;
  physical_exam_expected?: {
    inspection?: string[];
    palpation?: string[];
    auscultation?: string[];
    vital_signs_expected?: string;
    maneuvers?: { name: string; technique: string; positive_finding: string; indicates: string }[];
  };
  xp_earned: number;
}

interface ResultPanelProps {
  finalEval: FinalEval;
  specialty: string;
  difficulty: string;
  onReset: () => void;
  onRetry: () => void;
  onExportPdf: () => void;
  onShare: () => void;
  onOpenTutor: () => void;
}

const getGradeColor = (grade: string) => {
  const map: Record<string, string> = { A: "text-green-500", B: "text-blue-500", C: "text-amber-500", D: "text-orange-500", F: "text-destructive" };
  return map[grade] || "text-muted-foreground";
};

const ResultPanel = memo(function ResultPanel({
  finalEval, specialty, difficulty, onReset, onRetry, onExportPdf, onShare, onOpenTutor,
}: ResultPanelProps) {
  return (
    <div className="space-y-4">
      {/* Score header */}
      <Card className="overflow-hidden">
        <div className={`p-1 ${finalEval.final_score >= 70 ? "bg-green-500/20" : finalEval.final_score >= 50 ? "bg-amber-500/20" : "bg-destructive/20"}`} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Plantão Encerrado</h3>
                <p className="text-sm text-muted-foreground">{specialty} • {difficulty}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {finalEval.student_got_diagnosis ? (
                    <Badge className="bg-green-500/20 text-green-500 text-xs gap-1"><CheckCircle className="h-3 w-3" /> Diagnóstico correto</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Diagnóstico incorreto</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">⏱️ {finalEval.time_total_minutes} min</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-black ${getGradeColor(finalEval.grade)}`}>{finalEval.grade}</p>
              <p className="text-2xl font-bold">{finalEval.final_score}/100</p>
              <p className="text-xs text-amber-500 font-semibold">+{finalEval.xp_earned} XP</p>
            </div>
          </div>
          <Progress value={finalEval.final_score} className="h-2" />
        </CardContent>
      </Card>

      {/* Correct diagnosis */}
      <Card className="border-2 border-primary/30">
        <CardContent className="p-5 space-y-3">
          <h4 className="text-base font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Correção Diagnóstica
          </h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary uppercase">Diagnóstico Correto</p>
                <p className="text-sm font-bold">{finalEval.correct_diagnosis}</p>
              </div>
            </div>
            <div className={`flex items-start gap-2 p-3 rounded-lg ${finalEval.student_got_diagnosis ? "bg-green-500/10 border border-green-500/20" : "bg-destructive/10 border border-destructive/20"}`}>
              {finalEval.student_got_diagnosis ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-semibold uppercase ${finalEval.student_got_diagnosis ? "text-green-500" : "text-destructive"}`}>
                  Seu Diagnóstico
                </p>
                <p className="text-sm font-medium">
                  {finalEval.student_got_diagnosis
                    ? "✅ Você acertou o diagnóstico!"
                    : "❌ Você não chegou ao diagnóstico correto. Revise a abordagem ideal abaixo."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Differential Diagnosis */}
      {finalEval.differential_diagnosis && finalEval.differential_diagnosis.length > 0 && (
        <Card className="border border-purple-500/30">
          <CardContent className="p-5 space-y-4">
            <h4 className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-purple-500" /> Diagnósticos Diferenciais
            </h4>
            <p className="text-xs text-muted-foreground">
              Diagnósticos que deveriam ser considerados neste caso. Verde = você considerou, cinza = não considerado.
            </p>
            <div className="space-y-3">
              {finalEval.differential_diagnosis.map((dd, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    dd.student_considered
                      ? "bg-green-500/5 border-green-500/30"
                      : "bg-muted/30 border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {dd.student_considered ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-bold">{dd.diagnosis}</span>
                    <Badge
                      variant={dd.student_considered ? "default" : "outline"}
                      className={`text-[10px] ml-auto ${dd.student_considered ? "bg-green-500/20 text-green-600" : ""}`}
                    >
                      {dd.student_considered ? "Considerado" : "Não considerado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 mb-1">
                    <span className="font-semibold">Por que considerar:</span> {dd.reasoning}
                  </p>
                  <p className="text-xs text-muted-foreground ml-6">
                    <span className="font-semibold">Como descartar:</span> {dd.how_to_rule_out}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category scores */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h4 className="text-sm font-semibold">📊 Avaliação por Categoria</h4>
          {Object.entries(finalEval.evaluation).map(([key, val]) => {
            const maxScore = EVAL_MAX_SCORES[key] || 25;
            const goodThreshold = maxScore * 0.7;
            const midThreshold = maxScore * 0.5;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{EVAL_LABELS[key] || key}</span>
                  <span className={`font-bold ${val.score >= goodThreshold ? "text-green-500" : val.score >= midThreshold ? "text-amber-500" : "text-destructive"}`}>
                    {val.score}/{maxScore}
                  </span>
                </div>
                <Progress value={(val.score / maxScore) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{val.feedback}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Ideal Prescription */}
      {finalEval.ideal_prescription && (
        <Card className="border border-blue-500/30">
          <CardContent className="p-5 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Syringe className="h-4 w-4 text-blue-500" /> Prescrição Modelo
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground bg-blue-500/5 rounded-lg p-4 border border-blue-500/20 whitespace-pre-wrap font-mono">
              {finalEval.ideal_prescription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Pontos Fortes
            </h4>
            <ul className="space-y-1">
              {finalEval.strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Star className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Pontos a Melhorar
            </h4>
            <ul className="space-y-1">
              {finalEval.improvements.map((w, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Physical Exam Expected */}
      {finalEval.physical_exam_expected && (
        <Card className="border border-teal-500/30">
          <CardContent className="p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4 text-teal-500" /> 🩺 Exame Físico Esperado
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {finalEval.physical_exam_expected.inspection && finalEval.physical_exam_expected.inspection.length > 0 && (
                <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                  <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Eye className="h-3 w-3 text-teal-500" /> Inspeção</p>
                  <ul className="space-y-1">
                    {finalEval.physical_exam_expected.inspection.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {finalEval.physical_exam_expected.palpation && finalEval.physical_exam_expected.palpation.length > 0 && (
                <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                  <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Hand className="h-3 w-3 text-teal-500" /> Palpação</p>
                  <ul className="space-y-1">
                    {finalEval.physical_exam_expected.palpation.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {finalEval.physical_exam_expected.auscultation && finalEval.physical_exam_expected.auscultation.length > 0 && (
                <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                  <p className="text-xs font-semibold flex items-center gap-1 mb-2"><Ear className="h-3 w-3 text-teal-500" /> Ausculta</p>
                  <ul className="space-y-1">
                    {finalEval.physical_exam_expected.auscultation.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {finalEval.physical_exam_expected.maneuvers && finalEval.physical_exam_expected.maneuvers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1"><Bone className="h-3 w-3 text-teal-500" /> Manobras Diagnósticas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {finalEval.physical_exam_expected.maneuvers.map((m: any, i: number) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border/50 space-y-1">
                      <p className="text-xs font-bold text-teal-600">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Técnica:</span> {m.technique}</p>
                      <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Achado +:</span> {m.positive_finding}</p>
                      <p className="text-[11px] text-muted-foreground"><span className="font-semibold">Indica:</span> {m.indicates}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {finalEval.physical_exam_expected.vital_signs_expected && (
              <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/20">
                <p className="text-xs font-semibold flex items-center gap-1 mb-1"><HeartPulse className="h-3 w-3 text-teal-500" /> Sinais Vitais Esperados</p>
                <p className="text-xs text-muted-foreground">{finalEval.physical_exam_expected.vital_signs_expected}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ideal approach */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" /> Abordagem Ideal
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground bg-primary/5 rounded-lg p-4 border border-primary/20">
            {finalEval.ideal_approach}
          </p>
        </CardContent>
      </Card>

      {finalEval.correct_diagnosis && (
        <Button
          onClick={onOpenTutor}
          variant="outline"
          className="w-full border-primary/30 hover:bg-primary/10 gap-2"
        >
          <BookOpen className="h-4 w-4 text-primary" />
          📚 Aprofundar no Tutor IA
        </Button>
      )}

      <TaskCompletionCard
        title="Simulação clínica concluída!"
        secondaryLabel="Novo Plantão"
        onSecondary={onReset}
        tertiaryLabel="Refazer Mesmo"
        onTertiary={onRetry}
      />
      <div className="flex gap-2 justify-center">
        <Button onClick={onExportPdf} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
        <Button onClick={onShare} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <ClipboardCheck className="h-4 w-4" /> Compartilhar
        </Button>
      </div>
    </div>
  );
});

export default ResultPanel;
