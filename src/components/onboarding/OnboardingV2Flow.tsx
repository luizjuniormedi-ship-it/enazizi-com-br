import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Calendar, Clock, ChevronRight, ArrowRight,
  CheckCircle2, Target, Brain, Sparkles, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

const TOTAL_STEPS = 4;

const EXAM_OPTIONS = [
  { value: "enare", label: "ENARE" },
  { value: "revalida", label: "Revalida (INEP)" },
  { value: "usp", label: "USP" },
  { value: "unicamp", label: "UNICAMP" },
  { value: "unifesp", label: "UNIFESP" },
  { value: "sus-sp", label: "SUS-SP" },
  { value: "sus-rj", label: "SUS-RJ" },
  { value: "amrigs", label: "AMRIGS" },
  { value: "ses-df", label: "SES-DF" },
  { value: "psu-mg", label: "PSU-MG" },
  { value: "hcpa", label: "HCPA" },
  { value: "santa-casa-sp", label: "Santa Casa SP" },
  { value: "einstein", label: "Einstein" },
  { value: "sirio-libanes", label: "Sírio-Libanês" },
  { value: "outra", label: "Outra prova de residência" },
];

export default function OnboardingV2Flow({ onComplete, onSkip }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [targetExams, setTargetExams] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("4");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("profiles").update({
        onboarding_version: 2,
        experience_reset_at: new Date().toISOString(),
        last_onboarding_step: 0,
        daily_study_hours: 4,
      } as any).eq("user_id", user.id);

      localStorage.setItem("enazizi_v2_welcome_seen", "true");
      localStorage.setItem("enazizi_v2_onboarding_done", "true");
      localStorage.setItem("enazizi_exam_setup_skipped", "true");

      onSkip ? onSkip() : onComplete();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    setGenerating(true);
    try {
      const updates: Record<string, any> = {
        onboarding_version: 2,
        experience_reset_at: new Date().toISOString(),
        last_onboarding_step: TOTAL_STEPS,
        daily_study_hours: parseFloat(dailyHours) || 4,
      };
      if (targetExams.length > 0) {
        updates.target_exams = targetExams;
        updates.target_exam = targetExams[0]; // backward compat
      }
      if (examDate) updates.exam_date = examDate;

      await supabase.from("profiles").update(updates as any).eq("user_id", user.id);

      // [planner-unification-final] generate-study-plan APOSENTADA do onboarding.
      // Edge function é @deprecated-flow (escreve em study_plans legado, shape semanal weeklySchedule).
      // O Planner oficial (daily_plans/daily_plan_tasks) é alimentado sob demanda pelo planner-orchestrator-v1.

      localStorage.setItem("enazizi_v2_welcome_seen", "true");
      localStorage.setItem("enazizi_v2_onboarding_done", "true");
      localStorage.removeItem("enazizi_exam_setup_skipped");

      onComplete();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setGenerating(false);
    }
  };

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, []);

  const progressPercent = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md sm:max-w-lg space-y-6 animate-fade-in">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Passo {step} de {TOTAL_STEPS}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* STEP 1 — INTRO */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">
                Você não precisa decidir o que estudar
              </h1>
              <p className="text-lg text-muted-foreground font-medium">
                Nós fazemos isso por você.
              </p>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Responda 3 perguntas e o sistema cria seu plano completo automaticamente.
            </p>
            <Button onClick={nextStep} size="lg" className="w-full gap-2 text-lg py-6">
              Começar <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* STEP 2 — EXAM SETUP (3 perguntas essenciais) */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center space-y-1">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Qual prova você vai fazer?</h2>
              <p className="text-sm text-muted-foreground">
                Selecione até 3 provas. O sistema adapta o estudo a todas elas.
              </p>
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  Provas alvo
                  <span className="text-xs text-muted-foreground ml-auto">{targetExams.length}/3</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {EXAM_OPTIONS.map((opt) => {
                    const checked = targetExams.includes(opt.value);
                    const disabled = !checked && targetExams.length >= 3;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg border text-sm cursor-pointer transition-colors",
                          checked
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : disabled
                              ? "border-border bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                              : "border-border hover:border-primary/50 hover:bg-accent"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => {
                            if (v) {
                              setTargetExams(prev => [...prev, opt.value].slice(0, 3));
                            } else {
                              setTargetExams(prev => prev.filter(e => e !== opt.value));
                            }
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {targetExams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {targetExams.map(e => (
                      <Badge key={e} variant="secondary" className="text-xs">
                        {EXAM_OPTIONS.find(o => o.value === e)?.label || e}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Data da prova
                  <span className="text-xs text-destructive font-medium">obrigatória*</span>
                </Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Sem essa data, o motor não consegue apertar o ritmo perto da prova. Se ainda não souber, escolha uma data estimada — você pode ajustar depois.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Horas de estudo por dia
                </Label>
                <Select value={dailyHours} onValueChange={setDailyHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h} hora{h > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={nextStep}
              className="w-full gap-2"
              disabled={targetExams.length === 0 || !examDate}
            >
              Gerar meu plano <Sparkles className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="text-xs text-muted-foreground hover:underline mx-auto block"
            >
              Pular e definir depois
            </button>
          </div>
        )}

        {/* STEP 3 — PLAN READY */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in text-center">
            <div className="h-20 w-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black">Seu plano está pronto!</h2>
              <p className="text-sm text-muted-foreground">
                Baseado na sua prova e disponibilidade, o sistema criou um plano adaptativo personalizado.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 text-left space-y-4">
              <div className="space-y-3">
                {targetExams.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Provas</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {targetExams.map(e => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {EXAM_OPTIONS.find(o => o.value === e)?.label || e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {examDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data</span>
                    <span className="text-sm font-semibold">
                      {new Date(examDate + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estudo diário</span>
                  <span className="text-sm font-semibold">{dailyHours}h/dia</span>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-primary">O que o sistema fará por você:</p>
                <div className="space-y-1.5">
                  {[
                    "Priorizar temas mais cobrados na sua prova",
                    "Agendar revisões automáticas (repetição espaçada)",
                    "Adaptar o plano ao seu desempenho diário",
                    "Gerar questões e flashcards personalizados",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={nextStep} className="w-full gap-2">
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 4 — START */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in text-center">
            <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
              <Rocket className="h-12 w-12 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black">Vamos começar agora</h2>
              <p className="text-muted-foreground">
                O sistema guia você automaticamente. Basta clicar em "Começar estudo" todos os dias.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Plano adaptativo criado</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Temas priorizados por frequência</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Primeira missão disponível</span>
              </div>
            </div>

            <Button
              onClick={handleFinish}
              disabled={saving}
              size="lg"
              className="w-full gap-2 text-lg py-6 font-bold"
            >
              {saving ? (
                <>
                  {generating ? "Gerando plano..." : "Salvando..."}
                  <Loader2 className="h-5 w-5 animate-spin" />
                </>
              ) : (
                <>COMEÇAR ESTUDO <Rocket className="h-5 w-5" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}