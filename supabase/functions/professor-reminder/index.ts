import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    // Window: simulados scheduled between now+115min and now+125min (2h ± 5min)
    const windowStart = new Date(now.getTime() + 115 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 125 * 60 * 1000);

    const { data: simulados } = await supabase
      .from("teacher_simulados")
      .select("id, title, scheduled_at, professor_id")
      .gte("scheduled_at", windowStart.toISOString())
      .lte("scheduled_at", windowEnd.toISOString())
      .in("status", ["scheduled", "published"]);

    if (!simulados || simulados.length === 0) {
      return corsResponse({ message: "No reminders to send", count: 0 }, 200);
    }

    let totalSent = 0;

    for (const sim of simulados) {
      // Get pending students
      const { data: results } = await supabase
        .from("teacher_simulado_results")
        .select("student_id")
        .eq("simulado_id", sim.id)
        .eq("status", "pending");

      if (!results || results.length === 0) continue;

      const scheduledTime = new Date(sim.scheduled_at).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      const notifications = results.map((r: any) => ({
        sender_id: sim.professor_id,
        recipient_id: r.student_id,
        title: `⏰ Lembrete: Simulado em 2 horas!`,
        content: `O simulado "${sim.title}" começa às ${scheduledTime}. Prepare-se e acesse a aba Mais Ferramentas → Proficiência para realizar.`,
        priority: "urgent",
      }));

      await supabase.from("admin_messages").insert(notifications);
      totalSent += notifications.length;
    }

    return corsResponse({ message: "Reminders sent", count: totalSent }, 200);
  } catch (e) {
    return corsResponse({ error: e.message, log: "[EDGE_SAFE_FAIL]" }, 500);
  }
});
