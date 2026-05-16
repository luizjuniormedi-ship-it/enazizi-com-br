/**
 * trajectory-explain-v1 — Gera explicação narrativa em PT-BR sobre o snapshot
 * mais recente do Radar de Trajetória. 1 chamada Lovable AI (openai/gpt-5-mini-mini).
 *
 * Falha silenciosa: se LOVABLE_API_KEY não existir ou a chamada falhar,
 * devolve uma narrativa fallback determinística baseada nos próprios scores.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest,
} from "../_shared/assistant-helpers.ts";

interface ExplainBody {
  snapshotId: string;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5-mini-mini";

function deterministicNarrative(snap: any, risks: any[], recs: any[]) {
  const overall = Number(snap.overall_score ?? 0);
  const conf = Number(snap.confidence_score ?? 0);
  const top = recs.sort((a, b) => b.priority - a.priority).slice(0, 3);
  const bullets = top.map((r) => `• ${r.title}`);

  const tone =
    overall >= 75 ? "Sua trajetória atual está bem encaminhada."
    : overall >= 55 ? "Sua trajetória atual mostra base sólida com pontos a ajustar."
    : "Sua trajetória atual indica espaço claro de evolução.";

  const confLabel: "alta" | "média" | "baixa" =
    conf >= 80 ? "alta" : conf >= 55 ? "média" : "baixa";

  const narrative =
    `${tone} Score geral estimado em ${overall}/100, ` +
    `com ${risks.length} risco(s) e ${recs.length} ação(ões) sugerida(s). ` +
    (snap.data_completeness === "insufficient"
      ? "Os dados ainda são limitados — recomendo continuar usando a plataforma para refinar essa leitura."
      : "Foque nas ações de maior prioridade para acelerar evolução nas próximas semanas.");

  return { narrative, bullets, confidence: confLabel };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método não permitido", 405);

  let userId: string;
  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    return errorResponse("Autenticação necessária", 401);
  }

  let body: ExplainBody;
  try {
    body = (await req.json()) as ExplainBody;
  } catch {
    return errorResponse("Body inválido", 400);
  }
  if (!body?.snapshotId) return errorResponse("snapshotId obrigatório", 400);

  const db = getServiceClient();

  const { data: snap } = await db
    .from("trajectory_snapshots")
    .select("*")
    .eq("id", body.snapshotId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!snap) return errorResponse("Snapshot não encontrado", 404);

  const [{ data: risks }, { data: recs }] = await Promise.all([
    db.from("trajectory_risk_factors").select("*").eq("snapshot_id", body.snapshotId),
    db.from("trajectory_recommendations").select("*").eq("snapshot_id", body.snapshotId),
  ]);

  const fallback = deterministicNarrative(snap, risks ?? [], recs ?? []);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      success: true,
      ...fallback,
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const sys =
      "Você é um mentor pedagógico do ENAZIZI. Responda SEMPRE em português do Brasil. " +
      "Nunca prometa aprovação ou nota. Use linguagem clara, encorajadora e específica. " +
      "Quando os dados forem limitados, declare a incerteza explicitamente.";

    const user = JSON.stringify({
      snapshot: {
        overall: snap.overall_score,
        consistency: snap.consistency_score,
        retention: snap.retention_score,
        execution: snap.execution_score,
        backlog: snap.backlog_score,
        confidence: snap.confidence_score,
        completeness: snap.data_completeness,
      },
      topRisks: (risks ?? []).slice(0, 3).map((r: any) => r.title),
      topRecs: (recs ?? []).slice(0, 3).map((r: any) => r.title),
      instruction:
        "Em 3-5 linhas, explique a leitura geral. Em seguida liste de 3 a 5 bullets curtos com a próxima ação.",
    });

    const resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_explanation",
            description: "Emite explicação estruturada para a UI do Radar.",
            parameters: {
              type: "object",
              properties: {
                narrative: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["alta", "média", "baixa"] },
              },
              required: ["narrative", "bullets", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_explanation" } },
      }),
    });

    if (!resp.ok) {
      console.warn("[trajectory-explain-v1] gateway falhou", resp.status);
      return jsonResponse({
        success: true,
        ...fallback,
        generatedAt: new Date().toISOString(),
      });
    }

    const data = await resp.json();
    const argsStr =
      data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      return jsonResponse({
        success: true,
        ...fallback,
        generatedAt: new Date().toISOString(),
      });
    }

    const parsed = JSON.parse(argsStr);
    return jsonResponse({
      success: true,
      narrative: String(parsed.narrative ?? fallback.narrative),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5) : fallback.bullets,
      confidence: ["alta", "média", "baixa"].includes(parsed.confidence)
        ? parsed.confidence
        : fallback.confidence,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[trajectory-explain-v1] erro IA, usando fallback:", e);
    return jsonResponse({
      success: true,
      ...fallback,
      generatedAt: new Date().toISOString(),
    });
  }
});
