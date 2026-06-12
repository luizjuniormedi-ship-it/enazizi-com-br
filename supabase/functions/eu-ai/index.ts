// ENAZIZI EU-AI - Edge Function Proxy
// Redireciona chamadas de IA para nossa API Railway (EU/Claude)
//
// Esta função substitui a chamada direta ao OpenAI por uma chamada
// à API Railway que usa EU (Claude) como provedor primário.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// URL da API Railway (EU/Claude)
const EU_API_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const isStream = body.stream === true;

    let message = body.message || body.prompt || body.text;
    if (!message && body.messages && Array.isArray(body.messages)) {
      const lastUser = [...body.messages].reverse().find((m: any) => m.role === "user");
      message = lastUser?.content || "";
    }
    if (!message) message = "Olá";

    const topic = body.topic || body.especialidade || body.subject || "Medicina";

    console.log(`[EU-AI] Chamando EU para: "${message.substring(0, 50)}..." | Stream: ${isStream}`);

    const response = await fetch(`${EU_API_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        topic,
        stream: isStream,
        context: {
          source: "supabase-edge-function",
          original_body: body
        }
      })
    });

    if (!response.ok) {
      throw new Error(`EU API error: ${response.status} ${response.statusText}`);
    }

    if (isStream && response.body) {
      console.log(`[EU-AI] Iniciando stream SSE para o cliente...`);
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = response.body.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              break;
            }
            
            const chunk = decoder.decode(value);
            
            // Tentativa de extrair o conteúdo real se vier como um objeto JSON stringificado
            // Algumas APIs de stream podem enviar JSONs em chunks
            let contentToStream = chunk;
            try {
                const parsed = JSON.parse(chunk);
                if (parsed.message) contentToStream = parsed.message;
                else if (parsed.content) contentToStream = parsed.content;
                else if (parsed.response) contentToStream = parsed.response;
            } catch {
                // Não é JSON, envia como texto puro
            }

            const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: contentToStream } }] })}\n\n`;
            await writer.write(encoder.encode(sseChunk));
          }
        } catch (e) {
          console.error(`[EU-AI] Erro no pipe de stream:`, e);
        } finally {
          writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({
        response: data.message,
        content: data.message,
        provider: data.provider,
        source: "eu-railway",
        success: data.success !== false,
        timestamp: data.timestamp
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error(`[EU-AI] Erro: ${error.message}`);
    return new Response(
      JSON.stringify({
        response: "Desculpe, o serviço de IA está temporariamente indisponível.",
        content: "Desculpe, o serviço de IA está temporariamente indisponível.",
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  }
});
