/**
 * Loop 2 — Normalizador de plan_json (daily_plans).
 *
 * Histórico:
 *  - v1 array: plan_json era um array de tasks/blocks
 *  - v1 object: plan_json era { blocks, tips, focus_areas, ... }
 *  - v2 canônico: { tasks: [...], metadata: { version, generated_at, source, ... } }
 *
 * Esta função NUNCA quebra render: sempre retorna o shape canônico v2,
 * preservando metadados antigos quando existirem.
 */

export type PlanTask = Record<string, unknown>;

export interface PlanMetadata {
  version: "v2";
  generated_at: string;
  source: string;
  // Campos legados preservados (tips, focus_areas, greeting, etc.)
  [key: string]: unknown;
}

export interface CanonicalPlanJson {
  tasks: PlanTask[];
  metadata: PlanMetadata;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function normalizePlanJson(
  raw: unknown,
  fallbackSource = "runtime_normalization"
): CanonicalPlanJson {
  const baseMeta: PlanMetadata = {
    version: "v2",
    generated_at: new Date().toISOString(),
    source: fallbackSource,
  };

  // null / undefined / primitivos → plano vazio
  if (raw == null || (typeof raw !== "object")) {
    return { tasks: [], metadata: baseMeta };
  }

  // Já canônico
  if (isPlainObject(raw) && Array.isArray((raw as any).tasks)) {
    const md = isPlainObject((raw as any).metadata) ? (raw as any).metadata : {};
    return {
      tasks: (raw as any).tasks as PlanTask[],
      metadata: { ...baseMeta, ...md, version: "v2" },
    };
  }

  // Array legado → tasks direto
  if (Array.isArray(raw)) {
    return {
      tasks: raw as PlanTask[],
      metadata: { ...baseMeta, source: "legacy_array" },
    };
  }

  // Objeto com `blocks` (formato IA antigo)
  if (isPlainObject(raw) && Array.isArray((raw as any).blocks)) {
    const { blocks, ...rest } = raw as Record<string, unknown>;
    return {
      tasks: blocks as PlanTask[],
      metadata: { ...baseMeta, ...rest, source: "legacy_blocks" },
    };
  }

  // Objeto desconhecido → preserva como metadata, tasks vazias
  return {
    tasks: [],
    metadata: { ...baseMeta, ...(raw as Record<string, unknown>), source: "legacy_unknown" },
  };
}

/** Atalho seguro para extrair só as tasks (compatível com código que usa Array.isArray). */
export function extractPlanTasks(raw: unknown): PlanTask[] {
  return normalizePlanJson(raw).tasks;
}
