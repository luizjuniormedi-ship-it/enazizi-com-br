/**
 * /admin/semantic-observatory — Wave 1 Operational Validation (Freeze v25)
 *
 * Consumer: admin-semantic-observatory (read-only, rollout=internal)
 * Lê SOMENTE views da ontologia via RPC `ontology_observatory_snapshot`.
 * Não toca em Planner / FSRS / Tutor / TRI / Simulados / specialty_id.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, RefreshCw, ShieldCheck, Database, Loader2 } from "lucide-react";

type Snapshot = {
  observed_at: string;
  kill_switch_enabled: boolean;
  ontology_health: any | null;
  semantic_drift: any[] | null;
  resolution_backlog: Array<{ resolution_type: string; question_count: number; rfc_pending: number; human_review_pending: number; unreviewed: number }>;
  pending_rfc_domains: Array<{ topic_normalized: string; topic_original: string; question_count: number }>;
  semantic_noise: Array<{ topic_normalized: string; question_count: number }>;
  transversal_topics: Array<{ topic_normalized: string; question_count: number }>;
  cross_domain_candidates: Array<{ topic_normalized: string; question_count: number }>;
};

export default function SemanticObservatory() {
  const { data, isLoading, refetch, isFetching, error } = useQuery<Snapshot | null>({
    queryKey: ["ontology-observatory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ontology_observatory_snapshot" as any);
      if (error) throw error;
      return data as Snapshot;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar observatório: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  const snap = data;
  const totalBacklog = snap?.resolution_backlog?.reduce((a, r) => a + Number(r.question_count || 0), 0) ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Semantic Observatory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wave 1 — Operação controlada. Read-only. Consumer: <code>admin-semantic-observatory</code>
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Governance status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Kill Switch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={snap?.kill_switch_enabled ? "default" : "secondary"}>
              {snap?.kill_switch_enabled ? "ONTOLOGY ON" : "LEGACY (default)"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Backlog total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBacklog}</div>
            <p className="text-xs text-muted-foreground">questões classificadas semanticamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snap?.semantic_drift?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">eventos detectados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Última leitura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {snap?.observed_at ? new Date(snap.observed_at).toLocaleString("pt-BR") : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resolution backlog */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Questões</TableHead>
                <TableHead className="text-right">RFC pendente</TableHead>
                <TableHead className="text-right">Review humana</TableHead>
                <TableHead className="text-right">Não revisado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(snap?.resolution_backlog ?? []).map((r) => (
                <TableRow key={r.resolution_type}>
                  <TableCell className="font-mono text-xs">{r.resolution_type}</TableCell>
                  <TableCell className="text-right">{r.question_count}</TableCell>
                  <TableCell className="text-right">{r.rfc_pending}</TableCell>
                  <TableCell className="text-right">{r.human_review_pending}</TableCell>
                  <TableCell className="text-right">{r.unreviewed}</TableCell>
                </TableRow>
              ))}
              {(!snap?.resolution_backlog || snap.resolution_backlog.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sem dados ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending RFC topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Curriculum RFC</CardTitle>
            <p className="text-xs text-muted-foreground">Specialties inexistentes — candidatas a RFC</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snap?.pending_rfc_domains ?? []).map((r) => (
                  <TableRow key={r.topic_normalized}>
                    <TableCell>{r.topic_original ?? r.topic_normalized}</TableCell>
                    <TableCell className="text-right">{r.question_count}</TableCell>
                  </TableRow>
                ))}
                {(!snap?.pending_rfc_domains || snap.pending_rfc_domains.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-6">—</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semantic Noise</CardTitle>
            <p className="text-xs text-muted-foreground">Topics genéricos sem significado curricular</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snap?.semantic_noise ?? []).map((r) => (
                  <TableRow key={r.topic_normalized}>
                    <TableCell>{r.topic_normalized}</TableCell>
                    <TableCell className="text-right">{r.question_count}</TableCell>
                  </TableRow>
                ))}
                {(!snap?.semantic_noise || snap.semantic_noise.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-6">—</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Operational Rituals */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Rituals (Freeze v25)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cadência obrigatória. Ver <code>docs/ontology/OPERATIONAL_RITUALS.md</code>.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ritual</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Semantic RFC Review", "semanal", "Curriculum board", "RFCs priorizados"],
                ["Drift Review", "semanal", "Platform admin", "Decisão por drift"],
                ["Ontology Health Review", "quinzenal", "Platform admin", "Snapshot arquivado"],
                ["Rollback Drill", "mensal", "Platform admin", "Log do drill"],
                ["Consumer Certification Review", "mensal", "Platform admin", "Auditoria L0–L5"],
              ].map(([r, f, o, s]) => (
                <TableRow key={r}>
                  <TableCell className="font-medium">{r}</TableCell>
                  <TableCell><Badge variant="outline">{f}</Badge></TableCell>
                  <TableCell className="text-xs">{o}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drift Governance Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Drift Governance Matrix</CardTitle>
          <p className="text-xs text-muted-foreground">
            Resposta humana obrigatória. Ver <code>docs/ontology/DRIFT_GOVERNANCE_MATRIX.md</code>.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drift Type</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["specialty_mismatch", "RFC review", "Curriculum board", "7d"],
                ["deprecated_node_link", "Ontology cleanup", "Platform admin", "14d"],
                ["multiple_specialty_links", "Human validation", "Curriculum board", "7d"],
                ["semantic_noise", "Backlog review", "Platform admin", "30d"],
                ["unresolved_transversal", "Curriculum board review", "Curriculum board", "30d"],
              ].map(([t, a, o, sla]) => (
                <TableRow key={t}>
                  <TableCell className="font-mono text-xs">{t}</TableCell>
                  <TableCell>{a}</TableCell>
                  <TableCell className="text-xs">{o}</TableCell>
                  <TableCell><Badge variant="secondary">{sla}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ownership Charter */}
      <Card>
        <CardHeader>
          <CardTitle>Ownership Charter</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ver <code>docs/ontology/OWNERSHIP_CHARTER.md</code>. Sem owner explícito, a ontologia degrada.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead>Owner oficial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Curriculum RFC", "Coordenação pedagógica"],
                ["Drift Review", "Arquitetura + Pedagogia"],
                ["Semantic Observatory", "Plataforma"],
                ["Rollback Authority", "Engenharia"],
                ["Ontology Versions", "Governance Board"],
                ["Consumer Certification", "Arquitetura"],
                ["Runtime Activation", "Comitê Técnico"],
              ].map(([area, owner]) => (
                <TableRow key={area}>
                  <TableCell className="font-medium">{area}</TableCell>
                  <TableCell className="text-xs">{owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SLOs */}
      <Card>
        <CardHeader>
          <CardTitle>Operational SLOs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ver <code>docs/ontology/SLOs.md</code>. Violação sustentada → suspender expansão.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Rollback time", "< 2 min"],
                ["Drift unresolved", "< 5%"],
                ["Unregistered consumers", "0"],
                ["Runtime incidents", "0"],
                ["Semantic review SLA", "< 7 dias"],
                ["RFC review SLA", "< 14 dias"],
              ].map(([m, t]) => (
                <TableRow key={m}>
                  <TableCell className="font-medium">{m}</TableCell>
                  <TableCell><Badge variant="outline">{t}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>



      {/* Wave 2 Gates */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Wave 2 — Gates obrigatórios
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Wave 2 (transversal + cross-domain + multi-axis) NÃO pode rodar sem todos os gates verdes.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>☐ 7 dias sem incidente desde Wave 1</li>
            <li>☐ Rollback drill aprovado no mês corrente</li>
            <li>☐ <code>v_ontology_health.drift_count</code> dentro de baseline</li>
            <li>☐ <code>unregistered_access_groups == 0</code></li>
            <li>☐ Aprovação explícita registrada</li>
          </ul>
        </CardContent>
      </Card>

      {/* Health raw */}
      {snap?.ontology_health && (
        <Card>
          <CardHeader>
            <CardTitle>Ontology Health (raw snapshot)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(snap.ontology_health, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

