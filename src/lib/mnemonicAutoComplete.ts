/**
 * Mnemonic Auto-Complete — fills missing critical items before generation.
 * Runs AFTER pre-validation, BEFORE edge function call.
 * Fail-closed: if unsure, does NOT add items and returns valid:false.
 */

import { supabase } from "@/integrations/supabase/client";

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

export type ContentType = "criterios" | "diagnostico" | "classificacao" | string;

export interface AutoCompleteParams {
  topic: string;
  subtopic?: string;
  items: string[];
  contentType: ContentType;
}

export interface AutoCompleteResult {
  valid: boolean;
  finalItems: string[];
  addedItems: string[];
  autoCompleted: boolean;
  reason?: string;
  suggestion?: string;
}

// ══════════════════════════════════════════════════
// SYNONYM EQUIVALENCE MAP
// ══════════════════════════════════════════════════

const SYNONYM_MAP: Array<[string[], string]> = [
  [["deficit neurologico focal", "sintomas focais agudos", "deficit focal", "hemiparesia", "hemiplegia", "paresia"], "deficit_neurologico"],
  [["tc de cranio", "tomografia", "imagem inicial", "tc", "ressonancia", "neuroimagem"], "imagem"],
  [["tempo de inicio", "tempo", "janela terapeutica", "golden hour", "tempo dos sintomas", "inicio dos sintomas"], "tempo_inicio"],
  [["nivel de consciencia", "glasgow", "rebaixamento de consciencia", "consciencia"], "nivel_consciencia"],
  [["cefaleia subita", "cefaleia intensa", "cefaleia em trovoada", "cefaleia"], "cefaleia"],
  [["vomito", "nausea e vomito", "vomitos"], "vomito"],
  [["supra st", "supradesnivelamento de st", "supra de st", "elevacao de st"], "supra_st"],
  [["inversao de t", "onda t invertida", "inversao de onda t", "inversao da onda t"], "inversao_t"],
  [["onda q", "onda q patologica", "q patologica"], "onda_q"],
  [["lactato", "lactato elevado", "hiperlactatemia"], "lactato"],
  [["hipotensao", "choque", "pa baixa", "hipotensao arterial"], "hipotensao"],
  [["disfuncao organica", "disfuncao de orgaos", "falencia organica"], "disfuncao_organica"],
  [["iam com supra", "stemi", "infarto com supra"], "stemi"],
  [["iam sem supra", "nstemi", "infarto sem supra"], "nstemi"],
  [["sangramento", "hemorragia", "marcador de sangramento"], "sangramento"],
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveConceptIds(normalizedItems: string[]): Set<string> {
  const ids = new Set<string>();
  for (const item of normalizedItems) {
    for (const [synonyms, conceptId] of SYNONYM_MAP) {
      if (synonyms.some((syn) => {
        if (item === syn) return true;
        const synRe = new RegExp(`\\b${syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        return synRe.test(item);
      })) {
        ids.add(conceptId);
      }
    }
  }
  return ids;
}

// ══════════════════════════════════════════════════
// INTERPRETATION MODE
// ══════════════════════════════════════════════════

type InterpretationMode = "CHECKLIST" | "COMPARATIVO" | "CATEGORICO" | "GENERIC";

function detectMode(topic: string, subtopic: string | undefined, contentType: string): InterpretationMode {
  const combined = normalize(`${topic} ${subtopic || ""} ${contentType}`);
  if (/diferencia|compara/.test(combined)) return "COMPARATIVO";
  if (/criterios|diagnostico/.test(combined)) return "CHECKLIST";
  if (/classificacao/.test(combined)) return "CATEGORICO";
  return "GENERIC";
}

// ══════════════════════════════════════════════════
// CLINICAL MAPPINGS (scalable dictionary)
// ══════════════════════════════════════════════════

interface ClinicalRule {
  topicPatterns: RegExp[];
  mode?: InterpretationMode;
  requiredConcepts: string[];          // concept IDs from SYNONYM_MAP
  completionItems: Record<string, string>; // conceptId → canonical item text to add
}

const CLINICAL_MAPPINGS: ClinicalRule[] = [
  // AVC general
  {
    topicPatterns: [/\bavc\b/, /\bacidente vascular\b/],
    requiredConcepts: ["deficit_neurologico", "tempo_inicio", "imagem"],
    completionItems: {
      deficit_neurologico: "Déficit neurológico focal",
      tempo_inicio: "Tempo de início dos sintomas",
      imagem: "Imagem inicial (TC de crânio)",
    },
  },
  // AVC comparative (isquêmico vs hemorrágico)
  {
    topicPatterns: [/\bavc\b.*\b(diferenc|compara|isquem|hemorr)\b/, /\b(isquem|hemorr)\b.*\bavc\b/],
    mode: "COMPARATIVO",
    requiredConcepts: ["imagem", "deficit_neurologico", "nivel_consciencia"],
    completionItems: {
      imagem: "TC de crânio",
      deficit_neurologico: "Sinal focal agudo",
      nivel_consciencia: "Nível de consciência",
    },
  },
  // SEPSE
  {
    topicPatterns: [/\bsepse\b/, /\bsepsis\b/],
    requiredConcepts: ["lactato", "hipotensao", "disfuncao_organica"],
    completionItems: {
      lactato: "Lactato elevado",
      hipotensao: "Hipotensão arterial",
      disfuncao_organica: "Disfunção orgânica",
    },
  },
  // IAM / ECG
  {
    topicPatterns: [/\biam\b/, /\becg\b.*\biam\b/, /\biam\b.*\becg\b/, /\binfarto\b/],
    requiredConcepts: ["supra_st", "inversao_t", "onda_q"],
    completionItems: {
      supra_st: "Supra de ST",
      inversao_t: "Inversão de onda T",
      onda_q: "Onda Q patológica",
    },
  },
];

// ══════════════════════════════════════════════════
// DANGEROUS TERMS — never auto-add
// ══════════════════════════════════════════════════

const DANGEROUS_PATTERNS = [
  /\bdose\b/, /\bmg\b/, /\bml\b/, /\bposologia\b/,
  /\bcontraindicac/, /\bcontraindica/,
  /\btempo\s+maximo\b/, /\bjanela\s+de\s+reperfus/,
];

function isDangerous(item: string): boolean {
  const n = normalize(item);
  return DANGEROUS_PATTERNS.some((p) => p.test(n));
}

// ══════════════════════════════════════════════════
// AI FALLBACK
// ══════════════════════════════════════════════════

async function aiFallbackComplete(
  topic: string,
  subtopic: string | undefined,
  items: string[]
): Promise<string[]> {
  try {
    const prompt = `Você é um auditor médico. Analise esta lista incompleta para o tema '${topic}'${subtopic ? ` e subtema '${subtopic}'` : ""}.
Sua tarefa é sugerir no máximo 2 itens curtos para completar a lista logicamente.
Regras: Não repita conceitos já presentes: ${JSON.stringify(items)}. Não sugira doses ou condutas perigosas.
Responda EXCLUSIVAMENTE em formato JSON usando esta estrutura: { "suggestedItems": ["item1", "item2"] }`;

    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: {
        prompt,
        model: "google/gemini-2.5-flash",
        responseFormat: "json",
        systemPrompt: "Responda apenas JSON válido.",
      },
    });

    if (error || !data) return [];

    const text = typeof data === "string" ? data : (data as any).content || (data as any).text || JSON.stringify(data);
    const jsonMatch = text.match(/\{[\s\S]*"suggestedItems"[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.suggestedItems)) return [];

    return parsed.suggestedItems
      .filter((i: unknown): i is string => typeof i === "string" && i.trim().length > 0)
      .filter((i: string) => !isDangerous(i))
      .slice(0, 2);
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════
// MAIN FUNCTION
// ══════════════════════════════════════════════════

export async function autoCompleteMnemonicItems(
  params: AutoCompleteParams
): Promise<AutoCompleteResult> {
  const { topic, subtopic, items, contentType } = params;

  // Guard: empty / too small to even attempt
  if (!items || items.length === 0) {
    return {
      valid: false, finalItems: [], addedItems: [], autoCompleted: false,
      reason: "Lista vazia.", suggestion: "Insira pelo menos 3 itens.",
    };
  }

  // Already at max — skip auto-complete
  if (items.length >= 7) {
    return { valid: true, finalItems: items, addedItems: [], autoCompleted: false };
  }

  const normalizedTopic = normalize(`${topic} ${subtopic || ""}`);
  const normalizedItems = items.map(normalize);
  const mode = detectMode(topic, subtopic, contentType);
  const presentConcepts = resolveConceptIds(normalizedItems);

  // Find matching clinical rules (prefer mode-specific, then general)
  let matchedRule: ClinicalRule | null = null;
  for (const rule of CLINICAL_MAPPINGS) {
    const topicMatch = rule.topicPatterns.some((p) => p.test(normalizedTopic));
    if (!topicMatch) continue;
    if (rule.mode && rule.mode === mode) { matchedRule = rule; break; }
    if (!rule.mode && !matchedRule) matchedRule = rule;
  }

  const addedItems: string[] = [];

  if (matchedRule) {
    // Determine missing concepts
    for (const conceptId of matchedRule.requiredConcepts) {
      if (presentConcepts.has(conceptId)) continue;
      const candidate = matchedRule.completionItems[conceptId];
      if (!candidate) continue;
      if (isDangerous(candidate)) continue;

      // Check total won't exceed 7
      if (items.length + addedItems.length >= 7) {
        return {
          valid: false, finalItems: items, addedItems: [], autoCompleted: false,
          reason: "Adicionar itens obrigatórios ultrapassaria o limite de 7.",
          suggestion: "Reduza a lista para liberar espaço para itens críticos.",
        };
      }
      addedItems.push(candidate);
    }
  }

  // If no local rule matched and list might be incomplete (< 5 items), try AI fallback
  if (!matchedRule && items.length < 5 && ["criterios", "diagnostico", "classificacao"].includes(contentType)) {
    const aiSuggestions = await aiFallbackComplete(topic, subtopic, items);
    for (const suggestion of aiSuggestions) {
      const sugNorm = normalize(suggestion);
      // Check not already present (exact or synonym)
      const sugConcepts = resolveConceptIds([sugNorm]);
      const alreadyPresent = [...sugConcepts].some((c) => presentConcepts.has(c)) ||
        normalizedItems.includes(sugNorm);
      if (alreadyPresent) continue;
      if (items.length + addedItems.length >= 7) break;
      addedItems.push(suggestion);
      // Update tracking
      for (const c of sugConcepts) presentConcepts.add(c);
    }
  }

  // Final items
  const finalItems = [...items, ...addedItems];

  // Still too few after completion?
  if (finalItems.length < 3) {
    return {
      valid: false, finalItems: items, addedItems: [], autoCompleted: false,
      reason: "Lista muito curta mesmo após tentativa de auto-completar.",
      suggestion: "Adicione mais itens manualmente.",
    };
  }

  return {
    valid: true,
    finalItems,
    addedItems,
    autoCompleted: addedItems.length > 0,
    reason: addedItems.length > 0
      ? `Adicionado(s) automaticamente: ${addedItems.join(", ")}`
      : undefined,
  };
}
