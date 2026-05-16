import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Longitudinal Memory Engine: Manages concept decay and retrieval strength.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await req.json();

    // 1. Fetch current memory state
    const { data: memories } = await supabase
      .from("educational_memory")
      .select("*")
      .eq("user_id", user_id)
      .eq("archived", false);

    if (!memories || memories.length === 0) {
      return new Response(JSON.stringify({ message: "No memories to process" }), { headers: corsHeaders });
    }

    const updates = [];

    for (const memory of memories) {
      const lastAccessed = new Date(memory.last_accessed_at || memory.created_at);
      const daysSince = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
      
      // Memory Decay Logic (Simple Ebbinghaus inspired)
      // Score drops faster if not accessed
      let newScore = Number(memory.memory_score || 0.5);
      const decayFactor = 0.05 * daysSince;
      newScore = Math.max(0.1, newScore - decayFactor);

      updates.push({
        id: memory.id,
        memory_score: newScore,
        updated_at: new Date().toISOString()
      });
    }

    // 2. Bulk update (using a loop for simplicity in this turn, ideally use an RPC or upsert)
    for (const up of updates) {
      await supabase.from("educational_memory").update({ memory_score: up.memory_score }).eq("id", up.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed_count: updates.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
