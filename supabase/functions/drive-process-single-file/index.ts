import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { processSingleDriveFile } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const fileId = body.fileId;
    const user = { id: "0af48797-38f2-4b77-bd16-0486fa291eba" };

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing fileId" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const logger = {
      info: (tag: string, msg: string, data?: any) => console.log(`[${tag}] ${msg}`, data || ""),
      error: (tag: string, msg: string, data?: any) => console.error(`[${tag}] ${msg}`, data || ""),
      warn: (tag: string, msg: string, data?: any) => console.warn(`[${tag}] ${msg}`, data || ""),
    };

    const result = await processSingleDriveFile(fileId, { supabaseAdmin, logger, user });

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});