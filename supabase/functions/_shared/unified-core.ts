import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

export const getServiceClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function logTelemetry(supabase: any, event: string, payload: any, userId: string | null = null) {
  // PHASE 14: Sampling (only log 10% of debug events, 100% of critical)
  const isCritical = event.includes("ERROR") || event.includes("CRITICAL") || event.includes("BILLING");
  if (!isCritical && Math.random() > 0.1) return;

  try {
    await supabase.from("telemetry_events").insert({
      event_type: event,
      payload,
      user_id: userId,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Telemetry failed:", e);
  }
}

export async function callAI(system: string, prompt: string, options: { model?: string, temperature?: number, maxTokens?: number } = {}) {
  // Unified AI entry point
  const body = {
    model: options.model || "gpt-5-mini-mini", // Cost optimization: default to mini
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`AI Request failed: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
