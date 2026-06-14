/**
 * Cliente Claude (proxy eu-ai/Railway) para GERADORES DE QUESTÕES (simulados).
 * Recovery Sprint — Edge-side (Opção A):
 *  - /health + /warmup probes
 *  - claudeMinimalTest() ({"ok":true})
 *  - Prompt compacto opcional (CLAUDE_COMPACT_SIMULADO_PROMPT)
 *  - Microbatch (batch>=3 dividido em chamadas de 1-2)
 *  - Logs [RAILWAY_REQ_*] com elapsedMs/inputChars/outputChars/expectedCount
 */

const EU_AI_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";
const EU_AI_TIMEOUT_MS = 40_000;
const EU_AI_MINIMAL_TIMEOUT_MS = 8_000;
const EU_AI_HEALTH_TIMEOUT_MS = 3_000;

// Microbatch: batch >= 3 dividido em chamadas paralelas de até 2 questões (5 = 2+2+1).
const MICROBATCH_THRESHOLD = 2;
const MICROBATCH_SIZE = 1;
const MICROBATCH_PARALLEL = true;

const JSON_TAIL_FULL = `

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

const JSON_TAIL_COMPACT = `

# SAÍDA
Apenas array JSON entre <json></json>. Sem markdown. Sem texto fora.
Schema por item: { "block": "...", "statement": ">=450 chars pt-BR caso clínico", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct_index": 0, "explanation": ">=200 chars pt-BR com Harrison/Nelson/Sabiston", "topic": "...", "difficulty_level": "easy|medium|hard" }
Regras: pt-BR estrito, 4 alternativas, sem inglês, sem LaTeX, sem imagens.

<json>
[]
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

export function isClaudeCompactPromptEnabled(): boolean {
  const v = Deno.env.get("CLAUDE_COMPACT_SIMULADO_PROMPT");
  if (!v) return true; // default ON para reduzir latência
  return v.toLowerCase() === "true" || v === "1";
}

export function isClaudeMicrobatchEnabled(): boolean {
  const v = Deno.env.get("CLAUDE_MICROBATCH");
  if (!v) return true; // default ON
  return v.toLowerCase() === "true" || v === "1";
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH / WARMUP / MINIMAL TEST
// ─────────────────────────────────────────────────────────────────────────────

export async function claudeHealthCheck(): Promise<{ ok: boolean; status: number; elapsedMs: number; body?: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_HEALTH_TIMEOUT_MS);
  try {
    console.log(`[RAILWAY_HEALTH_START] url=${EU_AI_URL}/health`);
    const res = await fetch(`${EU_AI_URL}/health`, { method: "GET", signal: ctrl.signal });
    const body = await res.text().catch(() => "");
    const elapsed = Date.now() - t0;
    console.log(`[RAILWAY_HEALTH_${res.ok ? "OK" : "FAIL"}] status=${res.status} elapsedMs=${elapsed} body="${body.slice(0, 120)}"`);
    return { ok: res.ok, status: res.status, elapsedMs: elapsed, body: body.slice(0, 200) };
  } catch (e: any) {
    const elapsed = Date.now() - t0;
    console.warn(`[RAILWAY_HEALTH_FAIL] elapsedMs=${elapsed} reason="${e?.message || e}"`);
    return { ok: false, status: 599, elapsedMs: elapsed, body: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function claudeWarmup(): Promise<{ ok: boolean; status: number; elapsedMs: number }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_HEALTH_TIMEOUT_MS);
  try {
    console.log(`[RAILWAY_WARMUP_START] url=${EU_AI_URL}/warmup`);
    const res = await fetch(`${EU_AI_URL}/warmup`, { method: "GET", signal: ctrl.signal });
    await res.text().catch(() => "");
    const elapsed = Date.now() - t0;
    console.log(`[RAILWAY_WARMUP_${res.ok ? "OK" : "FAIL"}] status=${res.status} elapsedMs=${elapsed}`);
    return { ok: res.ok, status: res.status, elapsedMs: elapsed };
  } catch (e: any) {
    const elapsed = Date.now() - t0;
    console.warn(`[RAILWAY_WARMUP_FAIL] elapsedMs=${elapsed} reason="${e?.message || e}"`);
    return { ok: false, status: 599, elapsedMs: elapsed };
  } finally {
    clearTimeout(timer);
  }
}

export async function claudeMinimalTest(): Promise<{ ok: boolean; status: number; elapsedMs: number; preview: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_MINIMAL_TIMEOUT_MS);
  try {
    console.log(`[CLAUDE_MINIMAL_START] url=${EU_AI_URL}/api/v1/chat timeoutMs=${EU_AI_MINIMAL_TIMEOUT_MS}`);
    const res = await fetch(`${EU_AI_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `{"ok":true}`,
        stream: false,
        context: { source: "claude-minimal-test" },
      }),
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => "");
    const elapsed = Date.now() - t0;
    if (res.ok) {
      console.log(`[CLAUDE_MINIMAL_OK] status=${res.status} elapsedMs=${elapsed} preview="${body.slice(0, 120).replace(/\n/g, " ")}"`);
    } else {
      console.warn(`[CLAUDE_MINIMAL_FAIL] status=${res.status} elapsedMs=${elapsed} body="${body.slice(0, 200)}"`);
    }
    return { ok: res.ok, status: res.status, elapsedMs: elapsed, preview: body.slice(0, 200) };
  } catch (e: any) {
    const elapsed = Date.now() - t0;
    const aborted = e?.name === "AbortError";
    console.warn(`[CLAUDE_MINIMAL_FAIL] elapsedMs=${elapsed} aborted=${aborted} reason="${e?.message || e}"`);
    return { ok: false, status: 599, elapsedMs: elapsed, preview: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE FETCH (single call) — usado pelo microbatch e pelo caller direto
// ─────────────────────────────────────────────────────────────────────────────

export async function claudeFetchQuestions(prompt: string, topicHint = "simulado", expectedCount = 0): Promise<ClaudeSimResponse> {
  const topicLock = `\n\n# TRAVA DE TEMA (OBRIGATÓRIO)\nO campo "topic" de TODA questão DEVE ser EXATAMENTE: "${topicHint}". Não use sinônimos, abreviações, nem o nome da especialidade pai. Use a string literal "${topicHint}".`;
  const countLock = expectedCount > 0
    ? `\n\n# QUANTIDADE OBRIGATÓRIA\nVocê DEVE retornar EXATAMENTE ${expectedCount} objeto(s) dentro do array JSON. Nem mais, nem menos. Se gerar menos, a resposta será rejeitada.`
    : `\n\n# QUANTIDADE OBRIGATÓRIA\nSempre retorne um ARRAY JSON, mesmo que com 1 elemento. NUNCA retorne um objeto JSON solto.`;
  const tail = isClaudeCompactPromptEnabled() ? JSON_TAIL_COMPACT : JSON_TAIL_FULL;
  const augmented = `${prompt}${topicLock}${countLock}${tail}`;
  const inputChars = augmented.length;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_TIMEOUT_MS);
  const t0 = Date.now();

  let res: Response;
  try {
    console.log(`[RAILWAY_REQ_START] url=${EU_AI_URL} topic="${topicHint}" expectedCount=${expectedCount} inputChars=${inputChars} timeoutMs=${EU_AI_TIMEOUT_MS} compactPrompt=${isClaudeCompactPromptEnabled()}`);
    res = await fetch(`${EU_AI_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: augmented,
        topic: topicHint,
        stream: false,
        context: { source: "professor-simulado", format: "json_array", expectedCount },
      }),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    const aborted = e?.name === "AbortError" || /aborted/i.test(String(e?.message));
    const reason = aborted ? `TIMEOUT_${EU_AI_TIMEOUT_MS}MS` : (e?.message || String(e));
    console.warn(`[RAILWAY_REQ_FAIL] elapsedMs=${elapsed} aborted=${aborted} reason="${reason}" url=${EU_AI_URL} topic="${topicHint}" expectedCount=${expectedCount} inputChars=${inputChars}`);
    return {
      ok: false,
      status: 599,
      _claude: true,
      text: async () => `CLAUDE_NETWORK_FAIL: ${reason} (elapsed=${elapsed}ms)`,
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  const elapsedAfterBody = Date.now() - t0;
  if (!res.ok) {
    console.warn(`[RAILWAY_REQ_FAIL] status=${res.status} elapsedMs=${elapsedAfterBody} expectedCount=${expectedCount} inputChars=${inputChars} outputChars=${raw.length} body="${raw.slice(0, 200)}"`);
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
  const outputChars = message.length;

  console.log(`[RAILWAY_REQ_OK] status=${res.status} elapsedMs=${elapsedAfterBody} topic="${topicHint}" expectedCount=${expectedCount} inputChars=${inputChars} outputChars=${outputChars}`);

  const objects = extractAllJsonObjects(message);
  const jsonText = objects.length > 0 ? `[${objects.map(o => JSON.stringify(o)).join(",")}]` : "[]";

  console.log(`[CLAUDE_OBJECTS_FOUND] count=${objects.length} expected=${expectedCount}`);
  if (expectedCount > 0 && objects.length !== expectedCount) {
    console.warn(`[COUNT_MISMATCH] requested=${expectedCount} parsed=${objects.length}`);
    return {
      ok: false,
      status: 422,
      _claude: true,
      text: async () => `CLAUDE_COUNT_MISMATCH: requested=${expectedCount} parsed=${objects.length}`,
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
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

// ─────────────────────────────────────────────────────────────────────────────
// MICROBATCH — divide batch>=3 em chamadas de MICROBATCH_SIZE (default 2)
// ─────────────────────────────────────────────────────────────────────────────

export async function claudeFetchQuestionsMicrobatch(prompt: string, topicHint: string, expectedCount: number): Promise<ClaudeSimResponse> {
  // Decide se aplica microbatch
  if (!isClaudeMicrobatchEnabled() || expectedCount < MICROBATCH_THRESHOLD) {
    return claudeFetchQuestions(prompt, topicHint, expectedCount);
  }

  // Plano: 5 = 2+2+1, 4 = 2+2, 3 = 2+1, etc.
  const plan: number[] = [];
  let left = expectedCount;
  while (left > 0) {
    const take = Math.min(MICROBATCH_SIZE, left);
    plan.push(take);
    left -= take;
  }

  console.log(`[CLAUDE_MICROBATCH_PLAN] requested=${expectedCount} calls=${plan.length} plan=${plan.join("+")} parallel=${MICROBATCH_PARALLEL}`);

  const allObjects: any[] = [];
  const t0 = Date.now();
  let anyOk = false;

  const runCall = async (size: number, idx: number) => {
    const callT0 = Date.now();
    console.log(`[CLAUDE_MICROBATCH_START] index=${idx}/${plan.length} size=${size}`);
    try {
      const resp = await claudeFetchQuestions(prompt, topicHint, size);
      const callElapsed = Date.now() - callT0;
      if (!resp.ok) {
        console.warn(`[CLAUDE_MICROBATCH_FAIL] index=${idx} elapsedMs=${callElapsed} status=${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content || "[]";
      let arr: any[] = [];
      try { arr = JSON.parse(content); } catch { arr = []; }
      if (Array.isArray(arr) && arr.length > 0) {
        anyOk = true;
        console.log(`[CLAUDE_MICROBATCH_OK] index=${idx} count=${arr.length} elapsedMs=${callElapsed}`);
        return arr;
      }
      console.warn(`[CLAUDE_MICROBATCH_EMPTY] index=${idx} elapsedMs=${callElapsed}`);
      return [];
    } catch (e: any) {
      console.warn(`[CLAUDE_MICROBATCH_FAIL] index=${idx} reason="${e?.message || e}"`);
      return [];
    }
  };

  if (MICROBATCH_PARALLEL) {
    const settled = await Promise.allSettled(plan.map((size, i) => runCall(size, i + 1)));
    for (const s of settled) {
      if (s.status === "fulfilled" && Array.isArray(s.value)) allObjects.push(...s.value);
    }
  } else {
    for (let i = 0; i < plan.length; i++) {
      const arr = await runCall(plan[i], i + 1);
      allObjects.push(...arr);
      if (allObjects.length >= expectedCount) break;
    }
  }

  // Dedupe por statement (primeiros 100 chars)
  const seen = new Set<string>();
  const deduped = allObjects.filter((o) => {
    const k = String(o?.statement || "").slice(0, 100);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, expectedCount);

  const totalElapsed = Date.now() - t0;
  console.log(`[CLAUDE_BATCH_MERGED] requested=${expectedCount} collected=${allObjects.length} final=${deduped.length} totalElapsedMs=${totalElapsed} calls=${plan.length}`);

  if (!anyOk || deduped.length === 0) {
    return {
      ok: false,
      status: 599,
      _claude: true,
      text: async () => `CLAUDE_MICROBATCH_EMPTY: all ${plan.length} calls failed/empty (elapsed=${totalElapsed}ms)`,
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
  }

  if (deduped.length !== expectedCount) {
    console.warn(`[COUNT_MISMATCH] provider=claude-microbatch requested=${expectedCount} parsed=${deduped.length} collected=${allObjects.length}`);
    return {
      ok: false,
      status: 422,
      _claude: true,
      text: async () => `CLAUDE_MICROBATCH_COUNT_MISMATCH: requested=${expectedCount} parsed=${deduped.length}`,
      json: async () => ({ choices: [{ message: { content: "[]" } }] }),
    };
  }

  const jsonText = `[${deduped.map(o => JSON.stringify(o)).join(",")}]`;
  return {
    ok: true,
    status: 200,
    _claude: true,
    text: async () => jsonText,
    json: async () => ({ choices: [{ message: { content: jsonText } }] }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────

function extractAllJsonObjects(input: string): any[] {
  if (!input) return [];

  let text = input.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const tagged = text.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
  if (tagged && tagged[1]) text = tagged[1];

  const results: any[] = [];
  const seen = new Set<string>();

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

    if (end === -1) break;
    const candidate = text.slice(start, end + 1);

    let parsed: any = null;
    try { parsed = JSON.parse(candidate); }
    catch {
      try { parsed = JSON.parse(candidate.replace(/,(\s*[}\]])/g, "$1")); }
      catch { /* skip */ }
    }

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
