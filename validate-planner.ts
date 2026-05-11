import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function runValidation() {
  console.log("Starting Automated Validation of Proficiency Planner...");

  const professorEmail = "raphaelcalima@hotmail.com";
  const studentA = "kakausousaa@gmail.com";
  const studentB = "dan.azevedo89@gmail.com";
  const studentC = "matheusamorim@outlook.com";

  // 1. Seed the environment
  console.log("\n[1/4] Seeding environment...");
  const { data: seedData, error: seedError } = await supabase.functions.invoke("seed-proficiency-pilot", {
    body: {
      professorEmail,
      studentEmails: [studentA, studentB]
    },
    headers: {
      "x-admin-secret": Deno.env.get("SEED_PILOT_ADMIN_SECRET") || ""
    }
  });

  if (seedError) {
    console.error("Seed failed:", seedError);
    return;
  }
  console.log("Seed success:", JSON.stringify(seedData, null, 2));

  const { planoIndividual, planoTurma, turma } = seedData;

  // 2. Run Planner for Students
  console.log("\n[2/4] Running proficiency-planner for students...");
  
  // Get user IDs
  const { data: students } = await supabase.from("profiles").select("user_id, email").in("email", [studentA, studentB, studentC]);
  const idA = students?.find(s => s.email === studentA)?.user_id;
  const idB = students?.find(s => s.email === studentB)?.user_id;
  const idC = students?.find(s => s.email === studentC)?.user_id;

  // Plan A: Individual for Student A
  console.log(`Generating individual plan for Student A (${studentA})...`);
  const { data: resA, error: errA } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoIndividual.id, targetUserId: idA }
  });
  if (errA) console.error("Planner A failed:", errA);
  else console.log("Planner A success:", resA.insertedTasks, "tasks created.");

  // Plan Turma: For both A and B
  console.log(`Generating class plan for Student A (${studentA})...`);
  const { data: resTurmaA, error: errTurmaA } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idA }
  });
  if (errTurmaA) console.error("Planner Turma A failed:", errTurmaA);
  else console.log("Planner Turma A success:", resTurmaA.insertedTasks, "tasks created.");

  console.log(`Generating class plan for Student B (${studentB})...`);
  const { data: resTurmaB, error: errTurmaB } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idB }
  });
  if (errTurmaB) console.error("Planner Turma B failed:", errTurmaB);
  else console.log("Planner Turma B success:", resTurmaB.insertedTasks, "tasks created.");

  // 3. Verify Isolation (Student C)
  console.log("\n[3/4] Verifying Isolation for Student C...");
  const { data: resC, error: errC } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idC }
  });
  // Since we are using service role in the edge function, it might bypass the target check if we don't pass the right headers.
  // BUT the edge function has a check: `const { data: tgtIs } = await admin.rpc("user_is_target_of_plan", { _user_id: targetUserId, _plan_id: plan.id });`
  // So it SHOULD fail even with service role if the logic is correct.
  if (errC || resC?.error) {
    console.log("Isolation verified: Student C cannot generate tasks for this plan. Error:", errC?.message || resC?.error);
  } else {
    console.warn("WARNING: Student C was able to generate tasks! Isolation check failed.");
  }

  // 4. Check Data Presence
  console.log("\n[4/4] Verifying data in database...");
  
  const { data: tasksA } = await supabase.from("professor_plan_daily_tasks").select("count").eq("user_id", idA);
  const { data: tasksB } = await supabase.from("professor_plan_daily_tasks").select("count").eq("user_id", idB);
  const { data: tasksC } = await supabase.from("professor_plan_daily_tasks").select("count").eq("user_id", idC);

  console.log(`Tasks for Student A: ${tasksA?.[0]?.count || 0}`);
  console.log(`Tasks for Student B: ${tasksB?.[0]?.count || 0}`);
  console.log(`Tasks for Student C: ${tasksC?.[0]?.count || 0}`);

  console.log("\nValidation Complete.");
}

runValidation();
