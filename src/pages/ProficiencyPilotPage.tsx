import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Sparkles,
  Stethoscope,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useSeedPilot } from "@/hooks/useSeedPilot";
import { usePilotChecklist } from "@/hooks/usePilotChecklist";
import { usePilotDiagnostics } from "@/hooks/usePilotDiagnostics";

/**
 * Painel de Piloto da Proficiência Guiada.
 * Acessível via /professor/proficiencia/piloto (ProfessorRoute).
 * - 1 clique cria turma + 2 planos (Cardio individual, Pneumo turma)
 * - Checklist persistido em localStorage (não polui o schema)
 * - Diagnóstico sob demanda (não roda em loop)
 */
export default function ProficiencyPilotPage() {
  const [profEmail, setProfEmail] = useState("");
  const [studentEmailsRaw, setStudentEmailsRaw] = useState("");
  const seed = useSeedPilot();
  const diag = usePilotDiagnostics();
  const { items, toggle, updateObs, reset, progress, doneCount } = usePilotChecklist();

  const studentEmails = studentEmailsRaw
    .split(/[\s,;\n]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  const canSeed = profEmail.includes("@") && studentEmails.length >= 1 && !seed.isPending;

  const handleSeed = () => {
    if (!canSeed) return;
    seed.mutate({ professorEmail: profEmail, studentEmails });
  };

  const diagData = diag.data;
  const hasIssues =
    diagData &&
    (diagData.duplicateTasks.count > 0 || diagData.inactiveStudents.count > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" />
          Piloto — Proficiência Guiada
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cria turma + 2 planos reais para validação de ponta a ponta. Não gera
          progresso fictício.
        </p>
      </div>

      {/* SEED */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            1. Gerar Ambiente de Piloto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" htmlFor="prof-email">
                Email do professor
              </label>
              <Input
                id="prof-email"
                type="email"
                placeholder="prof@exemplo.com"
                value={profEmail}
                onChange={(e) => setProfEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="stu-emails">
                Emails dos alunos (vírgula ou linha)
              </label>
              <Textarea
                id="stu-emails"
                placeholder="aluno1@exemplo.com, aluno2@exemplo.com"
                value={studentEmailsRaw}
                onChange={(e) => setStudentEmailsRaw(e.target.value)}
                rows={2}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {studentEmails.length} aluno(s) detectado(s)
              </p>
            </div>
          </div>

          <Button onClick={handleSeed} disabled={!canSeed} className="gap-2">
            {seed.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar ambiente
          </Button>

          {seed.data && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ambiente criado</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                <div>
                  Turma: <code>{seed.data.turma.name}</code>
                </div>
                <div>
                  Plano individual: <code>{seed.data.planoIndividual.name}</code>
                </div>
                <div>
                  Plano turma: <code>{seed.data.planoTurma.name}</code>
                </div>
                {seed.data.warnings.length > 0 && (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {seed.data.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {seed.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{(seed.error as Error).message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* CHECKLIST */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">2. Checklist de validação</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {doneCount}/{items.length} concluídos
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Resetar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress * 100} className="h-2" />
          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() => toggle(i)}
                  className="mt-0.5"
                  id={`chk-${i}`}
                />
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor={`chk-${i}`}
                    className={`text-sm font-medium cursor-pointer ${
                      item.done ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.text}
                  </label>
                  <Input
                    placeholder="Observação (opcional)"
                    value={item.observation}
                    onChange={(e) => updateObs(i, e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DIAGNÓSTICO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            3. Diagnóstico sob demanda
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Verifica duplicação de tarefas, inatividade e recálculos das últimas
            24h. Não roda em loop.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => diag.mutate()}
            disabled={diag.isPending}
            variant="secondary"
            className="gap-2"
          >
            {diag.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Rodar diagnóstico
          </Button>

          {diag.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {(diag.error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {diagData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                label="Planos ativos"
                value={diagData.plansActive}
                tone="default"
              />
              <Stat
                label="Alunos com plano"
                value={diagData.studentsWithActivePlan}
                tone="default"
              />
              <Stat
                label="Tarefas duplicadas"
                value={diagData.duplicateTasks.count}
                tone={diagData.duplicateTasks.count > 0 ? "danger" : "ok"}
              />
              <Stat
                label="Inativos (>3d)"
                value={diagData.inactiveStudents.count}
                tone={diagData.inactiveStudents.count > 0 ? "warn" : "ok"}
              />
              <Stat
                label="Recalc · prof (24h)"
                value={diagData.recalcsLast24h.teacher_update}
                tone="default"
              />
              <Stat
                label="Recalc · meta (24h)"
                value={diagData.recalcsLast24h.missed_goal}
                tone="default"
              />
              <Stat
                label="Recalc · auto (24h)"
                value={diagData.recalcsLast24h.auto}
                tone="default"
              />
            </div>
          )}

          {hasIssues && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Investigar antes de liberar</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                {diagData!.duplicateTasks.count > 0 && (
                  <div>
                    <strong>{diagData!.duplicateTasks.count}</strong> tarefas
                    duplicadas. Amostra:
                    <pre className="mt-1 text-[10px] bg-background/40 p-2 rounded overflow-auto">
                      {JSON.stringify(diagData!.duplicateTasks.samples, null, 2)}
                    </pre>
                  </div>
                )}
                {diagData!.inactiveStudents.count > 0 && (
                  <div>
                    <strong>{diagData!.inactiveStudents.count}</strong>{" "}
                    aluno(s) inativo(s) — esperado se for cenário de teste.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "ok" | "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "border-destructive/50 bg-destructive/10"
      : tone === "warn"
        ? "border-muted-foreground/40 bg-muted/40"
        : tone === "ok"
          ? "border-primary/40 bg-primary/5"
          : "";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
