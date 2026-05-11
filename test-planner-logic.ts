import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const INTENSITY = {
  leve: { tasksPerDay: 2, daysPerWeek: 4 },
  moderado: { tasksPerDay: 3, daysPerWeek: 5 },
  intenso: { tasksPerDay: 4, daysPerWeek: 6 },
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function buildStudyDates(start: Date, exam: Date, daysPerWeek: number): Date[] {
  const dates: Date[] = [];
  const restDays = 7 - daysPerWeek;
  let cursor = new Date(start);
  while (cursor.getTime() <= exam.getTime()) {
    const dow = cursor.getUTCDay();
    const restSet = new Set<number>();
    if (restDays >= 1) restSet.add(0);
    if (restDays >= 2) restSet.add(6);
    if (restDays >= 3) restSet.add(5);
    if (!restSet.has(dow)) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

async function simulatePlanner(planId: string, targetUserId: string) {
  console.log(`\nSimulating planner for plan=${planId} user=${targetUserId}`);
  
  // 1. Load Plan
  const { data: plan } = await admin.from("professor_plans").select("*").eq("id", planId).single();
  
  // 2. Load Subtopics
  const { data: subtopics } = await admin
    .from("professor_plan_subtopics")
    .select("subtopic_id, sort_order, curriculum_subtopics(nome, topic_id)")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });

  const todayIso = isoDate(new Date());
  const today = new Date(todayIso);
  const examDate = new Date(plan.exam_date);
  
  const profile = INTENSITY[plan.intensity as keyof typeof INTENSITY] || INTENSITY.moderado;
  const studyDates = buildStudyDates(today, examDate, profile.daysPerWeek);

  // 3. Queue Tasks
  const tasksQueue: any[] = [];
  let dayCursor = 0;
  let slotInDay = 0;
  const reviewBacklog: any[] = [];

  const pushTask = (task: any) => {
    tasksQueue.push(task);
    slotInDay++;
    if (slotInDay >= profile.tasksPerDay) {
      slotInDay = 0;
      dayCursor++;
    }
  };

  for (let i = 0; i < subtopics.length; i++) {
    const s = subtopics[i];
    if (dayCursor >= studyDates.length) break;
    const nome = s.curriculum_subtopics?.nome || "Subtema";

    pushTask({
      plan_id: planId,
      user_id: targetUserId,
      planned_date: isoDate(studyDates[dayCursor]),
      task_type: "theory",
      task_payload: { subtopic_id: s.subtopic_id, subtopic_name: nome },
      source: "planner_test",
      status: "pending",
    });
    if (dayCursor >= studyDates.length) break;
    pushTask({
      plan_id: planId,
      user_id: targetUserId,
      planned_date: isoDate(studyDates[dayCursor]),
      task_type: "questions",
      task_payload: { subtopic_id: s.subtopic_id, subtopic_name: nome, target_count: 10 },
      source: "planner_test",
      status: "pending",
    });
    reviewBacklog.push({ subtopicId: s.subtopic_id, nome });
  }

  // 4. Insert
  if (tasksQueue.length > 0) {
    const { data: inserted, error } = await admin.from("professor_plan_daily_tasks").upsert(tasksQueue, { onConflict: "plan_id,user_id,planned_date,task_type", ignoreDuplicates: true }).select("id");
    if (error) console.error("Error inserting tasks:", error);
    else console.log(`Inserted ${inserted?.length || 0} tasks.`);
  }

  // 5. Update Progress
  await admin.from("professor_plan_progress").upsert({
    plan_id: planId,
    user_id: targetUserId,
    progress_percent: 0,
    completed_tasks: 0,
    pending_tasks: tasksQueue.length,
    overdue_tasks: 0,
    last_activity_at: new Date().toISOString()
  });
}

async function runValidation() {
  const idA = "a08a8576-0055-444f-a05c-0ab478aa7886";
  const idB = "e841600c-d62d-411a-9355-f5614af346a1";
  const individualPlanId = "54cf2336-456a-4fd4-b57f-0c1091b89035";
  const classPlanId = "62ed0331-4887-4e08-8b44-298b3e820578";

  await simulatePlanner(individualPlanId, idA);
  await simulatePlanner(classPlanId, idA);
  await simulatePlanner(classPlanId, idB);

  console.log("\nValidation of logic distribution complete.");
}

runValidation();
