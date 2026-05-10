import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get all active users (those who have studies or exams in the last 30 days)
    const { data: users, error: usersError } = await adminClient
      .from("profiles")
      .select("user_id")
      .limit(100); // Batch for now

    if (usersError) throw usersError;

    console.log(`[Backfill] Processing ${users?.length} users...`);

    const results = [];
    for (const user of users || []) {
      const userId = user.user_id;

      // Ensure medical map
      await adminClient.rpc("ensure_user_medical_domain_map", { p_user_id: userId });

      // Trigger approval score recalculation
      // We call the existing calculate-approval-score logic by invoking the function
      // Or we can just import the logic if we were in the same file, but here we'll use a fetch to the other function
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/calculate-approval-score`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey
          },
          body: JSON.stringify({ target_user_id: userId, source: "backfill" })
        });
        const data = await res.json();
        results.push({ userId, status: "success", score: data.score });
      } catch (err) {
        console.error(`[Backfill] Error for user ${userId}:`, err);
        results.push({ userId, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("backfill-data error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
