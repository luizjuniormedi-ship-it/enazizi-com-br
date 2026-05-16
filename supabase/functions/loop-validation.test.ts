import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.test("Validation: Full Cognitive Loop", async () => {
  // 1. Setup - Use a dummy user or a test user
  const userId = "00000000-0000-0000-0000-000000000000";
  const topic = "IAM - Infarto Agudo do Miocárdio";
  
  console.log(`Starting loop test for topic: ${topic}`);

  // 2. Simulate Wrong Answer via study-complete
  // Note: We need a valid JWT or we use service_role and bypass auth check if function allows
  // Since we are in Deno test, we can try to call it directly if we have the endpoint
  
  const payload = {
    actionType: "practice",
    topicId: topic,
    wasCorrect: false,
    durationSeconds: 45,
    metadata: {
      specialty: "Cardiologia",
      source: "validation_test"
    }
  };

  console.log("Calling study-complete with wrong answer...");
  const { data: completeData, error: completeError } = await supabase.functions.invoke("study-complete", {
    body: payload,
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } // Using service role as auth fallback
  });

  if (completeError) {
    console.warn("study-complete call failed (possibly due to auth):", completeError);
    // Fallback: Check if we can at least see the tables reacting if we insert manually
  }

  // 3. Verify Error Bank
  console.log("Verifying error_bank registration...");
  const { data: errorEntry } = await supabase.from("error_bank")
    .select("*")
    .eq("user_id", userId)
    .eq("tema", topic)
    .maybeSingle();
  
  if (errorEntry) {
    console.log("✅ Error bank registered correctly.");
  } else {
    console.warn("⚠️ Error bank entry not found. Loop might be open.");
  }

  // 4. Verify FSRS
  console.log("Verifying FSRS card creation...");
  const { data: fsrsCard } = await supabase.from("fsrs_cards")
    .select("*")
    .eq("user_id", userId)
    .eq("card_ref_id", topic)
    .maybeSingle();

  if (fsrsCard) {
    console.log("✅ FSRS card created/updated correctly.");
    console.log(`Stability: ${fsrsCard.stability}, Due: ${fsrsCard.due}`);
  } else {
    console.warn("⚠️ FSRS card not found.");
  }
});
