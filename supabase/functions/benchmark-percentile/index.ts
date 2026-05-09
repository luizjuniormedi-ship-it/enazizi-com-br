import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get calling user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user id from their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read ALL users' domain maps (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: allDomains, error: dbError } = await adminClient
      .from("medical_domain_map")
      .select("user_id, specialty, domain_score, questions_answered");

    if (dbError) throw dbError;

    // Group scores by specialty
    const specialtyScores: Record<string, number[]> = {};
    const userScores: Record<string, { score: number; questions: number }> = {};

    for (const row of allDomains || []) {
      if (!specialtyScores[row.specialty]) specialtyScores[row.specialty] = [];
      specialtyScores[row.specialty].push(row.domain_score);

      if (row.user_id === user.id) {
        userScores[row.specialty] = {
          score: row.domain_score,
          questions: row.questions_answered,
        };
      }
    }

    // Calculate percentiles
    const benchmarks = Object.entries(specialtyScores)
      .filter(([, scores]) => scores.length >= 2) // Need at least 2 users
      .map(([specialty, scores]) => {
        const sorted = [...scores].sort((a, b) => a - b);
        const userScore = userScores[specialty]?.score ?? 0;
        const belowCount = sorted.filter((s) => s < userScore).length;
        const percentile = Math.round((belowCount / sorted.length) * 100);
        const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
        const median = sorted.length % 2 === 0
          ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
          : sorted[Math.floor(sorted.length / 2)];

        return {
          specialty,
          userScore: Math.round(userScore),
          percentile,
          average: avg,
          median,
          totalUsers: sorted.length,
          userQuestions: userScores[specialty]?.questions ?? 0,
        };
      })
      .sort((a, b) => b.percentile - a.percentile);

    return new Response(JSON.stringify({ benchmarks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("benchmark-percentile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
