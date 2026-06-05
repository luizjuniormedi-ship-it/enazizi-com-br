/**
 * ENAZIZI — AI Stability Kit v10
 * Circuit Breaker, Safe Parser, and Fallback Orchestration.
 */

import { generateSHA256 } from "./crypto-utils.ts";

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private static instances: Map<string, CircuitBreaker> = new Map();
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly COOLDOWN_MS = 60000;

  private constructor(private provider: string) {}

  public static getInstance(provider: string): CircuitBreaker {
    if (!this.instances.has(provider)) {
      this.instances.set(provider, new CircuitBreaker(provider));
    }
    return this.instances.get(provider)!;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime > this.COOLDOWN_MS) {
      this.state = "HALF_OPEN";
      console.log(`[CIRCUIT_HALF_OPEN] Provider ${this.provider} attempting recovery.`);
    }
    return this.state;
  }

  public recordSuccess() {
    this.failureCount = 0;
    if (this.state !== "CLOSED") {
      console.log(`[CIRCUIT_RECOVERED] Provider ${this.provider} is now CLOSED.`);
    }
    this.state = "CLOSED";
  }

  public recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.state = "OPEN";
      console.warn(`[CIRCUIT_OPEN] Provider ${this.provider} tripped after ${this.failureCount} failures.`);
    }
  }

  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }
}

// ─── SAFE PARSER ────────────────────────────────────────────────────────────

export function safeJsonParse<T>(content: string, fallback: T): T {
  if (!content) return fallback;
  
  try {
    // 1. Sanitize
    let cleaned = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Control characters
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // 2. Extract JSON block if needed
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn("[SAFE_PARSER_FAIL] Invalid JSON from AI, using fallback.", { error: err.message });
    return fallback;
  }
}

/**
 * Normalizes common AI response variations.
 */
export function normalizeAIResponse(data: any): any {
  if (!data) return null;
  
  // ENAZIZI v3 Tutor Parsing (Handle response from Tutor index.ts)
  if (data.choices?.[0]?.message?.content) {
    try {
      const content = data.choices[0].message.content;
      if (typeof content === "string") {
        const parsed = JSON.parse(content);
        return {
          content: parsed.content || content,
          socraticQuestion: parsed.socraticQuestion || "",
          teachingMode: parsed.teachingMode || "PRECEPTOR",
          interactionMode: parsed.interactionMode || "BALANCED_SOCRATIC",
          minimumTeachingDelivered: parsed.minimumTeachingDelivered ?? true
        };
      }
    } catch (_e) {
      // Not JSON or parse error, return as is
    }
  }

  // If it's a mnemônico-like object, ensure keys are consistent
  if (data.mnemonic || data.phrase || data.items_map) {
    return {
      title: data.mnemonic || data.sigla || "Mnemônico",
      phrase: data.phrase || data.frase_mnemonica || "",
      association: data.explanation_didatica || data.explanation || data.association || "",
      visualScene: data.scene_description || data.cena_visual || data.visualScene || "",
      ...data
    };
  }
  
  return data;
}

// ─── STATIC FALLBACK ────────────────────────────────────────────────────────

export const MEDICAL_STATIC_FALLBACKS: Record<string, any> = {
  "Critérios de Light": {
    content: "### 💡 Mnemônico: Critérios de Light (LUZ)\n\n**A LUZ ilumina os critérios de Light para diferenciar o derrame pleural.**\n\n- **Proteína** pleural / sérica > 0,5\n- **LDH** pleural / sérico > 0,6\n- **LDH** pleural > 2/3 do limite superior do normal do soro\n\n*Se qualquer um for positivo: EXUDATO (Inflamatório).*",
    socraticQuestion: "Em um paciente com IC, você espera transudato ou exudato?",
    sigla: "LUZ",
    fallback: true
  },
  "SEPSE": {
    content: "### 🚨 Protocolo de Sepse\n\n**Sintomas Estão Piorando: Socorro Emergencial!**\n\n- Reconhecimento precoce (qSOFA / SOFA)\n- Lactato e Hemoculturas na 1ª hora\n- Antibiótico de amplo espectro na 1ª hora\n- Ressuscitação volêmica (30ml/kg) se hipotensão ou lactato >= 4.",
    socraticQuestion: "Qual a conduta que mais reduz mortalidade na sepse?",
    sigla: "SEPSE",
    fallback: true
  }
};


export function getStaticFallback(tema: string): any {
  const key = Object.keys(MEDICAL_STATIC_FALLBACKS).find(k => tema.toLowerCase().includes(k.toLowerCase()));
  if (key) return { ...MEDICAL_STATIC_FALLBACKS[key], tema };
  
  // Generic fallback
  return {
    content: `### 🏥 Sistema em Manutenção Cognitiva\n\nIdentificamos uma alta demanda no tema **${tema}**. Nossos provedores de IA estão escalando recursos para garantir a precisão médica.\n\nPor favor, aguarde alguns segundos e tente novamente.`,
    socraticQuestion: "Gostaria de tentar novamente agora?",
    sigla: "FIX",
    frase_mnemonica: `Focar na Informação X-encial de ${tema}.`,
    explicacao_didatica: "O sistema de IA está em manutenção. Este é um mnemônico de segurança.",
    cena_visual: "Um cadeado dourado protegendo um livro de medicina.",
    tema,
    fallback: true
  };

}
