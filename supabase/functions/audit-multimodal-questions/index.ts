import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Fake multimodal detection patterns ─────────────────────────
const FAKE_PATTERNS = [
  /logo\b/i,
  /símbolo\b/i,
  /\bamerican academy\b/i,
  /\bsociedade brasileira\b/i,
  /ícone\b.*representando/i,
  /emblema\b/i,
  /\binsígnia\b/i,
  /circle.*represent/i,
  /\bcírculo.*roxo\b/i,
  /\bcírculo.*branco\b/i,
  /\braios.*partindo\b/i,
  /\bse assemelha\b.*\bfundo de olho\b/i,
  /\bmetaforiza\b/i,
  /\bsimboliza\b/i,
  /\bvisualmente sugerido\b/i,
  /\bvisualmente metaforizada\b/i,
  /\bpadrão de cores.*formas\b/i,
];

const WEAK_PATTERNS = [
  /\bimagem abaixo\b/i,
  /\bfigura abaixo\b/i,
  /\bobserve a imagem\b/i,
  /\bveja a figura\b/i,
  /\bconforme mostrado\b/i,
  /\bconforme ilustrado\b/i,
  /\bna imagem apresentada\b/i,
];

// Patterns that indicate real image dependency (good)
const REAL_MULTIMODAL_PATTERNS = [
  /\bderiv[aç][ãõ][oe]s?\b.*\b(V[1-6]|DI|DII|DIII|aVR|aVL|aVF)\b/i,
  /\bsupradesnivelamento\b/i,
  /\binfradesnivelamento\b/i,
  /\bond[ae]s?\b.*\b(P|Q|R|S|T|U)\b/i,
  /\bopacidade\b/i,
  /\bconsolidação\b/i,
  /\blesão\b.*\b(eritematosa|papular|vesicular|ulcerada|crostosa)\b/i,
  /\bhipodensidade\b/i,
  /\bhiperdensidade\b/i,
  /\bhiperintens\b/i,
  /\banecóic[oa]\b/i,
  /\bhiperecogênic[oa]\b/i,
  /\bcoloração\b.*\b(H&E|hematoxilina|eosina)\b/i,
  /\bcélulas\b.*\batípicas\b/i,
];

interface AuditResult {
  question_id: string;
  status: "approved" | "needs_improvement" | "rejected";
  multimodal_strength: "strong" | "moderate" | "weak";
  image_required: boolean;
  issues: string[];
  suggested_fix: string | null;
}

function auditQuestion(q: {
  id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string | null;
  correct_index: number;
  explanation: string;
  image_type: string;
  diagnosis: string;
}): AuditResult {
  const issues: string[] = [];
  const allText = `${q.statement} ${q.explanation}`;

  // 1. Check for fake patterns (logo/symbol references)
  const fakeHits = FAKE_PATTERNS.filter(p => p.test(allText));
  if (fakeHits.length > 0) {
    return {
      question_id: q.id,
      status: "rejected",
      multimodal_strength: "weak",
      image_required: false,
      issues: ["fake_multimodal: enunciado referencia logo/símbolo em vez de achados clínicos reais"],
      suggested_fix: "Regenerar questão com imagem clínica real — a imagem atual não é médica",
    };
  }

  // 2. Check for weak patterns (generic image references)
  const weakHits = WEAK_PATTERNS.filter(p => p.test(q.statement));
  if (weakHits.length > 0) {
    issues.push("weak_reference: usa referência genérica à imagem em vez de descrever achados");
  }

  // 3. Check if statement describes real image findings
  const realHits = REAL_MULTIMODAL_PATTERNS.filter(p => p.test(q.statement));
  const hasRealFindings = realHits.length >= 1;

  // 4. Check if diagnosis is given away in the statement
  const diagLower = q.diagnosis.toLowerCase();
  const stmtLower = q.statement.toLowerCase();
  const diagWords = diagLower.split(/[\s,;-]+/).filter(w => w.length > 4);
  const diagInStatement = diagWords.filter(w => stmtLower.includes(w));
  if (diagInStatement.length >= 2) {
    issues.push("diagnosis_leaked: diagnóstico completo presente no enunciado, tornando a imagem desnecessária");
  }

  // 5. Check if correct answer can be deduced without image
  const options = [q.option_a, q.option_b, q.option_c, q.option_d];
  if (q.option_e) options.push(q.option_e);
  const correctOpt = options[q.correct_index]?.toLowerCase() || "";
  
  // If diagnosis is in statement AND correct option, no image needed
  const diagInCorrect = diagWords.some(w => correctOpt.includes(w));
  const diagLeaked = diagInStatement.length >= 2 && diagInCorrect;

  // 6. Determine multimodal strength
  let strength: "strong" | "moderate" | "weak" = "moderate";
  let imageRequired = true;

  if (!hasRealFindings && weakHits.length > 0) {
    strength = "weak";
    imageRequired = false;
  } else if (hasRealFindings && !diagLeaked) {
    strength = "strong";
    imageRequired = true;
  } else if (diagLeaked && !hasRealFindings) {
    strength = "weak";
    imageRequired = false;
    issues.push("answerable_without_image: questão pode ser respondida sem a imagem");
  }

  // 7. Classification
  let status: "approved" | "needs_improvement" | "rejected";
  let fix: string | null = null;

  if (strength === "strong" && issues.length === 0) {
    status = "approved";
  } else if (strength === "weak" || issues.length >= 2) {
    status = "rejected";
    fix = "Reescrever enunciado para descrever achados visíveis na imagem sem entregar o diagnóstico";
  } else {
    status = "needs_improvement";
    fix = "Adicionar descrição de achados visuais específicos no enunciado";
  }

  return {
    question_id: q.id,
    status,
    multimodal_strength: strength,
    image_required: imageRequired,
    issues,
    suggested_fix: fix,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetStatuses = body.statuses || ["needs_review", "upgraded", "draft", "published"];
    const autoReject = body.auto_reject !== false; // default true
    const limit = Math.min(body.limit || 100, 500);

    // Fetch questions with asset info
    const { data: questions, error } = await supabase
      .from("medical_image_questions")
      .select(`
        id, statement, option_a, option_b, option_c, option_d, option_e,
        correct_index, explanation, status,
        asset:medical_image_assets!inner(
          image_type, diagnosis, image_url, clinical_findings,
          asset_origin, review_status, multimodal_ready
        )
      `)
      .in("status", targetStatuses)
      .limit(limit);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        message: "Nenhuma questão para auditar",
        audited: 0,
        approved: 0,
        needs_improvement: 0,
        rejected: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: AuditResult[] = [];
    const rejectedIds: string[] = [];
    const improvementIds: string[] = [];

    for (const q of questions) {
      const asset = Array.isArray(q.asset) ? q.asset[0] : q.asset;
      if (!asset) continue;

      const result = auditQuestion({
        id: q.id,
        statement: q.statement,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        correct_index: q.correct_index,
        explanation: q.explanation || "",
        image_type: asset.image_type,
        diagnosis: asset.diagnosis,
      });

      results.push(result);

      if (result.status === "rejected") rejectedIds.push(q.id);
      if (result.status === "needs_improvement") improvementIds.push(q.id);
    }

    // Auto-reject fake multimodal questions
    if (autoReject && rejectedIds.length > 0) {
      await supabase
        .from("medical_image_questions")
        .update({
          status: "rejected",
          validated_by: "multimodal_audit_bot",
          validated_at: new Date().toISOString(),
        })
        .in("id", rejectedIds);
    }

    const summary = {
      audited: results.length,
      approved: results.filter(r => r.status === "approved").length,
      needs_improvement: results.filter(r => r.status === "needs_improvement").length,
      rejected: results.filter(r => r.status === "rejected").length,
      auto_rejected: autoReject ? rejectedIds.length : 0,
      details: results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
