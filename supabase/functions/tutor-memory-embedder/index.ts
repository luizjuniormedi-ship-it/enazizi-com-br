/**
 * tutor-memory-embedder (com sintomas)
 *
 * Processa em lote memórias `pending`/`failed` e:
 *   1. extrai symptom_keywords
 *   2. expande conceitos clínicos no texto a embeddar
 *   3. embedda via OpenAI text-embedding-3-small (1536 dims)
 *   4. atualiza embedding + symptom_keywords + status
 *
 * Acesso: admin (JWT) ou service_role.
 *
 * Payload: { limit?: number; retryFailed?: boolean; forceReembed?: boolean }
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

const PII_PATTERNS: RegExp[] = [
  /\bcpf\b/i,
  /\bprontu[aá]rio\b/i,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  /\bnome do paciente\b/i,
  /\bpaciente\s+(joão|joao|maria|josé|jose|ana|carlos|pedro)\b/i,
];

const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  ic: "insuficiencia cardiaca",
  icc: "insuficiencia cardiaca congestiva",
  icfer: "insuficiencia cardiaca fracao ejecao reduzida",
  icfep: "insuficiencia cardiaca fracao ejecao preservada",
  icfei: "insuficiencia cardiaca fracao ejecao intermediaria",
  feve: "fracao ejecao ventriculo esquerdo",
  iam: "infarto agudo miocardio",
  iamcsst: "infarto agudo miocardio com supradesnivelamento st",
  iamssst: "infarto agudo miocardio sem supradesnivelamento st",
  sca: "sindrome coronariana aguda",
  dac: "doenca arterial coronariana",
  tep: "tromboembolismo pulmonar",
  tvp: "trombose venosa profunda",
  avc: "acidente vascular cerebral",
  avci: "acidente vascular cerebral isquemico",
  avch: "acidente vascular cerebral hemorragico",
  ait: "ataque isquemico transitorio",
  dpoc: "doenca pulmonar obstrutiva cronica",
  sdra: "sindrome desconforto respiratorio agudo",
  hda: "hemorragia digestiva alta",
  hdb: "hemorragia digestiva baixa",
  has: "hipertensao arterial sistemica",
  dm: "diabetes mellitus",
  dm2: "diabetes mellitus tipo 2",
  dm1: "diabetes mellitus tipo 1",
  dlp: "dislipidemia",
  irc: "insuficiencia renal cronica",
  drc: "doenca renal cronica",
  ira: "insuficiencia renal aguda",
  lra: "lesao renal aguda",
  itu: "infeccao trato urinario",
  ivas: "infeccao vias aereas superiores",
  pcr: "parada cardiorrespiratoria",
  fa: "fibrilacao atrial",
  tsv: "taquicardia supraventricular",
  tv: "taquicardia ventricular",
  fv: "fibrilacao ventricular",
  bav: "bloqueio atrioventricular",
  b3: "terceira bulha",
  dpn: "dispneia paroxistica noturna",
  nyha: "new york heart association",
  eap: "edema agudo pulmao",
};

const SYMPTOM_DICTIONARY: Record<string, string[]> = {
  dispneia: ["dispneia", "falta de ar", "falta ar"],
  ortopneia: ["ortopneia"],
  dpn: ["dpn", "dispneia paroxistica noturna"],
  edema: ["edema", "inchaco"],
  edema_mmii: ["edema mmii", "edema membros inferiores"],
  edema_pulmonar: ["edema agudo pulmao", "edema pulmonar", "eap"],
  febre: ["febre", "febril"],
  dor_toracica: ["dor toracica", "dor no peito", "precordialgia"],
  sincope: ["sincope", "desmaio"],
  tosse: ["tosse"],
  hemoptise: ["hemoptise"],
  hipoxemia: ["hipoxemia", "saturacao baixa"],
  taquicardia: ["taquicardia"],
  bradicardia: ["bradicardia"],
  hipotensao: ["hipotensao", "pa baixa", "choque"],
  hipertensao: ["hipertensao", "pa alta"],
  b3: ["b3", "terceira bulha", "ritmo de galope"],
  estertores: ["estertores", "creptantes"],
  turgencia_jugular: ["turgencia jugular"],
  hemiparesia: ["hemiparesia"],
  afasia: ["afasia"],
  convulsao: ["convulsao"],
  rebaixamento: ["rebaixamento", "torpor", "coma"],
  vomito: ["vomito", "emese"],
  melena: ["melena"],
  hematemese: ["hematemese"],
  ictericia: ["ictericia"],
  sibilos: ["sibilos", "chiado"],
  hipercapnia: ["hipercapnia"],
  anemia: ["anemia"],
  fa: ["fibrilacao atrial"],
  fe_reduzida: ["feve reduzida", "fe reduzida", "fracao ejecao reduzida"],
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalize(s: string): string {
  return stripDiacritics((s || "").toLowerCase());
}

function expandClinicalConcepts(text: string): string {
  if (!text) return text;
  return text.replace(/\b([a-zA-ZÀ-ÿ]{2,7})\b/g, (m) => {
    const exp = MEDICAL_ABBREVIATIONS[normalize(m)];
    return exp ? `${m} ${exp}` : m;
  });
}

function extractSymptoms(text: string): string[] {
  const norm = normalize(text);
  const found = new Set<string>();
  for (const [keyword, variants] of Object.entries(SYMPTOM_DICTIONARY)) {
    for (const v of variants) {
      if (norm.includes(v)) {
        found.add(keyword);
        break;
      }
    }
  }
  return [...found];
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

function buildEmbeddingText(row: MemoryRow): string {
  const question = row.question_normalized ?? row.question_original ?? "";
  const expandedQuestion = expandClinicalConcepts(question);
  const summarySnippet = (row.answer_summary ?? "").slice(0, 400);

  const parts = [
    expandedQuestion,
    expandedQuestion,
    expandedQuestion,
    row.topic ?? "",
    row.subtopic ?? "",
    row.specialty ?? "",
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

    let body: { limit?: number; retryFailed?: boolean; forceReembed?: boolean } = {};
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
    const forceReembed = body.forceReembed === true;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Se forceReembed: marca TODAS as memórias como pending primeiro (em lotes)
    if (forceReembed) {
      const { error: resetErr } = await admin
        .from("tutor_knowledge_memory")
        .update({ embedding_status: "pending" })
        .neq("embedding_status", "pending");
      if (resetErr) {
        console.warn("[embedder] reset failed:", resetErr.message);
      }
    }

    const statusFilter = retryFailed || forceReembed
      ? ["pending", "failed"]
      : ["pending"];

    // Conta total pendente para reportar progresso
    const { count: totalPending } = await admin
      .from("tutor_knowledge_memory")
      .select("id", { count: "exact", head: true })
      .in("embedding_status", statusFilter);

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
        // Extrai sintomas do texto completo (pergunta + summary)
        const symptomText = `${row.question_original ?? ""} ${row.answer_summary ?? ""}`;
        const symptoms = extractSymptoms(symptomText);

        const { error: updErr } = await admin
          .from("tutor_knowledge_memory")
          .update({
            embedding: vec as unknown as string,
            embedding_status: "ready",
            embedding_model: EMBED_MODEL,
            embedding_updated_at: new Date().toISOString(),
            symptom_keywords: symptoms,
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

    const remaining = Math.max(0, (totalPending ?? 0) - processed);

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
        total_pending_before: totalPending ?? null,
        remaining_after: remaining,
        force_reembed: forceReembed,
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
