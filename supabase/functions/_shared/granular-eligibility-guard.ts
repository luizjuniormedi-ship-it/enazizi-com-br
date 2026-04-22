// Sprint 6 — Guard centralizado de elegibilidade granular
//
// Centraliza a decisão "posso usar pipeline granular?" em UM único lugar,
// padronizando as razões de fallback que aparecem na telemetria/admin.
//
// Razões padronizadas (use SEMPRE estas chaves):
//   - flag_off                  → system_flags.granular_generator_enabled = false
//   - no_banca_provided         → request sem banca
//   - banca_nao_pronta          → coverage curricular insuficiente para a banca
//   - questions_not_classified  → banco de questões com classificação abaixo do threshold
//   - coverage_insufficient     → curriculum_weights muito baixo para a banca específica
//   - empty_distribution        → planner não conseguiu produzir shares
//
// Safe-by-default: qualquer falha → eligible:false com reason="guard_error".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getBancaCoverage,
  isGranularEnabled,
  buildTopicDistribution,
  type GranularPlan,
  type BancaStatus,
} from "./granular-generator-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Thresholds mínimos de classificação no banco para considerar o
 * gerador granular tecnicamente viável. Sem isso, o pipeline finge
 * usar IDs mas na prática ainda depende de texto livre.
 */
export const GRANULAR_CLASSIFICATION_THRESHOLDS = {
  pct_specialty: 70,  // % de questions_bank com specialty_id
  pct_topic: 50,      // % com topic_id
  pct_subtopic: 30,   // % com subtopic_id (mais baixo: granularidade é topic)
} as const;

export type GranularFallbackReason =
  | "flag_off"
  | "no_banca_provided"
  | "banca_nao_pronta"
  | "questions_not_classified"
  | "coverage_insufficient"
  | "empty_distribution"
  | "guard_error";

export interface ClassificationReadiness {
  total_questions: number;
  pct_specialty: number;
  pct_topic: number;
  pct_subtopic: number;
  meets_threshold: boolean;
}

export interface GuardDecision {
  eligible: boolean;
  reason: GranularFallbackReason | null;
  banca: string | null;
  banca_status: BancaStatus | null;
  classification: ClassificationReadiness | null;
  plan: GranularPlan | null;
}

/** Lê prontidão de classificação do banco. Cacheado em memória por 60s. */
let _readinessCache: { value: ClassificationReadiness; at: number } | null = null;
const READINESS_TTL_MS = 60_000;

export async function getClassificationReadiness(): Promise<ClassificationReadiness> {
  const now = Date.now();
  if (_readinessCache && now - _readinessCache.at < READINESS_TTL_MS) {
    return _readinessCache.value;
  }
  try {
    const sb = admin();
    const { data, error } = await sb.rpc("granular_classification_readiness");
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      const fallback: ClassificationReadiness = {
        total_questions: 0,
        pct_specialty: 0,
        pct_topic: 0,
        pct_subtopic: 0,
        meets_threshold: false,
      };
      _readinessCache = { value: fallback, at: now };
      return fallback;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const value: ClassificationReadiness = {
      total_questions: Number(row.total_questions ?? 0),
      pct_specialty: Number(row.pct_specialty ?? 0),
      pct_topic: Number(row.pct_topic ?? 0),
      pct_subtopic: Number(row.pct_subtopic ?? 0),
      meets_threshold:
        Number(row.pct_specialty ?? 0) >= GRANULAR_CLASSIFICATION_THRESHOLDS.pct_specialty &&
        Number(row.pct_topic ?? 0) >= GRANULAR_CLASSIFICATION_THRESHOLDS.pct_topic &&
        Number(row.pct_subtopic ?? 0) >= GRANULAR_CLASSIFICATION_THRESHOLDS.pct_subtopic,
    };
    _readinessCache = { value, at: now };
    return value;
  } catch {
    const fallback: ClassificationReadiness = {
      total_questions: 0,
      pct_specialty: 0,
      pct_topic: 0,
      pct_subtopic: 0,
      meets_threshold: false,
    };
    _readinessCache = { value: fallback, at: now };
    return fallback;
  }
}

/**
 * Decisão centralizada — usar essa em vez de chamar planGranularOrFallback
 * diretamente quando a UI/telemetria precisar das razões padronizadas.
 *
 * Não desliga a flag: apenas decide. O caller continua dono do fluxo.
 */
export async function evaluateGranularEligibility(opts: {
  banca?: string | null;
  totalQuestions: number;
  specialtyHints?: string[];
}): Promise<GuardDecision> {
  const base: GuardDecision = {
    eligible: false,
    reason: null,
    banca: opts.banca ?? null,
    banca_status: null,
    classification: null,
    plan: null,
  };

  try {
    if (!opts.banca) return { ...base, reason: "no_banca_provided" };

    const enabled = await isGranularEnabled();
    if (!enabled) return { ...base, reason: "flag_off" };

    const cov = await getBancaCoverage(opts.banca);
    base.banca_status = cov.status;
    if (cov.status !== "pronta") {
      return { ...base, reason: "banca_nao_pronta" };
    }

    const classification = await getClassificationReadiness();
    base.classification = classification;
    if (!classification.meets_threshold) {
      return { ...base, reason: "questions_not_classified" };
    }

    const plan = await buildTopicDistribution(opts.banca, opts.totalQuestions, opts.specialtyHints);
    if (!plan || plan.shares.length === 0) {
      return { ...base, reason: "empty_distribution" };
    }

    return { ...base, eligible: true, plan };
  } catch (e) {
    console.warn("[granular-guard] threw:", (e as Error).message);
    return { ...base, reason: "guard_error" };
  }
}

/** Helper para anexar a razão à telemetria de um run. */
export function describeFallbackReason(reason: GranularFallbackReason | null): string {
  switch (reason) {
    case "flag_off": return "Feature flag desligada";
    case "no_banca_provided": return "Banca não informada";
    case "banca_nao_pronta": return "Banca sem cobertura curricular suficiente";
    case "questions_not_classified": return "Banco de questões abaixo do threshold de classificação";
    case "coverage_insufficient": return "Cobertura insuficiente para a banca";
    case "empty_distribution": return "Distribuição vazia após cálculo de shares";
    case "guard_error": return "Erro interno no guard";
    default: return "Pipeline granular ativo";
  }
}
