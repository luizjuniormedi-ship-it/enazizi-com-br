// Drive Corpus — Scanner recursivo de pasta do Google Drive
// Popula drive_corpus_queue com PDFs encontrados. Não baixa nada.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken, GOOGLE_SA_EMAIL } from "../_shared/google-drive.ts";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

const COPYRIGHT_PATTERNS = /\b(harrison|nelson|sabiston|robbins|guyton|netter|cecil)\b/i;
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function specialtyFromPath(path: string): string {
  // path = "ROOT/Cardiologia/Subpasta/x.pdf"  → "Cardiologia"
  const parts = path.split("/").filter(Boolean);
  return parts[1] || parts[0] || "Geral";
}

async function listFolder(folderId: string, token: string): Promise<DriveItem[]> {
  const all: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id,name,mimeType,size,shortcutDetails)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      console.error(`[SCAN] list failed ${r.status}`, await r.text().catch(() => ""));
      break;
    }
    const d = await r.json();
    all.push(...(d.files || []));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return all;
}

async function crawl(
  folderId: string,
  token: string,
  supabase: any,
  path: string,
  stats: { folders: number; pdfs: number; queued: number; skipped: number },
) {
  stats.folders++;
  const items = await listFolder(folderId, token);

  const pdfs = items.filter((i) => {
    const isPdf = i.mimeType === "application/pdf";
    const isShortcut = i.mimeType === "application/vnd.google-apps.shortcut"
      && i.shortcutDetails?.targetMimeType === "application/pdf";
    return isPdf || isShortcut;
  });

  for (const pdf of pdfs) {
    stats.pdfs++;
    const targetId = pdf.mimeType === "application/vnd.google-apps.shortcut"
      ? pdf.shortcutDetails!.targetId : pdf.id;
    const size = pdf.size ? parseInt(pdf.size) : null;

    let skipReason: string | null = null;
    if (COPYRIGHT_PATTERNS.test(pdf.name)) skipReason = "possivel_copyright";
    else if (size && size > MAX_SIZE_BYTES) skipReason = "arquivo_muito_grande";

    const specialty = specialtyFromPath(`${path}/${pdf.name}`);

    const { error } = await supabase.from("drive_corpus_queue").upsert({
      drive_file_id: targetId,
      file_name: pdf.name,
      folder_path: path,
      specialty,
      file_size: size,
      mime_type: "application/pdf",
      status: skipReason ? "skipped" : "pending",
      skip_reason: skipReason,
    }, { onConflict: "drive_file_id" });

    if (error) console.error("[SCAN] upsert error:", error.message);
    else if (skipReason) stats.skipped++;
    else stats.queued++;
  }

  // Recurse into folders
  for (const item of items) {
    let targetId = item.id;
    let mime = item.mimeType;
    if (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails) {
      targetId = item.shortcutDetails.targetId;
      mime = item.shortcutDetails.targetMimeType;
    }
    if (mime === "application/vnd.google-apps.folder") {
      await crawl(targetId, token, supabase, `${path}/${item.name}`, stats);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const folderId = body.folder_id || body.folderId;
    if (!folderId) {
      return new Response(JSON.stringify({ error: "folder_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getGoogleAccessToken({
      client_email: GOOGLE_SA_EMAIL,
      token_uri: "https://oauth2.googleapis.com/token",
    });

    const stats = { folders: 0, pdfs: 0, queued: 0, skipped: 0 };
    // Non-blocking: kick off and return quickly
    (async () => {
      try {
        await crawl(folderId, token, supabase, "ROOT", stats);
        console.log("[SCAN_DONE]", stats);
      } catch (e) {
        console.error("[SCAN_FAIL]", e);
      }
    })();

    return new Response(JSON.stringify({ status: "scan_started", root_folder: folderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
