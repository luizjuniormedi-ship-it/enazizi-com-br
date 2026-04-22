/**
 * Sprint 3 — Painel admin de cobertura curricular por banca.
 * Somente leitura. Não altera gerador, currículo, nem dados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type Status = "pronta" | "parcial" | "nao_pronta";

interface BancaReport {
  banca: string;
  specialties_total: number;
  specialties_cobertas: number;
  topics_total: number;
  topics_cobertos: number;
  subtopics_total: number;
  subtopics_cobertos: number;
  microtopics_total: number;
  pct_specialties: number;
  pct_topics: number;
  pct_subtopics: number;
  peso_medio: number | null;
  status: Status;
  top_gaps_specialties: { specialty: string; subtopics_sem_peso: number }[];
}

const STATUS_META: Record<Status, { label: string; tone: "default" | "secondary" | "destructive"; icon: JSX.Element }> = {
  pronta: { label: "Pronta", tone: "default", icon: <CheckCircle2 className="h-4 w-4" /> },
  parcial: { label: "Parcialmente pronta", tone: "secondary", icon: <AlertTriangle className="h-4 w-4" /> },
  nao_pronta: { label: "Não pronta", tone: "destructive", icon: <XCircle className="h-4 w-4" /> },
};

export default function CurriculumCoverage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["banca-coverage-report"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_banca_coverage_report");
      if (error) throw error;
      return (data ?? []) as BancaReport[];
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Cobertura curricular por banca</h1>
        <p className="text-sm text-muted-foreground">
          Sprint 3 — auditoria de <code>curriculum_weights</code> contra a hierarquia ativa.
          Somente leitura. Não altera gerador.
        </p>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Critérios de pronto:</strong>
          {" "}
          <Badge variant="default" className="mx-1">Pronta</Badge> ≥ 80% subtopics e ≥ 90% specialties.{" "}
          <Badge variant="secondary" className="mx-1">Parcial</Badge> ≥ 40% subtopics ou ≥ 60% specialties.{" "}
          <Badge variant="destructive" className="mx-1">Não pronta</Badge> &lt; 40% subtopics.
        </AlertDescription>
      </Alert>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando relatório…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.map((b) => {
          const meta = STATUS_META[b.status];
          return (
            <Card key={b.banca}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">{b.banca}</CardTitle>
                  <CardDescription>
                    Peso médio: {b.peso_medio ?? "—"} · Microtopics no currículo: {b.microtopics_total}
                  </CardDescription>
                </div>
                <Badge variant={meta.tone} className="gap-1">
                  {meta.icon} {meta.label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Metric
                  label="Especialidades"
                  covered={b.specialties_cobertas}
                  total={b.specialties_total}
                  pct={Number(b.pct_specialties ?? 0)}
                />
                <Metric
                  label="Tópicos"
                  covered={b.topics_cobertos}
                  total={b.topics_total}
                  pct={Number(b.pct_topics ?? 0)}
                />
                <Metric
                  label="Subtópicos"
                  covered={b.subtopics_cobertos}
                  total={b.subtopics_total}
                  pct={Number(b.pct_subtopics ?? 0)}
                />

                {b.top_gaps_specialties?.length > 0 && (
                  <div className="rounded-md border p-3 bg-muted/30">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Top lacunas (specialties com mais subtopics sem peso)
                    </p>
                    <ul className="space-y-1 text-sm">
                      {b.top_gaps_specialties.map((g) => (
                        <li key={g.specialty} className="flex justify-between">
                          <span>{g.specialty}</span>
                          <span className="font-mono text-muted-foreground">{g.subtopics_sem_peso}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, covered, total, pct }: { label: string; covered: number; total: number; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {covered}/{total} ({pct.toFixed(1)}%)
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
