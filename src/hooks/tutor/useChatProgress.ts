import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StudyPerformance } from "@/components/tutor/TutorConstants";

export function useChatProgress(userId: string | undefined) {
  const [enaziziStep, setEnaziziStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const saveEnaziziStep = useCallback(async (step: number, tema?: string | null, performance?: StudyPerformance, sessionQuestions?: number) => {
    if (!userId || isTransitioning) return;
    
    // Sequence Validation (Prevenir Skip)
    if (step > enaziziStep + 1 && enaziziStep !== 1) {
      console.warn(`[BlockGuard] Tentativa de skip detectada: ${enaziziStep} -> ${step}. Bloqueado.`);
      return;
    }

    setIsTransitioning(true);
    const startTransition = Date.now();
    
    try {
      setEnaziziStep(step);
      const dbData = {
        user_id: userId,
        estado_atual: step,
        tema_atual: tema !== undefined ? tema : null,
        questoes_respondidas: (performance?.questoes_respondidas || 0) + (sessionQuestions || 0),
        taxa_acerto: performance?.taxa_acerto || 0,
        pontuacao_discursiva: performance?.pontuacao_discursiva || null,
        temas_fracos: (performance?.temas_fracos || []) as any,
        historico_estudo: [] as any,
        ultima_interacao: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("enazizi_progress")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("enazizi_progress").update(dbData).eq("user_id", userId);
      } else {
        await supabase.from("enazizi_progress").insert(dbData);
      }

      // Telemetria de Transição
      await supabase.from("tutor_block_transitions").insert({
        user_id: userId,
        previous_block: enaziziStep,
        next_block: step,
        transition_source: 'user_action',
        latency_ms: Date.now() - startTransition
      });

    } catch (err) {
      console.error("[useChatProgress] Error saving step:", err);
    } finally {
      setIsTransitioning(false);
    }
  }, [userId, enaziziStep, isTransitioning]);

  const getPhaseMap = useCallback((currentTopic: string) => {
    return {
      "leigo1": { prompt: `Agora traduza o bloco técnico 1 sobre ${currentTopic} para linguagem leiga e faça UMA pergunta curta de active recall.`, step: 4 },
      "tecnico2": { prompt: `Agora avance para o Bloco Técnico 2 (fisiopatologia) sobre ${currentTopic}. Base: Guyton, Robbins, Harrison. Explicação técnica profunda.`, step: 5 },
      "leigo2": { prompt: `Agora traduza o bloco técnico 2 (fisiopatologia) sobre ${currentTopic} para linguagem leiga e faça UMA pergunta curta.`, step: 6 },
      "tecnico3": { prompt: `Agora avance para o Bloco Técnico 3 (aplicação clínica) sobre ${currentTopic}. Sinais, sintomas, exames, tratamento, diagnósticos diferenciais. Explicação técnica.`, step: 7 },
      "leigo3": { prompt: `Agora traduza o bloco técnico 3 (aplicação clínica) sobre ${currentTopic} para linguagem leiga e faça UMA pergunta curta.`, step: 8 },
      "questions": { prompt: `Agora crie 1 questão objetiva estilo prova médica com caso clínico e alternativas A–E sobre ${currentTopic}. Não revele a resposta, espere eu responder.`, step: 9 },
      "discussion": { prompt: `Agora faça a discussão completa da questão sobre ${currentTopic}: alternativa correta, explicação simples+técnica, raciocínio clínico, diferenciais, análise de todas alternativas, ponto de prova, mini resumo.`, step: 10 },
      "discursive": { prompt: `Agora crie um caso clínico discursivo sobre ${currentTopic}. Pergunte: diagnóstico provável, conduta inicial, exames necessários, justificativa clínica.`, step: 11 },
      "correction": { prompt: `Corrija minha resposta discursiva com nota de 0-5 (Diagnóstico 0-2, Conduta 0-2, Justificativa 0-1). Depois apresente: resposta esperada, explicação simples+técnica, raciocínio clínico completo, pontos obrigatórios, erros clássicos, mini aula de reforço.`, step: 12 },
      "update": { prompt: `Atualize meu painel de desempenho com base nesta sessão sobre ${currentTopic}. Mostre: questões respondidas, taxa de acerto, temas fracos, desempenho clínico e discursivo.`, step: 13 },
      "consolidation": { prompt: `Agora inicie o BLOCO DE CONSOLIDAÇÃO sobre ${currentTopic}. Gere 5 questões objetivas sequenciais (uma por vez, espere minha resposta antes de enviar a próxima). Cada questão deve ter caso clínico curto + alternativas A–E. Após cada resposta, diga se acertou ou errou com breve explicação. Ao final das 5, apresente um resumo: acertos/erros, taxa, pontos fracos detectados e recomendação de próximo tema.`, step: 14 },
      "feynman": { prompt: `🧠 MÉTODO FEYNMAN — Agora é sua vez de ensinar! Explique o tema "${currentTopic}" com suas próprias palavras, como se estivesse ensinando para alguém SEM formação médica (um leigo completo). Use linguagem simples, analogias do dia a dia e exemplos práticos. Não use jargão médico — traduza TUDO. Após minha explicação, avalie em 4 critérios (nota 0-10 cada): ✨ Clareza (linguagem acessível?), 📋 Completude (cobriu os pontos essenciais?), 🎯 Precisão (informações corretas?), 💬 Simplicidade (evitou jargão?). Identifique as LACUNAS exatas do meu conhecimento e sugira como reformular as partes fracas.`, step: 15 },
      "retention": { prompt: `Gere um relatório final de retenção e recuperação sobre ${currentTopic}. Analise meu desempenho nesta sessão, projete meu esquecimento (FSRS) e sugira o próximo momento ideal para revisão.`, step: 16 },
    } as Record<string, { prompt: string; step: number }>;
  }, []);

  const getNextPhaseInfo = useCallback((step: number): { key: string; label: string; icon: string; desc: string } | null => {
    const phaseByStep: Record<number, { key: string; label: string; icon: string; desc: string }> = {
      3: { key: "leigo1", label: "Tradução Leiga", icon: "💡", desc: "O tutor vai simplificar o conteúdo técnico para linguagem do dia-a-dia" },
      4: { key: "tecnico2", label: "Fisiopatologia", icon: "🔬", desc: "Aprofundamento na fisiopatologia com base em Guyton e Robbins" },
      5: { key: "leigo2", label: "Tradução Leiga 2", icon: "💡", desc: "Simplificação da fisiopatologia para fixação" },
      6: { key: "tecnico3", label: "Aplicação Clínica", icon: "🏥", desc: "Sinais, sintomas, exames, diagnóstico e tratamento" },
      7: { key: "leigo3", label: "Tradução Leiga 3", icon: "💡", desc: "Simplificação da aplicação clínica" },
      8: { key: "questions", label: "Questão Objetiva", icon: "❓", desc: "Caso clínico com alternativas A-D para testar seu conhecimento" },
      9: { key: "discussion", label: "Discussão", icon: "💬", desc: "Análise detalhada da questão com raciocínio clínico" },
      10: { key: "discursive", label: "Caso Discursivo", icon: "✍️", desc: "Caso clínico aberto para diagnóstico e conduta" },
      11: { key: "correction", label: "Correção", icon: "✅", desc: "Correção detalhada com nota e feedback" },
      12: { key: "update", label: "Atualizar Painel", icon: "📈", desc: "Revisão do seu desempenho na sessão" },
      13: { key: "consolidation", label: "Consolidação", icon: "🔁", desc: "5 questões rápidas para consolidar o aprendizado" },
      14: { key: "feynman", label: "Método Feynman", icon: "💡", desc: "Explique o tema com suas palavras como se fosse para um leigo" },
      15: { key: "retention", label: "Relatório de Retenção", icon: "📊", desc: "Análise final de retenção e projeção FSRS" },
    };
    return phaseByStep[step] || null;
  }, []);

  return { enaziziStep, setEnaziziStep, saveEnaziziStep, getPhaseMap, getNextPhaseInfo };
}
