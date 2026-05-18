import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

    if (!resp.ok) {
      console.error(`Error listing folder ${folderId}:`, await resp.text());
      break;
    }

    const data = await resp.json();
    allItems = allItems.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

async function crawlRecursive(
  folderId: string, 
  accessToken: string, 
  path: string = "", 
  stats: any = { folders: [], totalFiles: 0 }
) {
  console.log(`Crawling: ${path || "root"}`);
  const items = await listAllItemsInFolder(folderId, accessToken);
  
  const filesCount = items.filter(i => i.mimeType === "application/pdf" || (i.mimeType === "application/vnd.google-apps.shortcut" && i.shortcutDetails?.targetMimeType === "application/pdf")).length;
  
  stats.folders.push({
    path: path || "ROOT",
    id: folderId,
    filesCount: filesCount
  });
  stats.totalFiles += filesCount;

  for (const item of items) {
    let targetId = item.id;
    let isFolder = item.mimeType === "application/vnd.google-apps.folder";

    // Handle shortcuts to folders
    if (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails?.targetMimeType === "application/vnd.google-apps.folder") {
      targetId = item.shortcutDetails.targetId;
      isFolder = true;
    }

    if (isFolder) {
      await crawlRecursive(targetId, accessToken, `${path}/${item.name}`, stats);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const client_email = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
    const token_uri = "https://oauth2.googleapis.com/token";
    const accessToken = await getGoogleAccessToken({ client_email, token_uri });

    const ROOT_FOLDER_ID = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
    const stats = { folders: [], totalFiles: 0 };
    
    await crawlRecursive(ROOT_FOLDER_ID, accessToken, "", stats);

    return new Response(JSON.stringify(stats), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
