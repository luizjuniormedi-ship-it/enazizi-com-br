import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "https://qszsyskumcmuknumwxtk.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

Deno.test("ENAZIZI: DB Connection & Logic Check", async (t) => {
  const testUserId = "00000000-0000-0000-0000-000000000000";

  await t.step("Step 0: Connection", async () => {
    const { data, error } = await supabase.from("error_bank").select("count").limit(1);
    if (error) {
      console.error("DB Error Detail:", JSON.stringify(error, null, 2));
      throw error;
    }
    console.log("✅ DB Connected.");
  });

  await t.step("Step 1: Adaptive Response to Errors", async () => {
    const topic = "Stress Test Topic " + Date.now();
    
    // UPSERT directly
    const { error: upsertError } = await supabase.from("error_bank").upsert({
      user_id: testUserId,
      tema: topic,
      vezes_errado: 5,
      dominado: false,
      updated_at: new Date().toISOString()
    });

    if (upsertError) {
      console.error("Upsert Error:", JSON.stringify(upsertError, null, 2));
      throw upsertError;
    }

    const { data: errorEntry } = await supabase.from("error_bank")
      .select("vezes_errado")
      .eq("user_id", testUserId)
      .eq("tema", topic)
      .single();

    if (errorEntry?.vezes_errado === 5) {
      console.log("✅ Error Bank: Successfully persisted error count.");
    } else {
      throw new Error(`❌ Error Bank: Expected 5, got ${errorEntry?.vezes_errado}`);
    }
    
    // Cleanup
    await supabase.from("error_bank").delete().eq("user_id", testUserId);
  });
});
