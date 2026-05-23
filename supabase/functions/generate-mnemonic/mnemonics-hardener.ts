
/**
 * ENAZIZI — Mnemonic Resilience Hardener
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";

export interface MnemonicHardenedResult {
  success: boolean;
  degraded?: boolean;
  mnemonic: string;
  frase_mnemonica: string;
  phrase: string;
  explanation_tecnica: string;
  explanation_didatica: string;
  scene_description: string;
  prompt_imagem: string;
  items_map: any[];
  score_final: number;
  id?: string;
  result_id?: string;
  correlation_id?: string;
  quality_flag?: string;
}

/**
 * CIRCUIT BREAKER LOGIC
 */
export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN"
}

export async function getCircuitState(supabase: SupabaseClient, provider: string): Promise<CircuitState> {
  const { data, error } = await supabase
    .from('ai_provider_circuits')
    .select('state, last_failure_at, failure_count')
    .eq('provider', provider)
    .single();

  if (error || !data) return CircuitState.CLOSED;

  if (data.state === CircuitState.OPEN) {
    const cooldownMs = 60000;
    const elapsed = Date.now() - new Date(data.last_failure_at).getTime();
    if (elapsed > cooldownMs) {
      return CircuitState.HALF_OPEN;
    }
    return CircuitState.OPEN;
  }

  return data.state as CircuitState;
}

export async function reportFailure(supabase: SupabaseClient, provider: string) {
  const { data } = await supabase
    .from('ai_provider_circuits')
    .select('failure_count')
    .eq('provider', provider)
    .single();

  const count = (data?.failure_count || 0) + 1;
  const state = count >= 3 ? CircuitState.OPEN : CircuitState.CLOSED;

  await supabase.from('ai_provider_circuits').upsert({
    provider,
    failure_count: count,
    state,
    last_failure_at: new Date().toISOString()
  });

  if (state === CircuitState.OPEN) {
    console.log(`[CIRCUIT_OPEN] Provider ${provider} is now OPEN`);
  }
}

export async function reportSuccess(supabase: SupabaseClient, provider: string) {
  await supabase.from('ai_provider_circuits').upsert({
    provider,
    failure_count: 0,
    state: CircuitState.CLOSED,
    last_failure_at: new Date().toISOString()
  });
  console.log(`[CIRCUIT_RECOVERED] Provider ${provider} is now CLOSED`);
}

/**
 * SAFE PARSER
 */
export function safeParseMnemonic(raw: string): Partial<MnemonicHardenedResult> {
  try {
    const parsed = parseAiJson(raw);
    return parsed;
  } catch (err) {
    console.warn("[MNEMONIC_PARSE_FAIL] Failed to parse AI response, attempting recovery", err);
    
    // Attempt recovery from partial JSON or text
    const result: any = {};
    
    // Simple regex for mnemonic sigla
    const siglaMatch = raw.match(/["']mnemonic["']:\s*["']([^"']+)["']/i) || raw.match(/SIGLA:\s*([A-Z]+)/i);
    if (siglaMatch) result.mnemonic = siglaMatch[1];
    
    // Simple regex for phrase
    const phraseMatch = raw.match(/["']frase_mnemonica["']:\s*["']([^"']+)["']/i) || raw.match(/FRASE:\s*([^\\n]+)/i);
    if (phraseMatch) result.frase_mnemonica = phraseMatch[1];
    
    if (!result.mnemonic && !result.frase_mnemonica) {
        // Absolute fallback if parsing fails completely
        return {
          mnemonic: "MEMO",
          frase_mnemonica: "Mnemônico em processamento...",
          degraded: true
        };
    }
    
    return result;
  }
}

/**
 * LAST RESORT FALLBACK
 */
export function getDeterministicFallback(topic: string): MnemonicHardenedResult {
  return {
    success: false,
    degraded: true,
    mnemonic: topic.substring(0, 5).toUpperCase(),
    frase_mnemonica: `Fallback temporário para: ${topic}`,
    phrase: `Fallback temporário para: ${topic}`,
    explanation_tecnica: "O sistema de IA está temporariamente indisponível. Por favor, tente novamente em alguns instantes.",
    explanation_didatica: "Fallback temporário gerado pelo sistema.",
    scene_description: "Imagem indisponível.",
    prompt_imagem: "",
    items_map: [],
    score_final: 50
  };
}

/**
 * GLOBAL REQUEST LOCK (Inflight Registry)
 */
export async function getInflightRequest(supabase: SupabaseClient, lockKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_inflight_requests')
    .select('result_id')
    .eq('lock_key', lockKey)
    .gt('expires_at', new Date().toISOString())
    .single();
    
  if (error || !data) return null;
  return data.result_id;
}

export async function setInflightRequest(supabase: SupabaseClient, lockKey: string, resultId?: string) {
  await supabase.from('ai_inflight_requests').upsert({
    lock_key: lockKey,
    result_id: resultId,
    expires_at: new Date(Date.now() + 60000).toISOString() // 60s lock
  });
}

export async function clearInflightRequest(supabase: SupabaseClient, lockKey: string) {
  await supabase.from('ai_inflight_requests').delete().eq('lock_key', lockKey);
}

export async function hashPrompt(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
