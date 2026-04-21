/**
 * backfill-temas-estudados-ids — Fase 1.6
 * ───────────────────────────────────────
 * Re-executa o backfill estrutural de subtopic_id/topic_id/specialty_id
 * em `temas_estudados` usando APENAS match exato por nome (case-insensitive).
 *
 * Idempotente: só preenche linhas onde o ID alvo está NULL. Pode ser
 * re-executado quando novos subtópicos forem inseridos no currículo.
 *
 * Acesso: somente admin (verificado via has_role).
 * Retorna o relatório de quantos foram preenchidos por cada método.
 */
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface BackfillReport {
  totalBefore: number;
  filledBySubtopicExact: number;
  filledBySubtopicViaTema: number;
  filledByTopicViaTema: number;
  filledSpecialtyOnly: number;
  totalAfterStructural: number;
  remainingUnmatched: number;
  durationMs: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();

  try {
    // 1) Autenticação: só admin
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userInfo, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userInfo?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userInfo.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden_admin_only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 2) Snapshot inicial
    const before = await admin
      .from("temas_estudados")
      .select("id, subtopic_id, topic_id, specialty_id", { count: "exact", head: false })
      .limit(1);
    const totalBefore = before.count ?? 0;

    // 3) Backfill em 4 passos via SQL (mesmo da migration, idempotente)
    // Reusa funções RPC inexistentes? Não — usamos uma única RPC: rpc('exec_sql') está vetada.
    // Estratégia: ler em lotes e fazer updates via JS (defensivo, sem SQL livre).

    let filledSubExact = 0;
    let filledSubViaTema = 0;
    let filledTopicViaTema = 0;
    let filledSpecialtyOnly = 0;

    // Carrega catálogo curricular UMA vez
    const { data: subs } = await admin
      .from("curriculum_subtopics")
      .select("id, nome, topic_id, curriculum_topics(id, nome, specialty_id, curriculum_specialties(id, nome))")
      .eq("ativo", true);
    const { data: tops } = await admin
      .from("curriculum_topics")
      .select("id, nome, specialty_id")
      .eq("ativo", true);
    const { data: specs } = await admin
      .from("curriculum_specialties")
      .select("id, nome")
      .eq("ativo", true);

    const subByName = new Map<string, { id: string; topicId: string; specialtyId: string }>();
    for (const s of (subs || []) as any[]) {
      const k = String(s.nome || "").trim().toLowerCase();
      if (!k) continue;
      subByName.set(k, {
        id: s.id,
        topicId: s.topic_id,
        specialtyId: s.curriculum_topics?.specialty_id ?? s.curriculum_topics?.curriculum_specialties?.id ?? null,
      });
    }
    const topByName = new Map<string, { id: string; specialtyId: string }>();
    for (const t of (tops || []) as any[]) {
      const k = String(t.nome || "").trim().toLowerCase();
      if (!k) continue;
      topByName.set(k, { id: t.id, specialtyId: t.specialty_id });
    }
    const specByName = new Map<string, string>();
    for (const sp of (specs || []) as any[]) {
      const k = String(sp.nome || "").trim().toLowerCase();
      if (!k) continue;
      specByName.set(k, sp.id);
    }

    // Lê todos os temas em lotes de 500
    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data: rows, error } = await admin
        .from("temas_estudados")
        .select("id, tema, subtopico, especialidade, subtopic_id, topic_id, specialty_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!rows || rows.length === 0) break;

      for (const r of rows as any[]) {
        const updates: Record<string, any> = {};
        let method: string | null = null;

        // Passo 1: subtopic via subtopico exato
        if (!r.subtopic_id && r.subtopico) {
          const hit = subByName.get(String(r.subtopico).trim().toLowerCase());
          if (hit) {
            updates.subtopic_id = hit.id;
            updates.topic_id = r.topic_id ?? hit.topicId;
            updates.specialty_id = r.specialty_id ?? hit.specialtyId;
            method = "subtopic_exact";
            filledSubExact++;
          }
        }
        // Passo 2: subtopic via tema exato
        if (!updates.subtopic_id && !r.subtopic_id && r.tema) {
          const hit = subByName.get(String(r.tema).trim().toLowerCase());
          if (hit) {
            updates.subtopic_id = hit.id;
            updates.topic_id = r.topic_id ?? hit.topicId;
            updates.specialty_id = r.specialty_id ?? hit.specialtyId;
            method = "subtopic_via_tema";
            filledSubViaTema++;
          }
        }
        // Passo 3: topic via tema exato
        if (!updates.subtopic_id && !r.subtopic_id && !r.topic_id && r.tema) {
          const hit = topByName.get(String(r.tema).trim().toLowerCase());
          if (hit) {
            updates.topic_id = hit.id;
            updates.specialty_id = r.specialty_id ?? hit.specialtyId;
            method = "topic_exact";
            filledTopicViaTema++;
          }
        }
        // Passo 4: specialty fallback
        if (!r.specialty_id && !updates.specialty_id && r.especialidade) {
          const sid = specByName.get(String(r.especialidade).trim().toLowerCase());
          if (sid) {
            updates.specialty_id = sid;
            if (!method) {
              method = "specialty_only";
              filledSpecialtyOnly++;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          if (method) updates.subtopic_match_method = method;
          await admin.from("temas_estudados").update(updates).eq("id", r.id);
        }
      }

      if (rows.length < PAGE) break;
      from += PAGE;
    }

    // 4) Snapshot final
    const { count: afterStructural } = await admin
      .from("temas_estudados")
      .select("id", { count: "exact", head: true })
      .not("subtopic_id", "is", null);
    const { count: remainingUnmatched } = await admin
      .from("temas_estudados")
      .select("id", { count: "exact", head: true })
      .is("subtopic_id", null)
      .is("topic_id", null);

    const report: BackfillReport = {
      totalBefore,
      filledBySubtopicExact: filledSubExact,
      filledBySubtopicViaTema: filledSubViaTema,
      filledByTopicViaTema: filledTopicViaTema,
      filledSpecialtyOnly: filledSpecialtyOnly,
      totalAfterStructural: afterStructural ?? 0,
      remainingUnmatched: remainingUnmatched ?? 0,
      durationMs: Date.now() - t0,
    };

    return new Response(JSON.stringify({ ok: true, report }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backfill-temas-estudados-ids]", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
