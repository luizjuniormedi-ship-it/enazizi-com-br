import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runValidation() {
    const userId = "00000000-0000-0000-0000-000000000000"; // Test user
    const topic = "IAM - Infarto Agudo do Miocárdio";
    const questionId = "d5a9ccd8-9abf-45cb-b3f6-3682818d46d3"; // Using a real-looking UUID

    console.log("--- ENAZIZI ALOS LONGITUDINAL VALIDATION ---");

    // 1. Clean up previous test data
    await supabase.from("error_bank").delete().eq("user_id", userId);
    await supabase.from("pedagogical_events").delete().eq("user_id", userId);
    await supabase.from("fsrs_cards").delete().eq("user_id", userId);
    console.log("Cleanup complete.");

    // 2. Simulate Error Event
    console.log("\n1. Simulating 'simulado_error_detected' event...");
    const { data: event, error: eventError } = await supabase.from("pedagogical_events").insert({
        user_id: userId,
        event_type: 'simulado_error_detected',
        module: 'simulado',
        source: 'test_script',
        entity_type: 'question',
        entity_id: questionId,
        study_context: { topic: topic },
        metadata: { is_correct: false, statement: "Qual o tratamento inicial do IAM?" }
    }).select().single();

    if (eventError) throw eventError;
    console.log(`Event ID: ${event.id} created.`);

    // 3. Trigger Consumer manually (simulating the trigger/webhook)
    console.log("\n2. Triggering pedagogical-event-consumer...");
    const consumerUrl = `${SUPABASE_URL}/functions/v1/pedagogical-event-consumer`;
    const resp = await fetch(consumerUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ event })
    });
    const consumerResult = await resp.json();
    console.log("Consumer Result:", consumerResult);

    // 4. Validate Error Bank
    console.log("\n3. Validating Error Bank registration...");
    const { data: errorEntry } = await supabase.from("error_bank")
        .select("*")
        .eq("user_id", userId)
        .eq("tema", topic)
        .maybeSingle();
    
    if (errorEntry) {
        console.log("✅ Error Bank: Found entry for topic:", errorEntry.tema);
        console.log(`   Vezes errado: ${errorEntry.vezes_errado}`);
    } else {
        console.log("❌ Error Bank: Entry NOT found.");
    }

    // 5. Validate FSRS Card (Triggered by DB)
    console.log("\n4. Validating FSRS Card creation (DB Trigger)...");
    const { data: fsrsCard } = await supabase.from("fsrs_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("card_type", "error_bank")
        .maybeSingle();

    if (fsrsCard) {
        console.log("✅ FSRS Card: Found card linked to error.");
        console.log(`   Due: ${fsrsCard.due}, Stability: ${fsrsCard.stability}`);
    } else {
        console.log("❌ FSRS Card: NOT found.");
    }

    // 6. Validate Cognitive State Update
    console.log("\n5. Validating Cognitive State evolution...");
    const { data: cogState } = await supabase.from("cognitive_states")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (cogState) {
        console.log("✅ Cognitive State: Updated.");
        console.log(`   Error Pressure: ${cogState.error_pressure}`);
        console.log(`   Retention Score: ${cogState.retention_score}`);
    } else {
        console.log("❌ Cognitive State: NOT found.");
    }

    console.log("\n--- VALIDATION COMPLETE ---");
}

runValidation().catch(console.error);
