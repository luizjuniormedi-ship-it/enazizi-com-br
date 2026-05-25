import { ALLOWED_MODELS } from "./ai-model-registry.ts";
import { sanitizeForPostgres, generateStatementHash } from "./db-utils.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

// Direct AI extraction with page-based chunking for large PDFs.
// OpenAI primary (180s timeout), Gemini fallback. Bypasses ai-router/Lovable Gateway.
async function callOpenAIOnce(base64Pdf: string, fileName: string, logger: any, timeoutMs = 180000): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return null;
  const systemPrompt = `Você é um especialista em medicina e extração de dados. Extraia questões médicas de provas em PDF. SEMPRE enriqueça cada questão com: board, year, institution, topic, subtopic, difficulty (1-5), explanation, clinical_case, tags.`;
  const userPrompt = `Extraia questões deste PDF de prova médica. Formato JSON: {"questions": [{"statement": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "...", "topic": "...", "subtopic": "...", "board": "...", "year": 2024, "institution": "...", "difficulty": 3, "clinical_case": true, "tags": ["tag1"]}]}`;
  try {
    logger.info("AI_OPENAI", `Calling OpenAI gpt-4o-mini for ${fileName} (timeout ${timeoutMs}ms)`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions: systemPrompt,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            { type: "input_file", filename: fileName, file_data: `data:application/pdf;base64,${base64Pdf}` }
          ]
        }],
        text: { format: { type: "json_object" } },
        max_output_tokens: 8000
      })
    });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const text = data.output_text
        || data.output?.[0]?.content?.[0]?.text
        || data.output?.find?.((o:any)=>o.type==='message')?.content?.find?.((c:any)=>c.type==='output_text')?.text
        || "{}";
      logger.info("AI_OPENAI_OK", `OpenAI succeeded for ${fileName}`);
      return text;
    }
    const errTxt = (await res.text()).slice(0, 300);
    logger.warn("AI_OPENAI_FAIL", `OpenAI ${res.status}: ${errTxt}`);
    return null;
  } catch (e) {
    logger.warn("AI_OPENAI_EXCEPTION", `OpenAI threw: ${(e as Error).message}`);
    return null;
  }
}

async function callGeminiOnce(base64Pdf: string, fileName: string, logger: any): Promise<string | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return null;
  const systemPrompt = `Você é um especialista em medicina. Extraia questões médicas com board, year, institution, topic, subtopic, difficulty, explanation, clinical_case, tags.`;
  const userPrompt = `Extraia questões. JSON: {"questions":[{"statement":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"...","topic":"...","subtopic":"...","board":"...","year":2024,"institution":"...","difficulty":3,"clinical_case":true,"tags":[]}]}`;
  try {
    logger.info("AI_GEMINI", `Calling Gemini direct for ${fileName}`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` },
            { inline_data: { mime_type: "application/pdf", data: base64Pdf } }
          ]}],
          generationConfig: { response_mime_type: "application/json", maxOutputTokens: 8000 }
        })
      }
    );
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      logger.info("AI_GEMINI_OK", `Gemini succeeded for ${fileName}`);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    }
    const errTxt = (await res.text()).slice(0, 200);
    logger.warn("AI_GEMINI_FAIL", `Gemini ${res.status}: ${errTxt}`);
    return null;
  } catch (e) {
    logger.warn("AI_GEMINI_EXCEPTION", `Gemini threw: ${(e as Error).message}`);
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function splitPdfByPages(pdfBytes: Uint8Array, pagesPerChunk: number, logger: any): Promise<string[]> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= pagesPerChunk) return [bytesToBase64(pdfBytes)];
  logger.info("PDF_SPLIT", `Splitting PDF with ${total} pages into chunks of ${pagesPerChunk}`);
  const chunks: string[] = [];
  for (let start = 0; start < total; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, total);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const copied = await out.copyPages(src, indices);
    copied.forEach(p => out.addPage(p));
    const outBytes = await out.save();
    chunks.push(bytesToBase64(outBytes));
  }
  return chunks;
}

async function extractFromChunk(base64Pdf: string, label: string, logger: any): Promise<any[]> {
  let raw = await callOpenAIOnce(base64Pdf, label, logger, 180000);
  if (!raw) raw = await callGeminiOnce(base64Pdf, label, logger);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch (e) {
    logger.warn("AI_PARSE_FAIL", `Could not parse JSON for ${label}: ${(e as Error).message}`);
    return [];
  }
}

async function extractQuestionsDirect(pdfBytes: Uint8Array, fileName: string, logger: any): Promise<string> {
  const PAGES_PER_CHUNK = 30;
  let chunks: string[];
  try {
    chunks = await splitPdfByPages(pdfBytes, PAGES_PER_CHUNK, logger);
  } catch (e) {
    logger.warn("PDF_SPLIT_FAIL", `Could not parse PDF for splitting, sending whole: ${(e as Error).message}`);
    chunks = [bytesToBase64(pdfBytes)];
  }
  const allQuestions: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks.length > 1 ? `${fileName}#chunk${i + 1}/${chunks.length}` : fileName;
    const qs = await extractFromChunk(chunks[i], label, logger);
    logger.info("AI_CHUNK_OK", `${label}: ${qs.length} questions`);
    allQuestions.push(...qs);
  }
  if (allQuestions.length === 0) throw new Error("AI returned zero questions across all chunks");
  return JSON.stringify({ questions: allQuestions });
}


// Shared Hardcoded Credentials (Temporary for validation)
export const GOOGLE_SA_EMAIL = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
export const GOOGLE_SA_PRIVATE_KEY_B64 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDeQwllT5BbX4pbtblw7u+xTtw2J5wv1erns7TNKWbR1sMFp6bwqAzSESz4JRky7ODbmT/0CTiyou/wQ/1FvI5q/6UAnOtSziiuFy2v2dE2CeipH0SqU4ENDy251+ap4q8v59rbAhPcaPVeXqOPA5zd+w6Ldn/0JKhT1Wh3YdaZQhaeT7ZCCBTGtatxGSfaQGjA85VZHwrc5uHpKoaFO+7XAE9hsNq/iRlbC89eUIkE1GG9NHKvYYVR0QP1MO9kF6jAwjAo3d4LkkYxojBukVustkElNzG614SDDt/+igroNkLXrHMjoYze+55AzuMA3HOWZA8dMz7sT1tnbtYiovZjAgMBAAECggEAF9b964F4vOxHBWY9EUl3qT+JrD9cZ98clqS2aGkf77MG8RTV+as00NVpyuYDyWwSBEvwSacxjyud69oHERNT/VMVajbqoNOfFmlDC8EjyRWQAI/riA9z4Kg3od7wDVnUq6FFXsdexP33D5u8FGtxSHgUy822lMPX0EIsNd3nLEHwvNHGVxDFoyeE431S7AE53SS2uwoEb54WKuOw0wubAHf4avc6ZwwJ3n7trKMPQudU1UyihJ2mQqJZTnB2Sxxk72DxrWHUQ20z17QjJ4qZRm5+3orrG/xh0E2hUCS2dhhnu5VsMHd6UHEVo0zV51n4mjjXdAWKTvde6dknQM1qlQKBgQD5l6JUi3aUhVAu43Z2o1D+koVCkxTZwg/rJepeMr2MVdcX5xe4gYFORVHXnA4rc6GZF+li5iwwGy4YMJg9lC95asXzy7ixDGPquCtxsHBgPJOCgisa+w+cdWrDLXhr5iwEAI/MIF5j+fs4q4FcMJrxk2Ic3cOqaAeTwazUZ7FIdQKBgQDj98gpShNAMu7MgjFKOxmEyhi+6FF7GekET6D3g3p3177mDPmOGi3aZbnQ4VoFzR7ovkuYrANj4SjU+mBBqQ91wh1WcgfaoNd0S/XZUj/oX0Osey1jNk2tSUJheQcJs4vFrZumanb45gsL0TFw4hGes7pOR+vmJbbzNq4/D0godwKBgBdUkznv51+urnYTkQk57uI88/PrJ7HLMA2895FikNFDXN3BHjiC8oFMfX/3+GMbZemXkJtMBKligQaF1FU9OsrQrjxBuLvj+psAKB9ybK6yOt+iJ0FYYncvipE/+NetJkQhgU+FXw1dWpxLe8YQTQtzyWIFYLrXCo5HNk6MesfZAoGAY8h7VodT8c/Zcq6yAHnp65PCTR3HPIjU08w++tgT7Q0ERBH90dNnqqbINMPO8acdFmblFAiG21sc0kxdgaAMYlD7InF7OpkYdZEiJWO5EW9RYdfwv/JvAaCFa8Db8cUjMv2QmcEUHlIjF6MTbwOlDsBAli8o9G4hrEeM8ZEw1nUCgYEA95ll1mt9GO9uVv9Tz1EneaMDqK8s4r20GskXu5HJL9Peh78HemLHMofX8r9OQFM6fQXbEdNr12O5DOV0mX/ef/jNLmqCb8+T7vfiVlme0wuZZ91VMBRWRa9cJdMPla8/44A4lBFb9gV9wPJZb/F7VF4p0ORqTNnTRiLbU1cIvbM=";

// Minimal JWT signer for Google Auth using native Web Crypto
export async function getGoogleAccessToken(serviceAccount: any, logger?: any) {
  if (logger) logger.info("GOOGLE_AUTH", "Google auth starting...", { client_email: serviceAccount.client_email });
  
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;
  
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const base64UrlEncode = (str: string) => {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Use hardcoded if env is missing
  const pemBody = GOOGLE_SA_PRIVATE_KEY_B64;
  
  if (logger) logger.info("GOOGLE_AUTH_PK", `PK body prefix: ${pemBody.substring(0, 30)}`);

  // 3. Decode base64 to binary
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const signedToken = `${unsignedToken}.${encodedSignature}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for auth

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedToken,
      }),
      signal: controller.signal
    });

    const data = await response.json();
    clearTimeout(timeoutId);

    if (!data.access_token) {
      if (logger) logger.error("GOOGLE_AUTH_FAILED", "Google auth failed", { data });
      throw new Error(`Failed to get Google access token: ${JSON.stringify(data)}`);
    }
    
    if (logger) logger.info("GOOGLE_AUTH_SUCCESS", "Google auth success");
    return data.access_token;
  } catch (err) {
    clearTimeout(timeoutId);
    if (logger) logger.error("GOOGLE_AUTH_ERROR", "Google auth error", { error: err.message });
    throw err;
  }
}

export async function processSingleDriveFile(
  fileId: string, 
  { supabaseAdmin, logger, user }: { supabaseAdmin: any, logger: any, user: any }
) {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increase to 50MB for large medical PDFs

  try {
    // Use hardcoded constants
    const client_email = GOOGLE_SA_EMAIL;
    const token_uri = "https://oauth2.googleapis.com/token";

    const serviceAccount = { client_email, token_uri };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      logger.error("CONFIG_ERROR", "LOVABLE_API_KEY not configured");
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Update status to processing
    await supabaseAdmin.from("drive_ingestion_log").update({ status: 'processing' }).eq('file_id', fileId);

    // 1. Google Drive Auth
    const accessToken = await getGoogleAccessToken(serviceAccount, logger);

    // 2. Get File Metadata
    const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,mimeType`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const file = await metaResp.json();

    if (file.mimeType === "application/vnd.google-apps.folder") {
      const error = `File ${file.name} is a folder, not a PDF. Skipping.`;
      logger.warn("FILE_SKIP", error);
      await supabaseAdmin.from("drive_ingestion_log").update({ status: 'failed', error_message: error }).eq('file_id', fileId);
      return { status: "skipped", reason: "is_folder" };
    }

    if (file.size && parseInt(file.size) > MAX_FILE_SIZE) {
      const error = `File too large: ${file.size} bytes. Limit 50MB.`;
      logger.warn("FILE_SKIP", error);
      await supabaseAdmin.from("drive_ingestion_log").update({ status: 'failed', error_message: error }).eq('file_id', fileId);
      return { status: "skipped", reason: "size_limit" };
    }

    // 3. Download PDF
    logger.info("FILE_DOWNLOAD", `Downloading ${file.name}...`);
    const dlResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const arrayBuffer = await dlResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 4. Call AI for extraction with page-based chunking (OpenAI primary, Gemini fallback)
    logger.info("AI_EXTRACTION", `Sending ${file.name} (${bytes.length} bytes) to AI...`);
    const aiContent = await extractQuestionsDirect(bytes, file.name, logger);
    logger.info("AI_RESPONSE_RAW", `Raw response: ${aiContent.substring(0, 500)}`);


    
    const parsed = JSON.parse(aiContent);
    const questions = parsed.questions || [];
    
    logger.info("AI_RESULT", `Found ${questions.length} questions in ${file.name}`);

    let savedCount = 0;
    for (const q of questions) {
      if (!q.statement || !q.options || q.options.length < 4) continue;

      // Insert into real_exam_questions
      const questionData = sanitizeForPostgres({
        statement: q.statement,
        statement_hash: generateStatementHash(q.statement),
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        topic: q.topic,
        subtopic: q.subtopic,
        board: q.board,
        year: q.year,
        institution: q.institution,
        difficulty: q.difficulty || 3, // Mapping correctly to 'difficulty' column
        difficulty_level: q.difficulty || 3, // Also keep difficulty_level if exists
        is_clinical_case: !!q.clinical_case,
        tags: Array.isArray(q.tags) ? q.tags : [],
        exam_info: file.name.replace(".pdf", ""),
        quality_score: 0.95,
        confidence_score: 0.9,
        answer_source: "ai_extraction",
        source_file: file.name,
        source_drive_id: file.id,
        source_url: `https://drive.google.com/file/d/${file.id}/view`,
        is_active: true
      });

      const { data: realQ, error: realErr } = await supabaseAdmin
        .from("real_exam_questions")
        .insert(questionData)
        .select("id")
        .single();

      if (realErr) {
        logger.error("DB_ERROR_REAL", `Failed to insert into real_exam_questions: ${realErr.message}`, { error: realErr, question: q.statement.substring(0, 50) });
        continue;
      }

      // Insert into questions_bank
      const bankData = sanitizeForPostgres({
        user_id: user.id,
        statement: q.statement,
        options: Array.isArray(q.options) && q.options.length >= 4 ? q.options.slice(0, 5) : ["A", "B", "C", "D"],
        correct_index: typeof q.correct_index === 'number' && q.correct_index >= 0 && q.correct_index < 5 ? q.correct_index : 0,
        explanation: q.explanation || "Sem explicação disponível.",
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty || 3, 
        difficulty_level: q.difficulty || 3, 
        is_clinical_case: !!q.clinical_case,
        tags: Array.isArray(q.tags) ? q.tags : [],
        source: file.name.replace(".pdf", ""),
        is_global: true,
        review_status: "approved",
        quality_tier: "gold",
        source_type: "official_exam",
        board: q.board,
        institution: q.institution,
        year: q.year
      });

      const { error: bankErr } = await supabaseAdmin
        .from("questions_bank")
        .insert(bankData);

      if (bankErr) {
        logger.error("DB_ERROR_BANK", `Failed to insert into questions_bank: ${bankErr.message}`, { error: bankErr });
        continue;
      }

      if (!bankErr) {
        savedCount++;
        // Generate Flashcard
        await supabaseAdmin.from("flashcards").insert(sanitizeForPostgres({
          user_id: user.id,
          question: q.statement,
          answer: `${q.options[q.correct_index] || ""}\n\nExplicação: ${q.explanation || ""}`,
          topic: q.topic || "Geral",
          is_global: true,
          source: file.name,
          generation_method: "drive-ingestion-v1"
        }));
      }
    }

    // Final log update
    await supabaseAdmin.from("drive_ingestion_log").update({
      status: 'completed',
      questions_found: questions.length,
      questions_saved: savedCount,
      processed_by: user.id
    }).eq('file_id', fileId);

    return { status: "completed", savedCount, questions_found: questions.length };

  } catch (err) {
    logger.error("PROCESS_FILE_ERROR", `Failed to process ${fileId}`, { error: err.message });
    await supabaseAdmin.from("drive_ingestion_log").update({
      status: 'failed',
      error_message: err.message
    }).eq('file_id', fileId);
    throw err;
  }
}
