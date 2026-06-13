// Drive Corpus — Ingestão em lote
// Pipeline: Drive PDF -> Claude (extrai + estrutura PDF nativo)
// -> chunk -> OpenAI embedding -> rag_documents/chunks/embeddings
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGoogleAccessToken, GOOGLE_SA_EMAIL } from "../_shared/google-drive.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Hardcoded para manter consistência com pipeline existente (drive-process-single-file)
const SYSTEM_USER_ID = "0af48797-38f2-4b77-bd16-0486fa291eba";
const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000001";

const DAILY_CAP = 50;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

async function ensureOrgExists(supabase: any) {
  await supabase.from("organizations")
    .upsert({ id: SYSTEM_ORG_ID, name: "ENAZIZI System" }, { onConflict: "id" });
}

async function downloadDrivePdf(fileId: string, token: string): Promise<Uint8Array> {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`DRIVE_DL_${r.status}`);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_PDF_BYTES) throw new Error(`PDF_TOO_LARGE_${buf.byteLength}`);
  return new Uint8Array(buf);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Encode in chunks to avoid call-stack overflow on large PDFs
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any);
  }
  return btoa(bin);
}

async function extractPdfTextWithGemini(pdfBytes: Uint8Array, fileName: string): Promise<string> {
  const b64 = bytesToBase64(pdfBytes);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: "application/pdf", data: b64 } },
        { text: `Extraia TODO o texto médico relevante deste PDF (${fileName}) em pt-BR. Preserve estrutura por seções (use ## títulos). Ignore cabeçalhos/rodapés/numeração de página. Não resuma — extraia integral. Saída: apenas o texto extraído, sem comentários.` },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GEMINI_EXTRACT_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n") || "";
  if (text.length < 200) throw new Error(`GEMINI_EXTRACT_EMPTY (${text.length} chars)`);
  return text;
}

async function structureWithClaude(rawText: string, specialty: string, fileName: string): Promise<string> {
  // Limita input (claude-sonnet aceita 200k, mas controlamos custo)
  const input = rawText.slice(0, 60000);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Você está estruturando conteúdo médico para uma base de conhecimento RAG (especialidade: ${specialty}, arquivo: ${fileName}).

Reescreva o texto abaixo em pt-BR como uma referência clínica estruturada por seções com títulos ## (Definição, Epidemiologia, Fisiopatologia, Quadro Clínico, Diagnóstico, Tratamento, Complicações, Prognóstico, Pontos de Prova). Preserve todos os dados clínicos relevantes (critérios, doses, valores, classificações). Cite a fonte ao final como: _Fonte: ${fileName}_.

Texto bruto:
<texto>
${input}
</texto>

Saída: apenas o markdown estruturado, sem comentários introdutórios.`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`CLAUDE_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const out = j?.content?.[0]?.text || "";
  if (out.length < 300) throw new Error(`CLAUDE_OUTPUT_TOO_SHORT (${out.length})`);
  return out;
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

async function embedOpenAI(input: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: input.replace(/\n/g, " "), model: "text-embedding-3-small" }),
  });
  if (!r.ok) throw new Error(`EMBED_${r.status}: ${(await r.text()).slice(0, 150)}`);
  const j = await r.json();
  return j.data[0].embedding;
}

async function processOne(row: any, token: string, supabase: any): Promise<void> {
  console.log(`[INGEST_START] ${row.file_name} (${row.drive_file_id})`);
  await supabase.from("drive_corpus_queue").update({
    status: "processing", retry_count: (row.retry_count || 0) + 1,
  }).eq("id", row.id);

  try {
    const pdfBytes = await downloadDrivePdf(row.drive_file_id, token);
    const rawText = await extractPdfTextWithGemini(pdfBytes, row.file_name);
    const structured = await structureWithClaude(rawText, row.specialty || "Geral", row.file_name);

    // Cria rag_document
    const { data: doc, error: docErr } = await supabase.from("rag_documents").insert({
      organization_id: SYSTEM_ORG_ID,
      uploaded_by: SYSTEM_USER_ID,
      title: row.file_name.replace(/\.pdf$/i, ""),
      file_name: row.file_name,
      file_path: `drive://${row.drive_file_id}`,
      file_type: "application/pdf",
      file_size: row.file_size,
      status: "completed",
      is_published: true,
      published_at: new Date().toISOString(),
      source_type: "drive_corpus",
      drive_file_id: row.drive_file_id,
      specialty: row.specialty,
    }).select("id").single();
    if (docErr) throw new Error(`DOC_INSERT: ${docErr.message}`);

    // Chunks + embeddings
    const chunks = chunkText(structured);
    let chunkIdx = 0;
    for (const chunk of chunks) {
      const { data: ch, error: chErr } = await supabase.from("rag_chunks").insert({
        document_id: doc.id,
        organization_id: SYSTEM_ORG_ID,
        chunk_index: chunkIdx,
        content: chunk,
        metadata: { specialty: row.specialty, source: row.file_name },
      }).select("id").single();
      if (chErr) throw new Error(`CHUNK_INSERT: ${chErr.message}`);

      const emb = await embedOpenAI(chunk);
      const { error: eErr } = await supabase.from("rag_embeddings").insert({
        chunk_id: ch.id,
        organization_id: SYSTEM_ORG_ID,
        embedding: emb,
        model: "text-embedding-3-small",
      });
      if (eErr) throw new Error(`EMB_INSERT: ${eErr.message}`);
      chunkIdx++;
    }

    await supabase.from("drive_corpus_queue").update({
      status: "completed",
      rag_document_id: doc.id,
      chunks_count: chunks.length,
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", row.id);

    console.log(`[INGEST_DONE] ${row.file_name} chunks=${chunks.length}`);
  } catch (e: any) {
    console.error(`[INGEST_FAIL] ${row.file_name}: ${e.message}`);
    await supabase.from("drive_corpus_queue").update({
      status: "failed", error_message: e.message?.slice(0, 500),
    }).eq("id", row.id);
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
    const batchSize = Math.min(Number(body.batch_size) || 5, 10);

    // Daily cap
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: doneToday } = await supabase
      .from("drive_corpus_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("processed_at", since);
    if ((doneToday || 0) >= DAILY_CAP) {
      return new Response(JSON.stringify({ status: "daily_cap_reached", processed_today: doneToday }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pending, error } = await supabase
      .from("drive_corpus_queue")
      .select("*")
      .eq("status", "pending")
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (error) throw error;

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ status: "empty", message: "Nenhum pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await ensureOrgExists(supabase);
    const token = await getGoogleAccessToken({
      client_email: GOOGLE_SA_EMAIL,
      token_uri: "https://oauth2.googleapis.com/token",
    });

    // Process sequentially to avoid rate limits and OOM with PDFs
    for (const row of pending) {
      await processOne(row, token, supabase);
    }

    return new Response(JSON.stringify({
      status: "batch_done",
      processed: pending.length,
      processed_today: doneToday,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[INGEST_ERR]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
