import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CronogramaHeader from "@/components/cronograma/CronogramaHeader";
import CronogramaVisaoGeral from "@/components/cronograma/CronogramaVisaoGeral";
import CronogramaAgendaHoje from "@/components/cronograma/CronogramaAgendaHoje";
import CronogramaNovoTema from "@/components/cronograma/CronogramaNovoTema";
import CronogramaTemas from "@/components/cronograma/CronogramaTemas";
import CronogramaRevisaoAtiva from "@/components/cronograma/CronogramaRevisaoAtiva";
import CronogramaTemasCriticos from "@/components/cronograma/CronogramaTemasCriticos";
import CronogramaHistorico from "@/components/cronograma/CronogramaHistorico";
import CronogramaConfiguracoes from "@/components/cronograma/CronogramaConfiguracoes";
import CronogramaGraficos from "@/components/cronograma/CronogramaGraficos";
// [planner-unification-final] StudyPlanContent não é mais montado pelo Cronograma.
// Componente isolado em modo @deprecated-flow (escreve em study_plans/study_tasks legado).
// import StudyPlanContent from "@/components/cronograma/StudyPlanContent";
import { syncTemasToModules, updateStudyPerformanceContext } from "@/lib/cronogramaSync";

/* ======================== TYPES ======================== */

export interface TemaEstudado {
  id: string;
  tema: string;
  especialidade: string;
  subtopico?: string | null;
  data_estudo: string;
  fonte: string;
  dificuldade: string; // facil | medio | dificil
  observacoes: string | null;
  status: string; // ativo | concluido
  created_at: string;
}

export interface Revisao {
  id: string;
  tema_id: string;
  tipo_revisao: string;
  data_revisao: string;
  status: string;
  concluida_em: string | null;
  prioridade: number;
  risco_esquecimento: string;
}

export interface Desempenho {
  id: string;
  tema_id: string;
  revisao_id: string | null;
  questoes_feitas: number;
  questoes_erradas: number;
  taxa_acerto: number;
  tempo_gasto: number;
  nivel_confianca: string; // nao_sei | parcial | sei_bem
  observacoes: string | null;
  data_registro: string;
}

export interface CronogramaConfig {
  id: string;
  user_id: string;
  revisoes_extras_ativas: boolean;
  max_revisoes_dia: number;
  meta_questoes_dia: number;
  meta_revisoes_semana: number;
  mostrar_concluidos: boolean;
  pesos_algoritmo: PesosAlgoritmo;
  dias_revisao: Record<string, number>;
}

export interface PesosAlgoritmo {
  erro: number;
  tempo: number;
  atraso: number;
  dificuldade: number;
  confianca: number;
}

export type NivelRisco = "baixo" | "moderado" | "alto" | "critico";
export type NivelPrioridade = "baixa" | "media" | "alta" | "urgente";

export interface TemaComputado extends TemaEstudado {
  taxaErro: number;
  taxaAcerto: number;
  totalQuestoes: number;
  totalErros: number;
  risco: NivelRisco;
  riscoScore: number;
  prioridade: NivelPrioridade;
  prioridadeScore: number;
  ultimaRevisao: string | null;
  revisoesFeitas: number;
  revisoesPendentes: number;
  revisoesAtrasadas: number;
  ultimaConfianca: string | null;
  diasSemRevisar: number;
}

export type TabCronograma = "visao" | "hoje" | "novo" | "temas" | "criticos" | "historico" | "graficos" | "config";

/* ======================== CONSTANTS ======================== */

import { ALL_SPECIALTIES } from "@/constants/specialties";
export const SPECIALTIES = ALL_SPECIALTIES;

export const REVIEW_DAYS: Record<string, number> = {
  D1: 1, D2: 2, D3: 3, D4: 4, D5: 5, D7: 7, D15: 15, D30: 30,
};

const DIFICULDADE_NUM: Record<string, number> = { facil: 1, medio: 2, dificil: 3 };
const CONFIANCA_NUM: Record<string, number> = { sei_bem: 1, parcial: 2, nao_sei: 3 };

const DEFAULT_PESOS: PesosAlgoritmo = { erro: 0.3, tempo: 0.2, atraso: 0.2, dificuldade: 0.15, confianca: 0.15 };

/* ======================== ALGORITHMS ======================== */

export function generateReviewsByError(dataEstudo: string, taxaErro: number): { tipo: string; data: string }[] {
  const base = new Date(dataEstudo + "T12:00:00");
  let reviewTypes: string[];
  if (taxaErro > 60) {
    reviewTypes = ["D1", "D2", "D4", "D7", "D15", "D30"];
  } else if (taxaErro > 40) {
    reviewTypes = ["D1", "D2", "D3", "D5", "D7", "D15", "D30"];
  } else if (taxaErro > 20) {
    reviewTypes = ["D1", "D3", "D5", "D7", "D15", "D30"];
  } else {
    reviewTypes = ["D1", "D3", "D7", "D15", "D30"];
  }
  return reviewTypes.map(tipo => {
    const d = new Date(base);
    d.setDate(d.getDate() + REVIEW_DAYS[tipo]);
    return { tipo, data: d.toISOString().split("T")[0] };
  });
}

export function calcPrioridadeScore(
  taxaErro: number, diasSemRevisar: number, revisoesAtrasadas: number,
  dificuldade: string, ultimaConfianca: string | null,
  taxaAcertoRecente: number, pesos: PesosAlgoritmo = DEFAULT_PESOS
): number {
  const diffNum = DIFICULDADE_NUM[dificuldade] || 2;
  const confNum = CONFIANCA_NUM[ultimaConfianca || "parcial"] || 2;
  const score =
    (pesos.erro * taxaErro) +
    (pesos.tempo * Math.min(diasSemRevisar * 3, 50)) +
    (pesos.atraso * Math.min(revisoesAtrasadas * 15, 40)) +
    (pesos.dificuldade * diffNum * 12) +
    (pesos.confianca * confNum * 12) -
    (0.15 * taxaAcertoRecente);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getPrioridadeLevel(score: number): NivelPrioridade {
  if (score >= 75) return "urgente";
  if (score >= 50) return "alta";
  if (score >= 25) return "media";
  return "baixa";
}

export function calcRiscoScore(
  diasSemRevisar: number, taxaErro: number, revisoesFeitas: number,
  ultimaConfianca: string | null, reincidenciaErro: boolean
): number {
  const confNum = CONFIANCA_NUM[ultimaConfianca || "parcial"] || 2;
  let score = 0;
  score += Math.min(diasSemRevisar * 2.5, 35);
  score += taxaErro * 0.35;
  score += Math.max(0, (5 - revisoesFeitas) * 5);
  score += confNum * 5;
  if (reincidenciaErro) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getRiscoLevel(score: number): NivelRisco {
  if (score >= 75) return "critico";
  if (score >= 50) return "alto";
  if (score >= 25) return "moderado";
  return "baixo";
}

export function computeTema(
  tema: TemaEstudado, revisoes: Revisao[], desempenhos: Desempenho[], pesos?: PesosAlgoritmo
): TemaComputado {
  const temaRevisoes = revisoes.filter(r => r.tema_id === tema.id);
  const temaDesempenhos = desempenhos.filter(d => d.tema_id === tema.id);
  const today = new Date().toISOString().split("T")[0];

  const totalQuestoes = temaDesempenhos.reduce((s, d) => s + d.questoes_feitas, 0);
  const totalErros = temaDesempenhos.reduce((s, d) => s + d.questoes_erradas, 0);
  const taxaErro = totalQuestoes > 0 ? Math.round((totalErros / totalQuestoes) * 100) : 0;
  const taxaAcerto = totalQuestoes > 0 ? Math.round(((totalQuestoes - totalErros) / totalQuestoes) * 100) : 0;

  const revisoesFeitas = temaRevisoes.filter(r => r.status === "concluida").length;
  const revisoesPendentes = temaRevisoes.filter(r => r.status === "pendente").length;
  const revisoesAtrasadas = temaRevisoes.filter(r => r.data_revisao < today && r.status === "pendente").length;

  const concluidas = temaRevisoes.filter(r => r.concluida_em).sort((a, b) => (b.concluida_em || "").localeCompare(a.concluida_em || ""));
  const ultimaRevisao = concluidas.length > 0 ? concluidas[0].concluida_em : null;
  const lastDate = ultimaRevisao || tema.data_estudo;
  const diasSemRevisar = Math.max(0, Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)));

  const ultimaConfianca = temaDesempenhos.length > 0 ? temaDesempenhos[0].nivel_confianca : null;

  // Check error recurrence (error in last 2 sessions)
  const reincidenciaErro = temaDesempenhos.length >= 2 &&
    temaDesempenhos[0].questoes_erradas > 0 && temaDesempenhos[1].questoes_erradas > 0;

  const taxaAcertoRecente = temaDesempenhos.length > 0 ? temaDesempenhos[0].taxa_acerto : 0;

  const prioridadeScore = calcPrioridadeScore(taxaErro, diasSemRevisar, revisoesAtrasadas, tema.dificuldade, ultimaConfianca, taxaAcertoRecente, pesos);
  const riscoScore = calcRiscoScore(diasSemRevisar, taxaErro, revisoesFeitas, ultimaConfianca, reincidenciaErro);

  return {
    ...tema,
    taxaErro, taxaAcerto, totalQuestoes, totalErros,
    risco: getRiscoLevel(riscoScore), riscoScore,
    prioridade: getPrioridadeLevel(prioridadeScore), prioridadeScore,
    ultimaRevisao, revisoesFeitas, revisoesPendentes, revisoesAtrasadas,
    ultimaConfianca, diasSemRevisar,
  };
}

export function calcPreparation(temas: TemaEstudado[], revisoes: Revisao[], desempenhos: Desempenho[]): number {
  if (temas.length === 0) return 0;
  const totalRevisoes = revisoes.filter(r => r.status === "concluida").length;
  const totalPossiveis = revisoes.length || 1;
  const revisaoPercent = (totalRevisoes / totalPossiveis) * 100;
  const acertos = desempenhos.length > 0 ? desempenhos.reduce((s, d) => s + d.taxa_acerto, 0) / desempenhos.length : 0;
  const temasScore = Math.min(temas.length * 2, 30);
  return Math.min(100, Math.round(acertos * 0.5 + revisaoPercent * 0.3 + temasScore));
}

export function getPreparationLevel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Pronto para prova", color: "text-emerald-500" };
  if (pct >= 60) return { label: "Avançado", color: "text-primary" };
  if (pct >= 40) return { label: "Intermediário", color: "text-amber-500" };
  return { label: "Básico", color: "text-destructive" };
}

/* ======================== COMPONENT ======================== */

const CronogramaInteligente = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { refreshAll } = useRefreshUserState();
  // Jornada atual (filtrada pelo último reset).
  const [temas, setTemas] = useState<TemaEstudado[]>([]);
  const [revisoes, setRevisoes] = useState<Revisao[]>([]);
  const [desempenhos, setDesempenhos] = useState<Desempenho[]>([]);
  // Histórico pedagógico completo — alimenta apenas a aba "Histórico".
  // Preserva visibilidade de tudo que o usuário já estudou no passado.
  const [temasHistorico, setTemasHistorico] = useState<TemaEstudado[]>([]);
  const [revisoesHistorico, setRevisoesHistorico] = useState<Revisao[]>([]);
  const [desempenhosHistorico, setDesempenhosHistorico] = useState<Desempenho[]>([]);
  const [config, setConfig] = useState<CronogramaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRevisao, setActiveRevisao] = useState<(Revisao & { tema: TemaEstudado }) | null>(null);
  const [tab, setTab] = useState<TabCronograma>("visao");

  const loadData = useCallback(async () => {
    if (!user) return;
    // Reset fence: tudo que aparece como "jornada atual" (visão, hoje, temas,
    // críticos, gráficos, plano) deve ignorar dados anteriores ao último reset.
    // O histórico pedagógico continua acessível na aba "Histórico".
    const profileRes = await supabase
      .from("profiles")
      .select("last_study_plan_reset_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const resetAt: string =
      (profileRes.data as any)?.last_study_plan_reset_at || "1900-01-01T00:00:00Z";

    const [
      temasRes, revisoesRes, desRes, configRes,
      temasHistRes, revisoesHistRes, desHistRes,
    ] = await Promise.all([
      // Atuais — pós-reset
      supabase.from("temas_estudados").select("*").eq("user_id", user.id).gt("created_at", resetAt).order("data_estudo", { ascending: false }),
      supabase.from("revisoes").select("*").eq("user_id", user.id).gt("created_at", resetAt).order("data_revisao", { ascending: true }),
      supabase.from("desempenho_questoes").select("*").eq("user_id", user.id).gt("data_registro", resetAt).order("data_registro", { ascending: false }),
      supabase.from("cronograma_config").select("*").eq("user_id", user.id).maybeSingle(),
      // Histórico — sem fence (todas as atividades passadas)
      supabase.from("temas_estudados").select("*").eq("user_id", user.id).order("data_estudo", { ascending: false }),
      supabase.from("revisoes").select("*").eq("user_id", user.id).order("data_revisao", { ascending: true }),
      supabase.from("desempenho_questoes").select("*").eq("user_id", user.id).order("data_registro", { ascending: false }),
    ]);
    setTemas((temasRes.data as any[]) || []);
    setRevisoes((revisoesRes.data as any[]) || []);
    setDesempenhos((desRes.data as any[]) || []);
    setConfig((configRes.data as any) || null);
    setTemasHistorico((temasHistRes.data as any[]) || []);
    setRevisoesHistorico((revisoesHistRes.data as any[]) || []);
    setDesempenhosHistorico((desHistRes.data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Recarregar dados ao trocar de tab para garantir dados frescos
  useEffect(() => {
    if (tab !== "plano" && tab !== "novo" && tab !== "config") {
      loadData();
    }
  }, [tab]);

  const pesos = config?.pesos_algoritmo || DEFAULT_PESOS;
  const temasComputados = temas.map(t => computeTema(t, revisoes, desempenhos, pesos as PesosAlgoritmo));

  const handleAddTema = async (
    tema: string, especialidade: string, subtopico: string, dataEstudo: string,
    fonte: string, dificuldade: string, observacoes: string,
    questoesFeitas: number, questoesErradas: number,
    files?: File[]
  ) => {
    if (!user) return;

    // Upload files if any
    let anexos: { name: string; path: string }[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = `${user.id}/cronograma/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("user-uploads").upload(filePath, file);
        if (!upErr) {
          anexos.push({ name: file.name, path: filePath });
        }
      }
    }

    const { data, error } = await supabase.from("temas_estudados").insert({
      user_id: user.id, tema, especialidade, subtopico: subtopico || null,
      data_estudo: dataEstudo, fonte, dificuldade,
      observacoes: observacoes || null, status: "ativo",
      anexos: anexos.length > 0 ? anexos : [],
    } as any).select().single();
    if (error || !data) { toast({ title: "Erro", description: "Não foi possível salvar o tema.", variant: "destructive" }); return; }

    const temaId = (data as any).id;
    const taxaErro = questoesFeitas > 0 ? Math.round((questoesErradas / questoesFeitas) * 100) : 0;
    const taxaAcerto = questoesFeitas > 0 ? Math.round(((questoesFeitas - questoesErradas) / questoesFeitas) * 100) : 0;

    if (questoesFeitas > 0) {
      await supabase.from("desempenho_questoes").insert({
        user_id: user.id, tema_id: temaId,
        questoes_feitas: questoesFeitas, questoes_erradas: questoesErradas,
        taxa_acerto: taxaAcerto, nivel_confianca: "parcial",
      } as any);
    }

    const configExtras = config?.revisoes_extras_ativas !== false;
    const reviews = configExtras ? generateReviewsByError(dataEstudo, taxaErro) : generateReviewsByError(dataEstudo, 0);
    const reviewRows = reviews.map(r => ({
      user_id: user.id, tema_id: temaId, tipo_revisao: r.tipo,
      data_revisao: r.data, status: "pendente", prioridade: 50, risco_esquecimento: "baixo",
    }));
    await supabase.from("revisoes").insert(reviewRows as any);

    toast({ title: "✅ Tema registrado!", description: `${reviews.length} revisões agendadas.${anexos.length > 0 ? ` ${anexos.length} arquivo(s) anexado(s).` : ""} Erro: ${taxaErro}%` });
    setTab("visao");
    loadData();
  };

  const handleCompleteRevisao = async (
    revisao: Revisao, questoesFeitas: number, questoesErradas: number,
    tempoGasto: number, nivelConfianca: string, obs: string
  ) => {
    if (!user) return;
    const acertos = questoesFeitas - questoesErradas;
    const taxa = questoesFeitas > 0 ? Math.round((acertos / questoesFeitas) * 100) : 0;
    const taxaErro = questoesFeitas > 0 ? Math.round((questoesErradas / questoesFeitas) * 100) : 0;

    await supabase.from("revisoes").update({ status: "concluida", concluida_em: new Date().toISOString() } as any).eq("id", revisao.id);
    await supabase.from("desempenho_questoes").insert({
      user_id: user.id, tema_id: revisao.tema_id, revisao_id: revisao.id,
      questoes_feitas: questoesFeitas, questoes_erradas: questoesErradas,
      taxa_acerto: taxa, tempo_gasto: tempoGasto,
      nivel_confianca: nivelConfianca, observacoes: obs || null,
    } as any);

    // Adaptive: add extras based on error rate
    const configExtras = config?.revisoes_extras_ativas !== false;
    if (configExtras && taxaErro > 20) {
      const tema = temas.find(t => t.id === revisao.tema_id);
      if (tema) {
        const existingTypes = revisoes.filter(r => r.tema_id === tema.id).map(r => r.tipo_revisao);
        let extrasNeeded: string[] = [];
        if (taxaErro > 60) extrasNeeded = ["D2", "D4", "D5"].filter(t => !existingTypes.includes(t));
        else if (taxaErro > 40) extrasNeeded = ["D2", "D5"].filter(t => !existingTypes.includes(t));
        else extrasNeeded = ["D5"].filter(t => !existingTypes.includes(t));

        if (extrasNeeded.length > 0) {
          const extraRows = extrasNeeded.map(tipo => {
            const d = new Date(tema.data_estudo + "T12:00:00");
            d.setDate(d.getDate() + REVIEW_DAYS[tipo]);
            return { user_id: user.id, tema_id: tema.id, tipo_revisao: tipo, data_revisao: d.toISOString().split("T")[0], status: "pendente", prioridade: 70, risco_esquecimento: "alto" };
          });
          await supabase.from("revisoes").insert(extraRows as any);
          toast({ title: "⚠️ Revisões extras", description: `Erro ${taxaErro}% → ${extrasNeeded.join(", ")}` });
        }
      }
    }

    // If user said "nao_sei", anticipate next pending review
    if (nivelConfianca === "nao_sei") {
      const nextPending = revisoes.find(r => r.tema_id === revisao.tema_id && r.status === "pendente" && r.id !== revisao.id);
      if (nextPending) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await supabase.from("revisoes").update({
          data_revisao: tomorrow.toISOString().split("T")[0],
          prioridade: 90,
        } as any).eq("id", nextPending.id);
        toast({ title: "🔄 Revisão antecipada", description: "Próxima revisão reagendada para amanhã." });
      }
    }

    toast({ title: "✅ Revisão concluída!", description: `Acerto: ${taxa}% | Erro: ${taxaErro}%` });
    setActiveRevisao(null);
    if (user?.id) {
      const tema = temas.find(t => t.id === revisao.tema_id);
      completeStudyAction({
        userId: user.id,
        taskType: "review",
        topic: tema?.tema || "Revisão",
        source: "auto",
        originModule: "cronograma",
      });
    }
    refreshAll();
    // Sync study context for Tutor IA
    const tema = temas.find(t => t.id === revisao.tema_id);
    if (tema) {
      updateStudyPerformanceContext(user.id, [{ id: tema.id, tema: tema.tema, especialidade: tema.especialidade }]).catch(() => {});
    }
    loadData();
  };

  const handleDeleteTema = async (temaId: string) => {
    await supabase.from("desempenho_questoes").delete().eq("tema_id", temaId);
    await supabase.from("revisoes").delete().eq("tema_id", temaId);
    await supabase.from("temas_estudados").delete().eq("id", temaId);
    toast({ title: "Tema removido" });
    loadData();
  };

  const handleSaveConfig = async (newConfig: Partial<CronogramaConfig>) => {
    if (!user) return;
    if (config) {
      await supabase.from("cronograma_config").update(newConfig as any).eq("id", config.id);
    } else {
      await supabase.from("cronograma_config").insert({ user_id: user.id, ...newConfig } as any);
    }
    toast({ title: "Configurações salvas" });
    loadData();
  };

  // Derived data
  const today = new Date().toISOString().split("T")[0];
  const revisoesHoje = revisoes.filter(r => r.data_revisao <= today && r.status === "pendente");
  const revisoesAtrasadas = revisoes.filter(r => r.data_revisao < today && r.status === "pendente");
  const totalQuestoes = desempenhos.reduce((s, d) => s + d.questoes_feitas, 0);
  const totalErros = desempenhos.reduce((s, d) => s + d.questoes_erradas, 0);
  const taxaGeralAcerto = totalQuestoes > 0 ? Math.round(((totalQuestoes - totalErros) / totalQuestoes) * 100) : 0;
  const taxaGeralErro = totalQuestoes > 0 ? Math.round((totalErros / totalQuestoes) * 100) : 0;
  const preparation = calcPreparation(temas, revisoes, desempenhos);
  const prepLevel = getPreparationLevel(preparation);

  // Best/worst specialty
  const specPerf: Record<string, { feitas: number; erros: number }> = {};
  desempenhos.forEach(d => {
    const t = temas.find(t => t.id === d.tema_id);
    if (!t) return;
    if (!specPerf[t.especialidade]) specPerf[t.especialidade] = { feitas: 0, erros: 0 };
    specPerf[t.especialidade].feitas += d.questoes_feitas;
    specPerf[t.especialidade].erros += d.questoes_erradas;
  });
  const specEntries = Object.entries(specPerf).filter(([, v]) => v.feitas > 0).map(([name, v]) => ({
    name, taxa: Math.round(((v.feitas - v.erros) / v.feitas) * 100)
  }));
  const melhorEspec = specEntries.length > 0 ? specEntries.sort((a, b) => b.taxa - a.taxa)[0]?.name : null;
  const piorEspec = specEntries.length > 0 ? specEntries.sort((a, b) => a.taxa - b.taxa)[0]?.name : null;

  // Weekly stats
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const revisoesSemana = revisoes.filter(r => r.status === "concluida" && r.concluida_em && new Date(r.concluida_em) >= weekAgo).length;
  const revisoesNaoConcluidas = revisoes.filter(r => r.status === "pendente" && r.data_revisao < today).length;

  const startRevisao = (revisao: Revisao) => {
    const tema = temas.find(t => t.id === revisao.tema_id);
    if (tema) setActiveRevisao({ ...revisao, tema });
  };

  if (activeRevisao) {
    const temaComp = temasComputados.find(t => t.id === activeRevisao.tema_id);
    return (
      <CronogramaRevisaoAtiva
        revisao={activeRevisao}
        temaComputado={temaComp || null}
        desempenhos={desempenhos.filter(d => d.tema_id === activeRevisao.tema_id)}
        onComplete={handleCompleteRevisao}
        onBack={() => setActiveRevisao(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CronogramaHeader
        tab={tab} setTab={setTab}
        revisoesHoje={revisoesHoje.length}
        revisoesAtrasadas={revisoesAtrasadas.length}
        temasCriticos={temasComputados.filter(t => t.risco === "critico" || t.risco === "alto").length}
      />

      {tab === "visao" && (
        <CronogramaVisaoGeral
          temas={temas} temasComputados={temasComputados} revisoes={revisoes}
          revisoesHoje={revisoesHoje} totalQuestoes={totalQuestoes} totalErros={totalErros}
          taxaGeralAcerto={taxaGeralAcerto} taxaGeralErro={taxaGeralErro}
          preparation={preparation} prepLevel={prepLevel}
          revisoesSemana={revisoesSemana} revisoesNaoConcluidas={revisoesNaoConcluidas}
          melhorEspec={melhorEspec} piorEspec={piorEspec}
          loading={loading}
        />
      )}

      {tab === "hoje" && (
        <CronogramaAgendaHoje
          revisoes={revisoes} temas={temas} temasComputados={temasComputados}
          onStartRevisao={startRevisao}
        />
      )}

      {tab === "novo" && (
        <CronogramaNovoTema specialties={SPECIALTIES} onAdd={handleAddTema} />
      )}

      {tab === "temas" && (
        <CronogramaTemas
          temasComRisco={temasComputados} revisoes={revisoes} desempenhos={desempenhos}
          onDelete={handleDeleteTema} onStartRevisao={startRevisao}
        />
      )}

      {tab === "criticos" && (
        <CronogramaTemasCriticos
          temasComputados={temasComputados} revisoes={revisoes}
          onStartRevisao={startRevisao}
        />
      )}

      {tab === "historico" && (
        <CronogramaHistorico
          temas={temasHistorico}
          revisoes={revisoesHistorico}
          desempenhos={desempenhosHistorico}
        />
      )}

      {tab === "graficos" && (
        <CronogramaGraficos temas={temas} revisoes={revisoes} desempenhos={desempenhos} />
      )}

      {tab === "config" && (
        <CronogramaConfiguracoes config={config} onSave={handleSaveConfig} />
      )}

      {tab === "plano" && (
        // [planner-unification-final] StudyPlanContent (shape semanal weeklySchedule) APOSENTADO.
        // O estado tab="plano" foi mantido apenas para compatibilidade com links antigos.
        // A entrada na navegação (CronogramaHeader) foi removida.
        <div className="glass-card p-6 text-center space-y-3">
          <h3 className="text-lg font-semibold">📋 Plano de Estudos semanal aposentado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            O plano semanal foi substituído pelo <strong>Plano do Dia</strong>, gerado e atualizado
            automaticamente pelo motor adaptativo do ENAZIZI.
          </p>
          <p className="text-xs text-muted-foreground">
            Acesse <strong>Plano do Dia</strong> no menu principal para ver suas tarefas de hoje.
          </p>
          <button
            type="button"
            onClick={() => setTab("hoje")}
            className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            Ir para Agenda de Hoje
          </button>
        </div>
      )}
    </div>
  );
};

export default CronogramaInteligente;
