// Drive Corpus — scanner recursivo e durável da fila canônica.
// Descobre arquivos, registra proveniência e falha fechado. Não baixa nem publica.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken, GOOGLE_SA_EMAIL } from "../_shared/google-drive.ts";
import { policyForDriveRoot, type DriveSourcePolicy } from "../_shared/drive-corpus-governance.ts";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

const COPYRIGHT_PATTERNS = /\b(harrison|nelson|sabiston|robbins|guyton|netter|cecil|estrat[eé]gia\s*med|medgrupo|banco\s*med)\b/i;
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_DEPTH = 20;

function specialtyFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[1] || parts[0] || "Geral";
}

async function requireAdmin(req: Request, supabase: any): Promise<string> {
  const authorization = req.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Response("Unauthorized", { status: 401 });
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Response("Unauthorized", { status: 401 });
  const { data: role, error: roleError } = await supabase
    .from("user_roles").select("user_id")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (roleError || !role) throw new Response("Forbidden", { status: 403 });
  return user.id;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`DRIVE_LIST_${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      const data = await response.json();
      all.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } finally {
      clearTimeout(timeout);
    }
  } while (pageToken);
  return all;
}

async function persistDiscoveredFile(
  supabase: any, rootId: string, policy: DriveSourcePolicy, pdf: DriveItem,
  targetId: string, path: string, scannedBy: string,
  stats: { queued: number; skipped: number },
) {
  const size = pdf.size ? Number(pdf.size) : null;
  const copyrightFlag = COPYRIGHT_PATTERNS.test(`${path}/${pdf.name}`);
  const tooLarge = Boolean(size && size > MAX_SIZE_BYTES);
  const skipReason = copyrightFlag
    ? "commercial_or_copyright_source_requires_rights_evidence"
    : tooLarge ? "file_too_large" : policy.defaultReason;
  const sourceUrl = `https://drive.google.com/file/d/${targetId}/view`;
  const sourceKind = copyrightFlag ? "commercial" : policy.sourceKind;
  const sourcePurpose = copyrightFlag ? "unclassified" : policy.sourcePurpose;
  const rightsStatus = copyrightFlag ? "blocked" : policy.rightsStatus;
  const rightsEvidenceUrl = copyrightFlag ? null : policy.rightsEvidenceUrl;
  const mutableMetadata = {
    file_name: pdf.name,
    folder_path: path,
    specialty: specialtyFromPath(`${path}/${pdf.name}`),
    file_size: size,
    mime_type: "application/pdf",
    source_root_id: rootId,
    source_url: sourceUrl,
    provenance: {
      drive_file_id: targetId, root_folder_id: rootId, folder_path: path,
      scanned_by: scannedBy, scanned_at: new Date().toISOString(),
    },
  };
  const { data: existing, error: lookupError } = await supabase
    .from("drive_corpus_queue").select("id,status")
    .eq("drive_file_id", targetId).maybeSingle();
  if (lookupError) throw new Error(`QUEUE_LOOKUP: ${lookupError.message}`);

  if (existing) {
    const isDiscoveryState = ["pending", "blocked"].includes(existing.status);
    const { error } = await supabase.from("drive_corpus_queue")
      .update({
        ...mutableMetadata,
        ...(isDiscoveryState ? {
          source_kind: sourceKind,
          source_purpose: sourcePurpose,
          rights_status: rightsStatus,
          rights_evidence_url: rightsEvidenceUrl,
          skip_reason: skipReason,
        } : {}),
      }).eq("id", existing.id);
    if (error) throw new Error(`QUEUE_UPDATE: ${error.message}`);
  } else {
    const { error } = await supabase.from("drive_corpus_queue").insert({
      drive_file_id: targetId,
      ...mutableMetadata,
      status: "blocked",
      skip_reason: skipReason,
      source_kind: sourceKind,
      source_purpose: sourcePurpose,
      rights_status: rightsStatus,
      rights_evidence_url: rightsEvidenceUrl,
      ingestion_review_status: "pending",
    });
    if (error) throw new Error(`QUEUE_INSERT: ${error.message}`);
  }
  stats.skipped++;
}

async function crawl(
  folderId: string, token: string, supabase: any, rootId: string,
  policy: DriveSourcePolicy, path: string, scannedBy: string,
  stats: { folders: number; pdfs: number; queued: number; skipped: number },
  visited: Set<string>, depth = 0,
) {
  if (depth > MAX_DEPTH) throw new Error(`MAX_DEPTH_EXCEEDED:${path}`);
  if (visited.has(folderId)) return;
  visited.add(folderId);
  stats.folders++;
  const items = await listFolder(folderId, token);
  for (const pdf of items) {
    const isPdf = pdf.mimeType === "application/pdf";
    const isPdfShortcut = pdf.mimeType === "application/vnd.google-apps.shortcut"
      && pdf.shortcutDetails?.targetMimeType === "application/pdf";
    if (!isPdf && !isPdfShortcut) continue;
    stats.pdfs++;
    const targetId = isPdfShortcut ? pdf.shortcutDetails!.targetId : pdf.id;
    await persistDiscoveredFile(supabase, rootId, policy, pdf, targetId, path, scannedBy, stats);
  }
  for (const item of items) {
    const targetId = item.mimeType === "application/vnd.google-apps.shortcut"
      ? item.shortcutDetails?.targetId : item.id;
    const mime = item.mimeType === "application/vnd.google-apps.shortcut"
      ? item.shortcutDetails?.targetMimeType : item.mimeType;
    if (targetId && mime === "application/vnd.google-apps.folder") {
      await crawl(targetId, token, supabase, rootId, policy, `${path}/${item.name}`,
        scannedBy, stats, visited, depth + 1);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const scannedBy = await requireAdmin(req, supabase);
    const body = await req.json().catch(() => ({}));
    const folderId = body.folder_id || body.folderId;
    if (!folderId || typeof folderId !== "string") {
      return new Response(JSON.stringify({ error: "folder_id_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = await getGoogleAccessToken({
      client_email: GOOGLE_SA_EMAIL, token_uri: "https://oauth2.googleapis.com/token",
    });
    const stats = { folders: 0, pdfs: 0, queued: 0, skipped: 0 };
    await crawl(folderId, token, supabase, folderId, policyForDriveRoot(folderId), "ROOT",
      scannedBy, stats, new Set<string>());
    return new Response(JSON.stringify({ status: "scan_completed", root_folder: folderId, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(JSON.stringify({ error: await error.text() }), {
        status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SCAN_FAIL]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
