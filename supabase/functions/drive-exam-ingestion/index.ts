import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function listFilesRecursive(folderId: string, accessToken: string, supabase: any, user: any, logger: any, depth = 0) {
  if (depth > 5) return; // Prevent too deep recursion
  
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,size,mimeType)`;
  const resp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!resp.ok) {
    logger.error("DRIVE_LIST", `Error listing ${folderId}: ${await resp.text()}`);
    return;
  }

  const data = await resp.json();
  const items = data.files || [];

  for (const item of items) {
    if (item.mimeType === "application/pdf") {
      // Save directly to DB as we find them to avoid memory/timeout issues
      await supabase.from("drive_ingestion_log").upsert({
        file_id: item.id,
        file_name: item.name,
        file_size: item.size ? parseInt(item.size) : null,
        status: 'pending',
        processed_by: user.id
      }, { onConflict: 'file_id' });
      logger.info("INGESTION", `Registered: ${item.name}`);
    } else if (item.mimeType === "application/vnd.google-apps.folder") {
      await listFilesRecursive(item.id, accessToken, supabase, user, logger, depth + 1);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logger = {
    info: (tag: string, msg: string) => console.log(`[${tag}] ${msg}`),
    error: (tag: string, msg: string) => console.error(`[${tag}] ${msg}`)
  };

  try {
    const user = { id: "0af48797-38f2-4b77-bd16-0486fa291eba" };
    const ROOT_FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";

    const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
    const token_uri = "https://oauth2.googleapis.com/token";
    const serviceAccount = { client_email, token_uri };

    const accessToken = await getGoogleAccessToken(serviceAccount);

    // List PDFs recursively - this might still timeout, but now it saves as it goes
    logger.info("INGESTION", "Starting recursive scan (saving to DB)...");
    
    // We start the scan in the background by returning a response early or just letting it run
    // Since we want the user to see progress, we'll try to run it for a bit then return
    
    listFilesRecursive(ROOT_FOLDER_ID, accessToken, supabaseAdmin, user, logger)
      .then(() => logger.info("INGESTION", "Scan completed"))
      .catch(e => logger.error("INGESTION", `Scan failed: ${e.message}`));

    return new Response(JSON.stringify({ 
      status: "started", 
      message: "Recursive scan started in background. Check drive_ingestion_log table."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});