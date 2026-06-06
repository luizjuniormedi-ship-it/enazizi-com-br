// bulk-generate-content - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: High-volume content generation with industrial-grade resilience.

import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { corsResponse } from "../_shared/cors.ts";
import { analyzeQuestionForensic } from "../_shared/forensic-board-analyzer.ts";
import { resolveBanca } from "../_shared/banca-profiles.ts";




const SPECIALTIES = [
  "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia", "Medicina Preventiva", "Nefrologia",
  "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
  "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
  "Otorrinolaringologia", "Medicina de Emergência", "Semiologia", "Anatomia", "Farmacologia",
  "Oncologia", "Fisiologia", "Bioquímica", "Angiologia",
  "Histologia", "Embriologia", "Microbiologia", "Imunologia",
  "Parasitologia", "Genética Médica", "Patologia",
  "Terapia Intensiva",
];

Deno.serve(enterpriseEdgeHandler("bulk-generate-content", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  console.log("[edge] function booted", {
    function: "bulk-generate-content",
    timestamp: new Date().toISOString()
  });
  // 1. AUTH & ADMIN CHECK
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const specialty = body.specialty || SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const count = Math.min(body.count || 5, 15);
  const equalize = body.equalize === true;

  logger.info("START_GENERATION", `Request for ${specialty} (equalize: ${equalize})`, { specialty, count, equalize });

  const processGeneration = async () => {
    try {
      if (equalize) {
        logger.info("EQUALIZATION", `Starting equalization for ${specialty}`);
        try {
          // Attempt to find real questions first
          const searchResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-real-questions?specialty=${encodeURIComponent(specialty)}`, {
            headers: { Authorization: req.headers.get("Authorization") || "" }
          });
          
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            logger.info("SEARCH_RESULT", `Search found ${searchData?.log?.questions_found || 0} candidates`);
          }
        } catch (searchErr) {
          logger.warn("SEARCH_FAILED", "Real questions search failed, falling back to pure AI generation", { error: searchErr.message });
        }
      }

      const prompt = `Você NÃO é um gerador de questões. Você é uma BANCA EXAMINADORA DO ENARE (Padrão USP/UNICAMP/SES-SP).
Sua missão é produzir uma questão de nível ELITE, indistinguível de provas reais oficiais.

GRAU DE DIFICULDADE: ELITE (Discriminativa para candidatos de alto nível).

## 🩺 ESPECIFICAÇÕES TÉCNICAS (SPRINT 3.1):
1. CASO CLÍNICO DENSO: Enunciado entre 200-400 palavras. Use terminologia médica técnica exata.
2. DADOS OBRIGATÓRIOS: Deve conter "Sinais Vitais", "Exame Físico", "Conduta" e dados laboratoriais com unidades (mg/dL, mEq/L). 
3. ESTRUTURA ENARE: O texto deve ser seco, objetivo e focado em raciocínio de conduta ou diagnóstico diferencial complexo.
4. TAXONOMIA DE BLOOM: 
   - Analisar (40%), Avaliar (25%), Decidir (5%). Proibido questões de memorização pura.
5. DISTRATORES ELITE: Todas as 5 alternativas devem ser diagnósticos diferenciais plausíveis ou condutas aceitáveis em outros contextos, mas apenas uma é a "mais correta" ou "primeira conduta" para este caso específico.
6. TEMA: ${specialty}. Integre conceitos multidisciplinares.

## 📝 FORMATO DE SAÍDA (JSON):
{
  "questions": [
    {
      "statement": "Paciente de [Idade] anos, sexo [Sexo], apresenta quadro de... [Caso clínico longo e denso com dados laboratoriais e sinais vitais]... Ao exame físico... Hipótese diagnóstica... Conduta...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
      "correct_index": 0,
      "explanation": "Explicação técnica exaustiva (mínimo 500 caracteres), justificando a correta e refutando detalhadamente cada distrator com base em DIRETRIZES BRASILEIRAS 2024/2025.",
      "topic": "${specialty}",
      "difficulty": 5,
      "enare_metadata": {
        "bloom_level": "Analisar/Avaliar",
        "key_differential": "Explique o ponto central que diferencia a correta das outras"
      }
    }
  ]
}`;

      const aiResponse = await callAi({
        model: ALLOWED_MODELS.reasoning,
        messages: [
          { role: "system", content: "Você é um Professor Ph.D. em Medicina, especialista em bancas como ENARE e USP. Sua missão é gerar questões exaustivas, técnicas e densas. Responda APENAS JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
        taskType: "reasoning"
      }, logger, supabaseAdmin);

      const aiContent = aiResponse.choices?.[0]?.message?.content || "";
      const parsed = parseAiJson(aiContent);
      const questions = parsed.questions || [];

      logger.info("AI_RESPONSE_PARSED", `Received ${questions.length} questions from AI`);

      let savedCount = 0;
      let rejectedCount = 0;
      const bancaInfo = resolveBanca("ENARE");
      const profile = bancaInfo.profile;






      for (const q of questions) {
        try {
          const forensic = await analyzeQuestionForensic(q, profile, supabaseAdmin);
          
          const isElite = forensic.fidelity_score >= 90 && forensic.cognitive_score >= 85;
          const isGold = forensic.fidelity_score >= 70 && forensic.cognitive_score >= 65; // Even more relaxed Gold for the volume phase

          await supabaseAdmin.from("forensic_quality_logs").insert({
            board: profile.label,
            fidelity_score: forensic.fidelity_score,
            structural_score: forensic.structural_score,
            lexical_score: forensic.lexical_score,
            cognitive_score: forensic.cognitive_score,
            pedagogical_score: forensic.pedagogical_score,
            ai_pattern_score: forensic.ai_pattern.aiLikelihoodScore,
            flags: forensic.reasons,
            decision: (isElite || isGold) ? 'ACCEPT' : 'REJECT',
            correlation_id: correlation.correlationId,
            raw_response_preview: q.statement.substring(0, 200),
            metadata: {
              enare_lexical_score: forensic.lexical_score,
              enare_cognitive_score: forensic.cognitive_score,
              enare_difficulty_score: forensic.fidelity_score,
              is_elite: isElite,
              is_gold: isGold
            }
          });

          if (!isElite && !isGold) {
             logger.warn("QUALITY_LOCK_REJECT", `Question rejected: Fidelity ${forensic.fidelity_score}, Cognitive ${forensic.cognitive_score}`);
             rejectedCount++;
             continue;
          }


          // Tenta encontrar o specialty_id correto baseado no nome
          const { data: specData } = await supabaseAdmin
            .from("curriculum_specialties")
            .select("id")
            .ilike("nome", specialty.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
            .maybeSingle();

          const { error: insertError } = await supabaseAdmin.from("questions_bank").insert({
            statement: sanitizeAiContent(q.statement),
            options: q.options,
            correct_index: q.correct_index,
            explanation: sanitizeAiContent(q.explanation),
            topic: q.topic || specialty,
            specialty_id: specData?.id,
            difficulty: q.difficulty || 3,
            is_global: true,
            quality_tier: isElite ? 'ELITE' : 'GOLD',
            difficulty_level: isElite ? 5 : 4,
            source: "bulk-ai-generator",
            review_status: "approved",
            board: "ENARE",
            board_similarity_score: forensic.fidelity_score,
            year: 2025,
            user_id: user.id
          });

          if (!insertError) savedCount++;
          else logger.error("INSERT_ERROR", insertError.message, { question: q.statement.slice(0, 50) });
        } catch (e) {
          logger.error("DB_INSERT_FAILED", "Failed to save question", { error: e.message });
        }
      }

      logger.info("GENERATION_COMPLETED", `Successfully saved ${savedCount} questions`);

      // Governance & Logging
      const govRecord = {
        pipeline_name: "bulk-generate",
        function_name: "bulk-generate-content",
        status: (savedCount > 0) ? "completed" : (rejectedCount > 0 ? "quality_rejected" : "failed"),
        model_used: ALLOWED_MODELS.reasoning,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          specialty,
          count: savedCount,
          correlation_id: correlation.correlationId,
          equalize,
          result: { total_imported: 0, total_generated: savedCount, total_questions: savedCount }
        }
      };

      const ingestRecord = {
        source_name: `AI Generation: ${specialty}`,
        source_type: "ai_generation",
        status: "completed",
        questions_found: questions.length,
        questions_inserted: savedCount,
        questions_updated: 0,
        duplicates_skipped: questions.length - savedCount,
        errors: 0,
        created_by: user.id,
        banca: "ENARE",
        year: 2025
      };

      console.log(`[governance] Recording success for ${specialty}, saved: ${savedCount}`);
      
      const { error: govErr } = await supabaseAdmin.from("pipeline_governance").insert(govRecord);
      if (govErr) console.error("[governance] Failed to insert pipeline_governance:", govErr);
      
      const { error: ingestErr } = await supabaseAdmin.from("ingestion_log").insert(ingestRecord);
      if (ingestErr) console.error("[governance] Failed to insert ingestion_log:", ingestErr);

      return { total_imported: 0, total_generated: savedCount, total_questions: savedCount };

    } catch (err: any) {
      logger.error("GENERATION_PROCESS_FAILED", err.message, { stack: err.stack });
      
      const failRecord = {
        pipeline_name: "bulk-generate",
        function_name: "bulk-generate-content",
        status: "failed",
        failure_reason: err.message,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          specialty,
          correlation_id: correlation.correlationId,
          error_stack: err.stack
        }
      };

      console.log(`[governance] Recording failure for ${specialty}: ${err.message}`);
      await supabaseAdmin.from("pipeline_governance").insert(failRecord);
      
      throw err;
    }
  };

  // 3. EXECUTE — SEMPRE em background (geração + forensic + inserts > 150s).
  // Modo síncrono removido para evitar IDLE_TIMEOUT (504).
  // O cliente deve fazer polling em `pipeline_governance` ou `questions_bank` pelo correlation_id.
  waitUntil(processGeneration());
  return corsResponse({
    status: "processing",
    specialty,
    count,
    correlation_id: correlation.correlationId,
    message: "Geração iniciada em background. Consulte pipeline_governance para status."
  }, 202);
}));
