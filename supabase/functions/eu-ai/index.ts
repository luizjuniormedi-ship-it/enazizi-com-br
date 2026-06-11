// ENAZIZI EU-AI - Edge Function Proxy
// Redireciona chamadas de IA para nossa API Railway (EU/Claude)
//
// Esta função substitui a chamada direta ao OpenAI por uma chamada
// à API Railway que usa EU (Claude) como provedor primário.
//
// ANTES: supabase.functions.invoke('tutor-ai', { body: {...} })
// DEPOIS: supabase.functions.invoke('eu-ai', { body: {...} })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// URL da API Railway (EU/Claude)
const EU_API_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Extrair mensagem do payload
    // Pode vir como: { message }, { messages: [...] }, { prompt }, { text }
    let message = body.message || body.prompt || body.text;

    if (!message && body.messages && Array.isArray(body.messages)) {
      const lastUser = [...body.messages].reverse().find((m: any) => m.role === "user");
      message = lastUser?.content || "";
    }

    if (!message) {
      message = "Olá";
    }

    const topic = body.topic || body.especialidade || body.subject || "Medicina";

    console.log(`[EU-AI] Chamando EU para: "${message.substring(0, 50)}..."`);

    // Chamar API Railway (EU/Claude)
    const response = await fetch(`${EU_API_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        topic,
        context: {
          source: "supabase-edge-function",
          original_body: body
        }
      })
    });

    if (!response.ok) {
      throw new Error(`EU API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`[EU-AI] Resposta recebida via ${data.provider}`);

    // Retornar no formato esperado pelo frontend
    return new Response(
      JSON.stringify({
        // Formato original do tutor-ai
        response: data.message,
        content: data.message,
        // Metadados
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

    // Em caso de erro, retornar mensagem de fallback
    return new Response(
      JSON.stringify({
        response: "Desculpe, o serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.",
        content: "Desculpe, o serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.",
        provider: "fallback",
        source: "error",
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 // Retornar 200 para o frontend processar
      }
    );
  }
});
