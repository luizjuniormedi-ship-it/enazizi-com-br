/**
 * InterventionProfileSection — Personalização por Perfil (Fase 6)
 * ────────────────────────────────────────────────────────────────
 * Sub-bloco read-only do painel admin que mostra o desempenho médio
 * de cada tipo de intervenção por perfil de aluno (agregado).
 *
 * Lê `intervention_user_profiles` (somente leitura). Sem mutação.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeProfileAdjustment } from "@/lib/interventionProfileRanking";

interface ProfileRow {
  intervention_type: string;
  shown_count: number;
  clicked_count: number;
  resolved_count: number;
  ctr: number;
  conversion_rate: number;
  profile_score: number;
}

interface AggregatedRow {
  type: string;
  users: number;
  shown: number;
  clicked: number;
  resolved: number;
  avgCtr: number;
  avgConversion: number;
  avgProfileScore: number;
  expectedDelta: number;
  expectedReason: string;
}

const TYPE_LABEL: Record<string, string> = {
  "min-mission": "🚨 Missão destrava",
  fsrs: "📚 Revisões FSRS",
  recovery: "⚠️ Recuperação",
  coverage: "📊 Cobertura",
  default: "✨ Continue",
};

async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("intervention_user_profiles")
    .select(
      "intervention_type, shown_count, clicked_count, resolved_count, ctr, conversion_rate, profile_score"
    )
    .limit(5000);

  if (error) {
    console.warn("[InterventionProfileSection] read failed:", error.message);
    return [];
  }
  return (data ?? []) as ProfileRow[];
}

function aggregate(rows: ProfileRow[]): AggregatedRow[] {
  const buckets = new Map<
    string,
    {
      users: number;
      shown: number;
      clicked: number;
      resolved: number;
      sumCtr: number;
      sumConv: number;
      sumScore: number;
    }
  >();

  for (const r of rows) {
    const b = buckets.get(r.intervention_type) ?? {
      users: 0,
      shown: 0,
      clicked: 0,
      resolved: 0,
      sumCtr: 0,
      sumConv: 0,
      sumScore: 0,
    };
    b.users++;
    b.shown += r.shown_count;
    b.clicked += r.clicked_count;
    b.resolved += r.resolved_count;
    b.sumCtr += Number(r.ctr) || 0;
    b.sumConv += Number(r.conversion_rate) || 0;
    b.sumScore += Number(r.profile_score) || 0;
    buckets.set(r.intervention_type, b);
  }

  return Array.from(buckets.entries())
    .map(([type, b]) => {
      const avgCtr = b.users > 0 ? b.sumCtr / b.users : 0;
      const avgConversion = b.users > 0 ? b.sumConv / b.users : 0;
      const avgProfileScore = b.users > 0 ? b.sumScore / b.users : 0;
      const adj = computeProfileAdjustment({
        type,
        shownCount: Math.round(b.shown / Math.max(b.users, 1)),
        clickedCount: Math.round(b.clicked / Math.max(b.users, 1)),
        resolvedCount: Math.round(b.resolved / Math.max(b.users, 1)),
        ctr: avgCtr,
        conversionRate: avgConversion,
        profileScore: avgProfileScore,
      });
      return {
        type,
        users: b.users,
        shown: b.shown,
        clicked: b.clicked,
        resolved: b.resolved,
        avgCtr,
        avgConversion,
        avgProfileScore,
        expectedDelta: adj.weightDelta,
        expectedReason: adj.reason,
      };
    })
    .sort((a, b) => b.avgProfileScore - a.avgProfileScore);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function deltaBadge(delta: number) {
  if (delta > 0) {
    return (
      <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
        <TrendingUp className="h-3 w-3" />+{delta}
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
        <TrendingDown className="h-3 w-3" />
        {delta}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Activity className="h-3 w-3" />0
    </Badge>
  );
}

export default function InterventionProfileSection() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["intervention-user-profiles-admin"],
    queryFn: fetchAllProfiles,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const aggregated = aggregate(rows ?? []);
  const best = aggregated.find((r) => r.expectedDelta > 0) ?? null;
  const worst = [...aggregated]
    .reverse()
    .find((r) => r.expectedDelta < 0) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          User Fit / Profile Personalization (Fase 6)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando perfis…</p>
        ) : aggregated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem dados de perfil ainda. A personalização ativa quando os alunos
            começarem a interagir com as intervenções.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 bg-emerald-500/5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Mais favorecido por perfil
                </div>
                {best ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {TYPE_LABEL[best.type] ?? best.type}
                    </span>
                    {deltaBadge(best.expectedDelta)}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhum tipo promovido
                  </span>
                )}
              </div>
              <div className="rounded-lg border p-3 bg-destructive/5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Mais rejeitado por perfil
                </div>
                {worst ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {TYPE_LABEL[worst.type] ?? worst.type}
                    </span>
                    {deltaBadge(worst.expectedDelta)}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhum tipo rebaixado
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Shown</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">CTR médio</TableHead>
                    <TableHead className="text-right">Conv. média</TableHead>
                    <TableHead className="text-right">Score médio</TableHead>
                    <TableHead className="text-right">Δ esperado</TableHead>
                    <TableHead>Razão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregated.map((r) => (
                    <TableRow key={r.type}>
                      <TableCell className="font-medium">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </TableCell>
                      <TableCell className="text-right">{r.users}</TableCell>
                      <TableCell className="text-right">{r.shown}</TableCell>
                      <TableCell className="text-right">{r.clicked}</TableCell>
                      <TableCell className="text-right">{r.resolved}</TableCell>
                      <TableCell className="text-right">
                        {formatPct(r.avgCtr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPct(r.avgConversion)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.avgProfileScore.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {deltaBadge(r.expectedDelta)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.expectedReason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
