/**
 * ENAZIZI — AI Stability Kit v11 (Resilience Hardening & AI Cost Reduction)
 * Circuit Breaker, Safe Parser, and Fallback Orchestration.
 */

import { generateSHA256 } from "./crypto-utils.ts";

export interface TutorResponse {
  content: string;
  teachingPhase: string;
  socraticQuestion: string;
  source: "openai" | "lovable" | "fallback" | "safe_mode" | "cache";
  confidence: number;
  metadata?: any;
}

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
    teachingPhase: "ENSINAR",
    sigla: "LUZ",
    fallback: true
  },
  "Insuficiência Cardíaca": {
    content: "### 🫀 Insuficiência Cardíaca (Premium Fallback)\n\nO tratamento da IC com fração de ejeção reduzida (ICFEr) baseia-se nos **4 Pilares (The Fantastic Four)**:\n\n1. **Beta-bloqueadores**: Bisoprolol, Carvedilol ou Metoprolol.\n2. **iSGLT2**: Dapagliflozina ou Empagliflozina.\n3. **Sacubitril-Valsartana (INRA)** ou IECA/BRA.\n4. **Antagonistas de Mineralocorticoide**: Espironolactona.\n\nTodos esses grupos demonstraram redução de mortalidade.",
    socraticQuestion: "Qual o papel da espironolactona na insuficiência cardíaca crônica?",
    teachingPhase: "ENSINAR",
    sigla: "IC",
    fallback: true
  },
  "Infarto": {
    content: "### 🫀 Infarto Agudo do Miocárdio (Premium Fallback)\n\nO manejo do IAM com supra de ST (IAMCSST) foca na **reperfusão imediata**.\n\n**Prazos Críticos:**\n- **Porta-ECG**: < 10 minutos.\n- **Porta-Balão (Angioplastia)**: < 90 minutos (em hospital com hemodinâmica).\n- **Porta-Agulha (Trombólise)**: < 30 minutos (se angioplastia não disponível em 120 min).\n\n**Mnemônico MONA (Clássico):**\n- **M**orfina (se dor refratária)\n- **O**xigênio (se SatO2 < 90%)\n- **N**itrato (vasodilatação, exceto em VD)\n- **A**spirina (300mg mastigados)",
    socraticQuestion: "Por que o nitrato é contraindicado no infarto de ventrículo direito?",
    teachingPhase: "ENSINAR",
    sigla: "IAM",
    fallback: true
  },
  "SEPSE": {
    content: "### 🚨 Protocolo de Sepse (Premium Fallback)\n\n**Sintomas Estão Piorando: Socorro Emergencial!**\n\nA sepse é uma emergência médica tempo-dependente. Os pilares do tratamento na primeira hora (Protocolo 1h) são:\n\n1. **Lactato sérico**: Coletar e repetir se > 2 mmol/L.\n2. **Culturas**: Coletar hemoculturas antes do antibiótico.\n3. **Antibióticos**: Iniciar espectro amplo imediatamente.\n4. **Cristaloides**: 30 mL/kg se hipotensão ou lactato ≥ 4.\n5. **Vasopressores**: Se mantiver PAM < 65 mmHg após volume.",
    socraticQuestion: "Qual o valor do lactato que indica necessidade de ressuscitação volêmica imediata?",
    teachingPhase: "ENSINAR",
    sigla: "SEPSE",
    fallback: true
  },
  "CURB-65": {
    content: "### 🫁 CURB-65 (Escore de Gravidade na Pneumonia)\n\n- **C**onfusão mental\n- **U**reia > 50 mg/dL\n- **R**espiração (FR >= 30 irpm)\n- **B**lood Pressure (PAS < 90 ou PAD <= 60)\n- **65** anos ou mais\n\n**Pontuação:**\n- 0-1: Ambulatorial\n- 2: Hospitalar\n- 3+: UTI",
    socraticQuestion: "Qual a conduta para um paciente com CURB-65 de 2 pontos?",
    teachingPhase: "ENSINAR",
    sigla: "CURB65",
    fallback: true
  },
  "Wells": {
    content: "### 🫁 Escore de Wells (TEP)\n\n- Sinais clínicos de TVP (+3)\n- Diagnóstico alternativo menos provável (+3)\n- FC > 100 bpm (+1,5)\n- Imobilização/Cirurgia recente (+1,5)\n- TVP/TEP prévio (+1,5)\n- Hemoptise (+1)\n- Malignidade (+1)\n\n**Probabilidade:**\n- <= 4: Baixa (pedir D-dímero)\n- > 4: Alta (pedir Angio-TC)",
    socraticQuestion: "Se o Wells for de 2 pontos, qual o próximo passo?",
    teachingPhase: "ENSINAR",
    sigla: "WELLS",
    fallback: true
  }
};


export function normalizeTutorResponse(raw: any, source: TutorResponse["source"]): TutorResponse {
  console.log(`[TUTOR_RESPONSE_NORMALIZER] source=${source}`);

  // 1. If it's already a normalized response, return it
  if (raw && typeof raw === 'object' && raw.content && raw.teachingPhase && raw.socraticQuestion) {
    console.log("[TUTOR_NORMALIZED_OK] Standard format detected");
    return {
      content: raw.content,
      teachingPhase: raw.teachingPhase,
      socraticQuestion: raw.socraticQuestion,
      source: source,
      confidence: raw.confidence ?? 1.0,
      metadata: raw.metadata ?? {}
    };
  }

  // 2. Handle OpenAI style Choice object
  if (raw && raw.choices?.[0]?.message?.content) {
    console.log("[TUTOR_NORMALIZED_OK] AI Choice format detected");
    const content = raw.choices[0].message.content;
    try {
      const parsed = JSON.parse(content);
      return {
        content: parsed.content || content,
        teachingPhase: parsed.teachingPhase || "ENSINAR",
        socraticQuestion: parsed.socraticQuestion || "",
        source: source,
        confidence: 0.95,
        metadata: parsed
      };
    } catch {
      return {
        content: content,
        teachingPhase: "ENSINAR",
        socraticQuestion: "O que você achou dessa explicação?",
        source: source,
        confidence: 0.8
      };
    }
  }

  // 3. Handle Fallback objects
  if (raw && raw.fallback) {
    console.log("[TUTOR_NORMALIZED_OK] Fallback format detected");
    return {
      content: raw.content || "### 💡 Resumo de Segurança\nConteúdo técnico carregado da biblioteca local.",
      teachingPhase: raw.teachingPhase || "ENSINAR",
      socraticQuestion: raw.socraticQuestion || "Ficou clara essa explicação base?",
      source: "fallback",
      confidence: 1.0,
      metadata: raw
    };
  }

  // 4. Emergency Last Resort (Safe Mode Premium)
  console.error("[TUTOR_NORMALIZED_FAIL] Using Emergency Safe Mode");
  return {
    content: "### 🏥 Atendimento de Emergência Cognitiva\n\n⚠ **Estamos utilizando conteúdo validado localmente.**\n\nEnquanto os provedores de IA escalam, preparamos uma revisão essencial dos fundamentos clínicos para você não perder o ritmo.\n\n**Pontos Críticos:**\n- Priorize a estabilização hemodinâmica.\n- Siga os protocolos de 1ª hora (Sepse/IAM/AVC).\n- Reavalie o paciente a cada intervenção.",
    teachingPhase: "ENSINAR",
    socraticQuestion: "Gostaria de revisar um mnemônico específico enquanto aguardamos a conexão?",
    source: "safe_mode",
    confidence: 0.5
  };
}


export function getStaticFallback(tema: string): any {
  // Normalize search term
  const search = (tema || "").toUpperCase();
  
  // High-precision medical matching
  const key = Object.keys(MEDICAL_STATIC_FALLBACKS).find(k => {
    const kUpper = k.toUpperCase();
    return search.includes(kUpper) || 
           kUpper.includes(search) ||
           (kUpper === "IC" && (search.includes("INSUFICIÊNCIA CARDÍACA") || search.includes("CORAÇÃO"))) ||
           (kUpper === "IAM" && (search.includes("INFARTO") || search.includes("REPERFUSÃO") || search.includes("MIOCÁRDIO"))) ||
           (kUpper === "SEPSE" && (search.includes("CHOQUE SÉPTICO") || search.includes("INFECÇÃO GENERALIZADA")));
  });

  if (key) {
    console.log(`[TUTOR_FALLBACK_MATCH] Found local summary for ${key} (requested: ${tema})`);
    return { ...MEDICAL_STATIC_FALLBACKS[key], tema: key };
  }
  
  // Generic fallback with better messaging
  console.log(`[TUTOR_FALLBACK_GENERIC] No local summary for "${tema}"`);
  return {
    content: `### 🏥 Sistema em Manutenção Cognitiva\n\nIdentificamos uma alta demanda no tema **${tema}**. Estamos utilizando nosso motor de resiliência local para garantir que seu estudo não seja interrompido.\n\nEm instantes, o Tutor V3 voltará com profundidade total de IA.`,
    socraticQuestion: "Podemos revisar os conceitos base deste tema enquanto os servidores escalam?",
    teachingPhase: "ENSINAR",
    sigla: "FIX",
    fallback: true,
    tema
  };
}
