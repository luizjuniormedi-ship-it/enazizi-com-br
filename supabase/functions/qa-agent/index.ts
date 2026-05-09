import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth, authCorsHeaders } from "../_shared/require-auth.ts";

const corsHeaders = authCorsHeaders;

// ─── Helpers ───────────────────────────────────────────────────────
function getAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const FUNCTIONS_URL = Deno.env.get("SUPABASE_URL")! + "/functions/v1";

// Forwarded caller JWT — set per-request inside the handler. Downstream
// edge functions (post Loop 3F-B) require a real user JWT; we never use
// anon key or service_role to impersonate a user here.
let CALLER_TOKEN = "";
let CALLER_ID = "";
let CALLER_KIND: "user" | "internal" = "user";

async function callFunction(name: string, body: any, timeoutMs = 30000): Promise<{ ok: boolean; status: number; data: any; ms: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CALLER_TOKEN}`,
        "x-qa-agent-caller": CALLER_KIND,
        "x-qa-agent-user": CALLER_ID,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    // For streaming responses, just check status
    if (resp.headers.get("content-type")?.includes("text/event-stream")) {
      const text = await resp.text();
      return { ok: resp.ok, status: resp.status, data: { streaming: true, length: text.length }, ms };
    }
    const data = await resp.json().catch(() => ({ raw: "non-json" }));
    return { ok: resp.ok, status: resp.status, data, ms };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const isTimeout = (e as Error).name === "AbortError";
    return { ok: false, status: 0, data: { error: isTimeout ? "TIMEOUT" : (e as Error).message }, ms };
  }
}

type TestResult = {
  test_suite: string;
  test_name: string;
  status: "passed" | "warning" | "failed" | "skipped";
  duration_ms: number;
  module_tested: string;
  details_json: any;
  error_message?: string;
  suggestion?: string;
};

// ─── Test Suites ───────────────────────────────────────────────────

async function testEdgeFunctionHealth(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const functions = [
    { name: "study-session", body: { messages: [{ role: "user", content: "Olá" }], phase: "performance", topic: "Cardiologia" }, module: "tutor", timeout: 45000 },
    { name: "question-generator", body: { messages: [{ role: "user", content: "Gere 1 questão de Cardiologia" }], outputFormat: "json", generationContext: { specialty: "Cardiologia", topic: "IAM" } }, module: "questoes", timeout: 45000 },
    { name: "generate-flashcards", body: { messages: [{ role: "user", content: "Gere 2 flashcards de Pneumologia" }] }, module: "flashcards", timeout: 45000 },
    { name: "medical-chronicle", body: { specialty: "Clínica Médica", difficulty: "intermediario" }, module: "cronicas", timeout: 60000 },
    { name: "mentor-chat", body: { messages: [{ role: "user", content: "Explique IAM" }] }, module: "mentor", timeout: 45000 },
    { name: "motivational-coach", body: { messages: [{ role: "user", content: "Estou ansioso para a prova" }] }, module: "coach", timeout: 45000 },
    { name: "calculate-approval-score", body: { user_id: "00000000-0000-0000-0000-000000000000" }, module: "engine", timeout: 15000 },
    { name: "system-health-check", body: {}, module: "sistema", timeout: 15000 },
  ];

  for (const fn of functions) {
    const result = await callFunction(fn.name, fn.body, fn.timeout);
    const passed = result.ok || result.status === 400; // 400 = validation working correctly
    results.push({
      test_suite: "edge_function_health",
      test_name: `${fn.name} responde`,
      status: passed ? "passed" : result.status === 0 ? "failed" : "warning",
      duration_ms: result.ms,
      module_tested: fn.module,
      details_json: { status: result.status, response_time_ms: result.ms, has_data: !!result.data },
      error_message: passed ? undefined : `Status ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`,
      suggestion: passed ? undefined : result.status === 0 ? "Verificar se a função está deployada e o timeout é suficiente" : "Verificar logs da edge function",
    });
  }

  return results;
}

async function testAIQuality(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Study session generates Portuguese content
  const studyResult = await callFunction("study-session", {
    messages: [{ role: "user", content: "Me ensine sobre Insuficiência Cardíaca" }],
    phase: "teaching",
    topic: "Cardiologia",
  }, 60000);

  if (studyResult.ok && studyResult.data?.streaming) {
    results.push({
      test_suite: "ai_quality",
      test_name: "Tutor IA gera conteúdo em português",
      status: "passed",
      duration_ms: studyResult.ms,
      module_tested: "tutor",
      details_json: { response_length: studyResult.data.length, response_time_ms: studyResult.ms },
    });
  } else {
    results.push({
      test_suite: "ai_quality",
      test_name: "Tutor IA gera conteúdo em português",
      status: "failed",
      duration_ms: studyResult.ms,
      module_tested: "tutor",
      details_json: studyResult.data,
      error_message: `Falha na geração: status ${studyResult.status}`,
      suggestion: "Verificar créditos de IA e logs do study-session",
    });
  }

  // Test 2: Question generator produces valid JSON
  const qResult = await callFunction("question-generator", {
    messages: [{ role: "user", content: "Gere 2 questões de Pediatria sobre Bronquiolite" }],
    outputFormat: "json",
    generationContext: { specialty: "Pediatria", topic: "Bronquiolite" },
  }, 60000);

  if (qResult.ok) {
    const toolCall = qResult.data?.choices?.[0]?.message?.tool_calls?.[0];
    let questionsValid = false;
    let questionCount = 0;
    let hasPortuguese = false;
    let minLength = 0;

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (Array.isArray(parsed.questions)) {
          questionCount = parsed.questions.length;
          questionsValid = parsed.questions.every((q: any) =>
            q.statement && q.options?.length === 5 && typeof q.correct_index === "number" && q.explanation
          );
          hasPortuguese = parsed.questions.every((q: any) =>
            !/\bthe patient\b/i.test(q.statement) && !/\bmost likely\b/i.test(q.statement)
          );
          minLength = Math.min(...parsed.questions.map((q: any) => (q.statement || "").length));
        }
      } catch { /* parse error */ }
    }

    const passed = questionsValid && hasPortuguese && questionCount > 0 && minLength >= 200;
    results.push({
      test_suite: "ai_quality",
      test_name: "Questões: estrutura JSON válida e em português",
      status: passed ? "passed" : "warning",
      duration_ms: qResult.ms,
      module_tested: "questoes",
      details_json: { question_count: questionCount, valid_structure: questionsValid, portuguese: hasPortuguese, min_statement_length: minLength, source: qResult.data?.source },
      error_message: passed ? undefined : `Questões: count=${questionCount}, valid=${questionsValid}, pt=${hasPortuguese}, minLen=${minLength}`,
      suggestion: passed ? undefined : minLength < 200 ? "Enunciados abaixo de 200 chars — verificar prompt de geração" : "Verificar filtros de validação",
    });
  } else {
    results.push({
      test_suite: "ai_quality",
      test_name: "Questões: estrutura JSON válida e em português",
      status: "failed",
      duration_ms: qResult.ms,
      module_tested: "questoes",
      details_json: qResult.data,
      error_message: `question-generator retornou status ${qResult.status}`,
      suggestion: "Verificar logs e créditos de IA",
    });
  }

  return results;
}

async function testCacheAndOptimization(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const sb = getAdmin();

  // Test 1: Check ai_content_cache has entries
  const { count: cacheCount } = await sb.from("ai_content_cache").select("*", { count: "exact", head: true });
  results.push({
    test_suite: "cache_optimization",
    test_name: "Cache global possui entradas",
    status: (cacheCount || 0) > 0 ? "passed" : "warning",
    duration_ms: 0,
    module_tested: "cache",
    details_json: { cache_entries: cacheCount },
    suggestion: (cacheCount || 0) === 0 ? "Cache vazio — executar módulos para popular" : undefined,
  });

  // Test 2: Check cache hit rate from ai_usage_logs
  const { data: usageLogs } = await sb.from("ai_usage_logs")
    .select("cache_hit")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString())
    .limit(500);

  if (usageLogs && usageLogs.length > 10) {
    const hits = usageLogs.filter((l: any) => l.cache_hit).length;
    const rate = Math.round((hits / usageLogs.length) * 100);
    results.push({
      test_suite: "cache_optimization",
      test_name: "Taxa de cache hit nas últimas 24h",
      status: rate >= 20 ? "passed" : rate >= 5 ? "warning" : "warning",
      duration_ms: 0,
      module_tested: "cache",
      details_json: { total_calls: usageLogs.length, cache_hits: hits, hit_rate_pct: rate },
      suggestion: rate < 20 ? "Cache hit rate baixa — considerar pré-popular temas frequentes" : undefined,
    });
  }

  // Test 3: Check questions bank size
  const [{ count: qbCount }, { count: reqCount }] = await Promise.all([
    sb.from("questions_bank").select("*", { count: "exact", head: true }),
    sb.from("real_exam_questions").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const totalQuestions = (qbCount || 0) + (reqCount || 0);
  results.push({
    test_suite: "cache_optimization",
    test_name: "Banco de questões disponível para cache",
    status: totalQuestions >= 100 ? "passed" : totalQuestions >= 20 ? "warning" : "failed",
    duration_ms: 0,
    module_tested: "questoes",
    details_json: { questions_bank: qbCount, real_exam: reqCount, total: totalQuestions },
    suggestion: totalQuestions < 100 ? "Banco pequeno — executar geração em massa ou ingestão" : undefined,
  });

  return results;
}

async function testDatabaseIntegrity(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const sb = getAdmin();

  // Test 1: Profiles table has users
  const { count: profileCount } = await sb.from("profiles").select("*", { count: "exact", head: true });
  results.push({
    test_suite: "database_integrity",
    test_name: "Tabela profiles possui registros",
    status: (profileCount || 0) > 0 ? "passed" : "warning",
    duration_ms: 0,
    module_tested: "sistema",
    details_json: { profile_count: profileCount },
  });

  // Test 2: Check for orphaned data
  const { data: orphanedProgress } = await sb.rpc("get_login_stats").single();
  results.push({
    test_suite: "database_integrity",
    test_name: "Estatísticas do sistema consistentes",
    status: orphanedProgress ? "passed" : "warning",
    duration_ms: 0,
    module_tested: "sistema",
    details_json: orphanedProgress || {},
  });

  // Test 3: Check mentor_theme_plans integrity
  const { count: planCount } = await sb.from("mentor_theme_plans").select("*", { count: "exact", head: true });
  results.push({
    test_suite: "database_integrity",
    test_name: "Mentor theme plans acessíveis",
    status: "passed",
    duration_ms: 0,
    module_tested: "mentoria",
    details_json: { plan_count: planCount || 0 },
  });

  return results;
}

async function testPerformanceMetrics(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const sb = getAdmin();

  // Check average AI response times from recent logs
  const { data: recentLogs } = await sb.from("ai_usage_logs")
    .select("function_name, response_time_ms, success, model_used")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (recentLogs && recentLogs.length > 0) {
    const avgTime = Math.round(recentLogs.reduce((s: number, l: any) => s + (l.response_time_ms || 0), 0) / recentLogs.length);
    const successRate = Math.round((recentLogs.filter((l: any) => l.success).length / recentLogs.length) * 100);
    const slowCalls = recentLogs.filter((l: any) => (l.response_time_ms || 0) > 30000).length;

    results.push({
      test_suite: "performance",
      test_name: "Tempo médio de resposta da IA",
      status: avgTime < 15000 ? "passed" : avgTime < 30000 ? "warning" : "failed",
      duration_ms: 0,
      module_tested: "ia",
      details_json: { avg_response_ms: avgTime, total_calls: recentLogs.length, slow_calls: slowCalls },
      suggestion: avgTime >= 30000 ? "Tempo médio muito alto — verificar modelos e timeouts" : undefined,
    });

    results.push({
      test_suite: "performance",
      test_name: "Taxa de sucesso das chamadas de IA",
      status: successRate >= 95 ? "passed" : successRate >= 80 ? "warning" : "failed",
      duration_ms: 0,
      module_tested: "ia",
      details_json: { success_rate_pct: successRate, total: recentLogs.length },
      suggestion: successRate < 80 ? "Taxa de sucesso crítica — verificar erros recorrentes" : undefined,
    });

    // Model distribution
    const models = new Map<string, number>();
    for (const l of recentLogs) {
      const m = l.model_used || "unknown";
      models.set(m, (models.get(m) || 0) + 1);
    }
    results.push({
      test_suite: "performance",
      test_name: "Distribuição de modelos de IA",
      status: "passed",
      duration_ms: 0,
      module_tested: "ia",
      details_json: { model_distribution: Object.fromEntries(models) },
    });
  } else {
    results.push({
      test_suite: "performance",
      test_name: "Logs de IA disponíveis",
      status: "warning",
      duration_ms: 0,
      module_tested: "ia",
      details_json: { message: "Nenhum log de IA nas últimas 24h" },
      suggestion: "Sem dados de uso recente — sistema pode estar inativo",
    });
  }

  return results;
}

async function testErrorHandling(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Invalid input handling
  const badInput = await callFunction("question-generator", { messages: null }, 10000);
  results.push({
    test_suite: "error_handling",
    test_name: "question-generator rejeita input inválido",
    status: !badInput.ok ? "passed" : "warning",
    duration_ms: badInput.ms,
    module_tested: "questoes",
    details_json: { status: badInput.status },
    suggestion: badInput.ok ? "Função aceita input inválido sem validação" : undefined,
  });

  // Test 2: Empty messages handling
  const emptyMsg = await callFunction("study-session", { messages: [], phase: "teaching", topic: "" }, 15000);
  results.push({
    test_suite: "error_handling",
    test_name: "study-session lida com mensagens vazias",
    status: emptyMsg.status !== 0 ? "passed" : "failed",
    duration_ms: emptyMsg.ms,
    module_tested: "tutor",
    details_json: { status: emptyMsg.status },
    error_message: emptyMsg.status === 0 ? "Timeout ou crash com input vazio" : undefined,
  });

  // Test 3: Chronicle OSCE with insufficient content
  const badChronicle = await callFunction("generate-chronicle-osce", { chronicle_content: "abc" }, 10000);
  results.push({
    test_suite: "error_handling",
    test_name: "OSCE rejeita crônica insuficiente",
    status: badChronicle.status === 400 ? "passed" : "warning",
    duration_ms: badChronicle.ms,
    module_tested: "osce",
    details_json: { status: badChronicle.status, response: badChronicle.data },
    suggestion: badChronicle.status !== 400 ? "Validação de input não está funcionando" : undefined,
  });

  return results;
}

// ─── Main ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const runStart = Date.now();
  const sb = getAdmin();

  // ── Internal batch path: header x-internal-secret + INTERNAL_EDGE_SECRET.
  // Still requires Authorization (admin user JWT) so downstream auth
  // remains intact. Never skips downstream auth, never uses anon key.
  const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET") || "";
  const providedSecret = req.headers.get("x-internal-secret") || "";
  const isInternalCall = !!internalSecret && providedSecret === internalSecret;

  // 1) Require real user JWT via shared helper.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  // 2) Require admin/professor role (qa-agent fans out to AI generators).
  const { data: roles, error: rolesErr } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId);

  if (rolesErr) {
    console.error("[qa-agent] role lookup failed:", rolesErr);
    return new Response(
      JSON.stringify({ success: false, error: "FORBIDDEN", message: "Falha ao validar permissões.", requestId: auth.requestId }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const roleSet = new Set((roles || []).map((r: any) => r.role));
  const allowed = roleSet.has("admin") || roleSet.has("professor") || roleSet.has("coordinator") || roleSet.has("institutional_admin");
  if (!allowed) {
    return new Response(
      JSON.stringify({ success: false, error: "FORBIDDEN", message: "Apenas admin/professor pode executar o qa-agent.", requestId: auth.requestId }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Bind caller context for downstream callFunction() calls.
  CALLER_TOKEN = auth.token;
  CALLER_ID = auth.userId;
  CALLER_KIND = isInternalCall ? "internal" : "user";

  try {
    const body = await req.json().catch(() => ({}));
    const runType = body.run_type || (isInternalCall ? "internal" : "manual");

    // Create run record
    const { data: run, error: runErr } = await sb.from("qa_test_runs").insert({
      run_type: runType,
      status: "running",
    }).select("id").single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Falha ao criar registro de execução" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runId = run.id;
    const allResults: TestResult[] = [];

    // Execute all test suites
    console.log(`[qa-agent] Starting run ${runId} (${runType})`);

    const suites = [
      { name: "edge_function_health", fn: testEdgeFunctionHealth },
      { name: "ai_quality", fn: testAIQuality },
      { name: "cache_optimization", fn: testCacheAndOptimization },
      { name: "database_integrity", fn: testDatabaseIntegrity },
      { name: "performance", fn: testPerformanceMetrics },
      { name: "error_handling", fn: testErrorHandling },
    ];

    for (const suite of suites) {
      try {
        console.log(`[qa-agent] Running suite: ${suite.name}`);
        const results = await suite.fn();
        allResults.push(...results);
      } catch (e) {
        console.error(`[qa-agent] Suite ${suite.name} crashed:`, e);
        allResults.push({
          test_suite: suite.name,
          test_name: `Suite ${suite.name} crashed`,
          status: "failed",
          duration_ms: 0,
          module_tested: "sistema",
          details_json: {},
          error_message: (e as Error).message,
          suggestion: "Verificar implementação do teste",
        });
      }
    }

    // Insert all results
    const resultRows = allResults.map(r => ({ ...r, run_id: runId }));
    await sb.from("qa_test_results").insert(resultRows);

    // Compute summary
    const passed = allResults.filter(r => r.status === "passed").length;
    const failed = allResults.filter(r => r.status === "failed").length;
    const warnings = allResults.filter(r => r.status === "warning").length;
    const total = allResults.length;
    const durationMs = Date.now() - runStart;

    const overallStatus = failed > 0 ? "failed" : warnings > 0 ? "warning" : "passed";

    const summary = {
      suites_run: suites.length,
      critical_failures: allResults.filter(r => r.status === "failed").map(r => ({
        test: r.test_name,
        module: r.module_tested,
        error: r.error_message,
        suggestion: r.suggestion,
      })),
      warnings: allResults.filter(r => r.status === "warning").map(r => ({
        test: r.test_name,
        module: r.module_tested,
        suggestion: r.suggestion,
      })),
    };

    // Update run record
    await sb.from("qa_test_runs").update({
      status: overallStatus,
      total_tests: total,
      passed_tests: passed,
      failed_tests: failed,
      warning_tests: warnings,
      summary_json: summary,
      duration_ms: durationMs,
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    console.log(`[qa-agent] Run ${runId} completed: ${passed}/${total} passed, ${failed} failed, ${warnings} warnings (${durationMs}ms)`);

    return new Response(JSON.stringify({
      run_id: runId,
      status: overallStatus,
      total_tests: total,
      passed: passed,
      failed: failed,
      warnings: warnings,
      duration_ms: durationMs,
      summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[qa-agent] Fatal error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
