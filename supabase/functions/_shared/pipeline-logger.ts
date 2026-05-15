import { createClient } from "https://esm.sh/@supabase/supabase-client@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

export async function logPipelineAlert(data: {
  source: string;
  message: string;
  error_stack?: string;
  payload?: any;
  model_used?: string;
  http_status?: number;
  severity?: 'warning' | 'error' | 'critical';
  metadata?: any;
}) {
  try {
    const { error } = await serviceClient
      .from("pipeline_alerts")
      .insert({
        source: data.source,
        message: data.message,
        error_stack: data.error_stack,
        payload: data.payload,
        model_used: data.model_used,
        http_status: data.http_status,
        severity: data.severity || 'error',
        metadata: data.metadata || {},
      });

    if (error) {
      console.error("[logPipelineAlert] Failed to save alert to DB:", error);
    }
  } catch (err) {
    console.error("[logPipelineAlert] Fatal error logging alert:", err);
  }
}
