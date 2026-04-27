// supabase/functions/baseline-freeze-check/index.ts
//
// Auditoria de integridade do freeze observacional (Fase 2 / Shadow Adaptive).
// Apenas-leitura. Não altera flags, não apaga dados, não dispara ações.
// Acesso restrito a admin (verificado via has_role).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHADOW_FLAGS = [
  "shadow_adaptive_enabled",
  "unified_events_enabled",
  "shadow_decisions_enabled",
  "shadow_scores_enabled",
];

interface CheckResult {
  ok: boolean;
  generated_at: string;
  flags: {
    ok: boolean;
    items: Array<{ flag_key: string; enabled: boolean; rollout_mode: string | null }>;
    enabled_count: number;
  };
  shadow_events: {
    ok: boolean;
    total: number;
    by_event: Array<{ event_name: string; count: number; last_at: string | null }>;
    by_source_property: number;
    last_at: string | null;
  };
  shadow_decisions: {
    ok: boolean;
    total: number;
    last_at: string | null;
    table_present: boolean;
  };
  summary: {
    contamination_detected: boolean;
    reasons: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) return json({ error: "Token inválido" }, 401);

    // Gate admin via has_role
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) {
      return json({ error: "Acesso restrito a administradores" }, 403);
    }

    // Service-role client para leitura agregada (políticas não bloqueiam scans agregados)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const reasons: string[] = [];

    // 1) Flags shadow
    const { data: flagRows } = await svc
      .from("system_flags")
      .select("flag_key, enabled, rollout_mode")
      .in("flag_key", SHADOW_FLAGS);

    const flagItems = (flagRows ?? []).map((r: any) => ({
      flag_key: r.flag_key,
      enabled: !!r.enabled,
      rollout_mode: r.rollout_mode ?? null,
    }));
    const enabledFlags = flagItems.filter((f) => f.enabled);
    if (enabledFlags.length > 0) {
      reasons.push(
        `Flag(s) shadow ativa(s): ${enabledFlags.map((f) => f.flag_key).join(", ")}`,
      );
    }

    // 2) telemetry_events com shadow_%
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30d
    const { count: shadowEventsTotal } = await svc
      .from("telemetry_events")
      .select("id", { count: "exact", head: true })
      .like("event_name", "shadow_%")
      .gte("timestamp", since);

    // top breakdown (limit 10)
    const { data: topEvents } = await svc
      .from("telemetry_events")
      .select("event_name, timestamp")
      .like("event_name", "shadow_%")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false })
      .limit(500);

    const breakdownMap = new Map<string, { count: number; last_at: string }>();
    for (const ev of topEvents ?? []) {
      const cur = breakdownMap.get(ev.event_name) ?? { count: 0, last_at: ev.timestamp };
      cur.count += 1;
      if (ev.timestamp > cur.last_at) cur.last_at = ev.timestamp;
      breakdownMap.set(ev.event_name, cur);
    }
    const byEvent = Array.from(breakdownMap.entries())
      .map(([event_name, v]) => ({ event_name, count: v.count, last_at: v.last_at }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // properties->>source = 'shadow-adaptive-v1'
    const { count: bySourceCount } = await svc
      .from("telemetry_events")
      .select("id", { count: "exact", head: true })
      .gte("timestamp", since)
      .filter("properties->>source", "eq", "shadow-adaptive-v1");

    const lastEventAt =
      topEvents && topEvents.length > 0 ? topEvents[0].timestamp : null;
    const eventsTotal = (shadowEventsTotal ?? 0) + (bySourceCount ?? 0);
    if (eventsTotal > 0) {
      reasons.push(
        `Eventos shadow gravados: ${shadowEventsTotal ?? 0} via event_name + ${bySourceCount ?? 0} via properties.source (últimos 30d)`,
      );
    }

    // 3) assistant_decisions.source_module = 'shadow-adaptive-v1'
    let decisionsTotal = 0;
    let decisionsLastAt: string | null = null;
    let decisionsTablePresent = true;
    {
      const { count, error } = await svc
        .from("assistant_decisions")
        .select("id", { count: "exact", head: true })
        .eq("source_module", "shadow-adaptive-v1");
      if (error) {
        decisionsTablePresent = false;
      } else {
        decisionsTotal = count ?? 0;
        if (decisionsTotal > 0) {
          const { data: latest } = await svc
            .from("assistant_decisions")
            .select("created_at")
            .eq("source_module", "shadow-adaptive-v1")
            .order("created_at", { ascending: false })
            .limit(1);
          decisionsLastAt = latest?.[0]?.created_at ?? null;
          reasons.push(`assistant_decisions com source_module='shadow-adaptive-v1': ${decisionsTotal}`);
        }
      }
    }

    const result: CheckResult = {
      ok: reasons.length === 0,
      generated_at: new Date().toISOString(),
      flags: {
        ok: enabledFlags.length === 0,
        items: flagItems,
        enabled_count: enabledFlags.length,
      },
      shadow_events: {
        ok: eventsTotal === 0,
        total: shadowEventsTotal ?? 0,
        by_event: byEvent,
        by_source_property: bySourceCount ?? 0,
        last_at: lastEventAt,
      },
      shadow_decisions: {
        ok: decisionsTotal === 0,
        total: decisionsTotal,
        last_at: decisionsLastAt,
        table_present: decisionsTablePresent,
      },
      summary: {
        contamination_detected: reasons.length > 0,
        reasons,
      },
    };

    return json(result, 200);
  } catch (err: any) {
    return json({ error: err?.message ?? String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
