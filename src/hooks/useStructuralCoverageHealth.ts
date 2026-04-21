/**
 * useStructuralCoverageHealth (Fase 1.6)
 * ──────────────────────────────────────
 * Mede a cobertura estrutural (subtopic_id / topic_id / specialty_id)
 * nas fontes legadas que alimentam recommendations do Study Engine.
 *
 * Fonte considerada nesta fase: `temas_estudados` (alimenta revisoes,
 * weak topics e — via fallback — error_review). Outras fontes legadas
 * são listadas explicitamente como "ainda sem coluna estrutural".
 *
 * Read-only, leve e tolerante a falhas. Usado apenas no admin.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthBadge = "excellent" | "good" | "warning" | "critical" | "n/a";

export interface SourceHealth {
  table: string;
  label: string;
  total: number;
  withSubtopic: number;
  withTopic: number;
  withSpecialty: number;
  pctSubtopic: number;
  pctTopic: number;
  pctSpecialty: number;
  badge: HealthBadge;
  status: "structured" | "partial" | "legacy_only";
  note?: string;
}

export interface StructuralCoverageHealth {
  sources: SourceHealth[];
  /** Top fonte (média ponderada pela contagem) — % com subtopic_id. */
  overallPctSubtopic: number;
  overallBadge: HealthBadge;
  unmatchedSamples: Array<{ table: string; id: string; tema?: string; subtopico?: string; especialidade?: string }>;
}

function classifyBadge(pct: number): HealthBadge {
  if (!Number.isFinite(pct) || pct < 0) return "n/a";
  if (pct >= 80) return "excellent";
  if (pct >= 60) return "good";
  if (pct >= 40) return "warning";
  return "critical";
}

export function useStructuralCoverageHealth() {
  return useQuery<StructuralCoverageHealth>({
    queryKey: ["structural-coverage-health"],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const sources: SourceHealth[] = [];
      const unmatchedSamples: StructuralCoverageHealth["unmatchedSamples"] = [];

      // ── temas_estudados (fonte estruturada na Fase 1.6) ──
      try {
        const [{ count: total }, { count: withSub }, { count: withTop }, { count: withSpec }, sample] = await Promise.all([
          supabase.from("temas_estudados").select("id", { count: "exact", head: true }),
          supabase.from("temas_estudados" as any).select("id", { count: "exact", head: true }).not("subtopic_id", "is", null),
          supabase.from("temas_estudados" as any).select("id", { count: "exact", head: true }).not("topic_id", "is", null),
          supabase.from("temas_estudados" as any).select("id", { count: "exact", head: true }).not("specialty_id", "is", null),
          supabase.from("temas_estudados" as any)
            .select("id, tema, subtopico, especialidade")
            .is("subtopic_id", null).is("topic_id", null)
            .limit(20),
        ]);
        const t = total ?? 0;
        const ws = withSub ?? 0;
        const wt = withTop ?? 0;
        const wp = withSpec ?? 0;
        const pct = t > 0 ? (ws / t) * 100 : 0;
        sources.push({
          table: "temas_estudados",
          label: "Temas estudados (revisões, weak topics)",
          total: t, withSubtopic: ws, withTopic: wt, withSpecialty: wp,
          pctSubtopic: Math.round(pct * 10) / 10,
          pctTopic: t > 0 ? Math.round((wt / t) * 1000) / 10 : 0,
          pctSpecialty: t > 0 ? Math.round((wp / t) * 1000) / 10 : 0,
          badge: classifyBadge(pct),
          status: pct >= 60 ? "structured" : "partial",
        });
        for (const s of (sample.data || []) as any[]) {
          unmatchedSamples.push({
            table: "temas_estudados",
            id: s.id, tema: s.tema, subtopico: s.subtopico, especialidade: s.especialidade,
          });
        }
      } catch (e) {
        console.warn("[StructuralHealth] temas_estudados:", e);
      }

      // ── error_bank (ainda 100% legado) ──
      try {
        const { count } = await supabase.from("error_bank").select("id", { count: "exact", head: true });
        sources.push({
          table: "error_bank",
          label: "Banco de erros (error_review)",
          total: count ?? 0, withSubtopic: 0, withTopic: 0, withSpecialty: 0,
          pctSubtopic: 0, pctTopic: 0, pctSpecialty: 0,
          badge: "critical", status: "legacy_only",
          note: "Sem colunas estruturais — recs usam fallback via tema↔temas_estudados.",
        });
      } catch { /* noop */ }

      // ── revisoes (estruturada via join em temas_estudados) ──
      try {
        const { count } = await supabase.from("revisoes").select("id", { count: "exact", head: true });
        sources.push({
          table: "revisoes",
          label: "Revisões (review)",
          total: count ?? 0, withSubtopic: -1, withTopic: -1, withSpecialty: -1,
          pctSubtopic: -1, pctTopic: -1, pctSpecialty: -1,
          badge: "n/a", status: "structured",
          note: "Sem colunas próprias — herda IDs via join em temas_estudados.",
        });
      } catch { /* noop */ }

      // ── desempenho_questoes (deprecated) ──
      try {
        const { count } = await supabase.from("desempenho_questoes").select("id", { count: "exact", head: true });
        sources.push({
          table: "desempenho_questoes",
          label: "Desempenho (legado, deprecated)",
          total: count ?? 0, withSubtopic: 0, withTopic: 0, withSpecialty: 0,
          pctSubtopic: 0, pctTopic: 0, pctSpecialty: 0,
          badge: "n/a", status: "legacy_only",
          note: "Tabela marcada @deprecated-source — fonte viva é performance_unified.",
        });
      } catch { /* noop */ }

      // overall = pct ponderado entre fontes "reais" (que têm colunas estruturais)
      const real = sources.filter((s) => s.pctSubtopic >= 0 && s.total > 0 && s.status !== "legacy_only");
      const totalReal = real.reduce((s, x) => s + x.total, 0);
      const overallPctSubtopic = totalReal > 0
        ? Math.round((real.reduce((s, x) => s + x.withSubtopic, 0) / totalReal) * 1000) / 10
        : 0;

      return {
        sources,
        overallPctSubtopic,
        overallBadge: classifyBadge(overallPctSubtopic),
        unmatchedSamples,
      };
    },
  });
}

export function badgeVariant(b: HealthBadge): "default" | "secondary" | "destructive" | "outline" {
  switch (b) {
    case "excellent": return "default";
    case "good": return "secondary";
    case "warning": return "outline";
    case "critical": return "destructive";
    default: return "outline";
  }
}

export function badgeLabel(b: HealthBadge): string {
  return { excellent: "Excelente", good: "Boa", warning: "Atenção", critical: "Crítica", "n/a": "—" }[b];
}
