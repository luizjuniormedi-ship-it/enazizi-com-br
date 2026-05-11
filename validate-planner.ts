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

  // Get user IDs
  const { data: profiles } = await supabase.from("profiles").select("user_id, email").in("email", [professorEmail, studentA, studentB, studentC]);
  const profId = profiles?.find(p => p.email === professorEmail)?.user_id;
  const idA = profiles?.find(p => p.email === studentA)?.user_id;
  const idB = profiles?.find(p => p.email === studentB)?.user_id;
  const idC = profiles?.find(p => p.email === studentC)?.user_id;

  if (!profId || !idA || !idB || !idC) {
    console.error("Required users not found.");
    return;
  }

  // 1. Setup Environment
  console.log("\n[1/4] Setting up test environment...");
  
  // Create Institution
  const { data: inst } = await supabase.from("institutions").upsert({ name: "Validation Inst" }, { onConflict: "name" }).select().single();
  
  // Link Prof
  await supabase.from("institution_members").upsert({ institution_id: inst.id, user_id: profId, role: "professor", is_active: true }, { onConflict: "institution_id,user_id" });

  // Create Class
  const { data: turma } = await supabase.from("classes").insert({ name: "Validation Class", institution_id: inst.id, created_by: profId }).select().single();
  
  // Add A and B to class
  await supabase.from("class_members").insert([
    { class_id: turma.id, user_id: idA, role: "student", is_active: true },
    { class_id: turma.id, user_id: idB, role: "student", is_active: true }
  ]);

  // Create Plans
  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 30);
  const examDateStr = examDate.toISOString().slice(0, 10);

  const { data: planoIndividual } = await supabase.from("professor_plans").insert({
    name: "Individual Plan Validation",
    intensity: "moderado",
    exam_date: examDateStr,
    status: "active",
    created_by: profId
  }).select().single();

  const { data: planoTurma } = await supabase.from("professor_plans").insert({
    name: "Class Plan Validation",
    intensity: "leve",
    exam_date: examDateStr,
    status: "active",
    created_by: profId
  }).select().single();

  // Targets
  await supabase.from("professor_plan_targets").insert([
    { plan_id: planoIndividual.id, user_id: idA },
    { plan_id: planoTurma.id, class_id: turma.id }
  ]);

  // Subtopics (just pick some real ones)
  const { data: subtopics } = await supabase.from("curriculum_subtopics").select("id").eq("ativo", true).limit(2);
  if (subtopics && subtopics.length >= 2) {
    await supabase.from("professor_plan_subtopics").insert([
      { plan_id: planoIndividual.id, subtopic_id: subtopics[0].id, sort_order: 0 },
      { plan_id: planoTurma.id, subtopic_id: subtopics[1].id, sort_order: 0 }
    ]);
  }

  console.log("Environment setup complete.");

  // 2. Run Planner for Students
  console.log("\n[2/4] Running proficiency-planner for students...");

  // Plan A: Individual
  console.log(`Generating individual plan for Student A...`);
  const { data: resA } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoIndividual.id, targetUserId: idA }
  });
  console.log("Planner A result:", resA?.insertedTasks || 0, "tasks.");

  // Plan Turma: For A and B
  console.log(`Generating class plan for Student A...`);
  const { data: resTurmaA } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idA }
  });
  console.log("Planner Turma A result:", resTurmaA?.insertedTasks || 0, "tasks.");

  console.log(`Generating class plan for Student B...`);
  const { data: resTurmaB } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idB }
  });
  console.log("Planner Turma B result:", resTurmaB?.insertedTasks || 0, "tasks.");

  // 3. Verify Isolation
  console.log("\n[3/4] Verifying Isolation...");
  
  // Student C tries to generate for the class plan (he's not in the class)
  const { data: resC } = await supabase.functions.invoke("proficiency-planner", {
    body: { planId: planoTurma.id, targetUserId: idC }
  });
  
  if (resC?.error) {
    console.log("Isolation verified: Student C rejected correctly. Error:", resC.error);
  } else {
    console.warn("WARNING: Student C was NOT rejected! Check RLS/Logic.");
  }

  // 4. Check Final Data
  console.log("\n[4/4] Final Data Check...");
  
  const { data: finalTasksA } = await supabase.from("professor_plan_daily_tasks").select("id").eq("user_id", idA).eq("plan_id", planoTurma.id);
  const { data: finalTasksB } = await supabase.from("professor_plan_daily_tasks").select("id").eq("user_id", idB).eq("plan_id", planoTurma.id);
  const { data: finalTasksC } = await supabase.from("professor_plan_daily_tasks").select("id").eq("user_id", idC).eq("plan_id", planoTurma.id);

  console.log(`Class tasks for A: ${finalTasksA?.length || 0}`);
  console.log(`Class tasks for B: ${finalTasksB?.length || 0}`);
  console.log(`Class tasks for C: ${finalTasksC?.length || 0}`);

  const { data: individualTasksA } = await supabase.from("professor_plan_daily_tasks").select("id").eq("user_id", idA).eq("plan_id", planoIndividual.id);
  console.log(`Individual tasks for A: ${individualTasksA?.length || 0}`);

  // Cleanup (optional but good)
  // await supabase.from('professor_plans').delete().in('id', [planoIndividual.id, planoTurma.id]);
  
  console.log("\nValidation Finished.");
}

runValidation();
