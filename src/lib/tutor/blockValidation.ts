/**
 * Tutor Cognitive UI — Zod Validation Layer (Sprint Fase 3)
 *
 * Schemas Zod + sanitizadores para os 4 blocos cognitivos críticos:
 *   - clinical_flow
 *   - differential_diagnosis
 *   - pharmacology_compare
 *   - semiology_insight
 *
 * Política:
 *   - Payload válido          → render normal
 *   - Payload parcial         → sanitiza e renderiza o que sobreviver
 *   - Payload muito quebrado  → fallback CognitiveEmpty (no caller)
 *
 * Nunca lança exceções para o caller. Sempre devolve `{ ok, block?, reason? }`.
 */

import { z } from "zod";
import type {
  ClinicalFlowBlock,
  ClinicalFlowEdge,
  ClinicalFlowNode,
  DifferentialDiagnosisBlock,
  DifferentialItem,
  DrugComparisonItem,
  PharmacologyCompareBlock,
  SemiologyInsightBlock,
  SemiologyManeuver,
  TutorBlock,
  CurriculumImpactBlock,
} from "@/types/tutor";

// ─── helpers ────────────────────────────────────────────────────────────────

const trimmedString = (max = 500) =>
  z
    .string()
    .transform((s) => (typeof s === "string" ? s.trim() : s))
    .pipe(z.string().min(1).max(max));

const safeStringArray = (max = 200) =>
  z
    .array(z.unknown())
    .optional()
    .transform((arr) =>
      Array.isArray(arr)
        ? arr
            .filter((x) => typeof x === "string" && x.trim().length > 0)
            .map((x) => (x as string).trim().slice(0, max))
        : [],
    );

const clamp01 = (n: unknown): number | undefined => {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
};

const DDX_SEVERITY = ["baixa", "moderada", "alta", "critica"] as const;
const DDX_URGENCY = ["baixa", "moderada", "alta", "emergencia"] as const;
const FLOW_NODE_KIND = ["decision", "action", "outcome"] as const;

// ─── clinical_flow ──────────────────────────────────────────────────────────

const ClinicalFlowNodeSchema = z.object({
  id: trimmedString(80),
  label: trimmedString(240),
  kind: z.enum(FLOW_NODE_KIND).optional(),
});

const ClinicalFlowEdgeSchema = z.object({
  from: trimmedString(80),
  to: trimmedString(80),
  label: z.string().max(160).optional(),
});

const ClinicalFlowPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  nodes: z.array(z.unknown()).default([]),
  edges: z.array(z.unknown()).default([]),
});

function sanitizeClinicalFlow(rawPayload: unknown): ClinicalFlowBlock | null {
  const parsed = ClinicalFlowPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  const { title, nodes: rawNodes, edges: rawEdges } = parsed.data;

  // 1) Sanitize nodes — drop invalid, dedupe by id, cap depth at 60.
  const seenIds = new Set<string>();
  const nodes: ClinicalFlowNode[] = [];
  for (const raw of rawNodes) {
    const r = ClinicalFlowNodeSchema.safeParse(raw);
    if (!r.success) continue;
    if (seenIds.has(r.data.id)) continue;
    seenIds.add(r.data.id);
    nodes.push(r.data as ClinicalFlowNode);
    if (nodes.length >= 60) break;
  }
  if (nodes.length === 0) return null;

  // 2) Sanitize edges — drop orphans (from/to not in nodes) + self loops + dupes.
  const validIds = new Set(nodes.map((n) => n.id));
  const edgeKeys = new Set<string>();
  const edges: ClinicalFlowEdge[] = [];
  for (const raw of rawEdges) {
    const r = ClinicalFlowEdgeSchema.safeParse(raw);
    if (!r.success) continue;
    const { from, to, label } = r.data;
    if (!validIds.has(from) || !validIds.has(to)) continue;
    if (from === to) continue;
    const key = `${from}→${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, label });
    if (edges.length >= 120) break;
  }

  return {
    type: "clinical_flow",
    payload: { title, nodes, edges },
  };
}

// ─── differential_diagnosis ─────────────────────────────────────────────────

const DifferentialItemSchema = z.object({
  name: trimmedString(160),
  probability: z.unknown().optional(),
  severity: z.unknown().optional(),
  urgency: z.unknown().optional(),
  doNotMiss: z.boolean().optional(),
  pros: z.array(z.unknown()).optional(),
  cons: z.array(z.unknown()).optional(),
});

const DifferentialPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  chief_complaint: z.string().max(400).optional(),
  items: z.array(z.unknown()).default([]),
});

function sanitizeDifferentialDiagnosis(
  rawPayload: unknown,
): DifferentialDiagnosisBlock | null {
  const parsed = DifferentialPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  const { title, chief_complaint, items: rawItems } = parsed.data;

  const items: DifferentialItem[] = [];
  const seenNames = new Set<string>();

  for (const raw of rawItems) {
    const r = DifferentialItemSchema.safeParse(raw);
    if (!r.success) continue;
    const item = r.data;

    const key = item.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const sev = (DDX_SEVERITY as readonly string[]).includes(item.severity as string)
      ? (item.severity as DifferentialItem["severity"])
      : undefined;
    const urg = (DDX_URGENCY as readonly string[]).includes(item.urgency as string)
      ? (item.urgency as DifferentialItem["urgency"])
      : undefined;

    const pros = Array.isArray(item.pros)
      ? item.pros
          .filter((x) => typeof x === "string" && (x as string).trim())
          .map((x) => (x as string).trim().slice(0, 240))
          .slice(0, 12)
      : undefined;
    const cons = Array.isArray(item.cons)
      ? item.cons
          .filter((x) => typeof x === "string" && (x as string).trim())
          .map((x) => (x as string).trim().slice(0, 240))
          .slice(0, 12)
      : undefined;

    items.push({
      name: item.name,
      probability: clamp01(item.probability),
      severity: sev,
      urgency: urg,
      doNotMiss: item.doNotMiss === true,
      pros,
      cons,
    });
    if (items.length >= 30) break;
  }

  if (items.length === 0) return null;
  return {
    type: "differential_diagnosis",
    payload: { title, chief_complaint, items },
  };
}

// ─── pharmacology_compare ───────────────────────────────────────────────────

const DrugItemSchema = z.object({
  name: trimmedString(160),
  class: z.string().max(160).optional(),
  mechanism: z.string().max(800).optional(),
  adverse: z.array(z.unknown()).nullish(),
  contraindications: z.array(z.unknown()).nullish(),
  interactions: z.array(z.unknown()).nullish(),
  potency: z.string().max(160).optional(),
  half_life: z.string().max(160).optional(),
  clinical_advantage: z.string().max(400).optional(),
  preferred: z.boolean().optional(),
});

const PharmacologyPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  indication: z.string().max(400).optional(),
  drugs: z.array(z.unknown()).default([]),
});

function pickStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string" && (x as string).trim())
    .map((x) => (x as string).trim().slice(0, 240))
    .slice(0, max);
}

function sanitizePharmacologyCompare(
  rawPayload: unknown,
): PharmacologyCompareBlock | null {
  const parsed = PharmacologyPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  const { title, indication, drugs: rawDrugs } = parsed.data;

  const drugs: DrugComparisonItem[] = [];
  const seen = new Set<string>();

  for (const raw of rawDrugs) {
    const r = DrugItemSchema.safeParse(raw);
    if (!r.success) continue;
    const d = r.data;
    const key = d.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    drugs.push({
      name: d.name,
      class: d.class?.trim() || undefined,
      mechanism: d.mechanism?.trim() || undefined,
      adverse: pickStringArray(d.adverse),
      contraindications: pickStringArray(d.contraindications),
      interactions: pickStringArray(d.interactions),
      potency: d.potency?.trim() || undefined,
      half_life: d.half_life?.trim() || undefined,
      clinical_advantage: d.clinical_advantage?.trim() || undefined,
      preferred: d.preferred === true,
    });
    if (drugs.length >= 12) break;
  }

  if (drugs.length === 0) return null;
  return {
    type: "pharmacology_compare",
    payload: { title, indication, drugs },
  };
}

// ─── semiology_insight ──────────────────────────────────────────────────────

const SemiologyManeuverSchema = z.object({
  name: trimmedString(160),
  technique: z.string().max(800).optional(),
  finding: z.string().max(400).optional(),
  interpretation: z.string().max(800).optional(),
  pathophysiology: z.string().max(800).optional(),
  region: z.string().max(160).optional(),
});

const SemiologyPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  region: z.string().max(160).optional(),
  maneuvers: z.array(z.unknown()).default([]),
});

function sanitizeSemiologyInsight(
  rawPayload: unknown,
): SemiologyInsightBlock | null {
  const parsed = SemiologyPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  const { title, region, maneuvers: rawMan } = parsed.data;

  const maneuvers: SemiologyManeuver[] = [];
  const seen = new Set<string>();
  for (const raw of rawMan) {
    const r = SemiologyManeuverSchema.safeParse(raw);
    if (!r.success) continue;
    const m = r.data;
    const key = m.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    maneuvers.push({
      name: m.name,
      technique: m.technique?.trim() || undefined,
      finding: m.finding?.trim() || undefined,
      interpretation: m.interpretation?.trim() || undefined,
      pathophysiology: m.pathophysiology?.trim() || undefined,
      region: m.region?.trim() || undefined,
    });
    if (maneuvers.length >= 20) break;
  }

  if (maneuvers.length === 0) return null;
  return {
    type: "semiology_insight",
    payload: { title, region, maneuvers },
  };
}

// ─── curriculum_impact ───────────────────────────────────────────────────

const CurriculumImpactPayloadSchema = z.object({
  theme: z.string().max(200),
  incidence: z.enum(["baixa", "media", "alta"]),
  impact_score: z.number().min(0).max(10),
  mastery_level: z.number().min(0).max(1),
  priority: z.number().min(0).max(100),
});

function sanitizeCurriculumImpact(rawPayload: unknown): CurriculumImpactBlock | null {
  const parsed = CurriculumImpactPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  return {
    type: "curriculum_impact",
    payload: parsed.data as any,
  };
}

// ─── public API ─────────────────────────────────────────────────────────────

export type ValidationOutcome =
  | { ok: true; block: TutorBlock; sanitized: boolean }
  | { ok: false; reason: string };

/**
 * Valida e sanitiza um único bloco cognitivo. Para tipos NÃO cognitivos
 * (summary, mini_quiz, deep_dive, etc.) o bloco passa direto — eles têm
 * fallbacks próprios nos componentes legados e não são alvo da Fase 3.
 *
 * O campo `sanitized` indica que o payload original foi corrigido durante
 * a validação (ex: edges órfãs removidas, severity inválida zerada).
 */
export function validateCognitiveBlock(block: unknown): ValidationOutcome {
  if (!block || typeof block !== "object") {
    return { ok: false, reason: "Bloco vazio ou inválido." };
  }
  const b = block as { type?: unknown; payload?: unknown };
  if (typeof b.type !== "string") {
    return { ok: false, reason: "Tipo de bloco ausente." };
  }

  // Hash simples da payload original para detectar sanitização.
  const beforeKey = JSON.stringify(b.payload ?? null);

  switch (b.type) {
    case "clinical_flow": {
      const out = sanitizeClinicalFlow(b.payload);
      if (!out)
        return { ok: false, reason: "clinical_flow sem nodes válidos." };
      return {
        ok: true,
        block: out,
        sanitized: JSON.stringify(out.payload) !== beforeKey,
      };
    }
    case "differential_diagnosis": {
      const out = sanitizeDifferentialDiagnosis(b.payload);
      if (!out)
        return {
          ok: false,
          reason: "differential_diagnosis sem itens nomeados.",
        };
      return {
        ok: true,
        block: out,
        sanitized: JSON.stringify(out.payload) !== beforeKey,
      };
    }
    case "pharmacology_compare": {
      const out = sanitizePharmacologyCompare(b.payload);
      if (!out)
        return { ok: false, reason: "pharmacology_compare sem drogas válidas." };
      return {
        ok: true,
        block: out,
        sanitized: JSON.stringify(out.payload) !== beforeKey,
      };
    }
    case "semiology_insight": {
      const out = sanitizeSemiologyInsight(b.payload);
      if (!out)
        return {
          ok: false,
          reason: "semiology_insight sem manobras válidas.",
        };
      return {
        ok: true,
        block: out,
        sanitized: JSON.stringify(out.payload) !== beforeKey,
      };
    }
    case "curriculum_impact": {
      const out = sanitizeCurriculumImpact(b.payload);
      if (!out) return { ok: false, reason: "curriculum_impact inválido." };
      return {
        ok: true,
        block: out,
        sanitized: JSON.stringify(out.payload) !== beforeKey,
      };
    }
    default:
      // Outros tipos seguem fluxo legado (não são parte da Fase 3).
      return {
        ok: true,
        block: block as TutorBlock,
        sanitized: false,
      };
  }
}

/**
 * Tipo de telemetria emitida pelo renderer ao validar blocos.
 * Não persiste — apenas exposto para callbacks externos opcionais.
 */
export interface BlockValidationReport {
  block_type: string;
  status: "ok" | "sanitized" | "rejected";
  reason?: string;
}

/**
 * Valida lista inteira de blocos. Sempre devolve uma lista filtrada
 * com somente blocos seguros; e relatórios para telemetria opcional.
 */
export function validateTutorBlocks(blocks: unknown[]): {
  blocks: TutorBlock[];
  reports: BlockValidationReport[];
  rejected: BlockValidationReport[];
} {
  const out: TutorBlock[] = [];
  const reports: BlockValidationReport[] = [];
  const rejected: BlockValidationReport[] = [];

  for (const raw of blocks ?? []) {
    const outcome = validateCognitiveBlock(raw);
    const type =
      raw && typeof raw === "object" && "type" in (raw as object)
        ? String((raw as { type: unknown }).type)
        : "unknown";
    if (outcome.ok === true) {
      out.push(outcome.block);
      reports.push({
        block_type: type,
        status: outcome.sanitized ? "sanitized" : "ok",
      });
    } else {
      const r: BlockValidationReport = {
        block_type: type,
        status: "rejected",
        reason: (outcome as { ok: false; reason: string }).reason,
      };
      reports.push(r);
      rejected.push(r);
    }
  }

  return { blocks: out, reports, rejected };
}
