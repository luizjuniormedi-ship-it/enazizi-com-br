import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken, processSingleDriveFile } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function listFilesRecursive(folderId: string, accessToken: string, supabase: any, user: any, logger: any, depth = 0) {
  if (depth > 5) return;
  
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
      await supabase.from("drive_ingestion_log").upsert({
        file_id: item.id,
        file_name: item.name,
        file_size: item.size ? parseInt(item.size) : null,
        status: 'pending',
        processed_by: user.id
      }, { onConflict: 'file_id' });
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
    info: (tag: string, msg: string, data?: any) => console.log(`[${tag}] ${msg}`, data || ""),
    error: (tag: string, msg: string, data?: any) => console.error(`[${tag}] ${msg}`, data || ""),
    warn: (tag: string, msg: string, data?: any) => console.warn(`[${tag}] ${msg}`, data || ""),
  };

  try {
    const user = { id: "0af48797-38f2-4b77-bd16-0486fa291eba" }; // Admin test user
    
    // 1. Get Pending Files (Prioritize MEDCURSO, then ESTRATEGIA)
    let { data: pendingFiles } = await supabaseAdmin
      .from("drive_ingestion_log")
      .select("file_id, file_name")
      .eq("status", "pending")
      .order("file_name", { ascending: true }) // Simplified priority via name for now
      .limit(3);

    // 2. If no pending, scan Drive
    if (!pendingFiles || pendingFiles.length === 0) {
      logger.info("PIPELINE", "No pending files. Starting new scan...");
      const ROOT_FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
      const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
      const token_uri = "https://oauth2.googleapis.com/token";
      const accessToken = await getGoogleAccessToken({ client_email, token_uri });

      await listFilesRecursive(ROOT_FOLDER_ID, accessToken, supabaseAdmin, user, logger);
      
      // Try fetching again after scan
      const { data: refreshedPending } = await supabaseAdmin
        .from("drive_ingestion_log")
        .select("file_id, file_name")
        .eq("status", "pending")
        .limit(3);
      pendingFiles = refreshedPending;
    }

    if (!pendingFiles || pendingFiles.length === 0) {
      return new Response(JSON.stringify({ status: "idle", message: "No files to process after scan." }), { headers: corsHeaders });
    }

    // 3. Process Batch
    logger.info("PIPELINE", `Processing batch of ${pendingFiles.length} files...`);
    const results = [];
    for (const file of pendingFiles) {
      logger.info("PIPELINE", `Starting: ${file.file_name}`);
      try {
        const result = await processSingleDriveFile(file.file_id, { supabaseAdmin, logger, user });
        results.push({ file: file.file_name, status: "ok", ...result });
      } catch (err) {
        logger.error("PIPELINE_ERROR", `Failed ${file.file_name}: ${err.message}`);
        results.push({ file: file.file_name, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ 
      status: "batch_completed", 
      processed: results.length,
      details: results
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    logger.error("PIPELINE_CRASH", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});