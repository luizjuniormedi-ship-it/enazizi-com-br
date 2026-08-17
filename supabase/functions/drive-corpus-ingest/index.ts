// Drive Corpus — consumidor em lote da fila canônica.
// Extrai somente fontes liberadas e grava RAG em staging não publicado.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken, GOOGLE_SA_EMAIL } from "../_shared/google-drive.ts";
import { retryDelayMs, sha256Hex } from "../_shared/drive-corpus-governance.ts";

const SYSTEM_USER_ID = "0af48797-38f2-4b77-bd16-0486fa291eba";
const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DAILY_CAP = 100;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const DRIVE_TIMEOUT_MS = 60_000;
const AI_TIMEOUT_MS = 180_000;
const EMBEDDING_TIMEOUT_MS = 30_000;

async function requireAdmin(req: Request, supabase: any): Promise<string> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Response("Unauthorized", { status: 401 });
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Response("Unauthorized", { status: 401 });
  const { data: role, error: roleError } = await supabase.from("user_roles")
    .select("user_id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (roleError || !role) throw new Response("Forbidden", { status: 403 });
  return user.id;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOrgExists(supabase: any) {
  const { error } = await supabase.from("organizations")
    .upsert({ id: SYSTEM_ORG_ID, name: "ENAZIZI System" }, { onConflict: "id" });
  if (error) throw new Error(`ORG_UPSERT: ${error.message}`);
}

async function downloadDrivePdf(fileId: string, token: string): Promise<Uint8Array> {
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }, DRIVE_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`DRIVE_DL_${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_PDF_BYTES) throw new Error(`PDF_TOO_LARGE_${buffer.byteLength}`);
  if (buffer.byteLength === 0) throw new Error("PDF_EMPTY");
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + size) as unknown as number[]);
  }
  return btoa(binary);
}

async function extractAndStructureWithClaude(
  pdfBytes: Uint8Array, specialty: string, fileName: string,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY_MISSING");
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytesToBase64(pdfBytes) } },
          { type: "text", text: `Estruture o conteúdo médico deste PDF para revisão editorial RAG (especialidade: ${specialty}, arquivo: ${fileName}). Preserve critérios, doses e referências. Saída em markdown pt-BR. Não invente conteúdo ausente.` },
        ],
      }],
    }),
  }, AI_TIMEOUT_MS);
  if (!response.ok) throw new Error(`CLAUDE_${response.status}: ${(await response.text()).slice(0, 200)}`);
  const json = await response.json();
  const output = json?.content?.[0]?.text || "";
  if (output.length < 300) throw new Error(`CLAUDE_OUTPUT_TOO_SHORT_${output.length}`);
  return output;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function embedOpenAI(input: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const response = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: input.replace(/\n/g, " "), model: "text-embedding-3-small" }),
  }, EMBEDDING_TIMEOUT_MS);
  if (!response.ok) throw new Error(`EMBED_${response.status}: ${(await response.text()).slice(0, 150)}`);
  const json = await response.json();
  if (!Array.isArray(json?.data?.[0]?.embedding)) throw new Error("EMBED_INVALID_RESPONSE");
  return json.data[0].embedding;
}

async function markFailure(supabase: any, row: any, message: string) {
  const exhausted = Number(row.retry_count) >= 3;
  const { error } = await supabase.from("drive_corpus_queue").update({
    status: exhausted ? "failed" : "retry_wait",
    error_message: message.slice(0, 500),
    next_retry_at: exhausted ? null : new Date(Date.now() + retryDelayMs(row.retry_count)).toISOString(),
    locked_at: null,
    locked_by: null,
    lease_until: null,
    processing_phase: exhausted ? "failed" : "retry_wait",
  }).eq("id", row.id).eq("locked_by", row.locked_by).eq("attempt_id", row.attempt_id);
  if (error) console.error(`[INGEST_MARK_FAILURE] ${row.id}: ${error.message}`);
}

async function renewLease(supabase: any, row: any, phase: string) {
  const { data, error } = await supabase.from("drive_corpus_queue").update({
    lease_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    processing_phase: phase,
  }).eq("id", row.id).eq("locked_by", row.locked_by).eq("attempt_id", row.attempt_id)
    .select("id").maybeSingle();
  if (error || !data) throw new Error(`LEASE_LOST:${phase}`);
}

async function processOne(row: any, token: string, supabase: any): Promise<"staged" | "duplicate" | "failed"> {
  try {
    await renewLease(supabase, row, "downloading");
    const pdfBytes = await downloadDrivePdf(row.drive_file_id, token);
    const checksum = await sha256Hex(pdfBytes);
    await renewLease(supabase, row, "deduplicating");
    const { data: duplicate, error: duplicateError } = await supabase
      .from("drive_corpus_queue").select("id")
      .eq("source_checksum_sha256", checksum)
      .eq("ingestion_version", row.ingestion_version)
      .neq("id", row.id).limit(1).maybeSingle();
    if (duplicateError) throw new Error(`DUPLICATE_LOOKUP: ${duplicateError.message}`);
    if (duplicate) {
      const { error } = await supabase.from("drive_corpus_queue").update({
        status: "duplicate", duplicate_of_queue_id: duplicate.id,
        source_checksum_sha256: null, processed_at: new Date().toISOString(),
        locked_at: null, locked_by: null, lease_until: null,
        processing_phase: "duplicate", error_message: null,
      }).eq("id", row.id).eq("locked_by", row.locked_by).eq("attempt_id", row.attempt_id);
      if (error) throw new Error(`DUPLICATE_UPDATE: ${error.message}`);
      return "duplicate";
    }
    const { error: hashError } = await supabase.from("drive_corpus_queue")
      .update({ source_checksum_sha256: checksum }).eq("id", row.id)
      .eq("locked_by", row.locked_by).eq("attempt_id", row.attempt_id);
    if (hashError) throw new Error(`CHECKSUM_UPDATE: ${hashError.message}`);

    await renewLease(supabase, row, "extracting");
    const structured = await extractAndStructureWithClaude(pdfBytes, row.specialty || "Geral", row.file_name);
    await renewLease(supabase, row, "staging_document");
    const documentPayload = {
      organization_id: SYSTEM_ORG_ID,
      uploaded_by: SYSTEM_USER_ID,
      title: row.file_name.replace(/\.pdf$/i, ""),
      file_name: row.file_name,
      file_path: `drive://${row.drive_file_id}`,
      file_type: "application/pdf",
      file_size: row.file_size,
      status: "completed",
      is_published: false,
      published_at: null,
      is_active: true,
      source_type: "drive_corpus",
      source_purpose: row.source_purpose,
      drive_file_id: row.drive_file_id,
      specialty: row.specialty,
      source_url: row.source_url,
      source_checksum_sha256: checksum,
      rights_status: row.rights_status,
      answer_key_url: row.answer_key_url,
      editorial_review_status: "pending",
      provenance: { ...(row.provenance || {}), queue_id: row.id, ingestion_version: row.ingestion_version },
    };
    const { data: existingDoc, error: existingError } = await supabase.from("rag_documents")
      .select("id").eq("drive_file_id", row.drive_file_id).maybeSingle();
    if (existingError) throw new Error(`DOC_LOOKUP: ${existingError.message}`);
    let documentId: string;
    if (existingDoc) {
      const { error: deleteError } = await supabase.from("rag_chunks").delete().eq("document_id", existingDoc.id);
      if (deleteError) throw new Error(`CHUNK_RESET: ${deleteError.message}`);
      const { data: updated, error } = await supabase.from("rag_documents")
        .update(documentPayload).eq("id", existingDoc.id).select("id").single();
      if (error) throw new Error(`DOC_UPDATE: ${error.message}`);
      documentId = updated.id;
    } else {
      const { data: inserted, error } = await supabase.from("rag_documents")
        .insert(documentPayload).select("id").single();
      if (error) throw new Error(`DOC_INSERT: ${error.message}`);
      documentId = inserted.id;
    }

    const chunks = chunkText(structured);
    for (let index = 0; index < chunks.length; index++) {
      await renewLease(supabase, row, `embedding_${index + 1}_of_${chunks.length}`);
      const chunk = chunks[index];
      const { data: createdChunk, error: chunkError } = await supabase.from("rag_chunks").insert({
        document_id: documentId,
        organization_id: SYSTEM_ORG_ID,
        chunk_index: index,
        content: chunk,
        metadata: { specialty: row.specialty, source: row.file_name, queue_id: row.id, publication_state: "staged" },
      }).select("id").single();
      if (chunkError) throw new Error(`CHUNK_INSERT: ${chunkError.message}`);
      const embedding = await embedOpenAI(chunk);
      const { error: embeddingError } = await supabase.from("rag_embeddings").insert({
        chunk_id: createdChunk.id, organization_id: SYSTEM_ORG_ID,
        embedding, model: "text-embedding-3-small",
      });
      if (embeddingError) throw new Error(`EMB_INSERT: ${embeddingError.message}`);
    }

    const { error: completionError } = await supabase.from("drive_corpus_queue").update({
      status: "staged", rag_document_id: documentId, chunks_count: chunks.length,
      processed_at: new Date().toISOString(), next_retry_at: null,
      locked_at: null, locked_by: null, lease_until: null,
      processing_phase: "staged", error_message: null,
    }).eq("id", row.id).eq("locked_by", row.locked_by).eq("attempt_id", row.attempt_id);
    if (completionError) throw new Error(`QUEUE_COMPLETE: ${completionError.message}`);
    return "staged";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[INGEST_FAIL] ${row.file_name}: ${message}`);
    await markFailure(supabase, row, message);
    return "failed";
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
    await requireAdmin(req, supabase);
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batch_size) || 1, 1), 2);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: capError } = await supabase.from("drive_corpus_queue")
      .select("*", { count: "exact", head: true }).eq("status", "staged").gte("processed_at", since);
    if (capError) throw new Error(`DAILY_CAP_QUERY: ${capError.message}`);
    if ((count || 0) >= DAILY_CAP) {
      return new Response(JSON.stringify({ status: "daily_cap_reached", processed_today: count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await ensureOrgExists(supabase);
    const workerId = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabase.rpc("claim_drive_corpus_jobs", {
      p_worker_id: workerId, p_limit: Math.min(batchSize, DAILY_CAP - (count || 0)),
    });
    if (claimError) throw new Error(`CLAIM: ${claimError.message}`);
    if (!claimed?.length) {
      return new Response(JSON.stringify({ status: "empty", message: "Nenhum item elegível" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getGoogleAccessToken({
      client_email: GOOGLE_SA_EMAIL, token_uri: "https://oauth2.googleapis.com/token",
    });
    const results = { staged: 0, duplicate: 0, failed: 0 };
    for (const claimedRow of claimed) {
      const row = { ...claimedRow, locked_by: workerId };
      results[await processOne(row, token, supabase)]++;
    }
    return new Response(JSON.stringify({ status: "batch_done", claimed: claimed.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(JSON.stringify({ error: await error.text() }), {
        status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[INGEST_ERR]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
