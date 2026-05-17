import { ALLOWED_MODELS } from "./ai-model-registry.ts";
import { sanitizeForPostgres } from "./db-utils.ts";

// Minimal JWT signer for Google Auth using native Web Crypto
export async function getGoogleAccessToken(serviceAccount: any, logger?: any) {
  if (logger) logger.info("GOOGLE_AUTH", "Google auth starting...", { privateKeyId: serviceAccount.private_key_id });
  
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

  const privateKeyPem = serviceAccount.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
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
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  try {
    const client_email = Deno.env.get("GOOGLE_SA_CLIENT_EMAIL");
    const token_uri = Deno.env.get("GOOGLE_SA_TOKEN_URI") || "https://oauth2.googleapis.com/token";
    let private_key = Deno.env.get("GOOGLE_SA_PRIVATE_KEY") || "";

    if (!client_email || !private_key) {
      throw new Error("Missing Google Service Account individual secrets (GOOGLE_SA_CLIENT_EMAIL, GOOGLE_SA_PRIVATE_KEY)");
    }

    private_key = private_key.replace(/\\n/g, '\n');
    if (private_key.startsWith('"') && private_key.endsWith('"')) {
      private_key = private_key.slice(1, -1);
    }

    const serviceAccount = { client_email, token_uri, private_key };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Update status to processing
    await supabaseAdmin.from("drive_ingestion_log").update({ status: 'processing' }).eq('file_id', fileId);

    // 1. Google Drive Auth
    const accessToken = await getGoogleAccessToken(serviceAccount, logger);

    // 2. Get File Metadata
    const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const file = await metaResp.json();

    if (file.size && parseInt(file.size) > MAX_FILE_SIZE) {
      const error = `File too large: ${file.size} bytes. Limit 5MB.`;
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
    
    // Base64 encode chunk-safe
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64Pdf = btoa(binary);

    // 4. Call AI for extraction
    logger.info("AI_EXTRACTION", `Sending ${file.name} to AI...`);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ALLOWED_MODELS.generation,
        max_tokens: 16000,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em medicina e extração de dados. Extraia questões médicas de provas em PDF. Retorne APENAS JSON."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia TODAS as questões deste PDF de prova médica. Se o arquivo for muito grande, extraia apenas o que couber ou as primeiras 20 páginas.
                Para cada questão, retorne:
                - statement: o enunciado completo
                - options: array com as alternativas (mínimo 4, máximo 5)
                - correct_index: índice da resposta correta (0-based)
                - explanation: uma breve explicação do porquê a resposta está correta
                - topic: a especialidade ou tema (ex: Cardiologia, Pediatria)
                
                Formato final: {"questions": [...]}`
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64Pdf}` }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI Gateway error: ${aiResponse.status} ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(aiContent);
    const questions = parsed.questions || [];
    
    logger.info("AI_RESULT", `Found ${questions.length} questions in ${file.name}`);

    let savedCount = 0;
    for (const q of questions) {
      if (!q.statement || !q.options || q.options.length < 4) continue;

      // Insert into real_exam_questions
      const { data: realQ, error: realErr } = await supabaseAdmin
        .from("real_exam_questions")
        .insert(sanitizeForPostgres({
          statement: q.statement,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          topic: q.topic,
          exam_info: file.name.replace(".pdf", ""),
          quality_score: 0.95,
          source_file: file.name,
          source_drive_id: file.id,
          is_active: true
        }))
        .select("id")
        .single();

      if (realErr) continue;

      // Insert into questions_bank
      const { error: bankErr } = await supabaseAdmin
        .from("questions_bank")
        .insert(sanitizeForPostgres({
          user_id: user.id,
          statement: q.statement,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          topic: q.topic,
          source: file.name.replace(".pdf", ""),
          is_global: true,
          review_status: "approved",
          original_question_id: realQ.id,
          quality_tier: "gold",
          source_type: "official_exam"
        }));

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

    return { status: "completed", savedCount };

  } catch (err) {
    logger.error("PROCESS_FILE_ERROR", `Failed to process ${fileId}`, { error: err.message });
    await supabaseAdmin.from("drive_ingestion_log").update({
      status: 'failed',
      error_message: err.message
    }).eq('file_id', fileId);
    throw err;
  }
}

