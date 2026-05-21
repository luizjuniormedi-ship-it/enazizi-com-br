import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getGoogleAccessToken } from "../_shared/google-drive.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: {
    targetId: string;
    targetMimeType: string;
  };
}

async function listAllItemsInFolder(folderId: string, accessToken: string): Promise<DriveItem[]> {
  let allItems: DriveItem[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, size, shortcutDetails)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!resp.ok) break;

    const data = await resp.json();
    allItems = allItems.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

async function deepCrawl(
  folderId: string, 
  accessToken: string, 
  supabase: any,
  path: string = "root",
  parentId: string | null = null
) {
  // IGNORE "MEDICO LEGISTA"
  if (path.toUpperCase().includes("MEDICO LEGISTA")) {
    console.log(`[CRAWL] Skipping blacklisted folder: ${path}`);
    return;
  }

  const items = await listAllItemsInFolder(folderId, accessToken);
  
  const pdfs = items.filter(i => {
    const isPdf = i.mimeType === "application/pdf";
    const isShortcutToPdf = i.mimeType === "application/vnd.google-apps.shortcut" && i.shortcutDetails?.targetMimeType === "application/pdf";
    return isPdf || isShortcutToPdf;
  });

  // Save folder info
  await supabase.from("drive_folders_scan").upsert({
    id: folderId,
    name: path.split("/").pop() || "ROOT",
    path: path,
    parent_id: parentId,
    files_count: pdfs.length
  });

  // Register PDFs to main log
  if (pdfs.length > 0) {
    for (const pdf of pdfs) {
      // Also skip files if the name contains the blacklisted term just in case
      if (pdf.name.toUpperCase().includes("MEDICO LEGISTA")) continue;

      const targetId = pdf.mimeType === "application/vnd.google-apps.shortcut" ? pdf.shortcutDetails?.targetId : pdf.id;
      await supabase.from("drive_ingestion_log").upsert({
        file_id: targetId,
        file_name: pdf.name,
        file_size: pdf.size ? parseInt(pdf.size) : null,
        status: 'pending'
      }, { onConflict: 'file_id' });
    }
  }

  // Recurse
  for (const item of items) {
    let targetId = item.id;
    let isFolder = item.mimeType === "application/vnd.google-apps.folder";
    let targetMime = item.mimeType;

    if (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails) {
      targetId = item.shortcutDetails.targetId;
      targetMime = item.shortcutDetails.targetMimeType;
      isFolder = targetMime === "application/vnd.google-apps.folder";
    }

    if (isFolder) {
      await deepCrawl(targetId, accessToken, supabase, `${path}/${item.name}`, folderId);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
    const token_uri = "https://oauth2.googleapis.com/token";
    const accessToken = await getGoogleAccessToken({ client_email, token_uri });

    const ROOT_FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
    
    // Non-blocking crawl
    deepCrawl(ROOT_FOLDER_ID, accessToken, supabase).catch(console.error);

    return new Response(JSON.stringify({ status: "crawling_started" }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
