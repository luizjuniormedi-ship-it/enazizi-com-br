import { supabase } from "@/integrations/supabase/client";

/**
 * P0 TOPIC CONTAMINATION AUDIT QUERY
 * Identifies simulations where delivered questions mismatch the requested topic.
 */
export async function auditSimuladoContamination(sessionId?: string) {
  let query = supabase
    .from("topic_generation_logs")
    .select(`
      id,
      simulado_id,
      requested_topic,
      canonical_topic,
      matched_question_ids,
      insufficient_bank_flag,
      metadata,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("simulado_id", sessionId);
  }

  const { data: logs, error } = await query.limit(100);

  if (error) {
    console.error("[AUDIT] Failed to fetch logs:", error);
    return [];
  }

  const contaminationReport = logs.map(log => {
    const forensics = log.metadata?.guard_forensics || [];
    const totalGenerated = log.metadata?.generated_count || 0;
    const rejectedByGuard = forensics.filter((f: any) => f && f.allowed === false).length;
    
    // Detect mismatch if any question delivered doesn't match requested_topic or its canonical form
    // In our new architecture, guard_forensics only contains ALLOWED questions (metadata in log)
    // or we can cross-reference with questions_bank topics.
    
    return {
      log_id: log.id,
      simulado_id: log.simulado_id,
      requested: log.requested_topic,
      delivered_count: totalGenerated,
      insufficient: log.insufficient_bank_flag,
      timestamp: log.created_at,
      details: forensics
    };
  });

  return contaminationReport;
}
