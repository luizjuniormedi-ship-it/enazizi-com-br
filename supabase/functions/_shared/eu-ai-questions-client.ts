/**
 * Cliente Claude (proxy eu-ai/Railway) para GERADORES DE QUESTÕES (simulados).
 * Schema diferente do tutor: array JSON de questões {block, statement, options[4], correct_index, explanation, topic, difficulty_level}.
 *
 * Piloto controlado (Sprint 2.3): default OFF. Ative com USE_CLAUDE_PRIMARY_SIMULADO=true.
 * Retorna objeto Response-like (ok + json()) compatível com o consumo atual do professor-simulado,
 * para evitar refactor do parser existente.
 */

const EU_AI_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";
const EU_AI_TIMEOUT_MS = 55_000;

const JSON_TAIL = `

# REGRAS DE SAÍDA OBRIGATÓRIAS (NÃO NEGOCIÁVEIS)
1. Responda APENAS com um array JSON válido entre <json> e </json>. NÃO escreva nada antes ou depois. Sem \`\`\`json, sem comentários.
2. Cada "statement" DEVE ter NO MÍNIMO 450 caracteres — caso clínico COMPLETO em pt-BR (identificação do paciente, HDA detalhada, antecedentes, exame físico com sinais vitais, exames complementares relevantes) e terminar com pergunta objetiva.
3. Cada questão DEVE ter EXATAMENTE 4 opções no formato "A) ...", "B) ...", "C) ...", "D) ...".
4. "explanation" DEVE ter no mínimo 200 caracteres, em pt-BR, citando Harrison/Nelson/Sabiston/UpToDate.
5. NUNCA use inglês, LaTeX ($x$, \\times), referências a imagens/figuras, ou mencione provedor/modelo/identidade de IA.
6. Responda apenas como gerador médico ENAZIZI.

<json>
[ { "block": "...", "statement": "<>=450 chars em pt-BR>", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct_index": 0, "explanation": "<>=200 chars em pt-BR com bibliografia>", "topic": "...", "difficulty_level": "easy|medium|hard" } ]
</json>`;

export interface ClaudeSimResponse {
  ok: boolean;
  status: number;
  _claude: true;
  text: () => Promise<string>;
  json: () => Promise<{ choices: Array<{ message: { content: string } }> }>;
}

export function isClaudePrimarySimuladoEnabled(): boolean {
  const v = Deno.env.get("USE_CLAUDE_PRIMARY_SIMULADO");
  if (!v) return false;
  return v.toLowerCase() === "true" || v === "1";
}

export async function claudeFetchQuestions(prompt: string, topicHint = "simulado", expectedCount = 0): Promise<ClaudeSimResponse> {
  const topicLock = `\n\n# TRAVA DE TEMA (OBRIGATÓRIO)\nO campo "topic" de TODA questão DEVE ser EXATAMENTE: "${topicHint}". Não use sinônimos, abreviações, nem o nome da especialidade pai. Use a string literal "${topicHint}".`;
  const countLock = expectedCount > 0
    ? `\n\n# QUANTIDADE OBRIGATÓRIA\nVocê DEVE retornar EXATAMENTE ${expectedCount} objeto(s) dentro do array JSON. Nem mais, nem menos. Se gerar menos, a resposta será rejeitada.`
    : `\n\n# QUANTIDADE OBRIGATÓRIA\nSempre retorne um ARRAY JSON, mesmo que com 1 elemento. NUNCA retorne um objeto JSON solto.`;
  const augmented = `${prompt}${topicLock}${countLock}${JSON_TAIL}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${EU_AI_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: augmented,
        topic: topicHint,
        stream: false,
        context: { source: "professor-simulado", format: "json_array" },
      }),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 599,
      _claude: true,
      text: async () => `CLAUDE_NETWORK_FAIL: ${e?.message || e}`,
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      _claude: true,
      text: async () => raw.slice(0, 500),
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
  }

  let envelope: any = {};
  try { envelope = JSON.parse(raw); } catch { /* keep empty */ }
  const message: string = envelope?.message || envelope?.content || envelope?.response || raw;

  console.log(`[CLAUDE_RAW_RESPONSE] chars=${message.length} preview="${message.slice(0, 200).replace(/\n/g, " ")}"`);
  console.log(`[CLAUDE_EXTRACTION_START] topic=${topicHint} expected=${expectedCount}`);

  // Parser resiliente — cobre 6 cenários: array, objeto solto, NDJSON, texto+json, <json>...</json>, ```json```
  const objects = extractAllJsonObjects(message);
  const jsonText = objects.length > 0 ? `[${objects.map(o => JSON.stringify(o)).join(",")}]` : "[]";

  console.log(`[CLAUDE_EXTRACTION_END] objects_found=${objects.length}`);
  console.log(`[CLAUDE_OBJECTS_FOUND] count=${objects.length} expected=${expectedCount}`);
  if (expectedCount > 0 && objects.length !== expectedCount) {
    console.warn(`[COUNT_MISMATCH] requested=${expectedCount} parsed=${objects.length}`);
  }
  if (objects.length === 0) {
    console.warn(`[CLAUDE_SIM_NO_JSON] len=${message.length} head="${message.slice(0, 500).replace(/\n/g, " ")}"`);
  } else {
    console.log(`[CLAUDE_SIM_PARSED] objects=${objects.length} jsonLen=${jsonText.length}`);
  }

  return {
    ok: true,
    status: 200,
    _claude: true,
    text: async () => message,
    json: async () => ({ choices: [{ message: { content: jsonText } }] }),
  };
}

/**
 * Extrator resiliente — escaneia o texto com balanced-brace tracking
 * respeitando strings/escapes, e coleta TODOS os objetos JSON top-level válidos.
 * Cobre: array [...], objeto solto {...}, NDJSON {..}{..}, texto+json,
 * <json>...</json>, ```json...```.
 */
function extractAllJsonObjects(input: string): any[] {
  if (!input) return [];

  // 1) Normaliza: remove markdown fences + extrai <json>...</json> se houver
  let text = input.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const tagged = text.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
  if (tagged && tagged[1]) text = tagged[1];

  const results: any[] = [];
  const seen = new Set<string>();

  // 2) Scanner balanceado — encontra TODOS os {...} top-level
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") { i++; continue; }
    const start = i;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let end = -1;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }

    if (end === -1) break; // truncado — para aqui
    const candidate = text.slice(start, end + 1);

    // 3) Tenta parsear (com reparo leve para trailing commas)
    let parsed: any = null;
    try { parsed = JSON.parse(candidate); }
    catch {
      try { parsed = JSON.parse(candidate.replace(/,(\s*[}\]])/g, "$1")); }
      catch { /* skip */ }
    }

    // 4) Aceita apenas se parecer questão (statement + options) — evita ruído
    if (parsed && typeof parsed === "object" && parsed.statement && Array.isArray(parsed.options)) {
      const key = String(parsed.statement).slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(parsed);
      }
    }

    i = end + 1;
  }

  return results;
}

  };
}
