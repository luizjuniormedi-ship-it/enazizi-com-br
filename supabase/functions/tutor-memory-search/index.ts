/**
 * tutor-memory-search (HÍBRIDO)
 *
 * Gera embedding da pergunta + extrai sintomas + abreviações e chama
 * a RPC `match_tutor_memory_hybrid` para combinar:
 *   - similaridade semântica (cosine)
 *   - topic overlap
 *   - symptom overlap
 *   - abbreviation overlap
 *
 * Sempre 200 com `{ ok, hits, debug }`. Falha silenciosa → hits: [].
 *
 * Backward compatible: continua aceitando o mesmo body antigo
 * (text, threshold, matchCount). Novos opcionais: topic, subtopic, symptoms.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;

// Dicionário de abreviações clínicas (espelho de src/lib/tutor/clinicalConcepts.ts)
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

// Sintomas/sinais clínicos
const SYMPTOM_DICTIONARY: Record<string, string[]> = {
  dispneia: ["dispneia", "falta de ar", "falta ar", "dispneico"],
  ortopneia: ["ortopneia", "deita falta ar"],
  dpn: ["dpn", "dispneia paroxistica noturna"],
  edema: ["edema", "inchaco", "edemaciado"],
  edema_mmii: ["edema mmii", "edema membros inferiores", "edema pernas"],
  edema_pulmonar: ["edema agudo pulmao", "edema pulmonar", "eap"],
  febre: ["febre", "febril", "hipertermia"],
  dor_toracica: ["dor toracica", "dor no peito", "precordialgia"],
  sincope: ["sincope", "desmaio", "perda consciencia"],
  tosse: ["tosse"],
  hemoptise: ["hemoptise", "tosse com sangue"],
  hipoxemia: ["hipoxemia", "saturacao baixa", "dessaturacao"],
  taquicardia: ["taquicardia"],
  bradicardia: ["bradicardia"],
  hipotensao: ["hipotensao", "pa baixa", "pressao baixa", "choque"],
  hipertensao: ["hipertensao", "pa alta", "pressao alta"],
  b3: ["b3", "terceira bulha", "ritmo de galope"],
  estertores: ["estertores", "creptantes"],
  turgencia_jugular: ["turgencia jugular"],
  cianose: ["cianose", "cianotico"],
  hemiparesia: ["hemiparesia", "fraqueza um lado"],
  afasia: ["afasia"],
  disartria: ["disartria"],
  convulsao: ["convulsao", "crise epileptica"],
  rebaixamento: ["rebaixamento", "torpor", "coma"],
  vomito: ["vomito", "emese"],
  melena: ["melena", "fezes pretas"],
  hematemese: ["hematemese"],
  oliguria: ["oliguria"],
  ictericia: ["ictericia", "icterico"],
  sibilos: ["sibilos", "chiado", "sibilancia"],
  hipercapnia: ["hipercapnia", "co2 alto"],
  anemia: ["anemia", "hb baixa"],
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

function extractAbbrev(text: string): string[] {
  const norm = normalize(text);
  const found = new Set<string>();
  const tokens = norm.match(/\b[a-z]{2,7}\b/g) ?? [];
  for (const t of tokens) {
    if (MEDICAL_ABBREVIATIONS[t]) found.add(t);
  }
  return [...found];
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

function classifyLength(text: string): "short" | "medium" | "long" {
  const wc = (text || "").trim().split(/\s+/).filter(Boolean).length;
  if (wc <= 4) return "short";
  if (wc <= 10) return "medium";
  return "long";
}

function dynamicThreshold(text: string): number {
  const len = classifyLength(text);
  if (len === "short") return 0.45;
  if (len === "medium") return 0.55;
  return 0.65;
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

  const startedAt = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } =
      await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? body?.question ?? "").toString();
    const matchCount: number = Math.min(
      Math.max(Number(body?.matchCount ?? 8), 1),
      15,
    );
    const topic: string | null = body?.topic ?? null;
    const subtopic: string | null = body?.subtopic ?? null;
    const skipLogging: boolean = body?.skipLogging === true;

    if (!text || text.trim().length < 3) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrai contexto clínico
    const symptoms = extractSymptoms(text);
    const abbrev = extractAbbrev(text);

    // Threshold dinâmico (baseado em comprimento) — pode ser sobreposto pelo body
    const requestedThreshold = Number(body?.threshold);
    const baseThreshold = !Number.isFinite(requestedThreshold)
      ? dynamicThreshold(text)
      : requestedThreshold;

    // Se há overlaps, permitimos baixar até 0.35
    const hasOverlapHints = symptoms.length > 0 || abbrev.length > 0 || !!topic;
    const effectiveThreshold = hasOverlapHints
      ? Math.max(0.35, baseThreshold - 0.15)
      : Math.max(0.4, baseThreshold);

    // Texto da query: expande conceitos + repete 2x
    const expanded = expandClinicalConcepts(text);
    const queryText = `${expanded}\n${expanded}`;

    let vec: number[];
    try {
      vec = await embedText(queryText, OPENAI_API_KEY);
    } catch (e) {
      console.warn("[tutor-memory-search] embed failed:", e);
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("match_tutor_memory_hybrid", {
      query_embedding: vec as unknown as string,
      query_topic: topic,
      query_subtopic: subtopic,
      query_symptoms: symptoms,
      query_abbrev: abbrev,
      match_threshold: effectiveThreshold,
      match_count: matchCount,
      user_id_filter: userId,
    });

    if (error) {
      console.warn("[tutor-memory-search] hybrid rpc error:", error.message);

      // Fallback para a RPC antiga (compat)
      const { data: legacy, error: legacyErr } = await supabase.rpc(
        "match_tutor_memory",
        {
          query_embedding: vec as unknown as string,
          match_threshold: effectiveThreshold,
          match_count: matchCount,
          user_id_filter: userId,
        },
      );
      if (legacyErr) {
        return new Response(JSON.stringify({ ok: true, hits: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          hits: legacy ?? [],
          debug: { fallback: "legacy_rpc", symptoms, abbrev, effectiveThreshold },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const hits = data ?? [];
    const top = Array.isArray(hits) && hits.length > 0 ? hits[0] : null;
    const durationMs = Date.now() - startedAt;

    // Log de telemetria (best-effort, não bloqueia resposta)
    if (!skipLogging) {
      try {
        await admin.from("tutor_memory_search_logs").insert({
          user_id: userId,
          query: text.slice(0, 1000),
          query_normalized: expanded.slice(0, 1000),
          semantic_score: top?.similarity ?? null,
          hybrid_score: top?.hybrid_score ?? null,
          matched_memory_id: top?.id ?? null,
          fallback_tier: "semantic_hybrid",
          topic_overlap: top?.topic_overlap ?? false,
          symptom_overlap_count: top?.symptom_overlap_count ?? 0,
          abbreviation_overlap_count: top?.abbreviation_overlap_count ?? 0,
          duration_ms: durationMs,
          reused: !!top,
          threshold_used: effectiveThreshold,
        });
      } catch (logErr) {
        console.warn("[tutor-memory-search] log insert failed:", logErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hits,
        debug: {
          symptoms,
          abbrev,
          effectiveThreshold,
          baseThreshold,
          length: classifyLength(text),
          durationMs,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[tutor-memory-search] fatal:", e);
    return new Response(JSON.stringify({ ok: true, hits: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
