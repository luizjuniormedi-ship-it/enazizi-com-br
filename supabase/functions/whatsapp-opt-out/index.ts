import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Webhook authentication ──
    // Require a pre-shared secret to prevent anonymous opt-out abuse and
    // phone-number enumeration. The caller (e.g. WhatsApp gateway / Twilio
    // forwarder) must send `x-webhook-token: <secret>`.
    const expectedSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
    if (!expectedSecret) {
      console.error("[whatsapp-opt-out] WHATSAPP_WEBHOOK_SECRET is not configured");
      return respond({ error: "Webhook not configured" }, 503);
    }
    const provided = req.headers.get("x-webhook-token") || "";
    if (provided !== expectedSecret) {
      console.warn("[whatsapp-opt-out] Unauthorized webhook call");
      return respond({ error: "Unauthorized" }, 401);
    }

    const { phone, reply } = await req.json();
    if (!phone || !reply) {
      return respond({ error: "phone and reply are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanPhone = String(phone).replace(/\D/g, "");
    const replyUpper = String(reply).trim().toUpperCase();

    const optOutKeywords = ["SAIR", "NÃO", "NAO", "PARAR", "CANCELAR", "STOP"];
    const optInKeywords = ["SIM", "VOLTAR", "RETOMAR", "ATIVAR"];

    let optOut: boolean | null = null;
    if (optOutKeywords.some((k) => replyUpper.includes(k))) {
      optOut = true;
    } else if (optInKeywords.some((k) => replyUpper.includes(k))) {
      optOut = false;
    }

    if (optOut === null) {
      return respond({ action: "ignored", message: "Reply not recognized" });
    }

    // Look up the profile (constant-time-ish: always probe both exact and partial).
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone")
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.+55${cleanPhone}`);

    let target = profiles?.[0];
    if (!target) {
      const { data: partialMatch } = await supabase
        .from("profiles")
        .select("user_id, display_name, phone")
        .ilike("phone", `%${cleanPhone.slice(-9)}`);
      target = partialMatch?.[0];
    }

    // Always respond with the same generic shape to avoid number enumeration.
    if (!target) {
      return respond({ action: "ok" });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_opt_out: optOut } as any)
      .eq("user_id", target.user_id);

    if (error) {
      console.error("[whatsapp-opt-out] update error:", error);
      return respond({ error: "Internal error" }, 500);
    }

    return respond({ action: "ok" });
  } catch (e) {
    console.error("[whatsapp-opt-out] exception:", e);
    return respond({ error: "Internal error" }, 500);
  }
});
