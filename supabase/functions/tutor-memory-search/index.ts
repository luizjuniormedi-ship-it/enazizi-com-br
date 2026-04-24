/**
 * tutor-memory-search
 *
 * Gera embedding de UMA pergunta (do aluno) e chama a RPC `match_tutor_memory`
 * para encontrar memórias semanticamente similares.
 *
 * Sempre retorna 200 com `{ ok: true, hits: [...] }` — se algo falhar,
 * retorna `hits: []` para que o fluxo do Tutor caia para a IA normalmente.
 *
 * Auth: usuário autenticado (qualquer um). RLS é garantido pela RPC
 * (escopo global ou user_id = auth.uid()).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;

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
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } =
      await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? body?.question ?? "").toString();
    const threshold: number = Number(body?.threshold ?? 0.82);
    const matchCount: number = Math.min(
      Math.max(Number(body?.matchCount ?? 5), 1),
      10,
    );

    if (!text || text.trim().length < 3) {
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      // Sem chave -> fallback silencioso
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let vec: number[];
    try {
      vec = await embedText(text, OPENAI_API_KEY);
    } catch (e) {
      console.warn("[tutor-memory-search] embed failed:", e);
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("match_tutor_memory", {
      query_embedding: vec as unknown as string,
      match_threshold: Math.max(0.5, Math.min(0.99, threshold)),
      match_count: matchCount,
      user_id_filter: claims.claims.sub,
    });

    if (error) {
      console.warn("[tutor-memory-search] rpc error:", error.message);
      return new Response(JSON.stringify({ ok: true, hits: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, hits: data ?? [] }),
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
