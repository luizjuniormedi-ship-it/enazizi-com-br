import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken, processSingleDriveFile } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function listFilesRecursive(folderId: string, accessToken: string, supabase: any, user: any, logger: any, path: string = "root", depth = 0) {
  if (depth > 15) return; // Increased depth
  
  let pageToken: string | undefined = undefined;
  let totalInFolder = 0;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, size, shortcutDetails)");
    url.searchParams.set("pageSize", "1000"); // Maximize page size
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!resp.ok) {
      logger.error("DRIVE_LIST", `Error listing ${path} (${folderId}): ${await resp.text()}`);
      return;
    }

    const data = await resp.json();
    const items = data.files || [];
    pageToken = data.nextPageToken;

    for (const item of items) {
      let targetId = item.id;
      let targetMimeType = item.mimeType;

      // Handle shortcuts
      if (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails) {
        targetId = item.shortcutDetails.targetId;
        targetMimeType = item.shortcutDetails.targetMimeType;
      }

      if (targetMimeType === "application/pdf") {
        totalInFolder++;
        await supabase.from("drive_ingestion_log").upsert({
          file_id: targetId,
          file_name: item.name,
          file_size: item.size ? parseInt(item.size) : null,
          status: 'pending',
          processed_by: user.id
        }, { onConflict: 'file_id' });
      } else if (targetMimeType === "application/vnd.google-apps.folder") {
        await listFilesRecursive(targetId, accessToken, supabase, user, logger, `${path}/${item.name}`, depth + 1);
      }
    }
  } while (pageToken);
  
  if (totalInFolder > 0) {
    logger.info("SCAN", `Found ${totalInFolder} PDFs in ${path}`);
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
      .order("file_name", { ascending: true }) 
      .limit(3);

    // 2. Scan Drive (Always scan a bit to keep finding new things)
    logger.info("PIPELINE", "Checking for new files...");
    const ROOT_FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
    const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
    const token_uri = "https://oauth2.googleapis.com/token";
    const accessToken = await getGoogleAccessToken({ client_email, token_uri });

    // Background scan (don't await fully to avoid timeout)
    listFilesRecursive(ROOT_FOLDER_ID, accessToken, supabaseAdmin, user, logger).catch(e => logger.error("SCAN_ERROR", e.message));
    
    // If we already have files, don't wait for scan to finish
    if (!pendingFiles || pendingFiles.length === 0) {
      // Small wait for first few files if empty
      await new Promise(r => setTimeout(r, 5000));
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

    // 3. Process Batch via HTTP triggers (parallel & non-blocking)
    logger.info("PIPELINE", `Triggering batch of ${pendingFiles.length} files...`);
    const results = [];
    
    // We use a small batch here to not overwhelm the AI gateway or DB, but they run in parallel
    const triggerPromises = pendingFiles.map(async (file) => {
      logger.info("PIPELINE", `Triggering process for: ${file.file_name}`);
      try {
        // Trigger the specific processor function via HTTP
        // This allows each file to have its own 60s timeout window
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-process-single-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileId: file.file_id })
        }).catch(e => logger.error("TRIGGER_ERROR", `Failed to trigger ${file.file_name}: ${e.message}`));
        
        return { file: file.file_name, status: "triggered" };
      } catch (err) {
        return { file: file.file_name, status: "failed_trigger", error: err.message };
      }
    });

    const triggerResults = await Promise.all(triggerPromises);

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