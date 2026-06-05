/**
 * ENAZIZI — AI Stability Kit v11 (Resilience Hardening)
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
  "SEPSE": {
    content: "### 🚨 Protocolo de Sepse (Premium Fallback)\n\n**Sintomas Estão Piorando: Socorro Emergencial!**\n\nA sepse é uma emergência médica tempo-dependente. Os pilares do tratamento na primeira hora (Protocolo 1h) são:\n\n1. **Lactato sérico**: Coletar e repetir se > 2 mmol/L.\n2. **Culturas**: Coletar hemoculturas antes do antibiótico.\n3. **Antibióticos**: Iniciar espectro amplo imediatamente.\n4. **Cristaloides**: 30 mL/kg se hipotensão ou lactato ≥ 4.\n5. **Vasopressores**: Se mantiver PAM < 65 mmHg após volume.",
    socraticQuestion: "Qual o valor do lactato que indica necessidade de ressuscitação volêmica imediata?",
    teachingPhase: "ENSINAR",
    sigla: "SEPSE",
    fallback: true
  },
  "IAM": {
    content: "### 🫀 Infarto Agudo do Miocárdio (Premium Fallback)\n\nO manejo do IAM com supra de ST (IAMCSST) foca na **reperfusão imediata**.\n\n**Prazos Críticos:**\n- **Porta-ECG**: < 10 minutos.\n- **Porta-Balão (Angioplastia)**: < 90 minutos (em hospital com hemodinâmica).\n- **Porta-Agulha (Trombólise)**: < 30 minutos (se angioplastia não disponível em 120 min).\n\n**Mnemônico MONA (Clássico):**\n- **M**orfina (se dor refratária)\n- **O**xigênio (se SatO2 < 90%)\n- **N**itrato (vasodilatação, exceto em VD)\n- **A**spirina (300mg mastigados)",
    socraticQuestion: "Por que o nitrato é contraindicado no infarto de ventrículo direito?",
    teachingPhase: "ENSINAR",
    sigla: "IAM",
    fallback: true
  },
  "AVC": {
    content: "### 🧠 Acidente Vascular Cerebral (Premium Fallback)\n\nNo AVC Isquêmico agudo, \"Tempo é Cérebro\".\n\n**Escala de NIHSS**: Usada para quantificar o déficit neurológico.\n**Tomografia de Crânio**: Obrigatória para excluir hemorragia antes de qualquer conduta.\n\n**Janela Terapêutica:**\n- **Trombólise IV (rtPA)**: Até 4,5 horas do início dos sintomas.\n- **Trombectomia Mecânica**: Até 24 horas em casos selecionados (grandes vasos).",
    socraticQuestion: "Qual o primeiro exame de imagem obrigatório na suspeita de AVC?",
    teachingPhase: "ENSINAR",
    sigla: "AVC",
    fallback: true
  },
  "IC": {
    content: "### 🫀 Insuficiência Cardíaca (Premium Fallback)\n\nO tratamento da IC com fração de ejeção reduzida (ICFEr) baseia-se nos **4 Pilares (The Fantastic Four)**:\n\n1. **Beta-bloqueadores**: Bisoprolol, Carvedilol ou Metoprolol.\n2. **iSGLT2**: Dapagliflozina ou Empagliflozina.\n3. **Sacubitril-Valsartana (INRA)** ou IECA/BRA.\n4. **Antagonistas de Mineralocorticoide**: Espironolactona.\n\nTodos esses grupos demonstraram redução de mortalidade.",
    socraticQuestion: "Qual o papel da espironolactona na insuficiência cardíaca crônica?",
    teachingPhase: "ENSINAR",
    sigla: "IC",
    fallback: true
  },
  "HAS": {
    content: "### 🩸 Hipertensão Arterial Sistêmica (Premium Fallback)\n\nDefinição: PA sistólica ≥ 140 mmHg e/ou diastólica ≥ 90 mmHg em duas ou mais ocasiões.\n\n**Metas de Tratamento:**\n- Geral: < 140/90 mmHg.\n- Alto Risco CV / DM / Doença Renal: < 130/80 mmHg.\n\n**Classes de Medicamentos:**\n- IECA/BRA (especialmente se DM ou doença renal)\n- Tiazídicos (Clortalidona, Hidroclorotiazida)\n- Bloqueadores de Canais de Cálcio (Anlodipino)\n- Beta-bloqueadores (não são primeira linha na HAS pura)",
    socraticQuestion: "Qual a meta de PA para um paciente diabético com HAS?",
    teachingPhase: "ENSINAR",
    sigla: "HAS",
    fallback: true
  },
  "DM": {
    content: "### 🍬 Diabetes Mellitus (Premium Fallback)\n\nDiagnóstico (pelo menos 2 exames alterados):\n- Glicemia de jejum ≥ 126 mg/dL\n- Hemoglobina Glicada (HbA1c) ≥ 6,5%\n- TOTG (2h após 75g glicose) ≥ 200 mg/dL\n- Glicemia casual ≥ 200 mg/dL com sintomas inequívocos\n\n**Tratamento Inicial (Tipo 2):**\n- Metformina é o padrão-ouro.\n- Se doença cardiovascular ou renal: iSGLT2 ou análogos de GLP-1.",
    socraticQuestion: "Qual o valor da HbA1c que define o diagnóstico de Diabetes?",
    teachingPhase: "ENSINAR",
    sigla: "DM",
    fallback: true
  },
  "Pneumonia": {
    content: "### 🫁 Pneumonia Adquirida na Comunidade (Premium Fallback)\n\nCritérios de Gravidade (**CURB-65**):\n- **C**onfusão mental\n- **U**reia > 50 mg/dL\n- **R**espiração (FR ≥ 30 irpm)\n- **B**lood Pressure (PAS < 90 ou PAD ≤ 60)\n- **65** anos ou mais\n\n**Escore:**\n- 0-1: Tratamento ambulatorial.\n- 2: Considerar internação.\n- 3-5: Internação (provável UTI se 4-5).",
    socraticQuestion: "No CURB-65, qual valor de FR indica gravidade?",
    teachingPhase: "ENSINAR",
    sigla: "Pneumonia",
    fallback: true
  },
  "TEP": {
    content: "### 🫁 Tromboembolismo Pulmonar (Premium Fallback)\n\nInvestigação inicial baseada no **Escore de Wells**.\n\n**Wells Baixa Probabilidade**: Solicitar D-dímero.\n- Se D-dímero normal: TEP excluído.\n- Se D-dímero alterado: Solicitar Angio-TC de tórax.\n\n**Wells Alta Probabilidade**: Solicitar Angio-TC direto (não perde tempo com D-dímero).\n\n**Tratamento**: Anticoagulação (Heparina, Varfarina, DOACs). Se instabilidade hemodinâmica: Trombólise.",
    socraticQuestion: "Quando devemos solicitar o D-dímero na suspeita de TEP?",
    teachingPhase: "ENSINAR",
    sigla: "TEP",
    fallback: true
  },
  "DPOC": {
    content: "### 🫁 Doença Pulmonar Obstrutiva Crônica (Premium Fallback)\n\nDefinição Espirométrica: VEF1/CVF < 0,7 após broncodilatador.\n\n**Tratamento Crônico (GOLD):**\n- Grupo A: Broncodilatador (curta ou longa).\n- Grupo B: LAMA ou LABA.\n- Grupo E: LAMA + LABA (considerar corticoide inalatório se eosinófilos > 300).\n\n**Exacerbação**: Aumento de tosse, escarro ou dispneia. Tratar com Broncodilatadores, Corticoide Sistêmico e Antibióticos (se aumento de secreção/purulência).",
    socraticQuestion: "Qual o achado na espirometria que confirma o diagnóstico de DPOC?",
    teachingPhase: "ENSINAR",
    sigla: "DPOC",
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
      content: raw.content || "Conteúdo de segurança carregado.",
      teachingPhase: raw.teachingPhase || "ENSINAR",
      socraticQuestion: raw.socraticQuestion || "Podemos continuar?",
      source: "fallback",
      confidence: 1.0,
      metadata: raw
    };
  }

  // 4. Emergency Last Resort
  console.error("[TUTOR_NORMALIZED_FAIL] Using Emergency Safe Mode");
  return {
    content: "### 🏥 Atendimento de Emergência Cognitiva\n\nO sistema está em manutenção, mas seu aprendizado não para. Vamos revisar os fundamentos clínicos enquanto restauramos a conexão total.\n\n⚠️ **Nota**: Estamos utilizando conteúdo validado localmente enquanto nossos servidores de IA escalam.",
    teachingPhase: "ENSINAR",
    socraticQuestion: "Gostaria de revisar um tema específico enquanto aguarda?",
    source: "safe_mode",
    confidence: 0.5
  };
}


export function getStaticFallback(tema: string): any {
  const key = Object.keys(MEDICAL_STATIC_FALLBACKS).find(k => tema.toUpperCase().includes(k.toLowerCase()));
  if (key) {
    console.log(`[TUTOR_FALLBACK_MATCH] Found local summary for ${key}`);
    return { ...MEDICAL_STATIC_FALLBACKS[key], tema };
  }
  
  // Generic fallback with better messaging
  console.log(`[TUTOR_FALLBACK_GENERIC] No local summary for ${tema}`);
  return {
    content: `### 🏥 Sistema em Manutenção Cognitiva\n\nIdentificamos uma alta demanda no tema **${tema}**. Estamos utilizando nosso motor de resiliência local para garantir que seu estudo não seja interrompido.\n\nEm instantes, o Tutor V3 voltará com profundidade total de IA.`,
    socraticQuestion: "Podemos revisar os conceitos base deste tema enquanto os servidores escalam?",
    teachingPhase: "ENSINAR",
    sigla: "FIX",
    fallback: true,
    tema
  };
}
