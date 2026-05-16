import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { upload_id } = await req.json();
    if (!upload_id) throw new Error("upload_id is required");

    // Get upload record
    const { data: upload, error: uploadErr } = await supabase
      .from("uploads")
      .select("storage_path, filename, user_id")
      .eq("id", upload_id)
      .single();

    if (uploadErr || !upload) throw new Error(`Upload not found: ${uploadErr?.message}`);

    console.log(`Downloading from bucket 'user-uploads', path: '${upload.storage_path}'`);

    // Download the PDF file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("user-uploads")
      .download(upload.storage_path);

    if (dlErr || !fileData) {
      console.error("Download error:", JSON.stringify(dlErr));
      throw new Error(`Failed to download file: ${dlErr?.message || 'no data returned'}`);
    }

    // Convert PDF to base64 for Vision (chunk-safe for large files)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const fileSizeMB = bytes.length / (1024 * 1024);
    console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 15) {
      throw new Error(`PDF too large (${fileSizeMB.toFixed(1)} MB). Max 15 MB for visual extraction.`);
    }
    
    // Chunk-safe base64 encoding (avoids stack overflow with spread operator)
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64Pdf = btoa(binary);

    // Update status
    await supabase.from("uploads").update({
      status: "processing",
      extracted_json: { step: "analyzing_visual", progress: 10 },
    }).eq("id", upload_id);

    // Send entire PDF to AI Gateway for analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia as questões médicas deste PDF. Para cada questão: statement, options (array), correct_index (0-based), topic, source, has_image (true se tem ECG/raio-x/foto), page_number (página da imagem). Seja conciso nas explicações.`
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64Pdf}` }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_questions",
              description: "Extract medical exam questions from the PDF",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        statement: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correct_index: { type: "number" },
                        topic: { type: "string" },
                        source: { type: "string" },
                        has_image: { type: "boolean" },
                        page_number: { type: "number" },
                      },
                      required: ["statement", "options"]
                    }
                  }
                },
                required: ["questions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_questions" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let questions: any[] = [];
    
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      questions = parsed.questions || [];
    } else {
      // Fallback: try to parse from content text
      const content = aiResult.choices?.[0]?.message?.content || "";
      console.log("No tool call, trying content parse. Content length:", content.length);
      const jsonMatch = content.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        questions = parsed.questions || [];
      } else {
        console.error("Could not parse questions from response");
      }
    }

    await supabase.from("uploads").update({
      extracted_json: { step: "uploading_pages", progress: 50, questions_found: questions.length },
    }).eq("id", upload_id);

    // For questions with images, we need to upload the page screenshot
    // Since we can't extract individual pages in Deno, we upload the full PDF page as context
    // We'll use AI to generate the page image for each unique page that has images
    const pagesWithImages = new Set<number>();
    for (const q of questions) {
      if (q.has_image && q.page_number) {
        pagesWithImages.add(q.page_number);
      }
    }

    // Upload full PDF as reference and create page-level image URLs
    // For each page with images, we store the page number reference
    const pageImageUrls: Record<number, string> = {};

    if (pagesWithImages.size > 0) {
      // Upload the PDF itself to question-images bucket for reference
      const pdfFileName = `pdf-pages/${upload_id}/${upload.filename}`;
      const { error: pdfUploadErr } = await supabase.storage
        .from("question-images")
        .upload(pdfFileName, fileData, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!pdfUploadErr) {
        const { data: urlData } = supabase.storage
          .from("question-images")
          .getPublicUrl(pdfFileName);

        // All pages reference the same PDF with a page anchor
        for (const pageNum of pagesWithImages) {
          pageImageUrls[pageNum] = `${urlData.publicUrl}#page=${pageNum}`;
        }
      }
    }

    // Get admin user for insert
    const { data: adminUser } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    const systemUserId = adminUser?.user_id || upload.user_id;

    // Filter valid questions
    const validQuestions = questions.filter((q: any) => {
      if (!q.statement || !Array.isArray(q.options)) return false;
      if (q.options.length < 4 || q.options.length > 5) return false;
      if (q.statement.length < 400) return false;
      return true;
    });

    // Deduplicate against existing
    const firstStatements = validQuestions.map((q: any) => q.statement.slice(0, 80).toLowerCase().trim());
    const { data: existing } = await supabase
      .from("questions_bank")
      .select("statement")
      .eq("is_global", true);

    const existingSet = new Set(
      (existing || []).map((e: any) => e.statement.slice(0, 80).toLowerCase().trim())
    );

    const newQuestions = validQuestions.filter((_: any, i: number) => !existingSet.has(firstStatements[i]));

    // Insert in batches
    let totalInserted = 0;
    let totalImages = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < newQuestions.length; i += BATCH_SIZE) {
      const batch = newQuestions.slice(i, i + BATCH_SIZE).map((q: any) => {
        const hasImg = q.has_image && q.page_number && pageImageUrls[q.page_number];
        if (hasImg) totalImages++;
        return sanitizeForPostgres({
          user_id: systemUserId,
          statement: (q.statement || "").trim(),
          options: (Array.isArray(q.options) ? q.options : []).map((o: string) => String(o).trim()),
          correct_index: typeof q.correct_index === "number" ? q.correct_index : null,
          explanation: (q.explanation || ""),
          topic: (q.topic || "Geral"),
          source: (q.source || upload.filename?.replace(/\.\w+$/, "") || "visual-import"),
          is_global: true,
          review_status: "pending",
          image_url: hasImg ? pageImageUrls[q.page_number] : null,
        });
      });

      const { error: insertErr } = await supabase.from("questions_bank").insert(batch);
      if (!insertErr) totalInserted += batch.length;
      else console.error("Insert batch error:", insertErr.message);
    }

    // Update upload status
    await supabase.from("uploads").update({
      status: "processed",
      extracted_json: {
        step: "done",
        progress: 100,
        questions_count: totalInserted,
        images_count: totalImages,
        total_found: questions.length,
        pages_with_images: pagesWithImages.size,
      },
    }).eq("id", upload_id);

    return new Response(JSON.stringify({
      success: true,
      total_found: questions.length,
      total_inserted: totalInserted,
      total_images: totalImages,
      pages_with_images: pagesWithImages.size,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("extract-exam-visual error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
