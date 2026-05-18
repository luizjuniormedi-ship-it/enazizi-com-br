import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken } from "../_shared/google-drive.ts"

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
    const user = { id: "0af48797-38f2-4b77-bd16-0486fa291eba" };
    const FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";

    const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
    const token_uri = "https://oauth2.googleapis.com/token";
    const serviceAccount = { client_email, token_uri };

    const accessToken = await getGoogleAccessToken(serviceAccount);

    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)`;
    const listResp = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!listResp.ok) {
      throw new Error(`Google Drive API error: ${listResp.status} ${await listResp.text()}`);
    }

    const listData = await listResp.json();
    const files = listData.files || [];

    let registeredCount = 0;
    for (const file of files) {
      const { data: existing } = await supabaseAdmin
        .from("drive_ingestion_log")
        .select("id")
        .eq("file_id", file.id)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("drive_ingestion_log").insert({
          file_id: file.id,
          file_name: file.name,
          file_size: file.size ? parseInt(file.size) : null,
          status: 'pending',
          processed_by: user.id
        });
        registeredCount++;
      }
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      registered: registeredCount, 
      total_found: files.length 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});