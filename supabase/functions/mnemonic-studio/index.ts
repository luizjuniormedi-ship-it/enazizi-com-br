import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

// ── AI helper ──
async function callAI(
  apiKey: string,
  prompt: string,
  model = "openai/gpt-4o-mini",
  temperature = 1.0 // Fixed: gpt-4o-mini only supports 1.0
): Promise<{ ok: boolean; text?: string; status?: number }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });
  if (!resp.ok) return { ok: false, status: resp.status };
  const data = await resp.json();
  return { ok: true, text: data.choices?.[0]?.message?.content || "" };
}

function extractJSON(raw: string): any | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    // Try cleaning markdown fences
    const cleaned = m[0]
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    try { return JSON.parse(cleaned); } catch { return null; }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ══════════════════════════════════════════════════
// PROMPTS
// ══════════════════════════════════════════════════

function buildGeneratorPrompt(
  tema: string, termos: string[], estilo: string, publico: string, attempt: number, feedback?: string
): string {
  const retryBlock = attempt > 1 && feedback
    ? `\n⚠️ TENTATIVA ${attempt} — REJEITADO:\n"${feedback}"\nCorreija os problemas. Gere algo COMPLETAMENTE DIFERENTE.\n`
    : "";

  return `Você é um criador de mnemônicos médicos MEMORÁVEIS.
${retryBlock}
TEMA: "${tema}"
TERMOS PARA MEMORIZAR (${termos.length} itens):
${termos.map((t, i) => `${i + 1}. ${t}`).join("\n")}
ESTILO DESEJADO: ${estilo}
PÚBLICO-ALVO: ${publico}

REGRAS:
1. A SIGLA deve ter EXATAMENTE ${termos.length} letras (uma por termo)
2. Cada letra deve remeter claramente ao termo correspondente
3. NENHUM termo pode ser omitido
4. A frase mnemônica deve ser memorável e usar o estilo "${estilo}"
5. Forneça explicação técnica (clinicamente precisa) e didática (fácil para o público "${publico}")
6. Descreva uma cena visual vívida para memorização
7. Gere um prompt de imagem em inglês para ilustrar a cena

Responda APENAS em JSON:
{
  "sigla": "SIGLA com ${termos.length} letras",
  "frase_mnemonica": "frase memorável no estilo ${estilo}",
  "explicacao_tecnica": "explicação clínica detalhada de cada termo e sua relevância",
  "explicacao_didatica": "explicação simplificada para ${publico}",
  "cena_visual": "descrição da cena visual em português",
  "prompt_imagem": "image prompt in English for illustration",
  "items_map": [
    {"letter": "X", "word": "palavra-chave", "original_item": "termo original", "symbol": "objeto visual", "symbol_reason": "motivo"}
  ]
}`;
}

function buildMedicalAuditorPrompt(tema: string, termos: string[], generated: any): string {
  return `Você é um auditor médico sênior. Avalie este mnemônico com RIGOR CLÍNICO.

TEMA: "${tema}"
LISTA ORIGINAL (${termos.length} termos):
${termos.map((t, i) => `${i + 1}. ${t}`).join("\n")}

MNEMÔNICO:
- Sigla: ${generated.sigla}
- Frase: ${generated.frase_mnemonica}
- Mapeamento: ${JSON.stringify(generated.items_map)}

VERIFIQUE:
1. COBERTURA: Cada termo da lista DEVE estar na sigla. Se algum foi omitido, reprove.
2. DISTORÇÃO: Algum conceito médico foi simplificado incorretamente?
3. ASSOCIAÇÃO FALSA: Alguma associação pode induzir erro clínico?
4. FIDELIDADE: Cada item do mapeamento corresponde ao termo original?
5. A sigla tem EXATAMENTE ${termos.length} letras?

Responda APENAS em JSON:
{
  "approved": true/false,
  "score": 0-100,
  "critical_risk": true/false,
  "issues": [{"type": "string", "item": "string", "description": "string", "severity": "low|medium|high|critical"}],
  "summary": "resumo"
}`;
}

function buildPedagogicalAuditorPrompt(tema: string, termos: string[], generated: any, publico: string): string {
  return `Você é um auditor pedagógico especializado em memorização para "${publico}".

TEMA: "${tema}"
LISTA ORIGINAL (${termos.length} termos):
${termos.map((t, i) => `${i + 1}. ${t}`).join("\n")}

MNEMÔNICO:
- Sigla: ${generated.sigla}
- Frase: ${generated.frase_mnemonica}
- Cena: ${generated.cena_visual}
- Símbolos: ${JSON.stringify(generated.items_map?.map((m: any) => ({ item: m.original_item, symbol: m.symbol })))}

AVALIE:
1. MEMORABILIDADE: Fácil de lembrar?
2. CLAREZA: Entende em 10 segundos?
3. COMPLETUDE: Todos os ${termos.length} termos cobertos?
4. ADEQUAÇÃO: Apropriado para "${publico}"?
5. POLUIÇÃO: Elementos demais?

Responda APENAS em JSON:
{
  "approved": true/false,
  "score": 0-100,
  "issues": [{"type": "string", "description": "string", "severity": "low|medium|high"}],
  "summary": "resumo"
}`;
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { tema, termos, estilo, publico } = body as {
      tema: string; termos: string[]; estilo: string; publico: string;
    };

    // Validation
    if (!tema || typeof tema !== "string" || tema.trim().length < 2) {
      return json({ success: false, error: "Tema inválido." }, 400);
    }
    if (!Array.isArray(termos) || termos.length < 3 || termos.length > 7) {
      return json({ success: false, error: "Informe entre 3 e 7 termos." }, 400);
    }
    if (!estilo || typeof estilo !== "string") {
      return json({ success: false, error: "Estilo inválido." }, 400);
    }
    if (!publico || typeof publico !== "string") {
      return json({ success: false, error: "Público-alvo inválido." }, 400);
    }

    const cleanTerms = termos
      .map(t => typeof t === "string" ? t.trim() : "")
      .filter(t => t.length > 0);

    if (cleanTerms.length < 3) {
      return json({ success: false, error: "Ao menos 3 termos válidos são necessários." }, 400);
    }

    const apiKey = getEnv("LOVABLE_API_KEY");
    const MAX_ATTEMPTS = 3;
    let lastGenerated: any = null;
    let lastMedical: any = null;
    let lastPedagogical: any = null;
    let previousFeedback: string | undefined;
    let approved = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // ── AGENT 1: GENERATOR ──
      const genResult = await callAI(
        apiKey,
        buildGeneratorPrompt(tema, cleanTerms, estilo, publico, attempt, previousFeedback)
      );
      if (!genResult.ok) {
        console.error(`Attempt ${attempt}: Generator failed (${genResult.status})`);
        if (genResult.status === 429) return json({ success: false, error: "Limite de requisições atingido." }, 429);
        if (genResult.status === 402) return json({ success: false, error: "Créditos de IA esgotados." }, 402);
        continue;
      }

      const generated = extractJSON(genResult.text || "");
      if (!generated || !generated.items_map) {
        console.warn(`Attempt ${attempt}: Failed to parse generator JSON`);
        previousFeedback = "JSON inválido. Gere um JSON válido.";
        continue;
      }

      // Quick structural check
      if (!Array.isArray(generated.items_map) || generated.items_map.length !== cleanTerms.length) {
        previousFeedback = `items_map deve ter exatamente ${cleanTerms.length} itens.`;
        continue;
      }

      const siglaLetters = (generated.sigla || "").replace(/[^A-Za-zÀ-ÿ]/g, "");
      if (siglaLetters.length !== cleanTerms.length) {
        // Auto-fix: rebuild sigla from items_map
        generated.sigla = generated.items_map
          .map((m: any) => (m.letter || m.word?.[0] || "X").toUpperCase())
          .join("");
        console.log(`Auto-fixed sigla to: ${generated.sigla}`);
      }

      lastGenerated = generated;

      // ── AGENTS 2+3: DUAL AUDIT (parallel) ──
      const [medResult, pedResult] = await Promise.all([
        callAI(apiKey, buildMedicalAuditorPrompt(tema, cleanTerms, generated)),
        callAI(apiKey, buildPedagogicalAuditorPrompt(tema, cleanTerms, generated, publico)),
      ]);

      if (!medResult.ok || !pedResult.ok) {
        console.error(`Attempt ${attempt}: Audit call failed`);
        break;
      }

      const medAudit = extractJSON(medResult.text || "");
      const pedAudit = extractJSON(pedResult.text || "");

      if (!medAudit || !pedAudit) {
        console.error(`Attempt ${attempt}: Audit JSON parse failed`);
        break;
      }

      lastMedical = {
        approved: !!medAudit.approved,
        score: Number(medAudit.score) || 0,
        critical_risk: !!medAudit.critical_risk,
        issues: Array.isArray(medAudit.issues) ? medAudit.issues : [],
        summary: medAudit.summary || "",
      };
      lastPedagogical = {
        approved: !!pedAudit.approved,
        score: Number(pedAudit.score) || 0,
        issues: Array.isArray(pedAudit.issues) ? pedAudit.issues : [],
        summary: pedAudit.summary || "",
      };

      // ── RECONCILIATION ──
      const medScore = lastMedical.score;
      const pedScore = lastPedagogical.score;
      const avgScore = Math.round((medScore + pedScore) / 2);

      if (lastMedical.critical_risk && medScore < 30) {
        previousFeedback = `Risco clínico crítico: ${lastMedical.summary}`;
        console.warn(`Attempt ${attempt}: Critical risk — ${previousFeedback}`);
        continue;
      }

      if (medScore < 90) {
        previousFeedback = `Score médico insuficiente (${medScore}/100). Problemas: ${lastMedical.summary}. Corrija e gere novamente.`;
        console.warn(`Attempt ${attempt}: Medical score ${medScore} < 90`);
        continue;
      }

      if (avgScore < 50) {
        previousFeedback = `Score combinado ${avgScore} < 50. ${lastMedical.summary} | ${lastPedagogical.summary}`;
        continue;
      }

      // Passed all checks
      approved = true;
      console.log(`Attempt ${attempt}: Approved (med=${medScore}, ped=${pedScore}, avg=${avgScore})`);
      break;
    }

    if (!lastGenerated) {
      return json({ success: false, error: "Falha na geração após múltiplas tentativas." }, 500);
    }

    const medScore = lastMedical?.score ?? 0;
    const pedScore = lastPedagogical?.score ?? 0;
    const finalScore = Math.round((medScore + pedScore) / 2);

    // Build alerts
    const alertas: string[] = [];
    if (!approved) {
      alertas.push(`⚠️ Mnemônico gerado com ressalvas (score médico: ${medScore}, pedagógico: ${pedScore})`);
    }
    if (lastMedical?.critical_risk) {
      alertas.push("🚨 Risco clínico detectado — revise antes de usar");
    }
    if (medScore < 90) {
      alertas.push(`⚠️ Score médico abaixo do limiar (${medScore}/100)`);
    }
    for (const issue of (lastMedical?.issues || [])) {
      if (issue.severity === "high" || issue.severity === "critical") {
        alertas.push(`🔴 ${issue.type}: ${issue.description}`);
      }
    }
    for (const issue of (lastPedagogical?.issues || [])) {
      if (issue.severity === "high") {
        alertas.push(`🟡 ${issue.type}: ${issue.description}`);
      }
    }

    // ── AGENT 4: IMAGE GENERATION (best-effort) ──
    let image_url: string | null = null;
    if (lastGenerated.prompt_imagem) {
      try {
        const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: lastGenerated.prompt_imagem }],
            modalities: ["image", "text"],
          }),
        });
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          image_url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
        }
      } catch (e) {
        console.warn("Image generation failed (non-blocking):", e);
      }
    }

    // ── AGENT 5: CONSOLIDATOR — build final response ──
    return json({
      success: approved || medScore >= 70, // allow with warnings if med >= 70
      data: {
        tema: tema.trim(),
        sigla: lastGenerated.sigla || "",
        frase_mnemonica: lastGenerated.frase_mnemonica || "",
        explicacao_tecnica: lastGenerated.explicacao_tecnica || "",
        explicacao_didatica: lastGenerated.explicacao_didatica || "",
        cena_visual: lastGenerated.cena_visual || "",
        prompt_imagem: lastGenerated.prompt_imagem || "",
        image_url,
        score_medico: medScore,
        score_pedagogico: pedScore,
        score_final: finalScore,
        alertas,
        items_map: Array.isArray(lastGenerated.items_map) ? lastGenerated.items_map : [],
      },
    });
  } catch (err) {
    console.error("mnemonic-studio error:", err);
    return json(
      { success: false, error: err instanceof Error ? err.message : "Erro interno." },
      500
    );
  }
});
