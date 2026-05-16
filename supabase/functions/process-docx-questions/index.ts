import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|na imagem|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura)\b/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { uploadId, pageScreenshots, userId } = await req.json();
    if (!pageScreenshots || !Array.isArray(pageScreenshots) || pageScreenshots.length === 0) {
      throw new Error("pageScreenshots array is required");
    }
    if (!userId) throw new Error("userId is required");

    let totalInserted = 0;
    let totalImages = 0;
    const errors: string[] = [];

    // Process each page screenshot with OpenAI Vision via Gateway
    for (let i = 0; i < pageScreenshots.length; i++) {
      const screenshot = pageScreenshots[i]; // base64 data URL or URL
      
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é um extrator de questões médicas de provas de residência/concurso.
Analise a imagem da página e extraia TODAS as questões visíveis.

REGRAS:
- Cada questão deve ter entre 4 e 5 alternativas (A-E)
- Identifique o gabarito se estiver indicado
- Se a questão contém uma imagem médica (ECG, radiografia, etc.), descreva-a no campo image_description
- Identifique o tópico médico e a fonte/banca quando possível
- NÃO extraia questões incompletas (cortadas na borda da página)

Retorne SOMENTE JSON válido no formato:
{
  "questions": [
    {
      "statement": "Texto completo do enunciado",
      "options": ["alternativa A", "alternativa B", "alternativa C", "alternativa D", "alternativa E"],
      "correct_index": 0,
      "explanation": "Explicação se disponível ou null",
      "topic": "Tópico médico",
      "source": "Banca/ano se identificável",
      "has_image": true,
      "image_description": "Descrição da imagem médica associada à questão"
    }
  ]
}`
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Página ${i + 1} de ${pageScreenshots.length}. Extraia todas as questões completas desta página.`
                  },
                  {
                    type: "image_url",
                    image_url: { url: screenshot }
                  }
                ]
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_questions",
                  description: "Extract medical exam questions from the page screenshot",
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
                            explanation: { type: "string" },
                            topic: { type: "string" },
                            source: { type: "string" },
                            has_image: { type: "boolean" },
                            image_description: { type: "string" }
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
          errors.push(`Page ${i + 1}: AI error ${response.status} - ${errText.slice(0, 200)}`);
          continue;
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          errors.push(`Page ${i + 1}: No tool call in response`);
          continue;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        const questions = parsed.questions || [];

        // Filter and insert valid questions
        const validQuestions = questions.filter((q: any) => {
          if (!q.statement || !Array.isArray(q.options)) return false;
          if (q.options.length < 4 || q.options.length > 5) return false;
          // Skip questions that reference images we can't include (unless we have the image)
          if (!q.has_image && IMAGE_REF_PATTERN.test(q.statement)) return false;
          return true;
        });

        if (validQuestions.length === 0) continue;

        // For questions with images, upload the page screenshot to Storage
        const rows = [];
        for (const q of validQuestions) {
          let imageUrl: string | null = null;

          if (q.has_image && screenshot) {
            try {
              // Upload the page screenshot as the image context
              const imgFileName = `page-screenshots/${uploadId || 'unknown'}/${Date.now()}-p${i + 1}-${Math.random().toString(36).slice(2, 8)}.png`;
              
              // Convert base64 data URL to binary
              const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");
              const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
              
              const { error: imgUploadErr } = await supabase.storage
                .from("question-images")
                .upload(imgFileName, binaryData, {
                  contentType: "image/png",
                  upsert: true,
                });

              if (!imgUploadErr) {
                const { data: urlData } = supabase.storage
                  .from("question-images")
                  .getPublicUrl(imgFileName);
                imageUrl = urlData.publicUrl;
              }
            } catch (imgErr: any) {
              console.error(`Failed to upload image for page ${i + 1}:`, imgErr.message);
            }
          }

          rows.push({
            user_id: userId,
            statement: q.statement.replace(/\0/g, "").trim(),
            options: q.options.map((o: string) => String(o).replace(/\0/g, "").trim()),
            correct_index: typeof q.correct_index === "number" ? q.correct_index : null,
            explanation: (q.explanation || "").replace(/\0/g, ""),
            topic: (q.topic || "Cardiologia").replace(/\0/g, ""),
            source: (q.source || "docx-import").replace(/\0/g, ""),
            is_global: true,
            review_status: "pending",
            image_url: imageUrl,
          });
        }

        const { error: insertError } = await supabase.from("questions_bank").insert(rows);
        if (insertError) {
          errors.push(`Page ${i + 1}: Insert error - ${insertError.message}`);
        } else {
          totalInserted += rows.length;
          totalImages += rows.filter((r: any) => r.image_url).length;
        }
      } catch (pageErr: any) {
        errors.push(`Page ${i + 1}: ${pageErr.message}`);
      }

      // Small delay between pages to avoid rate limits
      if (i < pageScreenshots.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Update upload record if we have an uploadId
    if (uploadId) {
      await supabase.from("uploads").update({
        status: "processed",
        extracted_json: {
          step: "done",
          progress: 100,
          questions_count: totalInserted,
          images_count: totalImages,
          errors: errors.length > 0 ? errors : undefined,
        },
      }).eq("id", uploadId);
    }

    return new Response(JSON.stringify({
      success: true,
      total_inserted: totalInserted,
      total_images: totalImages,
      pages_processed: pageScreenshots.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("process-docx-questions error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
