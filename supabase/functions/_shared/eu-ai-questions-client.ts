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

# REGRA DE SAÍDA OBRIGATÓRIA
Responda APENAS com um array JSON válido entre <json> e </json>. NÃO escreva nada antes ou depois.
Não comente, não use \`\`\`json, não mencione provedor/modelo. Apenas:
<json>
[ { "block": "...", "statement": "...", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct_index": 0, "explanation": "...", "topic": "...", "difficulty_level": "easy|medium|hard" } ]
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

export async function claudeFetchQuestions(prompt: string, topicHint = "simulado"): Promise<ClaudeSimResponse> {
  const augmented = `${prompt}${JSON_TAIL}`;
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

  // Extrai array JSON: prefere bloco <json>...</json>, fallback para primeiro [ ... ] do texto
  let jsonText = "[]";
  const tagged = message.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
  if (tagged && tagged[1]) {
    const arr = tagged[1].match(/\[[\s\S]*\]/);
    if (arr) jsonText = arr[0];
  } else {
    const arr = message.match(/\[[\s\S]*\]/);
    if (arr) jsonText = arr[0];
  }

  return {
    ok: true,
    status: 200,
    _claude: true,
    text: async () => message,
    json: async () => ({ choices: [{ message: { content: jsonText } }] }),
  };
}
