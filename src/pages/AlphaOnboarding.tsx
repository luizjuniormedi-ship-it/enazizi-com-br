import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { safeTelemetryFireAndForget } from "@/lib/safeTelemetry";
import { toast } from "@/components/ui/sonner";

const COHORT_NAME = "ALPHA_2026";
const TARGET_EXAMS = [
  { id: "ENAMED", label: "ENAMED" },
  { id: "REVALIDA", label: "REVALIDA" },
  { id: "USMLE", label: "USMLE" },
];

type StepState = { done: boolean; loading: boolean };

export default function AlphaOnboarding() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [cohortId, setCohortId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [targetExam, setTargetExam] = useState<string | null>(null);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState("ENAMED");

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: cohort } = await supabase
        .from("academic_cohorts")
        .select("id")
        .eq("name", COHORT_NAME)
        .maybeSingle();
      const cId = cohort?.id ?? null;
      setCohortId(cId);

      if (cId) {
        const { data: mem } = await supabase
          .from("academic_cohort_members")
          .select("id")
          .eq("cohort_id", cId)
          .eq("user_id", userId)
          .maybeSingle();
        setIsMember(!!mem);
      }

      const { data: exam } = await supabase
        .from("student_target_exams")
        .select("exam_id")
        .eq("user_id", userId)
        .order("priority", { ascending: true })
        .limit(1)
        .maybeSingle();
      setTargetExam(exam?.exam_id ?? null);
      if (exam?.exam_id) setSelectedExam(exam.exam_id);

      const { data: base } = await supabase
        .from("pedagogical_baseline_snapshots")
        .select("id")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setHasBaseline(!!base);
    } catch (e) {
      console.error("[ALPHA_ONBOARDING_LOAD_ERROR]", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const joinCohort = async () => {
    if (!userId || !cohortId) return;
    setBusy("join");
    try {
      const { error } = await supabase
        .from("academic_cohort_members")
        .insert({ cohort_id: cohortId, user_id: userId });
      if (error && !String(error.message).includes("duplicate")) throw error;
      safeTelemetryFireAndForget(
        () =>
          supabase.from("telemetry_events").insert({
            user_id: userId,
            event_name: "ALPHA_USER_ONBOARDED",
            properties: { cohort: COHORT_NAME, cohort_id: cohortId },
            route: "/alpha/onboarding",
          }),
        "ALPHA_USER_ONBOARDED"
      );
      console.log("[ALPHA_USER_ONBOARDED]", { userId, cohort: COHORT_NAME });
      toast.success("Vinculado à coorte ALPHA_2026");
      await refresh();
    } catch (e: any) {
      toast.error("Falha ao vincular à coorte: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  const saveExam = async () => {
    if (!userId) return;
    setBusy("exam");
    try {
      const { error } = await supabase
        .from("student_target_exams")
        .upsert(
          { user_id: userId, exam_id: selectedExam, priority: 1 },
          { onConflict: "user_id,exam_id" }
        );
      if (error) throw error;
      toast.success(`Prova-alvo definida: ${selectedExam}`);
      await refresh();
    } catch (e: any) {
      toast.error("Falha ao salvar prova: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  const captureBaseline = async () => {
    if (!userId) return;
    setBusy("baseline");
    try {
      const { error } = await supabase
        .from("pedagogical_baseline_snapshots")
        .insert({
          user_id: userId,
          initial_theta: null,
          initial_accuracy: null,
          competencies_mastered: 0,
          competencies_deficit: 0,
        });
      if (error) throw error;
      safeTelemetryFireAndForget(
        () =>
          supabase.from("telemetry_events").insert({
            user_id: userId,
            event_name: "ALPHA_BASELINE_CAPTURED",
            properties: { cohort: COHORT_NAME, source: "alpha_onboarding" },
            route: "/alpha/onboarding",
          }),
        "ALPHA_BASELINE_CAPTURED"
      );
      console.log("[ALPHA_BASELINE_CAPTURED]", { userId });
      toast.success("Baseline D0 capturado");
      await refresh();
    } catch (e: any) {
      toast.error("Falha ao capturar baseline: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  const steps = useMemo(
    () => [
      {
        key: "auth",
        title: "Conta criada e autenticada",
        state: { done: !!userId, loading: false } as StepState,
        action: null,
      },
      {
        key: "cohort",
        title: `Vinculado à coorte ${COHORT_NAME}`,
        state: { done: isMember, loading: busy === "join" },
        action: !isMember && cohortId ? (
          <Button onClick={joinCohort} disabled={busy === "join"} size="sm">
            {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar na coorte"}
          </Button>
        ) : null,
      },
      {
        key: "exam",
        title: targetExam ? `Prova-alvo: ${targetExam}` : "Selecionar prova-alvo",
        state: { done: !!targetExam, loading: busy === "exam" },
        action: (
          <div className="flex items-center gap-2">
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {TARGET_EXAMS.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            <Button onClick={saveExam} disabled={busy === "exam"} size="sm" variant="outline">
              {targetExam ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        ),
      },
      {
        key: "baseline",
        title: "Baseline D0 capturado",
        state: { done: hasBaseline, loading: busy === "baseline" },
        action: !hasBaseline ? (
          <Button onClick={captureBaseline} disabled={busy === "baseline"} size="sm">
            {busy === "baseline" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Capturar baseline"}
          </Button>
        ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, isMember, cohortId, targetExam, hasBaseline, busy, selectedExam]
  );

  const doneCount = steps.filter((s) => s.state.done).length;
  const progress = (doneCount / steps.length) * 100;

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Faça login para acessar o onboarding ALPHA.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
            Programa ALPHA · Coorte 2026
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Onboarding ALPHA_2026</h1>
          <p className="text-sm text-muted-foreground">
            Complete os passos abaixo para entrar na primeira validação externa controlada
            do ENAZIZI. Tudo é descritivo e operacional — sem coleta de inferência estatística.
          </p>
        </header>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{doneCount}/{steps.length}</span>
          </div>
          <Progress value={progress} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="space-y-3">
            {steps.map((s) => (
              <li
                key={s.key}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <div className="mt-0.5">
                  {s.state.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium">{s.title}</Label>
                  {s.action && <div>{s.action}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/resultados-oficiais">
              Resultados Oficiais <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/dashboard">Ir para o Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
