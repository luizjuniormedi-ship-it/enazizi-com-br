import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function runAudit() {
  console.log("--- ENAZIZI MASTER PLANNER 2.0 AUDIT ---");

  // 1. Check Extracted Topics Consistency
  const { data: topics, error: topicsErr } = await supabase
    .from("planner_extracted_topics")
    .select("id, topic, raw_excerpt, source_page, validation_status, confidence_score")
    .limit(10);

  console.log("\n[1] Extracted Topics Sample:");
  if (topicsErr) console.error("Error fetching topics:", topicsErr);
  else console.table(topics);

  const invalidTopics = topics?.filter(t => !t.raw_excerpt || t.confidence_score < 0.5);
  console.log(`- Topics with issues (missing excerpt/low confidence): ${invalidTopics?.length || 0}`);

  // 2. Check Study Plan Items linkage
  const { data: planItems, error: itemsErr } = await supabase
    .from("study_plan_items")
    .select("topic, source, raw_excerpt, source_page")
    .eq("source", "extracted")
    .limit(5);

  console.log("\n[2] Study Plan Items (Linked to PDF):");
  if (itemsErr) console.error("Error fetching items:", itemsErr);
  else console.table(planItems);

  // 3. Check Exam Date Persistence
  const { data: plans, error: plansErr } = await supabase
    .from("study_plans")
    .select("id, exam_date, source")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n[3] Latest Study Plans (Exam Date Check):");
  if (plansErr) console.error("Error fetching plans:", plansErr);
  else console.table(plans);

  // 4. Check Daily Mission Integration
  const { data: dailyPlans, error: dailyErr } = await supabase
    .from("daily_plans")
    .select("id, plan_date, objective")
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("\n[4] Latest Daily Missions:");
  if (dailyErr) console.error("Error fetching daily plans:", dailyErr);
  else console.table(dailyPlans);

  console.log("\n--- AUDIT COMPLETE ---");
}

runAudit();
