/**
 * tutor-memory-embedder
 *
 * Processa em lote memórias da `tutor_knowledge_memory` que ainda não
 * têm embedding (`embedding_status = 'pending'`) e gera embeddings via
 * OpenAI (text-embedding-3-small, 1536 dims).
 *
 * Acesso: somente admin (via JWT) ou service_role.
 *
 * Payload opcional:
 *   { limit?: number; retryFailed?: boolean }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const HARD_LIMIT = 50;
const DEFAULT_LIMIT = 10;

// Padrões adicionais de PII para bloquear globalização
const PII_PATTERNS: RegExp[] = [
  /\bcpf\b/i,
  /\bprontu[aá]rio\b/i,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF formato
  /\bnome do paciente\b/i,
  /\bpaciente\s+(joão|joao|maria|josé|jose|ana|carlos|pedro)\b/i,
];

// Expansão de abreviações médicas (deve casar com src/lib/tutor/normalizeQuestion.ts)
const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  icc: "insuficiencia cardiaca",
  icfer: "insuficiencia cardiaca fracao ejecao reduzida",
  icfep: "insuficiencia cardiaca fracao ejecao preservada",
  icfei: "insuficiencia cardiaca fracao ejecao intermediaria",
  iam: "infarto agudo miocardio",
  tep: "tromboembolismo pulmonar",
  avc: "acidente vascular cerebral",
  avci: "acidente vascular cerebral isquemico",
  avch: "acidente vascular cerebral hemorragico",
  dpoc: "doenca pulmonar obstrutiva cronica",
  hda: "hemorragia digestiva alta",
  hdb: "hemorragia digestiva baixa",
  has: "hipertensao arterial sistemica",
  dm: "diabetes mellitus",
  irc: "insuficiencia renal cronica",
  ira: "insuficiencia renal aguda",
  itu: "infeccao trato urinario",
  ivas: "infeccao vias aereas superiores",
  pcr: "parada cardiorrespiratoria",
  sca: "sindrome coronariana aguda",
};

function expandAbbrev(s: string): string {
  if (!s) return s;
  return s.replace(/\b([a-zA-ZÀ-ÿ]{2,6})\b/g, (match) => {
    const expansion = MEDICAL_ABBREVIATIONS[match.toLowerCase()];
    return expansion ? `${match} ${expansion}` : match;
  });
}

function looksPersonal(text: string): boolean {
  if (!text) return false;
  return PII_PATTERNS.some((rx) => rx.test(text));
}

interface MemoryRow {
  id: string;
  scope: string;
  question_normalized: string | null;
  question_original: string | null;
  topic: string | null;
  subtopic: string | null;
  specialty: string | null;
  answer_summary: string | null;
  block_types: string[] | null;
}

/**
 * Constrói o texto a ser embeddado.
 *
 * Estratégia: a PERGUNTA domina o vetor (repetida 3x e expandida com
 * abreviações médicas). Topic/subtopic reforçam contexto clínico. O
 * answer_summary entra apenas como contexto curto (max 400 chars), evitando
 * que respostas longas diluam a similaridade contra perguntas curtas como
 * "O que é ICC?".
 */
function buildEmbeddingText(row: MemoryRow): string {
  const question =
    row.question_normalized ?? row.question_original ?? "";
  const expandedQuestion = expandAbbrev(question);
  const summarySnippet = (row.answer_summary ?? "").slice(0, 400);

  const parts = [
    // Pergunta repetida 3x — domina o vetor
    expandedQuestion,
    expandedQuestion,
    expandedQuestion,
    // Contexto curricular curto
    row.topic ?? "",
    row.subtopic ?? "",
    row.specialty ?? "",
    // Resposta apenas como contexto leve
    summarySnippet,
    (row.block_types ?? []).join(" "),
  ];
  return parts.filter(Boolean).join("\n").slice(0, 4000);
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
      dimensions: EMBED_DIMS,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`embedding api ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIMS) {
    throw new Error("invalid embedding shape");
  }
  return vec;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth: admin OR service_role bearer
    const authHeader = req.headers.get("Authorization") ?? "";
    const isServiceRole = authHeader.includes(SERVICE_ROLE);

    let isAdmin = false;
    if (!isServiceRole) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } =
        await userClient.auth.getUser(token);
      if (userErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleRow } = await userClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!roleRow;
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse payload
    let body: { limit?: number; retryFailed?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const limit = Math.min(
      Math.max(Number(body.limit) || DEFAULT_LIMIT, 1),
      HARD_LIMIT,
    );
    const retryFailed = body.retryFailed === true;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const statusFilter = retryFailed
      ? ["pending", "failed"]
      : ["pending"];

    const { data: rows, error: fetchErr } = await admin
      .from("tutor_knowledge_memory")
      .select(
        "id, scope, question_normalized, question_original, topic, subtopic, specialty, answer_summary, block_types",
      )
      .in("embedding_status", statusFilter)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchErr) throw fetchErr;
    const rowsArr = (rows ?? []) as MemoryRow[];

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rowsArr) {
      processed++;
      const text = buildEmbeddingText(row);

      // Safety: PII detection — if global scope but pergunta tem PII, marcar skipped
      if (row.scope === "global" && looksPersonal(text)) {
        skipped++;
        await admin
          .from("tutor_knowledge_memory")
          .update({
            embedding_status: "skipped",
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }

      if (!text || text.trim().length < 4) {
        skipped++;
        await admin
          .from("tutor_knowledge_memory")
          .update({
            embedding_status: "skipped",
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }

      try {
        const vec = await embedText(text, OPENAI_API_KEY);
        const { error: updErr } = await admin
          .from("tutor_knowledge_memory")
          .update({
            embedding: vec as unknown as string,
            embedding_status: "ready",
            embedding_model: EMBED_MODEL,
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (updErr) throw updErr;
        succeeded++;
      } catch (err) {
        failed++;
        errors.push(
          `${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
        await admin
          .from("tutor_knowledge_memory")
          .update({
            embedding_status: "failed",
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        model: EMBED_MODEL,
        dims: EMBED_DIMS,
        requested_limit: limit,
        processed,
        succeeded,
        failed,
        skipped,
        errors: errors.slice(0, 5),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("tutor-memory-embedder error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
