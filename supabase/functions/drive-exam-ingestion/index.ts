import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function listFilesRecursive(folderId: string, accessToken: string, logger: any) {
  let allFiles: any[] = [];
  
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,size,mimeType)`;
  const resp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!resp.ok) {
    logger.error("DRIVE_LIST", `Error listing ${folderId}: ${await resp.text()}`);
    return [];
  }

  const data = await resp.json();
  const items = data.files || [];

  for (const item of items) {
    if (item.mimeType === "application/pdf") {
      allFiles.push(item);
    } else if (item.mimeType === "application/vnd.google-apps.folder") {
      const subFiles = await listFilesRecursive(item.id, accessToken, logger);
      allFiles = allFiles.concat(subFiles);
    }
  }

  return allFiles;
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

    // List PDFs recursively
    logger.info("INGESTION", "Starting recursive scan...");
    const pdfFiles = await listFilesRecursive(ROOT_FOLDER_ID, accessToken, logger);
    logger.info("INGESTION", `Found ${pdfFiles.length} PDFs total`);

    // Clean up old log (which had folders)
    await supabaseAdmin.from("drive_ingestion_log").delete().neq("status", "completed");

    let registeredCount = 0;
    for (const file of pdfFiles) {
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
      total_found: pdfFiles.length,
      pdfs: pdfFiles.slice(0, 10).map(f => f.name)
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});