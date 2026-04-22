/**
 * seed-proficiency-pilot — Cria estrutura de piloto da Proficiência Guiada.
 *
 * Cria (somente ESTRUTURA, nunca progresso falso):
 *   - 1 turma "Turma Piloto"
 *   - vínculo dos alunos como class_members
 *   - 1 plano INDIVIDUAL para o primeiro aluno (Cardiologia)
 *   - 1 plano por TURMA (Pneumologia)
 *   - subtopics reais do currículo (busca por nome)
 *
 * Segurança: aceita o caller se ELE for admin (header Authorization válido
 * + role=admin), OU se enviar x-admin-secret coincidente com o secret
 * SEED_PILOT_ADMIN_SECRET. Service role só é usado depois da validação.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  professorEmail: string;
  studentEmails: string[];
}

interface SeedResult {
  success: true;
  turma: { id: string; name: string };
  planoIndividual: { id: string; name: string };
  planoTurma: { id: string; name: string };
  warnings: string[];
}

// Subtemas pedidos pelo roteiro de piloto. Buscados por LIKE (case-insensitive).
// "ECG" não existe no currículo atual → será omitido (warning).
const CARDIO_SUBTOPIC_NAMES = ["Insuficiência Cardíaca", "Síndrome Coronariana Aguda"];
const PNEUMO_SUBTOPIC_NAMES = ["Asma", "DPOC"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const ADMIN_SECRET = Deno.env.get("SEED_PILOT_ADMIN_SECRET");

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return jsonResponse({ error: "Configuração do servidor ausente" }, 500);
  }

  // ---- AUTORIZAÇÃO ----
  // Caminho A: header x-admin-secret bate com o secret configurado
  const headerSecret = req.headers.get("x-admin-secret");
  let authorized = !!ADMIN_SECRET && headerSecret === ADMIN_SECRET;

  // Caminho B: caller autenticado tem role=admin
  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const callerId = userData.user?.id;
      if (callerId) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();
        authorized = !!roleRow;
      }
    }
  }

  if (!authorized) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // ---- VALIDAÇÃO DE INPUT ----
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const professorEmail = body?.professorEmail?.trim().toLowerCase();
  const studentEmails = (body?.studentEmails ?? [])
    .map((e) => e?.trim().toLowerCase())
    .filter(Boolean);

  if (!professorEmail) {
    return jsonResponse({ error: "professorEmail obrigatório" }, 400);
  }
  if (studentEmails.length < 1) {
    return jsonResponse({ error: "Informe ao menos 1 studentEmail" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const warnings: string[] = [];

  try {
    // ---- BUSCA PROFESSOR ----
    const { data: profRow, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .eq("email", professorEmail)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profRow) {
      return jsonResponse(
        { error: `Professor não encontrado: ${professorEmail}` },
        404,
      );
    }
    const professorUserId = profRow.user_id as string;

    // ---- BUSCA ALUNOS ----
    const { data: studentRows, error: stuErr } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("email", studentEmails);
    if (stuErr) throw stuErr;
    if (!studentRows || studentRows.length === 0) {
      return jsonResponse({ error: "Nenhum aluno encontrado pelos emails informados" }, 404);
    }
    const foundEmails = new Set(studentRows.map((s) => s.email));
    for (const e of studentEmails) {
      if (!foundEmails.has(e)) warnings.push(`Aluno não encontrado: ${e}`);
    }

    // ---- INSTITUIÇÃO (necessária para classes) ----
    let institutionId: string | null = null;
    const { data: profInst } = await supabase
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", professorUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (profInst?.institution_id) {
      institutionId = profInst.institution_id as string;
    } else {
      // Reusa instituição "Piloto" se já existir, senão cria uma.
      const { data: pilotInst } = await supabase
        .from("institutions")
        .select("id")
        .eq("name", "Instituição Piloto (auto)")
        .maybeSingle();
      if (pilotInst?.id) {
        institutionId = pilotInst.id as string;
      } else {
        const { data: newInst, error: instErr } = await supabase
          .from("institutions")
          .insert({ name: "Instituição Piloto (auto)" })
          .select("id")
          .single();
        if (instErr) throw instErr;
        institutionId = newInst.id as string;
      }
      // Vincula o professor à instituição (idempotente).
      await supabase
        .from("institution_members")
        .upsert(
          {
            institution_id: institutionId,
            user_id: professorUserId,
            role: "professor",
            is_active: true,
          },
          { onConflict: "institution_id,user_id" },
        );
      warnings.push("Professor vinculado a 'Instituição Piloto (auto)'");
    }

    // ---- TURMA ----
    const { data: turma, error: turmaErr } = await supabase
      .from("classes")
      .insert({
        name: "Turma Piloto",
        institution_id: institutionId,
        created_by: professorUserId,
      })
      .select("id, name")
      .single();
    if (turmaErr) throw turmaErr;

    // class_members (idempotente via onConflict simples)
    const memberRows = studentRows.map((s) => ({
      class_id: turma.id,
      user_id: s.user_id as string,
      role: "student",
      is_active: true,
    }));
    if (memberRows.length > 0) {
      const { error: memErr } = await supabase.from("class_members").insert(memberRows);
      if (memErr) throw memErr;
    }

    // ---- BUSCA SUBTOPICS REAIS ----
    async function resolveSubtopicIds(names: string[]): Promise<string[]> {
      const ids: string[] = [];
      for (const n of names) {
        const { data } = await supabase
          .from("curriculum_subtopics")
          .select("id, nome")
          .ilike("nome", n)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          ids.push(data.id as string);
        } else {
          warnings.push(`Subtema não encontrado no currículo: "${n}"`);
        }
      }
      return ids;
    }

    const cardioSubIds = await resolveSubtopicIds(CARDIO_SUBTOPIC_NAMES);
    const pneumoSubIds = await resolveSubtopicIds(PNEUMO_SUBTOPIC_NAMES);

    if (cardioSubIds.length === 0 || pneumoSubIds.length === 0) {
      return jsonResponse(
        {
          error:
            "Não foi possível resolver subtemas mínimos no currículo. Verifique curriculum_subtopics.",
          warnings,
        },
        409,
      );
    }

    // ---- PLANO INDIVIDUAL (Cardiologia, aluno[0]) ----
    const examIndividual = new Date();
    examIndividual.setDate(examIndividual.getDate() + 30);

    const { data: planoIndividual, error: piErr } = await supabase
      .from("professor_plans")
      .insert({
        name: "Plano Cardiologia Piloto",
        intensity: "moderado",
        exam_date: examIndividual.toISOString().slice(0, 10),
        status: "active",
        created_by: professorUserId,
      })
      .select("id, name")
      .single();
    if (piErr) throw piErr;

    await supabase.from("professor_plan_targets").insert({
      plan_id: planoIndividual.id,
      user_id: studentRows[0].user_id,
    });

    await supabase.from("professor_plan_subtopics").insert(
      cardioSubIds.map((sid, i) => ({
        plan_id: planoIndividual.id,
        subtopic_id: sid,
        sort_order: i,
      })),
    );

    // ---- PLANO POR TURMA (Pneumologia) ----
    const examTurma = new Date();
    examTurma.setDate(examTurma.getDate() + 20);

    const { data: planoTurma, error: ptErr } = await supabase
      .from("professor_plans")
      .insert({
        name: "Plano Pneumologia Turma",
        intensity: "leve",
        exam_date: examTurma.toISOString().slice(0, 10),
        status: "active",
        created_by: professorUserId,
      })
      .select("id, name")
      .single();
    if (ptErr) throw ptErr;

    await supabase.from("professor_plan_targets").insert({
      plan_id: planoTurma.id,
      class_id: turma.id,
    });

    await supabase.from("professor_plan_subtopics").insert(
      pneumoSubIds.map((sid, i) => ({
        plan_id: planoTurma.id,
        subtopic_id: sid,
        sort_order: i,
      })),
    );

    const result: SeedResult = {
      success: true,
      turma: { id: turma.id, name: turma.name },
      planoIndividual: { id: planoIndividual.id, name: planoIndividual.name },
      planoTurma: { id: planoTurma.id, name: planoTurma.name },
      warnings,
    };
    return jsonResponse(result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg, warnings }, 500);
  }
});
