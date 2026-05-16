import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const auth = await requireAuth(req);
        if (!auth.ok) return auth.response;
        
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

        // Fetch high-level cognitive metrics
        const [
            analyticsRes,
            governanceRes,
            tutorEffRes,
            plannerEffRes,
            incidentsRes,
            costsRes
        ] = await Promise.all([
            supabase.from("cognitive_analytics").select("*").limit(100),
            supabase.from("ai_governance_logs").select("*").order("audited_at", { ascending: false }).limit(50),
            supabase.from("tutor_effectiveness").select("pedagogical_impact_score, average_depth_score, hallucination_detected"),
            supabase.from("planner_effectiveness").select("progress_delta, accepted"),
            supabase.from("self_healing_incidents").select("*").order("detected_at", { ascending: false }).limit(20),
            supabase.from("ai_cost_metrics").select("cost_usd, tokens_input, tokens_output")
        ]);

        const totalUsers = analyticsRes.data?.length || 0;
        const avgRetention = analyticsRes.data?.reduce((s, a) => s + (a.overall_retention || 0), 0) / (totalUsers || 1);
        const avgRecovery = analyticsRes.data?.reduce((s, a) => s + (a.recovery_success_rate || 0), 0) / (totalUsers || 1);
        const highRiskChurn = analyticsRes.data?.filter(a => (a.fatigue_score || 0) > 80 || a.overload_flag).length || 0;

        const totalCost = (costsRes.data || []).reduce((s, c) => s + Number(c.cost_usd || 0), 0);
        const totalTokens = (costsRes.data || []).reduce((s, c) => s + (c.tokens_input || 0) + (c.tokens_output || 0), 0);

        const report = {
            cognitive: {
                total_users: totalUsers,
                average_retention: avgRetention,
                average_recovery_success: avgRecovery,
                high_risk_churn_count: highRiskChurn,
                active_overload_count: analyticsRes.data?.filter(a => a.overload_flag).length || 0
            },
            ai_governance: {
                total_incidents_30d: (governanceRes.data?.length || 0) + (incidentsRes.data?.length || 0),
                hallucination_incidents: (governanceRes.data?.filter(g => g.incident_type === 'hallucination').length || 0) + 
                                       (incidentsRes.data?.filter(i => i.incident_type === 'hallucination').length || 0),
                drift_incidents: governanceRes.data?.filter(g => g.incident_type === 'drift').length || 0,
                self_healing_incidents: incidentsRes.data || [],
                average_tutor_impact: tutorEffRes.data?.reduce((s, t) => s + (t.pedagogical_impact_score || 0), 0) / (tutorEffRes.data?.length || 1)
            },
            planner: {
                acceptance_rate: (plannerEffRes.data?.filter(p => p.accepted).length || 0) / (plannerEffRes.data?.length || 1) * 100,
                average_progress_delta: plannerEffRes.data?.reduce((s, p) => s + (p.progress_delta || 0), 0) / (plannerEffRes.data?.length || 1)
            },
            finances: {
                total_ai_cost_usd: totalCost,
                total_tokens: totalTokens,
                cost_per_user: totalCost / (totalUsers || 1)
            }
        };

        return new Response(JSON.stringify(report), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
