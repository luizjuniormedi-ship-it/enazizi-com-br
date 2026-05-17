import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

// Minimal JWT signer for Google Auth using native Web Crypto
async function getGoogleAccessToken(serviceAccount: any) {
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

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedToken,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export default enterpriseEdgeHandler("drive-exam-ingestion", async ({ req, logger, supabaseAdmin, waitUntil, correlation }) => {
  // 1. Auth & Admin Check
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  const body = await req.json().catch(() => ({}));
  const FOLDER_ID = body.folder_id || "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
  const MAX_FILES = body.max_files || 3; // Processing in small batches to avoid timeouts

  const processIngestion = async () => {
    try {
      const GOOGLE_SA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
      if (!GOOGLE_SA_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
      const serviceAccount = JSON.parse(GOOGLE_SA_JSON);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // 2. Google Drive Auth
      logger.info("GOOGLE_AUTH", "Authenticating with Google Drive...");
      const accessToken = await getGoogleAccessToken(serviceAccount);

      // 3. List PDFs in folder
      logger.info("DRIVE_LIST", `Listing PDFs in folder ${FOLDER_ID}...`);
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name)`;
      const listResp = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const listData = await listResp.json();
      const files = listData.files || [];
      logger.info("DRIVE_LIST_RESULT", `Found ${files.length} PDFs`);

      // 4. Check which files are already processed
      const { data: processedFiles } = await supabaseAdmin
        .from("drive_ingestion_log")
        .select("file_id");
      const processedIds = new Set((processedFiles || []).map(f => f.file_id));

      const filesToProcess = files.filter(f => !processedIds.has(f.id)).slice(0, MAX_FILES);
      logger.info("INGESTION_START", `Will process ${filesToProcess.length} new files`);

      let totalQuestionsFound = 0;
      let totalQuestionsSaved = 0;

      for (const file of filesToProcess) {
        try {
          logger.info("FILE_PROCESSING", `Processing ${file.name} (${file.id})...`);
          
          // Download PDF
          const dlResp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
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

          // 5. Call AI for extraction
          logger.info("AI_EXTRACTION", `Sending ${file.name} to Gemini...`);
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
                      text: `Extraia TODAS as questões deste PDF de prova médica. Para cada questão, retorne:
                      - statement: o enunciado completo
                      - options: array com as alternativas (mínimo 4, máximo 5)
                      - correct_index: índice da resposta correta (0-based)
                      - explanation: uma breve explicação do porquê a resposta está correta
                      - topic: a especialidade ou tema (ex: Cardiologia, Pediatria)
                      - specialty: a especialidade médica principal
                      
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
          let parsed;
          try {
            parsed = JSON.parse(aiContent);
          } catch (e) {
            logger.error("JSON_PARSE_ERROR", "Failed to parse AI response", { content: aiContent.slice(0, 100) });
            continue;
          }
          
          const questions = parsed.questions || [];
          totalQuestionsFound += questions.length;
          logger.info("AI_RESULT", `Found ${questions.length} questions in ${file.name}`);

          let fileSavedCount = 0;
          for (const q of questions) {
            try {
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
                  quality_score: 0.95, // Gold standard
                  source_file: file.name,
                  source_drive_id: file.id,
                  is_active: true
                }))
                .select("id")
                .single();

              if (realErr) {
                logger.error("DB_INSERT_REAL_ERR", realErr.message);
                continue;
              }

              // Insert into questions_bank
              const { data: bankQ, error: bankErr } = await supabaseAdmin
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
                }))
                .select("id")
                .single();

              if (!bankErr) {
                fileSavedCount++;
                totalQuestionsSaved++;

                // 6. Generate Flashcard automatically
                await supabaseAdmin.from("flashcards").insert(sanitizeForPostgres({
                  user_id: user.id,
                  question: q.statement,
                  answer: `${q.options[q.correct_index] || ""}\n\nExplicação: ${q.explanation || ""}`,
                  topic: q.topic || q.specialty || "Geral",
                  is_global: true,
                  source: file.name,
                  generation_method: "drive-ingestion-v1"
                }));
              } else {
                logger.error("DB_INSERT_BANK_ERR", bankErr.message);
              }

            } catch (qErr) {
              logger.error("QUESTION_SAVE_ERR", qErr.message);
            }
          }

          // Log file as processed
          await supabaseAdmin.from("drive_ingestion_log").insert({
            file_id: file.id,
            file_name: file.name,
            questions_found: questions.length,
            questions_saved: fileSavedCount,
            processed_by: user.id
          });

          logger.info("FILE_DONE", `Completed ${file.name}: saved ${fileSavedCount} questions`);

        } catch (fileErr) {
          logger.error("FILE_ERROR", `Failed to process ${file.name}`, { error: fileErr.message });
        }
      }

      logger.info("INGESTION_SUMMARY", `Total Found: ${totalQuestionsFound}, Total Saved: ${totalQuestionsSaved}`);
      
      // Governance Log
      await supabaseAdmin.from("pipeline_governance").insert({
        pipeline_name: "drive-ingestion",
        function_name: "drive-exam-ingestion",
        status: "completed",
        model_used: ALLOWED_MODELS.generation,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          total_files: filesToProcess.length,
          total_questions: totalQuestionsSaved,
          correlation_id: correlation.correlationId
        }
      });

    } catch (err) {
      logger.error("INGESTION_CRITICAL_FAIL", err.message, { stack: err.stack });
      throw err;
    }
  };

  if (body.background !== false) {
    waitUntil(processIngestion());
    return new Response(JSON.stringify({ 
      status: "processing", 
      message: "Drive ingestion started in background",
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    await processIngestion();
    return new Response(JSON.stringify({ 
      status: "completed",
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
