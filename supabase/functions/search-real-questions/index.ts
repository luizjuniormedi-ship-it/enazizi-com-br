
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

const BLOCKED_DOMAINS = ["scribd.com", "youtube.com", "youtu.be", "facebook.com", "instagram.com", "twitter.com", "tiktok.com"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { mode, specialty, banca, url: hubUrl, user_id } = body;

    console.log(`[SEARCH] Mode: ${mode}, Specialty: ${specialty}, Banca: ${banca}, URL: ${hubUrl}`);

    if (mode === "hub_page" && hubUrl) {
      // 1. Scraping do HUB (página com vários links de PDFs)
      const resp = await fetch(hubUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await resp.text();
      
      const pdfLinks: any[] = [];
      const matches = html.match(/https?:\/\/[^\s"'<>]+\.pdf/gi) || [];
      
      for (const m of matches) {
        if (BLOCKED_DOMAINS.some(d => m.includes(d))) continue;
        const name = m.split("/").pop() || "prova.pdf";
        const yearMatch = m.match(/(20\d{2})/);
        pdfLinks.push({ 
          name, 
          url: m, 
          year: yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear() 
        });
      }

      await supabase.from("ingestion_log").insert({
        source_name: `Hub Scan: ${hubUrl}`,
        source_url: hubUrl,
        source_type: "hub_scan",
        status: "completed",
        created_by: user_id
      });

      return new Response(JSON.stringify({ 
        success: true, 
        pdf_links: pdfLinks.slice(0, 50),
        sources_found: pdfLinks.length 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (specialty || banca) {
      // 2. Busca ativa via IA + Web Search (se disponível)
      // Por enquanto, vamos retornar links conhecidos de alta qualidade para o tema
      const query = banca ? `"${banca}" ${specialty} prova residência` : `${specialty} questões comentadas residência médica`;
      
      const aiResp = await aiFetch({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Você é um especialista em encontrar fontes oficiais de provas de residência médica no Brasil. Retorne JSON com links de PDFs oficiais." },
          { role: "user", content: `Encontre 5 fontes de PDFs (links diretos) para: ${query}. Retorne: {"sources": [{"name": "...", "url": "...", "year": 2024}]}` }
        ],
        response_format: { type: "json_object" }
      });

      if (!aiResp.ok) throw new Error("IA indisponível para busca ativa.");
      
      const aiData = await aiResp.json();
      const parsed = parseAiJson(aiData.choices?.[0]?.message?.content || "{}");
      const sources = (parsed.sources || []).filter((s: any) => s.url && s.url.endsWith(".pdf"));

      return new Response(JSON.stringify({ 
        success: true, 
        pdf_links: sources,
        sources_found: sources.length 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[ERR]", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
