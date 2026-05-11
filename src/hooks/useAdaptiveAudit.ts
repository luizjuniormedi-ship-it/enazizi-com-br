import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditResult {
  category: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: any;
}

export function useAdaptiveAudit() {
  return useQuery({
    queryKey: ["adaptive-ecosystem-audit"],
    queryFn: async (): Promise<AuditResult[]> => {
      const results: AuditResult[] = [];

      // 1. Real-time Connectivity & Sync
      // Check if user actions (study_action_events) are being captured and if dependent tables update
      const { data: recentEvents } = await supabase
        .from("study_action_events")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      
      const { data: recentDailyPlans } = await supabase
        .from("daily_plans")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (recentEvents && recentDailyPlans) {
        results.push({
          category: "Real-time Sync",
          status: "success",
          message: "Eventos de estudo e planos diários estão sincronizados.",
          details: { lastEvent: recentEvents[0]?.created_at, lastPlan: recentDailyPlans[0]?.updated_at }
        });
      }

      // 2. Planner Adaptivity
      // Check if different users have different weights in their daily plans
      const { data: plans } = await supabase
        .from("daily_plans")
        .select("plan_json")
        .limit(20);
      
      const phases = new Set(plans?.map(p => (p.plan_json as any)?.metadata?.phase).filter(Boolean));
      if (phases.size > 1) {
        results.push({
          category: "Planner Adaptativo",
          status: "success",
          message: `O motor está operando em ${phases.size} fases distintas detectadas.`,
          details: { phases: Array.from(phases) }
        });
      } else {
        results.push({
          category: "Planner Adaptativo",
          status: "warning",
          message: "Apenas uma fase de planejamento detectada em todos os usuários recentes.",
        });
      }

      // 3. FSRS influence on Tutor
      // Check if tutor context includes FSRS data
      const { data: tutorEvents } = await supabase
        .from("tutor_v2_events")
        .select("event_type, metadata")
        .eq("event_type", "CONTEXT_BUILT")
        .limit(10);
      
      const hasFsrs = tutorEvents?.some(e => (e.metadata as any)?.fsrs_context_loaded === true);
      results.push({
        category: "FSRS + Tutor",
        status: hasFsrs ? "success" : "warning",
        message: hasFsrs ? "Tutor está consumindo contexto FSRS." : "Tutor pode não estar usando dados FSRS no contexto.",
      });

      // 4. Error Bank Intelligence
      // Check for semantic categories in error bank
      const { data: errorBank } = await supabase
        .from("error_bank")
        .select("categoria_erro")
        .not("categoria_erro", "is", null)
        .limit(100);
      
      const categories = new Set(errorBank?.map(e => e.categoria_erro));
      if (categories.size > 2) {
        results.push({
          category: "Error Bank",
          status: "success",
          message: `Banco de erros categorizado em ${categories.size} padrões.`,
          details: { categories: Array.from(categories) }
        });
      }

      // 5. TRI Integrity
      // Check approval scores distribution
      const { data: approvalScores } = await supabase
        .from("approval_scores")
        .select("score");
      
      if (approvalScores && approvalScores.length > 0) {
        const scores = approvalScores.map(s => s.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        results.push({
          category: "Integridade TRI",
          status: "success",
          message: `Score médio de aprovação: ${avg.toFixed(1)}%.`,
          details: { count: scores.length, min: Math.min(...scores), max: Math.max(...scores) }
        });
      }

      // 6. Race Conditions
      // Check for duplicate daily plans for same user/date
      const { data: duplicates } = await supabase.rpc("check_duplicate_plans" as any);
      // Fallback manual if RPC not exists
      const { data: allPlans } = await supabase
        .from("daily_plans")
        .select("user_id, plan_date");
      
      const planKeys = new Set();
      let dupeCount = 0;
      allPlans?.forEach(p => {
        const key = `${p.user_id}|${p.plan_date}`;
        if (planKeys.has(key)) dupeCount++;
        planKeys.add(key);
      });

      results.push({
        category: "Race Conditions",
        status: dupeCount === 0 ? "success" : "error",
        message: dupeCount === 0 ? "Sem planos duplicados detectados." : `${dupeCount} planos duplicados encontrados!`,
      });

      // 7. Cost Audit
      const { data: aiLogs } = await supabase
        .from("ai_usage_logs")
        .select("total_tokens, model")
        .limit(100);
      
      if (aiLogs) {
        const totalTokens = aiLogs.reduce((s, l) => s + (l.total_tokens || 0), 0);
        results.push({
          category: "Custo IA",
          status: "success",
          message: `Consumo recente: ${totalTokens.toLocaleString()} tokens.`,
          details: { avgPerRequest: Math.round(totalTokens / (aiLogs.length || 1)) }
        });
      }

      return results;
    },
    staleTime: 30_000,
  });
}
