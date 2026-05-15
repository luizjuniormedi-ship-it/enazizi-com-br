import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric?: number;
  threshold?: number;
}

// ── In-memory cache for health check results (5 min TTL) ──
let cachedFullResult: { data: any; ts: number } | null = null;
let cachedDashResult: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Loop 3E: bloqueia chamadas anônimas (endpoint admin/health).
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "full";

    // ── DASHBOARD MODE: return comprehensive metrics ──
    if (mode === "dashboard") {
      // Check cache first
      if (cachedDashResult && Date.now() - cachedDashResult.ts < CACHE_TTL_MS) {
        return new Response(JSON.stringify(cachedDashResult.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const yesterday = new Date(now.getTime() - 86400000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      // Parallel queries for all metrics
      const [
        activeUsersRes,
        totalUsersRes,
        dailyPlansRes,
        tasksCompletedRes,
        tasksOverdueRes,
        aiLogsRes,
        aiFailuresRes,
        approvalScoresRes,
        questionsCountRes,
        pendingProfilesRes,
        recentErrorsRes,
        topTopicsRes,
        weakTopicsRes,
      ] = await Promise.all([
        // Active users (seen in last 15 min)
        supabase
          .from("user_presence")
          .select("user_id", { count: "exact", head: true })
          .gte("last_seen_at", new Date(now.getTime() - 15 * 60000).toISOString()),
        // Total users
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        // Daily plans generated today
        supabase
          .from("daily_plans")
          .select("id", { count: "exact", head: true })
          .eq("plan_date", today),
        // Tasks completed today
        supabase
          .from("daily_plans")
          .select("completed_count")
          .eq("plan_date", today),
        // Overdue tasks (plans with low completion from yesterday)
        supabase
          .from("daily_plans")
          .select("total_blocks, completed_count")
          .eq("plan_date", new Date(now.getTime() - 86400000).toISOString().split("T")[0]),
        // AI usage logs (last 24h)
        supabase
          .from("ai_usage_logs")
          .select("function_name, response_time_ms, success, created_at")
          .gte("created_at", yesterday)
          .order("created_at", { ascending: false })
          .limit(500),
        // AI failures (last 24h)
        supabase
          .from("ai_usage_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", yesterday)
          .eq("success", false),
        // Approval scores (latest per user, for average)
        supabase
          .from("approval_scores")
          .select("score, user_id")
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: false })
          .limit(200),
        // Total questions in bank
        supabase
          .from("questions_bank")
          .select("id", { count: "exact", head: true })
          .eq("is_global", true),
        // Pending profiles
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        // Recent errors in error_bank
        supabase
          .from("error_bank")
          .select("tema", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        // Most studied topics (last 7 days)
        supabase
          .from("user_topic_profiles")
          .select("topic, total_questions")
          .gte("updated_at", weekAgo)
          .order("total_questions", { ascending: false })
          .limit(10),
        // Weakest topics
        supabase
          .from("user_topic_profiles")
          .select("topic, accuracy, total_questions")
          .gte("total_questions", 5)
          .order("accuracy", { ascending: true })
          .limit(10),
      ]);

      // Process AI usage by module
      const aiLogs = aiLogsRes.data || [];
      const aiByModule: Record<string, number> = {};
      let totalResponseTime = 0;
      for (const log of aiLogs) {
        aiByModule[log.function_name] = (aiByModule[log.function_name] || 0) + 1;
        totalResponseTime += log.response_time_ms || 0;
      }

      // Calculate tasks completed sum
      const tasksData = tasksCompletedRes.data || [];
      const totalTasksCompleted = tasksData.reduce((sum: number, d: any) => sum + (d.completed_count || 0), 0);

      // Calculate overdue
      const overdueData = tasksOverdueRes.data || [];
      const overdueTasks = overdueData.reduce((sum: number, d: any) => {
        const incomplete = (d.total_blocks || 0) - (d.completed_count || 0);
        return sum + Math.max(0, incomplete);
      }, 0);

      // Average approval score (deduplicate by user)
      const scoresByUser: Record<string, number> = {};
      for (const s of (approvalScoresRes.data || [])) {
        if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = s.score;
      }
      const scoreValues = Object.values(scoresByUser);
      const avgApprovalScore = scoreValues.length > 0
        ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
        : 0;

      // Deduplicate top topics
      const topTopicMap: Record<string, number> = {};
      for (const t of (topTopicsRes.data || [])) {
        topTopicMap[t.topic] = (topTopicMap[t.topic] || 0) + t.total_questions;
      }
      const topTopics = Object.entries(topTopicMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, count]) => ({ topic, count }));

      // Deduplicate weak topics
      const weakTopicMap: Record<string, { accuracy: number; count: number; n: number }> = {};
      for (const t of (weakTopicsRes.data || [])) {
        if (!weakTopicMap[t.topic]) weakTopicMap[t.topic] = { accuracy: 0, count: 0, n: 0 };
        weakTopicMap[t.topic].accuracy += t.accuracy;
        weakTopicMap[t.topic].count += t.total_questions;
        weakTopicMap[t.topic].n += 1;
      }
      const weakTopics = Object.entries(weakTopicMap)
        .map(([topic, d]) => ({ topic, accuracy: Math.round(d.accuracy / d.n), questions: d.count }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 8);

      const executionRate = tasksData.length > 0
        ? Math.round((totalTasksCompleted / tasksData.reduce((s: number, d: any) => s + (d.total_blocks || 1), 0)) * 100)
        : 0;

      // ── STUDENTS & RISK DATA ──
      const [profilesRes, presenceRes, latestScoresRes, plansYesterdayPerUser] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email, status").eq("status", "approved").limit(500),
        supabase.from("user_presence").select("user_id, last_seen_at").order("last_seen_at", { ascending: false }).limit(500),
        supabase.from("approval_scores").select("user_id, score, accuracy").order("created_at", { ascending: false }).limit(500),
        supabase.from("daily_plans").select("user_id, completed_count, total_blocks").eq("plan_date", new Date(now.getTime() - 86400000).toISOString().split("T")[0]).limit(500),
      ]);

      const presenceMap: Record<string, string> = {};
      for (const p of (presenceRes.data || [])) presenceMap[p.user_id] = p.last_seen_at;

      const scoreMap: Record<string, { score: number; accuracy: number }> = {};
      for (const s of (latestScoresRes.data || [])) {
        if (!scoreMap[s.user_id]) scoreMap[s.user_id] = { score: s.score, accuracy: s.accuracy };
      }

      const planMap: Record<string, { completed: number; total: number }> = {};
      for (const p of (plansYesterdayPerUser.data || [])) {
        if (!planMap[p.user_id]) planMap[p.user_id] = { completed: 0, total: 0 };
        planMap[p.user_id].completed += p.completed_count || 0;
        planMap[p.user_id].total += p.total_blocks || 0;
      }

      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const students = (profilesRes.data || []).map((p: any) => {
        const lastSeen = presenceMap[p.user_id] || null;
        const sc = scoreMap[p.user_id] || { score: 0, accuracy: 0 };
        const plan = planMap[p.user_id] || { completed: 0, total: 0 };
        const overdue = Math.max(0, plan.total - plan.completed);

        let status: "green" | "yellow" | "red" = "green";
        if (!lastSeen || lastSeen < sevenDaysAgo || sc.score < 30) status = "red";
        else if (lastSeen < threeDaysAgo || sc.score < 50 || overdue > 3) status = "yellow";

        return {
          user_id: p.user_id,
          display_name: p.display_name || p.email?.split("@")[0] || "—",
          email: p.email || "",
          last_seen_at: lastSeen,
          approval_score: Math.round(sc.score),
          accuracy: Math.round(sc.accuracy),
          tasks_completed: plan.completed,
          tasks_overdue: overdue,
          total_study_minutes: 0,
          status,
        };
      });

      const riskAlerts = students
        .filter((s: any) => s.status === "red" || s.status === "yellow")
        .map((s: any) => {
          let reason = "";
          let severity: "low" | "medium" | "high" = "low";
          const details: string[] = [];

          if (!s.last_seen_at || s.last_seen_at < sevenDaysAgo) {
            reason = "Aluno inativo";
            severity = "high";
            details.push("Sem atividade há mais de 7 dias");
          } else if (s.last_seen_at < threeDaysAgo) {
            reason = "Baixo engajamento";
            severity = "medium";
            details.push("Sem atividade há mais de 3 dias");
          }

          if (s.approval_score < 30) {
            reason = reason || "Score crítico";
            severity = "high";
            details.push(`Score de aprovação: ${s.approval_score}%`);
          } else if (s.approval_score < 50) {
            reason = reason || "Score baixo";
            severity = severity === "high" ? "high" : "medium";
            details.push(`Score de aprovação: ${s.approval_score}%`);
          }

          if (s.tasks_overdue > 3) {
            details.push(`${s.tasks_overdue} tarefas atrasadas`);
          }

          return {
            user_id: s.user_id,
            display_name: s.display_name,
            reason,
            severity,
            details: details.join(" · "),
          };
        })
        .sort((a: any, b: any) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.severity] - order[b.severity];
        });

      const dashboard = {
        system: {
          status: "online",
          uptime: "99.9%",
          apiResponseTime: aiLogs.length > 0 ? Math.round(totalResponseTime / aiLogs.length) : 0,
          errorRate: aiLogs.length > 0
            ? Math.round(((aiFailuresRes.count || 0) / aiLogs.length) * 100 * 10) / 10
            : 0,
        },
        users: {
          activeNow: activeUsersRes.count || 0,
          totalApproved: totalUsersRes.count || 0,
          pendingApproval: pendingProfilesRes.count || 0,
        },
        studyEngine: {
          dailyPlansToday: dailyPlansRes.count || 0,
          tasksCompleted: totalTasksCompleted,
          overdueTasks,
          executionRate,
        },
        ai: {
          totalCalls24h: aiLogs.length,
          avgResponseTime: aiLogs.length > 0 ? Math.round(totalResponseTime / aiLogs.length) : 0,
          failureRate: aiLogs.length > 0
            ? Math.round(((aiFailuresRes.count || 0) / aiLogs.length) * 100 * 10) / 10
            : 0,
          byModule: Object.entries(aiByModule)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, calls]) => ({ name, calls })),
        },
        learning: {
          avgApprovalScore,
          totalQuestionsBank: questionsCountRes.count || 0,
          recentErrors: recentErrorsRes.count || 0,
          topTopics,
          weakTopics,
        },
        students,
        riskAlerts,
        timestamp: now.toISOString(),
      };

      cachedDashResult = { data: dashboard, ts: Date.now() };
      return new Response(JSON.stringify(dashboard), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AI MODE: AI specific health check ──
    if (mode === "ai") {
      const { data: alerts } = await supabase
        .from("pipeline_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(10);
      
      const { data: providers } = await supabase
        .from("ai_provider_health")
        .select("*")
        .order("latency_ms", { ascending: true });
        
      return new Response(JSON.stringify({
        status: providers?.every(p => p.status === "healthy") ? "online" : "degraded",
        active_alerts: alerts?.length || 0,
        alerts,
        providers
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FULL MODE: original alerts logic ──
    // Check cache first
    if (cachedFullResult && Date.now() - cachedFullResult.ts < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cachedFullResult.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const alerts: HealthAlert[] = [];

    const SPECIALTIES = [
      "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
      "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
      "Cirurgia Geral", "Medicina Preventiva", "Nefrologia",
      "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
      "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
      "Otorrinolaringologia", "Emergência", "Semiologia", "Anatomia",
      "Farmacologia", "Oncologia",
    ];

    const countResults = await Promise.all(
      SPECIALTIES.map(async (spec) => {
        const { count } = await supabase
          .from("questions_bank")
          .select("id", { count: "exact", head: true })
          .eq("is_global", true)
          .ilike("topic", `${spec}%`);
        return { spec, count: count || 0 };
      })
    );

    const MIN_PER_SPECIALTY = 20;
    const lowSpecs = countResults.filter((r) => r.count < MIN_PER_SPECIALTY);
    if (lowSpecs.length > 0) {
      const severity = lowSpecs.some((s) => s.count === 0) ? "critical" as const : "warning" as const;
      alerts.push({
        id: "low-questions",
        severity,
        title: "Especialidades com Poucas Questões",
        message: `${lowSpecs.length} especialidade(s) com menos de ${MIN_PER_SPECIALTY} questões: ${lowSpecs.sort((a, b) => a.count - b.count).slice(0, 8).map((s) => `${s.spec} (${s.count})`).join(", ")}`,
        metric: lowSpecs.length,
        threshold: MIN_PER_SPECIALTY,
      });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { data: genLogs } = await supabase
      .from("daily_generation_log")
      .select("*")
      .gte("created_at", yesterday);

    const failedGens = (genLogs || []).filter((l: any) => l.status !== "success");
    if (failedGens.length > 0) {
      alerts.push({
        id: "generation-failed",
        severity: "critical",
        title: "Geração Diária Falhou",
        message: `${failedGens.length} execução(ões) falharam nas últimas 24h.`,
        metric: failedGens.length,
        threshold: 0,
      });
    }

    if ((genLogs || []).length === 0) {
      alerts.push({
        id: "no-generation",
        severity: "critical",
        title: "Nenhuma Geração nas Últimas 24h",
        message: "Nenhum registro de geração de questões encontrado nas últimas 24 horas.",
        metric: 0,
        threshold: 1,
      });
    }

    const { data: pendingUploads } = await supabase
      .from("uploads")
      .select("id, created_at")
      .eq("status", "pending")
      .lt("created_at", yesterday);

    if ((pendingUploads || []).length > 0) {
      alerts.push({
        id: "pending-uploads",
        severity: "warning",
        title: "Uploads Pendentes",
        message: `${pendingUploads!.length} upload(s) pendente(s) há mais de 24 horas.`,
        metric: pendingUploads!.length,
        threshold: 0,
      });
    }

    const { data: quotas } = await supabase
      .from("user_quotas")
      .select("user_id, questions_used, questions_limit");

    const overQuota = (quotas || []).filter(
      (q: any) => q.questions_limit > 0 && q.questions_used / q.questions_limit >= 0.8
    );
    if (overQuota.length > 0) {
      alerts.push({
        id: "quota-exhausted",
        severity: "warning",
        title: "Usuários com Cota Esgotando",
        message: `${overQuota.length} usuário(s) utilizaram 80%+ da cota de questões.`,
        metric: overQuota.length,
        threshold: 0,
      });
    }

    const { count: pendingProfiles } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if ((pendingProfiles || 0) > 0) {
      alerts.push({
        id: "pending-profiles",
        severity: "warning",
        title: "Usuários Pendentes de Aprovação",
        message: `${pendingProfiles} usuário(s) aguardando aprovação.`,
        metric: pendingProfiles || 0,
        threshold: 0,
      });
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: recentFeedback } = await supabase
      .from("user_feedback")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    if ((recentFeedback || 0) > 0) {
      alerts.push({
        id: "unread-feedback",
        severity: "info",
        title: "Feedbacks Recentes",
        message: `${recentFeedback} feedback(s) recebido(s) nos últimos 7 dias.`,
        metric: recentFeedback || 0,
        threshold: 0,
      });
    }

    // AI failure rate alert
    const { data: aiLogs24h } = await supabase
      .from("ai_usage_logs")
      .select("success")
      .gte("created_at", yesterday);

    if (aiLogs24h && aiLogs24h.length > 10) {
      const failures = aiLogs24h.filter((l: any) => !l.success).length;
      const failRate = (failures / aiLogs24h.length) * 100;
      if (failRate > 10) {
        alerts.push({
          id: "ai-high-failure",
          severity: failRate > 25 ? "critical" : "warning",
          title: "Alta Taxa de Falha em IA",
          message: `${failRate.toFixed(1)}% das chamadas de IA falharam nas últimas 24h (${failures}/${aiLogs24h.length}).`,
          metric: failRate,
          threshold: 10,
        });
      }
    }

    const totalCritical = alerts.filter((a) => a.severity === "critical").length;
    const totalWarning = alerts.filter((a) => a.severity === "warning").length;
    const totalInfo = alerts.filter((a) => a.severity === "info").length;

    await supabase.from("system_health_reports").insert({
      alerts,
      total_critical: totalCritical,
      total_warning: totalWarning,
      total_info: totalInfo,
    });

    const fullResult = {
      success: true,
      total_alerts: alerts.length,
      critical: totalCritical,
      warning: totalWarning,
      info: totalInfo,
      alerts,
    };
    cachedFullResult = { data: fullResult, ts: Date.now() };

    return new Response(
      JSON.stringify(fullResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("system-health-check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
