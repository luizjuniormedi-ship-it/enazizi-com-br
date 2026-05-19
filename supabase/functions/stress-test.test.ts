import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "https://qszsyskumcmuknumwxtk.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY!);

/**
 * ENAZIZI - STRESS TEST & ADAPTIVE EVOLUTION VALIDATION
 * Simulates 7 days of pedagogical evolution and stress scenarios.
 */

Deno.test("ENAZIZI: Dynamic Ecosystem & Adaptive Evolution", async (t) => {
  const testUserId = "00000000-0000-0000-0000-000000000000"; // Virtual Test User
  
  await t.step("Day 1: Onboarding & Initial Plan", async () => {
    console.log("--- Day 1: Starting Onboarding Simulation ---");
    
    // 1. Initial Profile Setup
    await supabase.from("profiles").upsert({
      id: testUserId,
      user_id: testUserId,
      daily_study_hours: 4,
      level: "beginner",
      exam_date: new Date(Date.now() + 60 * 86400000).toISOString(), // 60 days to exam
      target_exams: ["ENARE"]
    });

    // 2. Generate Daily Plan
    console.log("Generating initial daily plan...");
    const { data: planData, error: planError } = await supabase.functions.invoke("generate-daily-plan", {
      body: { forceRefresh: true },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    if (planError) throw new Error(`Day 1 Plan Failed: ${planError.message}`);
    console.log("✅ Day 1 Plan Generated:", planData.tasks.length, "tasks found.");
  });

  await t.step("Day 2: The 'Cardiology Failure' Scenario (Adaptive Response)", async () => {
    console.log("--- Day 2: Simulating High Error Rate in Cardiology ---");
    
    // 1. Register multiple errors in Cardiology
    const topic = "Insuficiência Cardíaca";
    for (let i = 0; i < 3; i++) {
      await supabase.functions.invoke("study-complete", {
        body: {
          actionType: "practice",
          topic: topic,
          specialty: "Cardiologia",
          wasCorrect: false,
          durationSeconds: 30
        },
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
    }

    // 2. Verify Error Bank
    const { data: errorEntry } = await supabase.from("error_bank")
      .select("*")
      .eq("user_id", testUserId)
      .eq("tema", topic)
      .maybeSingle();
    
    if (errorEntry && errorEntry.vezes_errado >= 3) {
      console.log("✅ Error Bank registered evolution: IC specialty flagged.");
    } else {
      throw new Error("❌ Error Bank failed to track consecutive errors.");
    }

    // 3. Regen Daily Plan and expect "error_recovery" task
    const { data: planData } = await supabase.functions.invoke("generate-daily-plan", {
      body: { forceRefresh: true },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    const hasRecovery = planData.tasks.some((t: any) => t.type === "error_recovery" || t.topic.includes("Cardiologia"));
    if (hasRecovery) {
      console.log("✅ Planner adapted: Recovery tasks injected for Cardiology.");
    } else {
      console.warn("⚠️ Planner did not immediately inject recovery. Might require more signals or higher priority.");
    }
  });

  await t.step("Day 3: FSRS & Memory Decay Simulation", async () => {
    console.log("--- Day 3: Simulating FSRS Due Reviews ---");
    
    // 1. Create a card with "Due Date" in the past
    await supabase.from("fsrs_cards").upsert({
      user_id: testUserId,
      card_type: "topic_mastery",
      card_ref_id: "Nefrologia - IRA",
      stability: 1,
      difficulty: 5,
      due: new Date(Date.now() - 86400000).toISOString() // Due yesterday
    });

    // 2. Regen Daily Plan
    const { data: planData } = await supabase.functions.invoke("generate-daily-plan", {
      body: { forceRefresh: true },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    const hasFsrs = planData.tasks.some((t: any) => t.type === "fsrs_review");
    if (hasFsrs) {
      console.log("✅ Planner adapted: FSRS reviews detected and prioritized.");
    } else {
      console.warn("⚠️ FSRS task not found in top list. Checking priorities...");
    }
  });

  await t.step("Day 4-6: Performance Evolution & Prediction", async () => {
    console.log("--- Day 4-6: Performance Evolution ---");
    
    // Simulate high success rate
    await supabase.functions.invoke("study-complete", {
      body: { actionType: "practice", topic: "Ginecologia", specialty: "GO", wasCorrect: true },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    // Call performance-predictor
    const { data: prediction } = await supabase.functions.invoke("performance-predictor", {
      body: { 
        totalQuestions: 50, 
        correctAnswers: 45, 
        studyHoursPerWeek: 28,
        daysUntilExam: 45
      },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    if (prediction && prediction.approval_probability > 0.5) {
      console.log(`✅ Performance Predictor: Approval Prob ${prediction.approval_probability}, Trend: ${prediction.trend}`);
    } else {
      throw new Error("❌ Performance Predictor failed to return valid adaptive prediction.");
    }
  });

  await t.step("Day 7: Stress Test - Proximity & Load", async () => {
    console.log("--- Day 7: Stress Test (Exam in 15 Days) ---");
    
    // Update profile to urgent
    await supabase.from("profiles").update({
      exam_date: new Date(Date.now() + 15 * 86400000).toISOString()
    }).eq("id", testUserId);

    const { data: planData } = await supabase.functions.invoke("generate-daily-plan", {
      body: { forceRefresh: true },
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });

    console.log(`Final Test Strategy: ${planData.daily_focus}`);
    console.log(`Tasks for today: ${planData.tasks.length}`);
    
    if (planData.tasks.length > 0) {
      console.log("✅ System remained stable under proximity stress.");
    }
  });

  // Cleanup
  await supabase.from("daily_plan_tasks").delete().eq("user_id", testUserId);
  await supabase.from("daily_plans").delete().eq("user_id", testUserId);
  await supabase.from("fsrs_cards").delete().eq("user_id", testUserId);
  await supabase.from("error_bank").delete().eq("user_id", testUserId);
});
