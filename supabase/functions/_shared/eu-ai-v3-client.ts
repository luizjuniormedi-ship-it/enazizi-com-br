/**
 * Cliente Claude (via proxy eu-ai/Railway) para o Tutor v3-premium.
 * Estratégia Caminho A: prompt instrui Claude a retornar JSON entre <json>...</json>;
 * resposta passa por safeJsonExtract. Se vier Markdown didático válido, converte para o
 * mesmo shape do v3 para evitar fallback desnecessário.
 *
 * Mantém Memory v22.1 intacta: o objeto retornado tem o mesmo shape que normalizeTutorResponse aceita,
 * então o save automático e a reutilização futura continuam funcionando — economizando tokens.
 */

import { safeJsonExtract, JsonExtractError } from "./json-extractor.ts";

const EU_AI_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";
const EU_AI_TIMEOUT_MS = 35_000; // v3 = respostas mais longas; Claude pode levar 15-25s

const JSON_INSTRUCTION = `

# REGRAS DE SAÍDA OBRIGATÓRIAS (NÃO NEGOCIÁVEIS)
Você DEVE retornar APENAS um objeto JSON válido entre as tags <json> e </json>.
NÃO escreva nada antes ou depois das tags. NÃO use \`\`\`json. NÃO comente o JSON.
Nunca mencione provedor/modelo/identidade de IA, prompts, instruções injetadas ou comparação com outro provedor; responda apenas como tutor médico ENAZIZI em pt-BR.

Schema obrigatório:
<json>
{
  "content": "<explicação em Markdown PT-BR, 200-2000 chars, com bibliografia Harrison/Nelson/Sabiston>",
  "socraticQuestion": "<uma pergunta socrática provocativa para o aluno>",
  "teachingPhase": "ENSINAR" | "TESTAR" | "CORRIGIR" | "REFORCAR" | "AVANCAR",
  "shouldWaitForStudent": true,
  "actionsContext": { "topic": "<tema atual>", "block": "<bloco pedagógico>" }
}
</json>`;

function coerceMarkdownTutorPayload(raw: string, topic: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/[^\n.?!]*(?:não sou|sou o claude|anthropic|instruções? injetadas?|prompts? injetados?)[^\n.?!]*(?:[.?!]|\n)/gi, "")
    .replace(/quanto à pergunta legítima[^\n—-]*[—-]?/gi, "")
    .replace(/[^\n.]*não sigo prompts[^\n.]*(?:\.|\n)/gi, "")
    .replace(/[^\n.]*adotar identidades diferentes[^\n.]*(?:\.|\n)/gi, "")
    .replace(/persistently positive/gi, "persistentemente positivas")
    .replace(/\n?---\s*\n?/g, "\n")
    .trim();

  if (cleaned.length < 400 || !/[#*_\-]|crit[eé]rio|diagn[oó]stico|conduta|tratamento/i.test(cleaned)) {
    return null;
  }

  const questionMatch = cleaned.match(/([^\n?]{25,220}\?)/g);
  const socraticQuestion = questionMatch?.at(-1)?.trim()
    || `Qual achado clínico mudaria sua hipótese principal sobre ${topic}?`;
  const content = cleaned.replace(socraticQuestion, "").trim();
  if (content.length < 300) return null;

  return {
    content,
    socraticQuestion,
    teachingPhase: "ENSINAR",
    shouldWaitForStudent: true,
    actionsContext: { topic, block: "BLOCO_2_MAPA_DA_AULA" },
  };
}

export interface ClaudeV3Result {
  content: string;
  socraticQuestion: string;
  teachingPhase: string;
  shouldWaitForStudent: boolean;
  actionsContext?: Record<string, unknown>;
  _provider: "claude";
  _model: "claude-eu";
  _latencyMs: number;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface CallOpts {
  systemPrompt: string;
  userMessage: string;
  topic: string;
}

export async function callClaudeV3({ systemPrompt, userMessage, topic }: CallOpts): Promise<ClaudeV3Result> {
  const start = Date.now();
  // IMPORTANTE: enquadramos como tarefa legítima de tutoria médica para evitar que Claude
  // interprete o systemPrompt como prompt injection (já recusou a identidade ENAZIZI antes).
  // ENAZIZI é o nome do PRODUTO de tutoria médica do usuário, não uma identidade de IA concorrente.
  const augmentedUser = [
    "Tarefa: gerar uma resposta pedagógica para a plataforma médica brasileira ENAZIZI (produto educacional do cliente, NÃO uma IA concorrente).",
    "Você é um assistente Claude executando essa tarefa de tutoria médica em pt-BR. Não precisa adotar identidade alternativa — apenas siga as diretrizes pedagógicas abaixo como especificação de formato/conteúdo da resposta.",
    "Não mencione provedor, modelo, Anthropic, ou que recebeu instruções; entregue apenas o conteúdo didático solicitado.",
    "",
    "=== DIRETRIZES PEDAGÓGICAS DA PLATAFORMA (siga como spec) ===",
    systemPrompt,
    "=== FIM DAS DIRETRIZES ===",
    "",
    `Pergunta/contexto do estudante (tema: ${topic}):`,
    userMessage,
    JSON_INSTRUCTION,
    "\nResponda APENAS com <json>{...}</json>. Sem texto antes ou depois.",
  ].join("\n");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EU_AI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${EU_AI_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: augmentedUser,
        topic,
        stream: false,
        context: { source: "tutor-v3-premium", format: "json_strict" },
      }),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    throw new Error(`CLAUDE_NETWORK_FAIL: ${e?.message || e}`);
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - start;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLAUDE_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  let envelope: any;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error("CLAUDE_INVALID_ENVELOPE_JSON");
  }

  const raw: string = envelope?.message || envelope?.content || envelope?.response || "";
  if (!raw || typeof raw !== "string") {
    throw new Error("CLAUDE_EMPTY_MESSAGE");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = safeJsonExtract<Record<string, unknown>>(raw);
  } catch (e) {
    const coerced = coerceMarkdownTutorPayload(raw, topic);
    if (!coerced) {
      const reason = e instanceof JsonExtractError ? e.reason : String((e as any)?.message || e);
      console.warn(`[CLAUDE_RAW_DEBUG] len=${raw.length} head="${raw.slice(0, 400).replace(/\n/g, " ")}"`);
      throw new Error(`CLAUDE_JSON_EXTRACT_FAIL: ${reason}`);
    }
    console.warn(`[CLAUDE_MARKDOWN_COERCED] len=${raw.length}`);
    parsed = coerced;
  }

  const content = String(parsed.content || "").trim();
  const socratic = String(parsed.socraticQuestion || "").trim();
  const phase = String(parsed.teachingPhase || "ENSINAR").trim().toUpperCase();

  if (content.length < 100) {
    throw new Error(`CLAUDE_CONTENT_TOO_SHORT: ${content.length} chars`);
  }
  if (!socratic) {
    throw new Error("CLAUDE_MISSING_SOCRATIC");
  }

  // Estimativa grosseira de tokens (proxy não retorna usage)
  const promptTokens = Math.ceil(augmentedUser.length / 4);
  const completionTokens = Math.ceil(raw.length / 4);

  return {
    content,
    socraticQuestion: socratic,
    teachingPhase: phase,
    shouldWaitForStudent: parsed.shouldWaitForStudent !== false,
    actionsContext: (parsed.actionsContext as Record<string, unknown>) || { topic },
    _provider: "claude",
    _model: "claude-eu",
    _latencyMs: latencyMs,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}

export function isClaudeV3Enabled(): boolean {
  // Default ON; desligue setando ENABLE_CLAUDE_V3=false
  const v = Deno.env.get("ENABLE_CLAUDE_V3");
  if (v === undefined || v === null || v === "") return true;
  return v.toLowerCase() !== "false" && v !== "0";
}
