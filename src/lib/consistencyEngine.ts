import { supabase } from "@/integrations/supabase/client";

/**
 * Consistency Engine (P0.7)
 * Periodically verifies metric alignment across Student Dashboard and Professor BI.
 * Alerts when divergence > 1%.
 */
export async function runMetricConsistencyAudit(userId: string) {
  console.info("[METRIC_CONSISTENCY_CHECK] Initiating audit for user:", userId);
  
  // 1. Fetch Student Metrics (aggregated)
  const { data: studentStats } = await supabase.rpc('get_unified_dashboard_data', {
    p_user_id: userId,
    p_today_iso: new Date().toISOString()
  });

  // 2. Fetch Professor BI data for same user
  const { data: profData } = await supabase.functions.invoke('professor-bi-audit', {
    body: { student_id: userId }
  });

  if (!studentStats || !profData) return { status: 'INCOMPLETE', divergence: 0 };

  // 3. Compare critical values
  const studentAccuracy = studentStats.metrics?.accuracy || 0;
  const profAccuracy = profData.accuracy || 0;
  const divergence = Math.abs(studentAccuracy - profAccuracy);

  const report = {
    user_id: userId,
    student_accuracy: studentAccuracy,
    prof_accuracy: profAccuracy,
    divergence,
    status: divergence > 1 ? 'ALERT' : 'PASS',
    timestamp: new Date().toISOString()
  };

  // 4. Trace the result
  await supabase.from('system_trace_log').insert({
    event_type: 'METRIC_CONSISTENCY_CHECK',
    user_id: userId,
    metadata: report
  });

  return report;
}
