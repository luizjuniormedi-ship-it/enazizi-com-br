import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

const MNEMONIC_PIPELINE_VERSION = "2026-04-14-v7-strict-coverage";

const STRICT_COVERAGE_TYPES = new Set([
  "criterios", "classificacao", "sinais_classicos",
  "diagnostico_diferencial_curto", "componentes",
]);

// ══════════════════════════════════════════════════
// STEP 1 — ELIGIBILITY GATE
// ══════════════════════════════════════════════════

const ALLOWED_TYPES = [
  "lista", "criterios", "causas", "classificacao",
  "efeitos_adversos", "sinais_classicos", "fatores_de_risco",
  "diagnostico_diferencial_curto", "componentes",
];

const BLOCKED_KEYWORDS = [
  "dosagem", "posologia", "dose", "mg/kg", "mg/dl",
  "protocolo de emergência", "reanimação", "pcr",
  "timing", "intervalo de tempo", "controvérsia",
  "off-label", "experimental",
];

function validateMnemonicEligibility(
  items: string[], contentType: string, topic: string
): { ok: boolean; reason?: string } {
  if (!ALLOWED_TYPES.includes(contentType)) {
    return { ok: false, reason: `Tipo "${contentType}" não é elegível para mnemônico visual.` };
  }
  if (items.length < 3) return { ok: false, reason: "Mínimo de 3 itens para gerar mnemônico." };
  if (items.length > 7) return { ok: false, reason: "Máximo de 7 itens. Listas maiores geram poluição visual." };

  const combined = (topic + " " + items.join(" ")).toLowerCase();
  for (const kw of BLOCKED_KEYWORDS) {
    if (combined.includes(kw)) {
      return { ok: false, reason: `Conteúdo contém "${kw}" — não seguro para mnemônico visual.` };
    }
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════
// STEP 1.5 — HYBRID CONCEPT NORMALIZATION
// Deterministic map first, AI fallback only if needed
// ══════════════════════════════════════════════════

const CONCEPT_EQUIVALENCE_MAP: Record<string, string> = {
  "pr prolongado": "bav de 1º grau",
  "bloqueio av de primeiro grau": "bav de 1º grau",
  "bloqueio av 1o grau": "bav de 1º grau",
  "bav 1 grau": "bav de 1º grau",
  "bav primeiro grau": "bav de 1º grau",
  "bloqueio av total": "bav total",
  "bavt": "bav total",
  "bav 3 grau": "bav total",
  "bav de 3º grau": "bav total",
  "bav terceiro grau": "bav total",
  "wenckebach": "mobitz i",
  "bloqueio av mobitz i": "mobitz i",
  "bav mobitz i": "mobitz i",
  "bloqueio av mobitz ii": "mobitz ii",
  "bav mobitz ii": "mobitz ii",
  "iam com supra": "stemi",
  "infarto com supra": "stemi",
  "iam com supra de st": "stemi",
  "infarto com supradesnivelamento de st": "stemi",
  "iam sem supra": "nstemi",
  "infarto sem supra": "nstemi",
  "hiperglicemia": "glicose elevada",
  "glicemia elevada": "glicose elevada",
  "hipoglicemia": "glicose baixa",
  "glicemia baixa": "glicose baixa",
  "taquicardia ventricular": "tv",
  "fibrilação ventricular": "fv",
  "fibrilação atrial": "fa",
  "flutter atrial": "fla",
  "taquicardia supraventricular": "tsv",
  "tsvp": "tsv",
  "edema agudo de pulmão": "eap",
  "edema pulmonar agudo": "eap",
  "insuficiência cardíaca congestiva": "icc",
  "insuficiencia cardiaca congestiva": "icc",
  "tromboembolismo pulmonar": "tep",
  "embolia pulmonar": "tep",
  "acidente vascular cerebral": "avc",
  "acidente vascular encefálico": "avc",
  "ave": "avc",
  "doença pulmonar obstrutiva crônica": "dpoc",
  "doenca pulmonar obstrutiva cronica": "dpoc",
  "síndrome coronariana aguda": "sca",
  "sindrome coronariana aguda": "sca",
  "pressão arterial elevada": "hipertensão",
  "pa elevada": "hipertensão",
  "pressão alta": "hipertensão",
  "has": "hipertensão",
  "diabetes mellitus": "dm",
  "diabetes mellitus tipo 2": "dm2",
  "dm tipo 2": "dm2",
  "diabetes mellitus tipo 1": "dm1",
  "dm tipo 1": "dm1",
};

interface HybridNormResult {
  ok: boolean;
  cleanedItems: string[];
  removedItems: string[];
  replacements: Array<{
    original: string;
    replacedBy: string;
    reason: string;
    source: "deterministic" | "ai";
  }>;
  usedAI: boolean;
  blocked: boolean;
  error?: string;
}

async function normalizeMnemonicItemsHybrid(
  items: string[],
  apiKey: string,
  topic?: string,
  subtopic?: string,
): Promise<HybridNormResult> {
  const replacements: HybridNormResult["replacements"] = [];
  const removedItems: string[] = [];

  // ── PHASE 1: Normalize via deterministic map ──
  const normalized: string[] = [];
  const seenCanonical = new Map<string, string>(); // canonical -> original display form

  for (const raw of items) {
    const key = raw.toLowerCase().trim();
    const canonical = CONCEPT_EQUIVALENCE_MAP[key] || key;

    if (canonical !== key && !CONCEPT_EQUIVALENCE_MAP[key]) {
      // No mapping found, keep as-is
    }

    if (CONCEPT_EQUIVALENCE_MAP[key]) {
      replacements.push({
        original: raw,
        replacedBy: canonical,
        reason: `Mapa determinístico: "${raw}" → "${canonical}"`,
        source: "deterministic",
      });
    }

    if (seenCanonical.has(canonical)) {
      // Duplicate after normalization — remove
      removedItems.push(raw);
      continue;
    }

    seenCanonical.set(canonical, CONCEPT_EQUIVALENCE_MAP[key] ? canonical : raw);
    normalized.push(CONCEPT_EQUIVALENCE_MAP[key] ? canonical : raw);
  }

  if (replacements.length > 0 || removedItems.length > 0) {
    console.log("mnemonic_items_normalized_deterministic", { replacements, removedItems });
  }

  // Check minimum after deterministic pass
  if (normalized.length < 3) {
    console.log("mnemonic_items_blocked", { reason: "below_minimum_after_deterministic", normalized });
    return {
      ok: false, cleanedItems: normalized, removedItems, replacements,
      usedAI: false, blocked: true,
      error: "Lista contém itens redundantes demais. Após normalização, restam menos de 3 itens únicos.",
    };
  }

  // ── PHASE 2: AI fallback for remaining items not in map ──
  // Only invoke AI if we have 2+ items that weren't resolved by the map
  const unmappedItems = normalized.filter(it => {
    const key = it.toLowerCase().trim();
    return !Object.values(CONCEPT_EQUIVALENCE_MAP).includes(key);
  });

  // If all items were resolved deterministically or there are fewer than 2 unmapped, skip AI
  if (unmappedItems.length < 2) {
    return { ok: true, cleanedItems: normalized, removedItems, replacements, usedAI: false, blocked: false };
  }

  // AI check: pairwise equivalence only for unmapped items
  try {
    const aiPrompt = `Você é um especialista médico. Verifique se algum par de itens abaixo é conceitualmente equivalente (um é definição ou sinônimo do outro).

LISTA:
${unmappedItems.map((it, i) => `${i + 1}. ${it}`).join("\n")}
${topic ? `\nTEMA: ${topic}` : ""}${subtopic ? `\nSUBTEMA: ${subtopic}` : ""}

REGRAS:
- Subtipos diferentes NÃO são equivalentes (Mobitz I ≠ Mobitz II)
- Apenas marque como equivalente se um item é definição direta ou sinônimo clínico do outro

Responda APENAS em JSON:
{"pairs": [{"item_a": "...", "item_b": "...", "equivalent": true, "preferred": "termo preferido", "reason": "curto"}]}

Se nenhum par for equivalente: {"pairs": []}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error("mnemonic_items_blocked", { reason: "ai_call_failed", status: resp.status });
      return {
        ok: false, cleanedItems: normalized, removedItems, replacements,
        usedAI: true, blocked: true,
        error: "Não foi possível validar unicidade conceitual com segurança.",
      };
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("mnemonic_items_blocked", { reason: "ai_parse_failed" });
      return {
        ok: false, cleanedItems: normalized, removedItems, replacements,
        usedAI: true, blocked: true,
        error: "Não foi possível validar unicidade conceitual com segurança.",
      };
    }

    const parsed = JSON.parse(match[0]);
    const pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
    const equivalentPairs = pairs.filter((p: any) => p.equivalent === true);

    if (equivalentPairs.length === 0) {
      console.log("mnemonic_items_normalized_ai", { result: "no_redundancies" });
      return { ok: true, cleanedItems: normalized, removedItems, replacements, usedAI: true, blocked: false };
    }

    // Remove AI-detected redundancies
    const aiRemoved = new Set<string>();
    for (const p of equivalentPairs) {
      const preferred = p.preferred?.trim()?.toLowerCase();
      const itemA = p.item_a?.trim()?.toLowerCase();
      const itemB = p.item_b?.trim()?.toLowerCase();
      if (!preferred || !itemA || !itemB) continue;

      const toRemove = preferred === itemA ? itemB : itemA;
      if (!aiRemoved.has(toRemove)) {
        aiRemoved.add(toRemove);
        const originalForm = normalized.find(it => it.toLowerCase().trim() === toRemove) || toRemove;
        removedItems.push(originalForm);
        replacements.push({
          original: originalForm,
          replacedBy: p.preferred,
          reason: p.reason || "Equivalência detectada por IA",
          source: "ai",
        });
      }
    }

    const finalItems = normalized.filter(it => !aiRemoved.has(it.toLowerCase().trim()));
    console.log("mnemonic_items_normalized_ai", { removedByAI: Array.from(aiRemoved), replacements: replacements.filter(r => r.source === "ai") });

    if (finalItems.length < 3) {
      console.log("mnemonic_items_blocked", { reason: "below_minimum_after_ai" });
      return {
        ok: false, cleanedItems: finalItems, removedItems, replacements,
        usedAI: true, blocked: true,
        error: "Lista contém itens redundantes demais. Após normalização, restam menos de 3 itens únicos.",
      };
    }

    return { ok: true, cleanedItems: finalItems, removedItems, replacements, usedAI: true, blocked: false };
  } catch (e) {
    console.error("mnemonic_items_blocked", { reason: "ai_error", error: e });
    return {
      ok: false, cleanedItems: normalized, removedItems, replacements,
      usedAI: true, blocked: true,
      error: "Não foi possível validar unicidade conceitual com segurança.",
    };
  }
}

// ══════════════════════════════════════════════════
// AI CALL HELPER
// ══════════════════════════════════════════════════

async function callAI(apiKey: string, prompt: string, model = "google/gemini-2.5-flash"): Promise<{ ok: boolean; text?: string; status?: number }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    }),
  });
  if (!resp.ok) return { ok: false, status: resp.status };
  const data = await resp.json();
  return { ok: true, text: data.choices?.[0]?.message?.content || "" };
}

function extractJSON(raw: string): any | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ══════════════════════════════════════════════════
// HASH GENERATOR (SHA-256, deterministic)
// ══════════════════════════════════════════════════

async function generateHash(topic: string, items: string[], contentType: string): Promise<string> {
  const normalized = [
    MNEMONIC_PIPELINE_VERSION,
    topic.toLowerCase().trim(),
    contentType.toLowerCase().trim(),
    ...items.map(i => i.toLowerCase().trim()).sort(),
  ].join("|");
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `mn_${hex.substring(0, 16)}`;
}

// ══════════════════════════════════════════════════
// STEP 2 — GENERATOR PROMPT
// ══════════════════════════════════════════════════

const GENERIC_LETTER_WORDS = new Set([
  "de", "do", "da", "das", "dos", "e", "ou", "sem", "com", "para", "por",
  "o", "a", "os", "as", "um", "uma", "novo", "nova", "patologico", "patologica",
  "sinais", "criterios", "criterio", "onda", "ramo",
]);

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForComparison(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSignificantWords(value: string): string[] {
  return normalizeForComparison(value)
    .split(" ")
    .filter((word) => word && !GENERIC_LETTER_WORDS.has(word));
}

function extractMnemonicLetters(value: string): string[] {
  return stripDiacritics(String(value || ""))
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter(Boolean);
}

function deriveCueLeadLetter(value: string): string {
  return extractSignificantWords(value)[0]?.charAt(0).toUpperCase() || "";
}

function roughStem(word: string): string {
  // Strip common Portuguese suffixes for fuzzy matching
  return word
    .replace(/(oes|oes|ais|eis|ois|uis|ens|oes)$/, "")
    .replace(/(mente|ando|endo|indo|acao|encia|ancia|amento|imento|avel|ivel|oso|osa|ado|ido|ica|ico)$/, "")
    .replace(/(as|es|os|is|ns|s)$/, "");
}

function tokensLooselyMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const minLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (minLength >= 4 && normalizedLeft.slice(0, 4) === normalizedRight.slice(0, 4)) return true;

  // Stem-based matching for Portuguese singular/plural, verb forms etc.
  const stemL = roughStem(normalizedLeft);
  const stemR = roughStem(normalizedRight);
  if (stemL.length >= 3 && stemR.length >= 3 && stemL === stemR) return true;

  return false;
}

function cueWordMatchesOriginalItem(cueWord: string, item: string): boolean {
  const cueTokens = extractSignificantWords(cueWord);
  const itemTokens = extractSignificantWords(item);

  if (cueTokens.length === 0 || itemTokens.length === 0) return false;

  return cueTokens.some((cueToken) =>
    itemTokens.some((itemToken) => tokensLooselyMatch(cueToken, itemToken))
  );
}

function phraseContainsCueWord(phraseWords: string[], cueWord: string): boolean {
  const cueTokens = extractSignificantWords(cueWord);
  if (cueTokens.length === 0) return false;

  return cueTokens.some((cueToken) =>
    phraseWords.some((phraseWord) => tokensLooselyMatch(phraseWord, cueToken))
  );
}

function deriveExpectedLetter(item: string): string {
  return deriveAcceptableLetters(item)[0] || "X";
}

function deriveAcceptableLetters(item: string): string[] {
  const normalized = normalizeForComparison(item);
  const letters: string[] = [];

  // Special medical term overrides
  if (/\bonda q\b|\bq patologic/.test(normalized)) letters.push("Q");
  if (/\bsupradesnivelamento\b|\bsupra\b/.test(normalized)) letters.push("S");
  if (/\binfradesnivelamento\b|\binfra\b/.test(normalized)) letters.push("I");
  if (/\bbloqueio\s+de?\s*ramo\s+esquerdo\b|\bbre\b/.test(normalized)) letters.push("B");
  if (/\bbav\b|\bbloqueio av\b/.test(normalized)) letters.push("B");
  if (/\bmobitz\b/.test(normalized)) letters.push("M");
  if (/\bkillip\b/.test(normalized)) letters.push("K");
  if (/\bstemi\b/.test(normalized)) letters.push("S");
  if (/\bnstemi\b/.test(normalized)) letters.push("N");
  if (letters.length > 0) return [...new Set(letters)];

  // Check for acronym/sigla
  const rawSigla = item.match(/\b[A-ZÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ][A-ZÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ0-9-]{1,}\b/u)?.[0];
  if (rawSigla) return [stripDiacritics(rawSigla).charAt(0).toUpperCase()];

  // All significant words' first letters are acceptable
  const tokens = normalized.split(" ").filter(Boolean);
  const significantTokens = tokens.filter((token) => !GENERIC_LETTER_WORDS.has(token));
  if (significantTokens.length > 0) {
    return [...new Set(significantTokens.map((t) => t.charAt(0).toUpperCase()))];
  }

  return [tokens[0]?.charAt(0)?.toUpperCase() || item.trim().charAt(0)?.toUpperCase() || "X"];
}

function deriveRequiredAnchors(item: string): string[] {
  const normalized = normalizeForComparison(item);
  const anchors: string[] = [];

  if (/\bonda q\b|\bq patologic/.test(normalized)) anchors.push("q");
  if (/\bsupradesnivelamento\b|\binfradesnivelamento\b|\bst\b/.test(normalized)) anchors.push("st");
  if (/\bbloqueio\s+de?\s*ramo\s+esquerdo\b|\bbre\b/.test(normalized)) anchors.push("ramo esquerdo");
  if (/\bnovo\b/.test(normalized)) anchors.push("novo");
  if (/\bb3\b/.test(normalized)) anchors.push("b3");

  return anchors;
}

function buildGeneratorPrompt(topic: string, items: string[], contentType: string, attempt = 1, previousFeedback?: string): string {
  const retryBlock = attempt > 1 && previousFeedback
    ? `\n⚠️ TENTATIVA ${attempt} — O mnemônico anterior foi REJEITADO:\n"${previousFeedback}"\nVocê DEVE corrigir os problemas apontados. Gere um mnemônico COMPLETAMENTE DIFERENTE.\n`
    : "";
  const strictCoverage = STRICT_COVERAGE_TYPES.has(contentType);
  const coverageBlock = strictCoverage
    ? `

═══ COBERTURA ESTRUTURAL OBRIGATÓRIA ═══

- A phrase DEVE ter EXATAMENTE ${items.length} palavras-chave significativas (uma por item)
- Cada palavra-chave da phrase deve usar o MESMO termo do campo items_mapped.word
- Cada items_mapped.word deve reaproveitar o termo nuclear do item original (ex.: "bordas", "febre", "linfangite") — NÃO use palavras decorativas ou vagas
- A ordem da phrase deve seguir a mesma ordem do items_mapped e da sigla
- Se um item não couber fielmente na sigla + phrase, regenere até caber — não force uma associação frouxa`
    : `

═══ COBERTURA ═══

- A phrase deve reforçar claramente a sigla com palavras-chave distintas
- Evite palavras decorativas que não apontem para o item médico real`;

  const letterHints = items
    .map((item, index) => {
      const acceptable = deriveAcceptableLetters(item);
      return `${index + 1}. ${item} → letras aceitas: ${acceptable.join(" ou ")}`;
    })
    .join("\n");

  return `Você é um criador de mnemônicos médicos MEMORÁVEIS para estudantes de residência.
${retryBlock}
TEMA: "${topic}"
ITENS PARA MEMORIZAR:
${letterHints}

═══ PRIORIDADE #1: O MNEMÔNICO DEVE FAZER SENTIDO ═══

O objetivo principal é criar uma PALAVRA ou FRASE CURTA que:
1. Faça sentido em português (uma palavra real, nome próprio, sigla conhecida, ou frase que conta uma mini-história)
2. Seja FÁCIL DE LEMBRAR — algo que grude na memória
3. Cada letra remeta claramente ao item correspondente

EXEMPLOS DE MNEMÔNICOS BOM vs RUIM:

✅ BOM: "SOQI" → Supra ST, Onda Q, Inversão T (parece "Soqui" — fácil de falar)
✅ BOM: "SALVA" → para 5 itens de tratamento (palavra real, memorável)
✅ BOM: "MICO" → para 4 critérios (palavra engraçada, gruda na cabeça)
✅ BOM: "DOR" → Déficit focal, Onset (tempo), Ressonância/TC
❌ RUIM: "STIQB" → letras sem sentido, impossível lembrar
❌ RUIM: "XZWTK" → não forma nada reconhecível
❌ RUIM: Frase de 15 palavras rebuscadas que ninguém lembra

═══ TÉCNICAS PERMITIDAS ═══

- Formar uma PALAVRA REAL em português (melhor opção)
- Formar um NOME PRÓPRIO que soe natural (ex: "SARA", "DAVI")
- Criar uma FRASE CURTA memorável (máx 6-8 palavras) onde as iniciais das palavras-chave correspondem aos itens
- Usar humor leve ou imagens absurdas (técnica de memória comprovada)
- Inverter a ordem dos itens se isso criar uma palavra melhor (indique a ordem no mapeamento)
${coverageBlock}

═══ REGRAS DE QUALIDADE ═══

- A sigla DEVE ter EXATAMENTE ${items.length} letras (uma por item)
- Cada letter em items_mapped deve corresponder à letra indicada acima
- A sigla final DEVE ser idêntica à sequência das letras em items_mapped (sem autoajustes implícitos)
- Cada item original deve aparecer fielmente no mapeamento
- NÃO invente itens que não estão na lista
- Cada items_mapped.word deve ser curto (1-2 palavras) e semanticamente colado ao item original
- Os símbolos visuais devem ser concretos e distintos entre si
- A cena visual deve ser uma imagem mental única e vívida

═══ REGRAS CLÍNICAS ═══

- NÃO distorça conceitos médicos
- NÃO omita qualificadores importantes (graus, tipos, localizações)
- O campo original_item deve repetir o item original com fidelidade máxima

Responda APENAS em JSON válido:
{
  "mnemonic_word": "PALAVRA/SIGLA memorável com ${items.length} letras",
  "phrase": "Frase curta e memorável que ajuda a lembrar a sigla",
  "items_mapped": [
    {"letter": "X", "word": "palavra-chave curta usada literalmente na phrase e colada ao item original", "original_item": "item original completo", "symbol": "objeto visual concreto", "symbol_reason": "por que esse símbolo representa o conceito"}
  ],
  "scene_description": "Cena visual única e vívida (1-2 frases)"
}`;
}

// ══════════════════════════════════════════════════
// STEP 3 — MEDICAL AUDITOR PROMPT
// ══════════════════════════════════════════════════

function buildMedicalAuditorPrompt(topic: string, items: string[], generated: any, contentType: string): string {
  const strictCoverage = STRICT_COVERAGE_TYPES.has(contentType);
  const strictCoverageBlock = strictCoverage
    ? `

TIPO SENSÍVEL: para este tipo de conteúdo, cada palavra-chave da phrase deve permanecer semanticamente colada ao item original. Não aceite palavras vagas ou ornamentais (ex.: "aguda", "forte", "bonita") se elas não forem o núcleo do item médico.`
    : "";

  return `Você é um auditor médico sênior. Avalie o mnemônico gerado com RIGOR CLÍNICO.

TEMA: "${topic}"
LISTA ORIGINAL:
${items.map((it, i) => `${i + 1}. ${it}`).join("\n")}

MNEMÔNICO GERADO:
- Sigla: ${generated.mnemonic_word}
- Frase: ${generated.phrase}
- Mapeamento: ${JSON.stringify(generated.items_mapped)}
${strictCoverageBlock}

VERIFIQUE COM RIGOR:
1. COBERTURA OBRIGATÓRIA: Cada item da lista original DEVE estar representado na sigla (mnemonic_word). Se algum item não tem sua letra correspondente na sigla, é OMISSÃO CRÍTICA — reprove imediatamente.
2. OMISSÃO: Algum item da lista original foi omitido ou mal representado? Não basta aparecer apenas no items_map — o item deve estar no NÚCLEO do mnemônico (sigla + frase), com uma pista específica e fiel.
3. DISTORÇÃO: Algum conceito médico foi simplificado de forma que mude seu significado clínico?
4. ASSOCIAÇÃO FALSA: Algum símbolo visual pode induzir associação médica incorreta?
5. RISCO CLÍNICO: O mnemônico pode levar alguém a memorizar algo errado que cause erro clínico?
6. FIDELIDADE: Cada item do mnemônico corresponde fielmente ao item original?

REGRA ABSOLUTA: Se a sigla "${generated.mnemonic_word}" tem MENOS letras do que a lista original (${items.length} itens), é OMISSÃO — reprove com critical_risk = true.
REGRA ABSOLUTA: O items_map NÃO substitui a sigla. Um item que aparece só no mapeamento mas não na sigla é considerado OMITIDO.

Responda APENAS em JSON válido:
{
  "approved": true/false,
  "score": 0-100,
  "critical_risk": true/false,
  "issues": [
    {"type": "omission|distortion|false_association|clinical_risk|fidelity|coverage_gap", "item": "qual item", "description": "descrição do problema", "severity": "low|medium|high|critical"}
  ],
  "summary": "resumo da avaliação médica"
}`;
}

// ══════════════════════════════════════════════════
// STEP 4 — PEDAGOGICAL AUDITOR PROMPT
// ══════════════════════════════════════════════════

function buildPedagogicalAuditorPrompt(topic: string, items: string[], generated: any, contentType: string): string {
  const strictCoverage = STRICT_COVERAGE_TYPES.has(contentType);
  const strictCoverageBlock = strictCoverage
    ? `

TIPO SENSÍVEL: para este conteúdo, a phrase deve fornecer uma pista explícita e separada para CADA item. Se a phrase usar palavras decorativas ou deixar itens implícitos, considere cobertura insuficiente.`
    : "";

  return `Você é um auditor pedagógico especializado em técnicas de memorização visual para provas médicas.

TEMA: "${topic}"
LISTA ORIGINAL (${items.length} itens):
${items.map((it, i) => `${i + 1}. ${it}`).join("\n")}

MNEMÔNICO GERADO:
- Sigla: ${generated.mnemonic_word}
- Frase: ${generated.phrase}
- Cena: ${generated.scene_description}
- Símbolos: ${JSON.stringify(generated.items_mapped?.map((m: any) => ({ item: m.original_item, symbol: m.symbol })))}
${strictCoverageBlock}

AVALIE:
1. COBERTURA NA SIGLA: A sigla "${generated.mnemonic_word}" tem ${String(generated.mnemonic_word || "").replace(/[^A-Za-z]/g, "").length} letras para ${items.length} itens. Se a sigla tem MENOS letras do que itens, reprove — o aluno não conseguirá lembrar todos os itens pela sigla.
2. CLAREZA: Um aluno consegue entender a cena visual em menos de 10 segundos?
3. REVISABILIDADE: Serve para revisão rápida pré-prova?
4. MEMORABILIDADE: A frase é fácil de lembrar e falar?
5. POLUIÇÃO VISUAL: A cena tem elementos demais ou sobrepostos?
6. AMBIGUIDADE: Dois símbolos podem ser confundidos entre si?
7. UTILIDADE REAL: Isso ajuda a decorar para prova ou é só efeito visual?
8. COMPLETUDE: A sigla + frase carregam TODOS os itens da lista, ou dão falsa sensação de completude?

Responda APENAS em JSON válido:
{
  "approved": true/false,
  "score": 0-100,
  "issues": [
    {"type": "clarity|revisability|memorability|visual_pollution|ambiguity|low_utility|incomplete_coverage", "description": "descrição do problema", "severity": "low|medium|high"}
  ],
  "summary": "resumo da avaliação pedagógica"
}`;
}

// ══════════════════════════════════════════════════
// STEP 5 — RECONCILER
// ══════════════════════════════════════════════════

interface AuditResult {
  approved: boolean;
  score: number;
  critical_risk?: boolean;
  issues: Array<{ type: string; severity: string; description: string }>;
  summary: string;
}

interface DeterministicMnemonicValidationResult {
  ok: boolean;
  reason?: string;
}

function extractInitialLettersFromPhrase(phrase: string): string[] {
  return extractSignificantWords(phrase)
    .map((word) => word.charAt(0).toUpperCase())
    .filter(Boolean);
}

function fuzzyMatchItem(normalizedItem: string, mappedItems: any[]): any | null {
  // Exact match first
  const exact = mappedItems.find((entry: any) => normalizeForComparison(String(entry?.original_item || "")) === normalizedItem);
  if (exact) return exact;

  // Fuzzy: check if the mapped original_item contains or is contained in the item
  const fuzzy = mappedItems.find((entry: any) => {
    const mappedNorm = normalizeForComparison(String(entry?.original_item || ""));
    return mappedNorm.includes(normalizedItem) || normalizedItem.includes(mappedNorm) ||
      // Check word overlap (at least 60% of words match)
      (() => {
        const itemWords = normalizedItem.split(" ").filter(w => w.length > 2);
        const mappedWords = mappedNorm.split(" ").filter(w => w.length > 2);
        if (itemWords.length === 0) return false;
        const matching = itemWords.filter(w => mappedWords.includes(w));
        return matching.length / itemWords.length >= 0.6;
      })();
  });
  return fuzzy || null;
}

function validateGeneratedMnemonicDeterministically(items: string[], generated: any, contentType?: string): DeterministicMnemonicValidationResult {
  if (!generated || !Array.isArray(generated.items_mapped)) {
    return { ok: false, reason: "JSON inválido ou items_mapped ausente." };
  }

  if (generated.items_mapped.length !== items.length) {
    return { ok: false, reason: `Número de itens incorreto: gerou ${generated.items_mapped.length}, esperado ${items.length}.` };
  }

  const strictCoverage = !!contentType && STRICT_COVERAGE_TYPES.has(contentType);
  const normalizedOriginals = new Set(items.map((item) => normalizeForComparison(item)));
  const mappedOriginals = new Set<string>();
  const validatedMappings: Array<{ item: string; mapped: any; letter: string; cueWord: string }> = [];

  for (const item of items) {
    const normalizedItem = normalizeForComparison(item);
    const mapped = fuzzyMatchItem(normalizedItem, generated.items_mapped);

    if (!mapped) {
      return { ok: false, reason: `O item obrigatório "${item}" não foi representado fielmente em items_mapped.` };
    }

    mappedOriginals.add(normalizedItem);

    const acceptableLetters = deriveAcceptableLetters(item);
    const cueWord = String(mapped.word || "").trim();
    if (!cueWord) {
      return { ok: false, reason: `O item "${item}" veio sem palavra-chave em items_mapped.word.` };
    }

    const cueLeadLetter = deriveCueLeadLetter(cueWord);
    if (!cueLeadLetter) {
      return { ok: false, reason: `Não foi possível extrair uma letra válida da palavra-chave "${cueWord}".` };
    }

    let actualLetter = String(mapped.letter || "").trim().charAt(0).toUpperCase();
    if (!actualLetter || actualLetter !== cueLeadLetter) {
      if (acceptableLetters.includes(cueLeadLetter)) {
        console.log(`Aligning letter with cue word for "${item}": ${actualLetter || "(empty)"} → ${cueLeadLetter}`);
        mapped.letter = cueLeadLetter;
        actualLetter = cueLeadLetter;
      }
    }

    if (!acceptableLetters.includes(actualLetter)) {
      return { ok: false, reason: `A letra "${actualLetter || "?"}" não cobre fielmente o item "${item}".` };
    }

    if (cueLeadLetter !== actualLetter) {
      return { ok: false, reason: `A palavra-chave "${cueWord}" não corresponde à letra "${actualLetter}" no item "${item}".` };
    }

    if (strictCoverage && !cueWordMatchesOriginalItem(cueWord, item)) {
      return { ok: false, reason: `A palavra-chave "${cueWord}" ficou solta demais em relação ao item clínico "${item}".` };
    }

    validatedMappings.push({ item, mapped, letter: actualLetter, cueWord });

    const anchorBundle = normalizeForComparison([
      mapped.word,
      mapped.original_item,
      mapped.symbol,
      mapped.symbol_reason,
      generated.phrase,
      generated.scene_description,
    ].filter(Boolean).join(" "));

    // Anchor check: warn but don't reject
    const missingAnchors: string[] = [];
    for (const anchor of deriveRequiredAnchors(item)) {
      if (!anchorBundle.includes(normalizeForComparison(anchor))) {
        missingAnchors.push(anchor);
      }
    }
    if (missingAnchors.length > 0) {
      console.log(`Anchor warning for "${item}": missing ${missingAnchors.join(", ")} (non-blocking)`);
    }
  }

  if (mappedOriginals.size !== normalizedOriginals.size) {
    return { ok: false, reason: "Há itens duplicados ou omitidos no mapeamento final." };
  }

  // ── COVERAGE CHECK: sigla must contain letters for all items ──
  const mappedLetters = validatedMappings.map(({ letter }) => letter);
  const mnemonicLetters = extractMnemonicLetters(generated.mnemonic_word);

  if (mnemonicLetters.length !== items.length) {
    // Auto-fix: rebuild mnemonic_word from validated mapping
    const corrected = mappedLetters.join("");
    console.log(`Auto-correcting mnemonic_word letter count: "${generated.mnemonic_word}" → "${corrected}"`);
    generated.mnemonic_word = corrected;
  } else if (mnemonicLetters.join("") !== mappedLetters.join("")) {
    // Auto-fix: align mnemonic_word to validated mapping order
    const corrected = mappedLetters.join("");
    console.log(`Auto-aligning mnemonic_word: "${generated.mnemonic_word}" → "${corrected}"`);
    generated.mnemonic_word = corrected;
  }

  if (strictCoverage) {
    const phraseWords = extractSignificantWords(String(generated.phrase || ""));
    const phraseLetters = extractInitialLettersFromPhrase(String(generated.phrase || ""));

    if (phraseWords.length !== items.length) {
      return {
        ok: false,
        reason: `Para este tipo de conteúdo, a phrase deve ter exatamente ${items.length} palavras-chave significativas; vieram ${phraseWords.length}.`,
      };
    }

    if (phraseLetters.join("") !== mappedLetters.join("")) {
      return {
        ok: false,
        reason: `A phrase não segue a mesma sequência de letras da sigla (${mappedLetters.join("")}).`,
      };
    }

    const missingCueWords = validatedMappings
      .filter(({ cueWord }) => !phraseContainsCueWord(phraseWords, cueWord))
      .map(({ cueWord, item }) => `"${cueWord}" para "${item}"`);

    if (missingCueWords.length > 0) {
      return {
        ok: false,
        reason: `A phrase não reutilizou claramente as palavras-chave obrigatórias: ${missingCueWords.join(", ")}.`,
      };
    }
  }

  return { ok: true };
}

function hasBlockingCoverageIssue(result: AuditResult): boolean {
  return result.issues.some((issue) => {
    if (["omission", "coverage_gap", "fidelity", "clinical_risk"].includes(issue.type)) {
      return issue.severity === "high" || issue.severity === "critical";
    }

    if (issue.type === "incomplete_coverage") {
      return issue.severity !== "low";
    }

    return false;
  });
}

function reconcileMnemonicAudit(
  medical: AuditResult, pedagogical: AuditResult
): { verdict: "approve" | "reject" | "regenerate"; score: number; reason: string } {
  const avgScore = Math.round((medical.score + pedagogical.score) / 2);
  const blockingCoverageIssue = hasBlockingCoverageIssue(medical) || hasBlockingCoverageIssue(pedagogical);
  const coverageReason = [
    hasBlockingCoverageIssue(medical) ? medical.summary : null,
    hasBlockingCoverageIssue(pedagogical) ? pedagogical.summary : null,
  ].filter(Boolean).join(" | ");

  // Only hard-reject on truly dangerous clinical errors (score < 30)
  if (medical.critical_risk && medical.score < 30) {
    return { verdict: "reject", score: 0, reason: `Risco clínico crítico: ${medical.summary}` };
  }
  if (medical.critical_risk) {
    return { verdict: "regenerate", score: avgScore, reason: `Risco clínico: ${medical.summary}` };
  }
  if (blockingCoverageIssue) {
    return {
      verdict: avgScore < 40 ? "reject" : "regenerate",
      score: avgScore,
      reason: `Cobertura/fidelidade insuficiente: ${coverageReason || "os auditores detectaram omissões relevantes."}`,
    };
  }
  if (!medical.approved && !pedagogical.approved && avgScore < 40) {
    return { verdict: "reject", score: avgScore, reason: "Reprovado por ambos auditores." };
  }
  if (!medical.approved && medical.score < 40) {
    return { verdict: "regenerate", score: avgScore, reason: `Auditor médico reprovou (score ${medical.score}): ${medical.summary}` };
  }
  if (!pedagogical.approved && avgScore < 45) {
    return { verdict: "regenerate", score: avgScore, reason: `Qualidade pedagógica insuficiente: ${pedagogical.summary}` };
  }
  if (avgScore < 50) {
    return { verdict: "regenerate", score: avgScore, reason: "Score combinado abaixo do mínimo (50)." };
  }
  const criticalIssues = [
    ...medical.issues.filter(i => i.severity === "critical"),
    ...pedagogical.issues.filter(i => i.severity === "critical"),
  ];
  if (criticalIssues.length >= 3) {
    return { verdict: "regenerate", score: avgScore, reason: `${criticalIssues.length} problemas críticos detectados.` };
  }
  return { verdict: "approve", score: avgScore, reason: "Aprovado." };
}

// ══════════════════════════════════════════════════
// MAIN HANDLER — UNIFIED PIPELINE
// Supports both manual (source=manual) and adaptive (source=adaptive) flows.
// ══════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      topic, items, contentType,
      // Adaptive/unified fields (optional for backward compat)
      userId, hash: clientHash, source,
      sourceContext,
      forceRegenerate,
    } = body as {
      topic: string; items: string[]; contentType: string;
      userId?: string; hash?: string; source?: "manual" | "adaptive";
      sourceContext?: { topicId?: string; questionId?: string; attemptId?: string };
      forceRegenerate?: boolean;
    };

    if (!topic || !items || !Array.isArray(items) || !contentType) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: topic, items (array), contentType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STEP 1: ELIGIBILITY ──
    const elig = validateMnemonicEligibility(items, contentType, topic);
    if (!elig.ok) {
      return new Response(JSON.stringify({ error: elig.reason, blocked: true, rejected: true }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = getRequiredEnv("LOVABLE_API_KEY");

    // ── STEP 1.5: HYBRID CONCEPT NORMALIZATION ──
    const normResult = await normalizeMnemonicItemsHybrid(items, LOVABLE_API_KEY, topic);
    if (!normResult.ok || normResult.blocked) {
      return new Response(JSON.stringify({
        error: normResult.error || "Itens redundantes detectados",
        rejected: true,
        removedItems: normResult.removedItems,
        replacements: normResult.replacements,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use cleaned items (deduplicated) for the rest of the pipeline
    const cleanedItems = normResult.cleanedItems;

    // Init Supabase client for persistence
    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // ── HASH & CACHE CHECK ──
    const hash = await generateHash(topic, cleanedItems, contentType);

    const { data: existing } = await supabase
      .from("mnemonic_assets")
      .select("id, verdict, topic, mnemonic, phrase, items_map_json, scene_description, image_url, quality_score, review_question, medical_score, pedagogical_score")
      .eq("hash", hash)
      .single();

    if (existing) {
      if (existing.verdict === "rejected") {
        if (forceRegenerate) {
          // Auto-repair: delete rejected cache entry so we can retry
          await supabase.from("mnemonic_assets").delete().eq("id", existing.id);
          console.log("forceRegenerate: cleared rejected cache for hash", hash);
        } else {
          return new Response(JSON.stringify({ rejected: true, error: "Mnemônico previamente rejeitado para estes itens." }), {
            status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Cache hit — return existing approved asset
        const output = buildOutputFromAsset(existing);
        return new Response(JSON.stringify({ ...output, assetId: existing.id, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── STEPS 2-5: GENERATE + AUDIT WITH RETRY ──
    const MAX_ATTEMPTS = 3;
    let lastVerdict: any = null;
    let lastGenerated: any = null;
    let lastMedical: AuditResult | null = null;
    let lastPedagogical: AuditResult | null = null;
    let previousFeedback: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // ── STEP 2: GENERATE MNEMONIC ──
      const genResult = await callAI(LOVABLE_API_KEY, buildGeneratorPrompt(topic, cleanedItems, contentType, attempt, previousFeedback));
      if (!genResult.ok) {
        if (genResult.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos.", rejected: true }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (genResult.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados.", rejected: true }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Generator AI error");
      }

      const generated = extractJSON(genResult.text || "");
      if (!generated || !generated.items_mapped) {
        console.warn(`Attempt ${attempt}: Failed to parse generator output`);
        previousFeedback = "Resposta do gerador inválida. Gere um JSON válido.";
        continue;
      }

      const deterministicValidation = validateGeneratedMnemonicDeterministically(cleanedItems, generated, contentType);
      if (!deterministicValidation.ok) {
        console.warn(`Attempt ${attempt}: Deterministic validation failed — ${deterministicValidation.reason}`);
        previousFeedback = deterministicValidation.reason;
        continue;
      }

      // ── STEPS 3+4: DUAL AUDIT (parallel) ──
      const [medicalResult, pedagogicalResult] = await Promise.all([
        callAI(LOVABLE_API_KEY, buildMedicalAuditorPrompt(topic, cleanedItems, generated, contentType)),
        callAI(LOVABLE_API_KEY, buildPedagogicalAuditorPrompt(topic, cleanedItems, generated, contentType)),
      ]);

      if (!medicalResult.ok || !pedagogicalResult.ok) {
        console.error(`Attempt ${attempt}: Auditor call failed`);
        break; // Don't retry on infra failure
      }

      const medicalAudit = extractJSON(medicalResult.text || "");
      const pedagogicalAudit = extractJSON(pedagogicalResult.text || "");

      if (!medicalAudit || !pedagogicalAudit) {
        console.error(`Attempt ${attempt}: Audit JSON parse failed`);
        break;
      }

      const medical: AuditResult = {
        approved: !!medicalAudit.approved,
        score: Number(medicalAudit.score) || 0,
        critical_risk: !!medicalAudit.critical_risk,
        issues: Array.isArray(medicalAudit.issues) ? medicalAudit.issues : [],
        summary: medicalAudit.summary || "",
      };
      const pedagogical: AuditResult = {
        approved: !!pedagogicalAudit.approved,
        score: Number(pedagogicalAudit.score) || 0,
        issues: Array.isArray(pedagogicalAudit.issues) ? pedagogicalAudit.issues : [],
        summary: pedagogicalAudit.summary || "",
      };

      const verdict = reconcileMnemonicAudit(medical, pedagogical);
      lastVerdict = verdict;
      lastGenerated = generated;
      lastMedical = medical;
      lastPedagogical = pedagogical;

      if (verdict.verdict === "approve") {
        console.log(`Attempt ${attempt}: Approved with score ${verdict.score}`);
        break; // Success!
      }

      // Feed rejection reason back for next attempt
      previousFeedback = verdict.reason;
      console.warn(`Attempt ${attempt}: ${verdict.verdict} — ${verdict.reason}`);

      if (attempt === MAX_ATTEMPTS) break;
    }

    // If no verdict or all attempts failed
    if (!lastVerdict || !lastGenerated || !lastMedical || !lastPedagogical) {
      return new Response(JSON.stringify({ error: "Falha na geração após múltiplas tentativas. Tente novamente.", rejected: true }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generated = lastGenerated;
    const medical = lastMedical;
    const pedagogical = lastPedagogical;
    const verdict = lastVerdict;

    if (verdict.verdict === "reject" || verdict.verdict === "regenerate") {
      // Save rejected to prevent retries
      const { error: rejectedInsertError } = await supabase.from("mnemonic_assets").insert({
        hash,
        topic,
        content_type: contentType,
        items_json: cleanedItems,
        mnemonic: generated.mnemonic_word || "",
        phrase: generated.phrase || "",
        items_map_json: generated.items_mapped || [],
        scene_description: generated.scene_description,
        quality_score: verdict.score,
        medical_score: medical.score,
        pedagogical_score: pedagogical.score,
        verdict: "rejected",
        source_reference: source || "manual",
        review_question: `Quais são os ${cleanedItems.length} itens de "${topic}"?`,
      });

      if (rejectedInsertError) {
        console.warn("Failed to save rejected:", rejectedInsertError);
      }

      const errorMsg = verdict.verdict === "regenerate"
        ? `Qualidade insuficiente após ${MAX_ATTEMPTS} tentativas (${verdict.score}/100): ${verdict.reason}`
        : verdict.reason;

      return new Response(JSON.stringify({
        rejected: true,
        error: errorMsg,
        audit: { medical_score: medical.score, pedagogical_score: pedagogical.score, combined_score: verdict.score },
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STEP 6: IMAGE GENERATION WITH VISUAL AUDIT LOOP ──
    const MAX_IMAGE_ATTEMPTS = 3; // 1 initial + 2 regenerations
    const sceneDesc = generated.scene_description || "cena médica didática";
    const mnemonicWord = generated.mnemonic_word || "";
    const phrase = generated.phrase || "";

    function buildImagePrompt(itemsMapped: any[], scene: string, issues?: any[]): string {
      const symbols = itemsMapped.map((v: any) =>
        `- ${v.symbol}: representa "${v.original_item}" — ${v.symbol_reason || "associação visual direta"}`
      ).join("\n");

      let issuesFix = "";
      if (issues && issues.length > 0) {
        const fixes: string[] = [];
        for (const issue of issues) {
          switch (issue.type) {
            case "missing_item":
              fixes.push(`- OBRIGATÓRIO: adicione explicitamente o elemento visual para "${issue.description}" — ele FALTOU na versão anterior`);
              break;
            case "weak_symbol":
              fixes.push(`- MELHORE: troque o símbolo abstrato por um objeto físico concreto e reconhecível para "${issue.description}"`);
              break;
            case "visual_confusion":
              fixes.push(`- SEPARE MELHOR: os elementos estão sobrepostos ou confusos — cada símbolo deve ocupar seu próprio espaço claro`);
              break;
            case "scene_mismatch":
              fixes.push(`- CORRIJA A CENA: a imagem não corresponde à descrição "${scene}" — recrie seguindo fielmente o conceito`);
              break;
            case "generic_image":
              fixes.push(`- ESPECIFIQUE: a imagem está genérica/decorativa — cada símbolo deve ter relação visual DIRETA com o item médico`);
              break;
          }
        }
        issuesFix = `\n\nCORREÇÕES OBRIGATÓRIAS (a versão anterior falhou nestes pontos):\n${fixes.join("\n")}`;
      }

      return `Create a single cohesive medical mnemonic illustration for the topic "${topic}".

MNEMONIC: "${mnemonicWord}" — "${phrase}"

SCENE CONCEPT: ${scene}

VISUAL ELEMENTS (each must be clearly visible and identifiable):
${symbols}
${issuesFix}

MANDATORY VISUAL RULES:
1. SINGLE UNIFIED SCENE — all elements interact in ONE coherent composition, not separate panels
2. Each symbol must be LARGE, clearly drawn, and visually distinct from the others
3. Use bright, saturated colors — each element gets its own dominant color
4. Style: clean medical infographic / cartoon illustration — professional and educational
5. White or very light background — no gradients, no dark backgrounds
6. NO TEXT, NO LETTERS, NO LABELS, NO NUMBERS anywhere in the image
7. NO overlapping elements — each symbol occupies its own clear space
8. Anatomical/medical elements should be stylized but recognizable (not photorealistic)
9. The composition should tell a visual story that links all elements together
10. High contrast between elements and background for clarity`;
    }

    async function generateImage(prompt: string): Promise<string | null> {
      try {
        const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          return imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
        }
        console.warn("Image generation failed:", imgResp.status);
        return null;
      } catch (e) {
        console.warn("Image generation error:", e);
        return null;
      }
    }

    interface VisualAuditResult {
      approved: boolean;
      score: number;
      issues: Array<{ type: string; description: string }>;
      summary: string;
    }

    async function auditImageVisually(itemsMapped: any[], scene: string, imgUrl: string): Promise<VisualAuditResult | null> {
      const itemsList = itemsMapped.map((v: any) =>
        `- Símbolo esperado: "${v.symbol}" para o item "${v.original_item}"`
      ).join("\n");

      const auditPrompt = `Você é um especialista em ensino visual médico e design instrucional.

Avalie se esta imagem representa corretamente o mnemônico descrito abaixo.

CENA ESPERADA: ${scene}

ELEMENTOS VISUAIS ESPERADOS:
${itemsList}

CRITÉRIOS DE AVALIAÇÃO:
1. COBERTURA: Todos os itens/símbolos esperados estão representados visualmente?
2. UNICIDADE: Cada item tem um símbolo visualmente distinto e diferenciado?
3. CORRESPONDÊNCIA: A imagem corresponde à descrição da cena?
4. CLAREZA: Elementos separados, sem poluição visual, sem sobreposição forte?
5. FORÇA PEDAGÓGICA: Os símbolos ajudam na memorização ou são genéricos/decorativos?

Responda APENAS em JSON válido:
{
  "approved": true ou false,
  "score": 0 a 100,
  "issues": [
    {"type": "missing_item|weak_symbol|visual_confusion|scene_mismatch|generic_image", "description": "descrição curta do problema"}
  ],
  "summary": "resumo curto da avaliação"
}`;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: auditPrompt },
                { type: "image_url", image_url: { url: imgUrl } },
              ],
            }],
            temperature: 0.2,
          }),
        });

        if (!resp.ok) {
          console.warn("Visual audit call failed:", resp.status);
          return null;
        }

        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || "";
        const parsed = extractJSON(text);
        if (!parsed) {
          console.warn("Visual audit JSON parse failed");
          return null;
        }

        return {
          approved: !!parsed.approved,
          score: Number(parsed.score) || 0,
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          summary: parsed.summary || "",
        };
      } catch (e) {
        console.warn("Visual audit error:", e);
        return null;
      }
    }

    // ── Visual audit loop ──
    let imageUrl: string | null = null;
    let visualScore: number | null = null;
    let visualSummary = "";
    let visualRegenCount = 0;
    let imagePromptOriginal = "";
    let imagePromptRefined = "";
    let assetVerdict = "approved_visual";

    const initialPrompt = buildImagePrompt(generated.items_mapped || [], sceneDesc);
    imagePromptOriginal = initialPrompt;

    for (let imgAttempt = 0; imgAttempt < MAX_IMAGE_ATTEMPTS; imgAttempt++) {
      const currentPrompt = imgAttempt === 0 ? initialPrompt : imagePromptRefined;
      
      console.log(`Image attempt ${imgAttempt + 1}/${MAX_IMAGE_ATTEMPTS}`);
      const generatedImage = await generateImage(currentPrompt);

      if (!generatedImage) {
        console.warn(`Image attempt ${imgAttempt + 1}: generation returned null`);
        if (imgAttempt < MAX_IMAGE_ATTEMPTS - 1) {
          visualRegenCount++;
          continue;
        }
        break;
      }

      // Audit the image
      const audit = await auditImageVisually(generated.items_mapped || [], sceneDesc, generatedImage);

      if (!audit) {
        // Audit infra failure — fail-closed: don't use this image
        console.warn(`Image attempt ${imgAttempt + 1}: audit failed (infra) — discarding`);
        if (imgAttempt < MAX_IMAGE_ATTEMPTS - 1) {
          visualRegenCount++;
          continue;
        }
        break;
      }

      visualScore = audit.score;
      visualSummary = audit.summary;

      console.log(`Image attempt ${imgAttempt + 1}: visual_score=${audit.score}, approved=${audit.approved}`);

      if (audit.score >= 70) {
        imageUrl = generatedImage;
        console.log(`Image approved (score ${audit.score})`);
        break;
      }

      // Image not good enough — prepare improved prompt for next attempt
      if (imgAttempt < MAX_IMAGE_ATTEMPTS - 1) {
        visualRegenCount++;
        imagePromptRefined = buildImagePrompt(generated.items_mapped || [], sceneDesc, audit.issues);
        console.warn(`Image regenerating: issues=${JSON.stringify(audit.issues.map(i => i.type))}`);
      }
    }

    // Decision: if no approved image after all attempts → text-only fallback
    if (!imageUrl) {
      assetVerdict = "approved_text_map_only";
      console.warn(`Image failed after ${visualRegenCount + 1} attempts — fallback to text-only (score: ${visualScore})`);
    }

    // assetVerdict already set in visual audit loop above
    const reviewQuestion = `Usando o mnemônico "${generated.mnemonic_word}", quais são os ${cleanedItems.length} itens de "${topic}"?`;

    // ── STEP 7: PERSIST TO mnemonic_assets (FAIL-CLOSED) ──
    const { data: inserted, error: insertErr } = await supabase
      .from("mnemonic_assets")
      .insert({
        hash,
        topic,
        content_type: contentType,
        items_json: cleanedItems,
        mnemonic: generated.mnemonic_word,
        phrase: generated.phrase,
        items_map_json: generated.items_mapped,
        scene_description: generated.scene_description,
        image_url: imageUrl,
        quality_score: verdict.score,
        medical_score: medical.score,
        pedagogical_score: pedagogical.score,
        verdict: assetVerdict,
        source_reference: source || "manual",
        review_question: reviewQuestion,
        image_prompt_original: imagePromptOriginal,
        image_prompt_refined: imagePromptRefined || null,
        visual_score: visualScore,
        visual_audit_summary: visualSummary || null,
        visual_regeneration_count: visualRegenCount,
      })
      .select("id")
      .single();

    // FIX #1: FAIL-CLOSED — if persistence fails, reject entirely
    if (insertErr || !inserted?.id) {
      console.error("Insert failed (fail-closed):", insertErr);
      return new Response(JSON.stringify({
        rejected: true,
        error: "Falha ao salvar mnemônico no banco. Tente novamente.",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const assetId = inserted.id;

    // ── BUILD OUTPUT ──
    const warning = verdict.score < 80
      ? "⚠️ Mnemônico aprovado com ressalvas. Revise antes de usar."
      : null;

    const output = {
      topic,
      mnemonic: generated.mnemonic_word,
      phrase: generated.phrase,
      items_map: (generated.items_mapped || []).map((im: any) => ({
        letter: im.letter,
        word: im.word,
        original_item: im.original_item,
        symbol: im.symbol || null,
        symbol_reason: im.symbol_reason || null,
      })),
      scene_description: generated.scene_description || "",
      image_url: imageUrl,
      quality_score: verdict.score,
      warning,
      review_question: reviewQuestion,
      audit: {
        medical_score: medical.score,
        pedagogical_score: pedagogical.score,
        medical_summary: medical.summary,
        pedagogical_summary: pedagogical.summary,
        verdict: verdict.verdict,
      },
      assetId,
      cached: false,
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-mnemonic error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno", rejected: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════════════════════════════════════════════════
// HELPER: Build output from cached asset
// ══════════════════════════════════════════════════

function buildOutputFromAsset(asset: any) {
  const itemsMap = Array.isArray(asset.items_map_json) ? asset.items_map_json : [];
  return {
    topic: asset.topic,
    mnemonic: asset.mnemonic,
    phrase: asset.phrase,
    items_map: itemsMap.map((im: any) => ({
      letter: im.letter,
      word: im.word,
      original_item: im.original_item,
      symbol: im.symbol || null,
      symbol_reason: im.symbol_reason || null,
    })),
    scene_description: asset.scene_description || "",
    image_url: asset.image_url,
    quality_score: asset.quality_score,
    warning: asset.quality_score < 80 ? "⚠️ Mnemônico aprovado com ressalvas." : null,
    review_question: asset.review_question,
    audit: {
      medical_score: asset.medical_score,
      pedagogical_score: asset.pedagogical_score,
      medical_summary: "",
      pedagogical_summary: "",
      verdict: "approve",
    },
  };
}