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

  // Extrai array JSON: 1) bloco <json>, 2) primeiro [...] do texto, 3) objeto solto {...} -> wrappa em array
  let jsonText = "[]";
  const tagged = message.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
  const haystack = tagged && tagged[1] ? tagged[1] : message;

  const arrMatch = haystack.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    jsonText = arrMatch[0];
  } else {
    // Fallback: Claude pode ter devolvido um único objeto OU múltiplos objetos concatenados
    const objMatches = haystack.match(/\{[\s\S]*?"statement"[\s\S]*?\}(?=\s*[,\{\]]|\s*$)/g);
    if (objMatches && objMatches.length > 0) {
      jsonText = `[${objMatches.join(",")}]`;
      console.log(`[CLAUDE_SIM_WRAPPED] standalone objects wrapped into array, count=${objMatches.length}`);
    }
  }

  if (jsonText === "[]") {
    console.warn(`[CLAUDE_SIM_NO_JSON] len=${message.length} head="${message.slice(0, 500).replace(/\n/g, " ")}"`);
  } else {
    const objCount = (jsonText.match(/"statement"\s*:/g) || []).length;
    console.log(`[CLAUDE_SIM_PARSED] objects=${objCount} jsonLen=${jsonText.length}`);
  }

  return {
    ok: true,
    status: 200,
    _claude: true,
    text: async () => message,
    json: async () => ({ choices: [{ message: { content: jsonText } }] }),
  };
}
