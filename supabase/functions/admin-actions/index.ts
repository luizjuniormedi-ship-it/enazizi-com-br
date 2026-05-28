import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logAudit = async (sb: any, adminId: string, action: string, targetUserId: string | null, details: Record<string, unknown>) => {
  await sb.from("admin_audit_log").insert({
    admin_user_id: adminId,
    action,
    target_user_id: targetUserId,
    details,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT using getClaims (works with signing-keys system)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Token inválido. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Client 2: Service role — bypasses RLS for admin operations
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    switch (action) {
      case "list_users": {
        const [{ data: profiles }, { data: roles }, { data: subs }, { data: quotas }, { data: domainMaps }, { data: attempts }, { data: presenceData }] = await Promise.all([
          supabaseAuth.from("profiles").select("user_id, display_name, email, is_blocked, created_at, avatar_url, organization_id, status, approved_by, approved_at, faculdade, periodo, phone, user_type").order("created_at", { ascending: false }),
          supabaseAuth.from("user_roles").select("user_id, role"),
          supabaseAuth.from("subscriptions").select("user_id, status, plan_id, plans(name, price)").eq("status", "active"),
          supabaseAuth.from("user_quotas").select("user_id, questions_used, questions_limit"),
          supabaseAuth.from("medical_domain_map").select("user_id, specialty, domain_score, questions_answered"),
          supabaseAuth.from("practice_attempts").select("user_id, correct, created_at"),
          supabaseAuth.from("user_presence").select("user_id, last_seen_at"),
        ]);

        const users = (profiles || []).map((p) => {
          const userRoles = (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role);
          const sub = (subs || []).find((s) => s.user_id === p.user_id);
          const quota = (quotas || []).find((q) => q.user_id === p.user_id);
          const presence = (presenceData || []).find((pr: any) => pr.user_id === p.user_id);
          
          // Evolution summary
          const userDomains = (domainMaps || []).filter((d: any) => d.user_id === p.user_id);
          const avgScore = userDomains.length > 0 ? Math.round(userDomains.reduce((sum: number, d: any) => sum + (d.domain_score || 0), 0) / userDomains.length) : 0;
          const totalQuestions = userDomains.reduce((sum: number, d: any) => sum + (d.questions_answered || 0), 0);
          const specialties = userDomains.length;
          
          // Recent activity
          const userAttempts = (attempts || []).filter((a: any) => a.user_id === p.user_id);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const recentAttempts = userAttempts.filter((a: any) => a.created_at >= sevenDaysAgo).length;
          const correctRecent = userAttempts.filter((a: any) => a.created_at >= sevenDaysAgo && a.correct).length;
          const recentAccuracy = recentAttempts > 0 ? Math.round((correctRecent / recentAttempts) * 100) : 0;
          
          return { ...p, roles: userRoles, subscription: sub || null, quota: quota || null, last_seen_at: presence?.last_seen_at || null, evolution: { avgScore, totalQuestions, specialties, recentAttempts, recentAccuracy } };
        });
        return ok({ users });
      }

      case "approve_user": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        await supabaseAuth.from("profiles").update({
          status: "active",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        }).eq("user_id", target_user_id);
        await logAudit(supabaseAuth, userId, "approve_user", target_user_id, {});
        return ok({ success: true });
      }

      case "reject_user": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        await supabaseAuth.from("profiles").update({ status: "disabled" }).eq("user_id", target_user_id);
        await logAudit(supabaseAuth, userId, "reject_user", target_user_id, {});
        return ok({ success: true });
      }

      case "block_user": {
        const { target_user_id, blocked } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        await supabaseAuth.from("profiles").update({ is_blocked: blocked }).eq("user_id", target_user_id);
        await logAudit(supabaseAuth, userId, blocked ? "block_user" : "unblock_user", target_user_id, { blocked });
        return ok({ success: true, blocked });
      }

      case "change_plan": {
        const { target_user_id, plan_name } = params;
        if (!target_user_id || !plan_name) throw new Error("target_user_id e plan_name obrigatórios");

        const planLimits: Record<string, { price: number; limit: number }> = {
          Free: { price: 0, limit: 50 },
          Pro: { price: 59.9, limit: 2000 },
          Premium: { price: 99.9, limit: 8000 },
          Enterprise: { price: 299.9, limit: 999999 },
        };

        let { data: plan } = await supabaseAuth.from("plans").select("id, name").eq("name", plan_name).single();
        if (!plan) {
          const cfg = planLimits[plan_name] || { price: 0, limit: 50 };
          const { data: newPlan } = await supabaseAuth.from("plans").insert({ name: plan_name, price: cfg.price, features_json: [] }).select("id").single();
          if (!newPlan) throw new Error("Erro ao criar plano");
          plan = { id: newPlan.id, name: plan_name };
        }

        await supabaseAuth.from("subscriptions").update({ status: "canceled" }).eq("user_id", target_user_id).eq("status", "active");
        await supabaseAuth.from("subscriptions").insert({ user_id: target_user_id, plan_id: plan.id, status: "active" });
        const limit = planLimits[plan_name]?.limit || 50;
        await supabaseAuth.from("user_quotas").upsert({ user_id: target_user_id, questions_limit: limit, questions_used: 0 }, { onConflict: "user_id" });
        await logAudit(supabaseAuth, userId, "change_plan", target_user_id, { plan_name });
        return ok({ success: true, plan: plan_name });
      }

      case "toggle_admin": {
        const { target_user_id, make_admin } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        if (target_user_id === userId) throw new Error("Você não pode remover seu próprio acesso admin.");

        if (make_admin) {
          await supabaseAuth.from("user_roles").upsert({ user_id: target_user_id, role: "admin" }, { onConflict: "user_id,role" });
        } else {
          await supabaseAuth.from("user_roles").delete().eq("user_id", target_user_id).eq("role", "admin");
        }
        await logAudit(supabaseAuth, userId, make_admin ? "promote_admin" : "demote_admin", target_user_id, { make_admin });
        return ok({ success: true, is_admin: make_admin });
      }

      case "toggle_professor": {
        const { target_user_id, make_professor } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");

        if (make_professor) {
          await supabaseAuth.from("user_roles").upsert({ user_id: target_user_id, role: "professor" }, { onConflict: "user_id,role" });
        } else {
          await supabaseAuth.from("user_roles").delete().eq("user_id", target_user_id).eq("role", "professor");
        }
        await logAudit(supabaseAuth, userId, make_professor ? "promote_professor" : "demote_professor", target_user_id, { make_professor });
        return ok({ success: true, is_professor: make_professor });
      }

      case "reset_password": {
        const { target_user_id, new_password } = params;
        if (!target_user_id || !new_password) throw new Error("target_user_id e new_password obrigatórios");
        if (new_password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
        const { error: updateErr } = await supabaseAuth.auth.admin.updateUserById(target_user_id, { password: new_password });
        if (updateErr) throw new Error(`Erro ao redefinir senha: ${updateErr.message}`);
        await logAudit(supabaseAuth, userId, "reset_password", target_user_id, {});
        return ok({ success: true });
      }

      case "get_stats": {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const [{ count: totalUsers }, { count: blockedUsers }, { data: activeSubs }, { count: pendingUsers }, { count: onlineUsers }, { data: onlineDetails }] = await Promise.all([
          supabaseAuth.from("profiles").select("id", { count: "exact", head: true }),
          supabaseAuth.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", true),
          supabaseAuth.from("subscriptions").select("plans(name)").eq("status", "active"),
          supabaseAuth.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabaseAuth.from("user_presence").select("user_id", { count: "exact", head: true }).gte("last_seen_at", fiveMinutesAgo),
          supabaseAuth.from("user_presence").select("user_id, last_seen_at, current_page").gte("last_seen_at", fiveMinutesAgo),
        ]);

        // Enrich online users with names
        let onlineUsersData: any[] = [];
        if (onlineDetails && onlineDetails.length > 0) {
          const onlineIds = onlineDetails.map((o: any) => o.user_id);
          const { data: onlineProfiles } = await supabaseAuth.from("profiles").select("user_id, display_name, email").in("user_id", onlineIds);
          onlineUsersData = onlineDetails.map((o: any) => {
            const profile = (onlineProfiles || []).find((p: any) => p.user_id === o.user_id);
            return { ...o, display_name: profile?.display_name || "Sem nome", email: profile?.email || "" };
          });
        }

        const planCounts: Record<string, number> = {};
        (activeSubs || []).forEach((s: any) => {
          const name = s.plans?.name || "Free";
          planCounts[name] = (planCounts[name] || 0) + 1;
        });

        return ok({ totalUsers: totalUsers || 0, blockedUsers: blockedUsers || 0, activeSubs: activeSubs?.length || 0, pendingUsers: pendingUsers || 0, planCounts, onlineUsers: onlineUsers || 0, onlineUsersData });
      }

      case "get_user_tracking": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");

        const [
          { data: profile },
          { data: performance },
          { data: domainMap },
          { data: errorBank },
          { data: attempts },
          { data: flashcards },
          { data: studyPlans },
          { data: examSessions },
          { data: diagnostics },
          { data: quota },
          { count: questionsCreated },
          { count: clinicalSimulations },
          { count: anamnesisCompleted },
          { count: summariesCreated },
          { count: discursivasCompleted },
          { count: uploadsCount },
        ] = await Promise.all([
          supabaseAuth.from("profiles").select("*").eq("user_id", target_user_id).maybeSingle(),
          supabaseAuth.from("study_performance").select("*").eq("user_id", target_user_id).order("updated_at", { ascending: false }).limit(1),
          supabaseAuth.from("medical_domain_map").select("*").eq("user_id", target_user_id).order("domain_score", { ascending: false }),
          supabaseAuth.from("error_bank").select("id, tema, subtema, vezes_errado, created_at").eq("user_id", target_user_id).order("vezes_errado", { ascending: false }).limit(20),
          supabaseAuth.from("practice_attempts").select("id, correct, created_at").eq("user_id", target_user_id).order("created_at", { ascending: false }).limit(200),
          supabaseAuth.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
          supabaseAuth.from("study_plans").select("id, plan_json, updated_at").eq("user_id", target_user_id).order("updated_at", { ascending: false }).limit(1),
          supabaseAuth.from("exam_sessions").select("id, title, score, total_questions, status, started_at, finished_at").eq("user_id", target_user_id).order("started_at", { ascending: false }).limit(10),
          supabaseAuth.from("diagnostic_results").select("*").eq("user_id", target_user_id).order("completed_at", { ascending: false }).limit(1),
          supabaseAuth.from("user_quotas").select("*").eq("user_id", target_user_id).maybeSingle(),
          supabaseAuth.from("questions_bank").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
          supabaseAuth.from("simulation_history").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
          supabaseAuth.from("anamnesis_results").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
          supabaseAuth.from("summaries").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
          supabaseAuth.from("discursive_attempts").select("id", { count: "exact", head: true }).eq("user_id", target_user_id).not("finished_at", "is", null),
          supabaseAuth.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", target_user_id),
        ]);

        // Calculate stats from attempts
        const totalAttempts = (attempts || []).length;
        const correctAttempts = (attempts || []).filter((a: any) => a.correct).length;
        const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const recentAttempts = (attempts || []).filter((a: any) => a.created_at >= sevenDaysAgo).length;

        return ok({
          profile,
          performance: performance?.[0] || null,
          domainMap: domainMap || [],
          errorBank: errorBank || [],
          stats: { totalAttempts, correctAttempts, accuracy, recentAttempts },
          flashcardsCount: flashcards || 0,
          latestPlan: studyPlans?.[0] || null,
          examSessions: examSessions || [],
          diagnostic: diagnostics?.[0] || null,
          quota: quota || null,
          activityMetrics: {
            questionsCreated: questionsCreated || 0,
            clinicalSimulations: clinicalSimulations || 0,
            anamnesisCompleted: anamnesisCompleted || 0,
            summariesCreated: summariesCreated || 0,
            discursivasCompleted: discursivasCompleted || 0,
            uploadsCount: uploadsCount || 0,
          },
        });
      }

      case "get_audit_log": {
        const { limit = 50 } = params;
        const { data: logs } = await supabaseAuth
          .from("admin_audit_log")
          .select("id, admin_user_id, action, target_user_id, details, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        const userIds = new Set<string>();
        (logs || []).forEach((l: any) => {
          if (l.admin_user_id) userIds.add(l.admin_user_id);
          if (l.target_user_id) userIds.add(l.target_user_id);
        });

        const { data: profiles } = await supabaseAuth
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", Array.from(userIds));

        const profileMap: Record<string, { name: string; email: string }> = {};
        (profiles || []).forEach((p) => {
          profileMap[p.user_id] = { name: p.display_name || "Sem nome", email: p.email || "" };
        });

        const enriched = (logs || []).map((l: any) => ({
          ...l,
          admin_name: profileMap[l.admin_user_id]?.name || "Desconhecido",
          admin_email: profileMap[l.admin_user_id]?.email || "",
          target_name: l.target_user_id ? profileMap[l.target_user_id]?.name || "Desconhecido" : null,
          target_email: l.target_user_id ? profileMap[l.target_user_id]?.email || "" : null,
        }));

        return ok({ logs: enriched });
      }

      case "get_user_access": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        const { data: modules } = await supabaseAuth
          .from("user_module_access")
          .select("module_key, enabled")
          .eq("user_id", target_user_id);
        return ok({ modules: modules || [] });
      }

      case "set_user_access": {
        const { target_user_id, modules } = params;
        if (!target_user_id || !modules) throw new Error("target_user_id e modules obrigatórios");
        
        // modules is an array of { module_key: string, enabled: boolean }
        for (const mod of modules as { module_key: string; enabled: boolean }[]) {
          await supabaseAuth
            .from("user_module_access")
            .upsert(
              { user_id: target_user_id, module_key: mod.module_key, enabled: mod.enabled, granted_by: userId },
              { onConflict: "user_id,module_key" }
            );
        }
        await logAudit(supabaseAuth, userId, "set_user_access", target_user_id, { modules_count: (modules as any[]).length });
        return ok({ success: true });
      }

      case "get_bi_data": {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        // [ANALYTICS_EXCLUSION_APPLIED] Sprint 2.3 — filtro defensivo de usuários sintéticos/bots.
        // NÃO altera dados crus; apenas exclui da camada analítica oficial.
        const { data: excludedRows } = await supabaseAuth
          .from("analytics_excluded_users")
          .select("user_id");
        const excludedIds: string[] = (excludedRows || []).map((r: any) => r.user_id);
        const excludedPgList = excludedIds.length > 0
          ? `(${excludedIds.map((id) => `"${id}"`).join(",")})`
          : null;
        console.log(`[ANALYTICS_EXCLUSION_APPLIED] get_bi_data excluding ${excludedIds.length} user(s) from analytics`);
        console.log(`[ANALYTICS_RAW_DATA_PRESERVED] historical sessions/attempts untouched — filter is read-only`);

        const applyExcl = (q: any, col = "user_id") =>
          excludedPgList ? q.not(col, "in", excludedPgList) : q;

        const [
          { data: allProfiles },
          { data: recentAttempts },
          { count: totalAttempts },
          { count: correctAttemptsCount },
          { count: simulations },
          { count: anamnesis },
          { count: discursives },
          { count: summariesCount },
          { count: uploadsCount },
          { data: presenceData },
          { count: activeUsersCount },
          { data: examSessionsData },
          { data: teacherResults },
        ] = await Promise.all([
          supabaseAuth.from("profiles").select("user_id, display_name, email, faculdade, periodo, status, created_at"),
          applyExcl(supabaseAuth.from("practice_attempts").select("user_id, correct, created_at").gte("created_at", thirtyDaysAgo)),
          applyExcl(supabaseAuth.from("practice_attempts").select("id", { count: "exact", head: true })),
          applyExcl(supabaseAuth.from("practice_attempts").select("id", { count: "exact", head: true }).eq("correct", true)),
          applyExcl(supabaseAuth.from("simulation_history").select("id", { count: "exact", head: true })),
          applyExcl(supabaseAuth.from("anamnesis_results").select("id", { count: "exact", head: true })),
          applyExcl(supabaseAuth.from("discursive_attempts").select("id", { count: "exact", head: true }).not("finished_at", "is", null)),
          supabaseAuth.from("summaries").select("id", { count: "exact", head: true }),
          supabaseAuth.from("uploads").select("id", { count: "exact", head: true }),
          supabaseAuth.from("user_presence").select("user_id, last_seen_at, current_page"),
          applyExcl(supabaseAuth.from("user_presence").select("user_id", { count: "exact", head: true }).gte("last_seen_at", sevenDaysAgo)),
          applyExcl(supabaseAuth.from("exam_sessions").select("id, user_id, score, total_questions, status").eq("status", "finished")),
          applyExcl(supabaseAuth.from("teacher_simulado_results").select("id, student_id, score, total_questions").not("score", "is", null), "student_id"),
        ]);
        console.log(`[ANALYTICS_WIDGET_VALIDATED] get_bi_data simulados/practice: totalAttempts=${totalAttempts ?? 0} simulations=${simulations ?? 0} examSessions=${examSessionsData?.length ?? 0}`);

        // KPIs
        const totalQuestions = (totalAttempts || 0) + (examSessionsData?.length || 0) + (teacherResults?.length || 0);
        const correctCount = correctAttemptsCount || 0;
        const avgAccuracy = (totalAttempts || 0) > 0 ? Math.round(((correctCount as number) / (totalAttempts as number)) * 100) : 0;
        const totalUsers = (allProfiles || []).length;
        const retention = totalUsers > 0 ? Math.round(((activeUsersCount || 0) / totalUsers) * 100) : 0;

        // Daily activity (last 30 days)
        const dailyMap: Record<string, number> = {};
        (recentAttempts || []).forEach((a: any) => {
          const day = a.created_at.substring(0, 10);
          dailyMap[day] = (dailyMap[day] || 0) + 1;
        });
        const dailyActivity = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

        // Module engagement
        const moduleEngagement = [
          { module: "Questões", count: totalAttempts || 0 },
          { module: "Simulações", count: simulations || 0 },
          { module: "Anamneses", count: anamnesis || 0 },
          { module: "Discursivas", count: discursives || 0 },
          { module: "Resumos", count: summariesCount || 0 },
          { module: "Uploads", count: uploadsCount || 0 },
        ];

        // Users by faculdade
        const faculdadeMap: Record<string, number> = {};
        (allProfiles || []).forEach((p: any) => {
          const f = p.faculdade || "Não informado";
          faculdadeMap[f] = (faculdadeMap[f] || 0) + 1;
        });
        const byFaculdade = Object.entries(faculdadeMap).sort(([, a], [, b]) => b - a).slice(0, 15).map(([name, value]) => ({ name, value }));

        // Users by periodo
        const periodoMap: Record<string, number> = {};
        (allProfiles || []).forEach((p: any) => {
          const per = p.periodo ? `${p.periodo}º` : "N/I";
          periodoMap[per] = (periodoMap[per] || 0) + 1;
        });
        const byPeriodo = Object.entries(periodoMap).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));

        // Top 10 users by attempts
        const userAttemptsMap: Record<string, { total: number; correct: number }> = {};
        (recentAttempts || []).forEach((a: any) => {
          if (!userAttemptsMap[a.user_id]) userAttemptsMap[a.user_id] = { total: 0, correct: 0 };
          userAttemptsMap[a.user_id].total++;
          if (a.correct) userAttemptsMap[a.user_id].correct++;
        });
        const topUsers = Object.entries(userAttemptsMap)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 10)
          .map(([userId, stats]) => {
            const profile = (allProfiles || []).find((p: any) => p.user_id === userId);
            const presence = (presenceData || []).find((p: any) => p.user_id === userId);
            return {
              user_id: userId,
              name: profile?.display_name || profile?.email || "Anônimo",
              questions: stats.total,
              accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
              last_seen: presence?.last_seen_at || null,
            };
          });

        // Peak hours from presence
        const hourMap: Record<number, number> = {};
        (presenceData || []).forEach((p: any) => {
          const hour = new Date(p.last_seen_at).getHours();
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        });
        const peakHours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, count: hourMap[i] || 0 }));

        return ok({
          kpis: { totalQuestions, avgAccuracy, activeUsers7d: activeUsersCount || 0, retention, totalUsers },
          dailyActivity,
          moduleEngagement,
          byFaculdade,
          byPeriodo,
          topUsers,
          peakHours,
        });
      }

      case "force_logout": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        if (target_user_id === userId) throw new Error("Você não pode desconectar a si mesmo.");
        const { error: banErr } = await supabaseAuth.auth.admin.updateUserById(target_user_id, { ban_duration: "1s" });
        if (banErr) throw new Error(`Erro ao desconectar: ${banErr.message}`);
        await supabaseAuth.auth.admin.updateUserById(target_user_id, { ban_duration: "none" });
        await logAudit(supabaseAuth, userId, "force_logout", target_user_id, {});
        return ok({ success: true });
      }

      case "delete_user": {
        const { target_user_id } = params;
        if (!target_user_id) throw new Error("target_user_id obrigatório");
        if (target_user_id === userId) throw new Error("Você não pode excluir a si mesmo.");

        // Delete user data from all related tables
        await Promise.all([
          supabaseAuth.from("practice_attempts").delete().eq("user_id", target_user_id),
          supabaseAuth.from("error_bank").delete().eq("user_id", target_user_id),
          supabaseAuth.from("flashcards").delete().eq("user_id", target_user_id),
          supabaseAuth.from("summaries").delete().eq("user_id", target_user_id),
          supabaseAuth.from("uploads").delete().eq("user_id", target_user_id),
          supabaseAuth.from("study_plans").delete().eq("user_id", target_user_id),
          supabaseAuth.from("study_tasks").delete().eq("user_id", target_user_id),
          supabaseAuth.from("study_performance").delete().eq("user_id", target_user_id),
          supabaseAuth.from("medical_domain_map").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_gamification").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_achievements").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_quotas").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_module_access").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_presence").delete().eq("user_id", target_user_id),
          supabaseAuth.from("subscriptions").delete().eq("user_id", target_user_id),
          supabaseAuth.from("exam_sessions").delete().eq("user_id", target_user_id),
          supabaseAuth.from("simulation_history").delete().eq("user_id", target_user_id),
          supabaseAuth.from("anamnesis_results").delete().eq("user_id", target_user_id),
          supabaseAuth.from("discursive_attempts").delete().eq("user_id", target_user_id),
          supabaseAuth.from("enazizi_progress").delete().eq("user_id", target_user_id),
          supabaseAuth.from("performance_predictions").delete().eq("user_id", target_user_id),
          supabaseAuth.from("diagnostic_results").delete().eq("user_id", target_user_id),
          supabaseAuth.from("daily_plans").delete().eq("user_id", target_user_id),
          supabaseAuth.from("cronograma_config").delete().eq("user_id", target_user_id),
          supabaseAuth.from("user_feedback").delete().eq("user_id", target_user_id),
          supabaseAuth.from("clinical_cases").delete().eq("user_id", target_user_id),
          supabaseAuth.from("questions_bank").delete().eq("user_id", target_user_id),
        ]);

        // Delete chat data (messages first due to FK)
        const { data: convos } = await supabaseAuth.from("chat_conversations").select("id").eq("user_id", target_user_id);
        if (convos && convos.length > 0) {
          const convoIds = convos.map((c: any) => c.id);
          await supabaseAuth.from("chronicle_favorites").delete().in("conversation_id", convoIds);
          await supabaseAuth.from("chat_messages").delete().in("conversation_id", convoIds);
          await supabaseAuth.from("chat_conversations").delete().eq("user_id", target_user_id);
        }

        // Delete revision data (desempenho first due to FK)
        const { data: temas } = await supabaseAuth.from("temas_estudados").select("id").eq("user_id", target_user_id);
        if (temas && temas.length > 0) {
          const temaIds = temas.map((t: any) => t.id);
          await supabaseAuth.from("desempenho_questoes").delete().in("tema_id", temaIds);
          await supabaseAuth.from("revisoes").delete().in("tema_id", temaIds);
        }
        await supabaseAuth.from("temas_estudados").delete().eq("user_id", target_user_id);

        // Delete roles and profile
        await supabaseAuth.from("user_roles").delete().eq("user_id", target_user_id);
        await supabaseAuth.from("profiles").delete().eq("user_id", target_user_id);

        // Finally delete the auth user
        const { error: deleteErr } = await supabaseAuth.auth.admin.deleteUser(target_user_id);
        if (deleteErr) throw new Error(`Erro ao excluir usuário: ${deleteErr.message}`);

        await logAudit(supabaseAuth, userId, "delete_user", target_user_id, {});
        return ok({ success: true });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
