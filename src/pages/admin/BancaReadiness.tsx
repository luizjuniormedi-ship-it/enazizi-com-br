/**
 * /admin/banca-readiness
 * ──────────────────────
 * Sprint 3.1 — Relatório consolidado de PRONTIDÃO REAL do gerador granular,
 * por banca. Combina:
 *   1) cobertura curricular (curriculum_weights vs curriculum_subtopics)
 *   2) cobertura do BANCO de questões (questions_bank via exam_banks +
 *      real_exam_questions via exam_info textual)
 *   3) status final do gerador (precisa AMBOS prontos)
 *
 * Não toca currículo, não classifica, não muda gerador.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Target, BookOpen, Database, CheckCircle2, AlertTriangle, XCircle, Star } from "lucide-react";

interface ReadinessRow {
  banca: string;
  specialties_total: number;
  specialties_cobertas: number;
  topics_total: number;
  topics_cobertos: number;
  subtopics_total: number;
  subtopics_cobertos: number;
  pct_subtopics: number | null;
  curriculum_status: "pronta" | "parcial" | "nao_pronta";
  total_questoes: number;
  questoes_classificadas: number;
  pct_questoes_classificadas: number | null;
  questions_status: "pronta" | "parcial" | "nao_pronta" | "sem_questoes";
  generator_status: "pronta" | "parcial" | "nao_pronta" | "so_curriculo";
  generator_status_reason: string;
  highlight: boolean;
}

const HIGHLIGHTED = new Set(["ENARE", "USP", "UNIFESP", "SUS-SP", "UNICAMP", "REVALIDA", "GERAL"]);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pronta: { label: "Pronta", variant: "default", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
    parcial: { label: "Parcial", variant: "secondary", icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    nao_pronta: { label: "Não pronta", variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
    so_curriculo: { label: "Só currículo", variant: "outline", icon: <BookOpen className="h-3 w-3 mr-1" /> },
    sem_questoes: { label: "Sem questões", variant: "outline", icon: <Database className="h-3 w-3 mr-1" /> },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const, icon: null };
  return (
    <Badge variant={cfg.variant} className="whitespace-nowrap">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function MiniBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const tone = pct >= 80 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="text-xs tabular-nums">{value}/{total} <span className="text-muted-foreground">({pct}%)</span></div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BancaReadiness() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["banca-generator-readiness"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_banca_generator_readiness");
      if (error) throw error;
      return data as ReadinessRow[];
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            Falha ao carregar: {(error as Error).message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data ?? [];
  const summary = {
    pronta: rows.filter((r) => r.generator_status === "pronta").length,
    parcial: rows.filter((r) => r.generator_status === "parcial").length,
    so_curriculo: rows.filter((r) => r.generator_status === "so_curriculo").length,
    nao_pronta: rows.filter((r) => r.generator_status === "nao_pronta").length,
  };

  const highlighted = rows.filter((r) => HIGHLIGHTED.has(r.banca));
  const others = rows.filter((r) => !HIGHLIGHTED.has(r.banca));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Prontidão por banca — gerador granular</h1>
          <p className="text-sm text-muted-foreground">
            Sprint 3.1 — relatório consolidado: cobertura <strong>curricular</strong> +
            cobertura do <strong>banco de questões</strong> + status final do gerador.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prontas para gerador</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.pronta}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            currículo OK + ≥70% questões classificadas
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Parciais</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.parcial}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            usar com fallback ativo
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Só currículo</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.so_curriculo}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            distribuição OK, mas sem questões para selecionar
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Não prontas</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.nao_pronta}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            seguir com EXAM_PROFILES estático
          </CardContent>
        </Card>
      </div>

      {/* Critério */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Critério exato de status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1.5 text-muted-foreground">
          <div><strong>currículo pronto</strong> = ≥80% subtopics da banca têm peso E ≥90% specialties cobertas.</div>
          <div><strong>questões prontas</strong> = ≥70% das questões vinculadas à banca já têm <code>specialty_id</code>.</div>
          <div><strong>gerador pronto</strong> = currículo pronto E questões prontas (ambos simultaneamente).</div>
          <div><strong>só currículo</strong> = currículo OK mas sem questões vinculadas (gerador IA pode rodar; seleção real cai no fallback de texto livre).</div>
        </CardContent>
      </Card>

      {/* Bancas em destaque */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Bancas em destaque
          </CardTitle>
          <CardDescription>
            ENARE · USP · UNIFESP · SUS-SP · UNICAMP · REVALIDA · GERAL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banca</TableHead>
                  <TableHead className="min-w-32">Specialties</TableHead>
                  <TableHead className="min-w-32">Topics</TableHead>
                  <TableHead className="min-w-32">Subtopics</TableHead>
                  <TableHead>Currículo</TableHead>
                  <TableHead className="min-w-32">Questões classif.</TableHead>
                  <TableHead>Banco questões</TableHead>
                  <TableHead>Gerador</TableHead>
                  <TableHead className="min-w-64">Razão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highlighted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                      Sem dados ainda — currículo ou questões não cadastrados para essas bancas.
                    </TableCell>
                  </TableRow>
                ) : (
                  highlighted.map((r) => (
                    <TableRow key={r.banca}>
                      <TableCell className="font-semibold">{r.banca}</TableCell>
                      <TableCell><MiniBar value={r.specialties_cobertas} total={r.specialties_total} /></TableCell>
                      <TableCell><MiniBar value={r.topics_cobertos} total={r.topics_total} /></TableCell>
                      <TableCell><MiniBar value={r.subtopics_cobertos} total={r.subtopics_total} /></TableCell>
                      <TableCell><StatusBadge status={r.curriculum_status} /></TableCell>
                      <TableCell><MiniBar value={r.questoes_classificadas} total={r.total_questoes} /></TableCell>
                      <TableCell><StatusBadge status={r.questions_status} /></TableCell>
                      <TableCell><StatusBadge status={r.generator_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.generator_status_reason}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Outras bancas */}
      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outras bancas</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banca</TableHead>
                    <TableHead>Currículo</TableHead>
                    <TableHead>Banco questões</TableHead>
                    <TableHead>Gerador</TableHead>
                    <TableHead>Razão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {others.map((r) => (
                    <TableRow key={r.banca}>
                      <TableCell>{r.banca}</TableCell>
                      <TableCell><StatusBadge status={r.curriculum_status} /></TableCell>
                      <TableCell><StatusBadge status={r.questions_status} /></TableCell>
                      <TableCell><StatusBadge status={r.generator_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.generator_status_reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
