import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, BookOpen, CalendarDays, History,
  Loader2, Brain, AlertTriangle, GraduationCap, Clock, TrendingUp, BarChart3, RefreshCw,
  Flame, Zap, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";


// Existing cronograma components
import CronogramaNovoTema from "@/components/cronograma/CronogramaNovoTema";
import CronogramaTemas from "@/components/cronograma/CronogramaTemas";
import CronogramaHistorico from "@/components/cronograma/CronogramaHistorico";
import StudyPlanContent from "@/components/cronograma/StudyPlanContent";
import { syncTemasToModules, updateStudyPerformanceContext } from "@/lib/cronogramaSync";
import CronogramaSmartSuggestions from "@/components/cronograma/CronogramaSmartSuggestions";

// New strategic components
import PlannerStrategicHeader from "@/components/planner/PlannerStrategicHeader";
import PlannerTaskCard, { type TaskCategory } from "@/components/planner/PlannerTaskCard";
import PlannerFSRSSection from "@/components/planner/PlannerFSRSSection";
import PlannerErrorZone from "@/components/planner/PlannerErrorZone";

// Types and algorithms from cronograma
import {
  type TemaEstudado, type Revisao, type Desempenho, type CronogramaConfig,
  type PesosAlgoritmo, type TemaComputado,
  computeTema, calcPreparation, getPreparationLevel,
  generateReviewsByError, REVIEW_DAYS, SPECIALTIES,
} from "@/pages/CronogramaInteligente";

// Study Engine
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { useExamReadiness } from "@/hooks/useExamReadiness";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useRadarPlannerOverlay } from "@/hooks/useRadarPlannerOverlay";
import { useCoreData } from "@/hooks/useCoreData";

const DEFAULT_PESOS: PesosAlgoritmo = { erro: 0.3, tempo: 0.2, atraso: 0.2, dificuldade: 0.15, confianca: 0.15 };

const SmartPlanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const plannerV2 = isEnabled("new_planner_enabled");
  const chanceByExamEnabled = isEnabled("new_chance_by_exam_enabled");
  const recoveryFlagEnabled = isEnabled("new_recovery_enabled");
  const [temas, setTemas] = useState<TemaEstudado[]>([]);
  const [revisoes, setRevisoes] = useState<Revisao[]>([]);
  const [desempenhos, setDesempenhos] = useState<Desempenho[]>([]);
  const [config, setConfig] = useState<CronogramaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => plannerV2 ? "estrategia" : "conteudo");
  const [showReprocess, setShowReprocess] = useState(false);
  const [newExamDate, setNewExamDate] = useState<Date>();
  const [reprocessing, setReprocessing] = useState(false);
  const [lastUpload, setLastUpload] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // New data
  const [approvalScore, setApprovalScore] = useState(0);
  const [chanceByExam, setChanceByExam] = useState<{ banca: string; chance_score: number }[]>([]);
  const [fsrsCards, setFsrsCards] = useState<any[]>([]);
  const [errorBank, setErrorBank] = useState<any[]>([]);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [targetExams, setTargetExams] = useState<string[]>([]);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [heavyRecoveryPhase, setHeavyRecoveryPhase] = useState<number | undefined>();



  const { data: engineRecs, adaptive } = useStudyEngine();
  const { getHint: getRadarHint } = useRadarPlannerOverlay();
  const { data: coreData } = useCoreData();
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [temasRes, revisoesRes, desRes, configRes, approvalRes, chanceRes, fsrsRes, errorRes, profileRes, recoveryRes] = await Promise.all([
        supabase.from("temas_estudados").select("*").eq("user_id", user.id).gt("created_at", resetAt || "1900-01-01T00:00:00Z").order("data_estudo", { ascending: false }),
        supabase.from("revisoes").select("*").eq("user_id", user.id).gt("created_at", resetAt || "1900-01-01T00:00:00Z").order("data_revisao", { ascending: true }),
        supabase.from("desempenho_questoes").select("*").eq("user_id", user.id).gt("data_registro", resetAt || "1900-01-01T00:00:00Z").order("data_registro", { ascending: false }),
        supabase.from("cronograma_config").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("approval_scores").select("score, phase").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        chanceByExamEnabled ? supabase.from("chance_by_exam").select("banca, chance_score").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
        supabase.from("fsrs_cards").select("id, card_ref_id, card_type, due, stability, difficulty, state, reps, lapses").eq("user_id", user.id).gt("updated_at", resetAt || "1900-01-01T00:00:00Z"),
        supabase.from("error_bank").select("id, tema, subtema, vezes_errado, categoria_erro, motivo_erro").eq("user_id", user.id).eq("dominado", false).gt("updated_at", resetAt || "1900-01-01T00:00:00Z").order("vezes_errado", { ascending: false }).limit(20),
        supabase.from("profiles").select("exam_date, target_exams").eq("user_id", user.id).maybeSingle(),
        recoveryFlagEnabled ? supabase.from("recovery_runs").select("mode, phase, active").eq("user_id", user.id).eq("active", true).gt("updated_at", resetAt || "1900-01-01T00:00:00Z").maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);

      setTemas((temasRes.data as any[]) || []);
      setRevisoes((revisoesRes.data as any[]) || []);
      setDesempenhos((desRes.data as any[]) || []);
      setConfig((configRes.data as any) || null);
      setApprovalScore(approvalRes.data?.score || 0);
      setChanceByExam((chanceRes.data as any[]) || []);
      setFsrsCards((fsrsRes.data as any[]) || []);
      setErrorBank((errorRes.data as any[]) || []);
      setExamDate(profileRes.data?.exam_date || null);
      setTargetExams((profileRes.data?.target_exams as string[]) || []);
      setRecoveryMode(!!recoveryRes.data);
      setHeavyRecoveryPhase(recoveryRes.data?.mode === "heavy" ? (recoveryRes.data?.phase || 1) : undefined);
    } catch (err) {
      console.error("[SmartPlanner.loadData] failed:", err);
      // Fallback: don't show toast if it's just a background sync
    } finally {
      setLoading(false);
    }
  }, [user, chanceByExamEnabled, recoveryFlagEnabled, resetAt]);

  useEffect(() => { loadData(); }, [loadData]);

  // Monitor uploads for real-time suggestions
  useEffect(() => {
    if (!user) return;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const fetchLastUpload = async () => {
      const { data } = await supabase
        .from("uploads")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "processed")
        .gt("created_at", tenMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data && (data.extracted_json as any)?.suggested_topics?.length > 0) {
        const dismissed = sessionStorage.getItem(`dismissed_suggestion_${data.id}`);
        if (!dismissed) {
          setLastUpload(data);
          setShowSuggestions(true);
        }
      }
    };

    fetchLastUpload();

    const channel = supabase
      .channel("planner-upload-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "uploads", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.status === "processed" && (payload.new.extracted_json as any)?.suggested_topics?.length > 0) {
            setLastUpload(payload.new);
            setShowSuggestions(true);
          } else if (payload.new.status === "error") {
            console.error("[PLANNER_UPLOAD] Processing error:", payload.new.extracted_json);
            toast({
              title: "Erro no processamento",
              description: (payload.new.extracted_json as any)?.error || "Não foi possível processar o material.",
              variant: "destructive"
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleBulkAddTopics = async (suggestedTopics: any[]) => {
    if (!user) return;
    const todayStr = new Date().toISOString().split("T")[0];
    // const insertedTemas: { id: string; tema: string; especialidade: string }[] = [];
    
    const temasToInsert = suggestedTopics.map(st => ({
      user_id: user.id,
      tema: st.tema,
      especialidade: st.especialidade,
      subtopico: st.subtopico || null,
      data_estudo: todayStr,
      fonte: "ia_suggestion",
      dificuldade: st.dificuldade || "medio",
      status: "ativo"
    }));

    const { data: insertedData, error: temasError } = await supabase
      .from("temas_estudados")
      .insert(temasToInsert as any)
      .select();

    if (temasError) {
      toast({ title: "Erro ao adicionar temas", variant: "destructive" });
      return;
    }

    const insertedTemas = (insertedData || []).map(t => ({ id: t.id, tema: t.tema, especialidade: t.especialidade }));

    if (insertedTemas.length > 0) {
      const allReviews: any[] = [];
      insertedTemas.forEach(tema => {
        const reviews = generateReviewsByError(todayStr, 0);
        reviews.forEach(r => {
          allReviews.push({
            user_id: user.id,
            tema_id: tema.id,
            tipo_revisao: r.tipo,
            data_revisao: r.data,
            status: "pendente",
            prioridade: 50,
            risco_esquecimento: "baixo",
          });
        });
      });
      await supabase.from("revisoes").insert(allReviews);
      toast({ title: "✅ Cronograma Atualizado!", description: `${insertedTemas.length} temas adicionados.` });
      setShowSuggestions(false);
      if (lastUpload) sessionStorage.setItem(`dismissed_suggestion_${lastUpload.id}`, "true");
      loadData();
    }
  };

  const handleDismissSuggestions = () => {
    setShowSuggestions(false);
    if (lastUpload) sessionStorage.setItem(`dismissed_suggestion_${lastUpload.id}`, "true");
  };

  const pesos = config?.pesos_algoritmo || DEFAULT_PESOS;
  const temasComputados = temas.map(t => computeTema(t, revisoes, desempenhos, pesos as PesosAlgoritmo));

  // Derived stats
  const today = new Date().toISOString().split("T")[0];
  const revisoesHoje = revisoes.filter(r => r.data_revisao <= today && r.status === "pendente");
  const revisoesAtrasadas = revisoes.filter(r => r.data_revisao < today && r.status === "pendente");
  const totalRevisoesPendentes = revisoes.filter(r => r.status === "pendente").length;
  const totalRevisoesConcluidas = revisoes.filter(r => r.status === "concluida").length;
  const totalQuestoes = desempenhos.reduce((s, d) => s + d.questoes_feitas, 0);
  const totalErros = desempenhos.reduce((s, d) => s + d.questoes_erradas, 0);
  const taxaGeralAcerto = totalQuestoes > 0 ? Math.round(((totalQuestoes - totalErros) / totalQuestoes) * 100) : 0;
  const preparation = calcPreparation(temas, revisoes, desempenhos);

  // Specialty performance
  const specPerf: Record<string, { feitas: number; erros: number }> = {};
  desempenhos.forEach(d => {
    const t = temas.find(t => t.id === d.tema_id);
    if (!t) return;
    if (!specPerf[t.especialidade]) specPerf[t.especialidade] = { feitas: 0, erros: 0 };
    specPerf[t.especialidade].feitas += d.questoes_feitas;
    specPerf[t.especialidade].erros += d.questoes_erradas;
  });
  const specEntries = Object.entries(specPerf).filter(([, v]) => v.feitas > 0).map(([name, v]) => ({
    name, taxa: Math.round(((v.feitas - v.erros) / v.feitas) * 100), feitas: v.feitas
  }));

  // Week stats
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const revisoesSemana = revisoes.filter(r => r.status === "concluida" && r.concluida_em && new Date(r.concluida_em) >= weekAgo).length;
  const weekNumber = examDate
    ? Math.max(1, Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : undefined;

  // Build strategic task list from engine + FSRS + errors
  const buildStrategicTasks = () => {
    const tasks: {
      id: string; title: string; specialty: string; subtopic?: string | null;
      category: TaskCategory; reason: string; impact: string;
      estimatedMinutes: number; priority: number; overdue?: boolean;
      targetPath: string; errorCount?: number;
    }[] = [];

    // 1. Error bank entries → highest priority
    errorBank.slice(0, 3).forEach((e, i) => {
      tasks.push({
        id: `error-${e.id}`,
        title: e.tema,
        specialty: "Clínica",
        subtopic: e.subtema,
        category: "error_active",
        reason: e.motivo_erro || `Erro recorrente — ${e.vezes_errado}x nas últimas sessões.`,
        impact: "Corrigir agora evita repetir o mesmo erro na prova.",
        estimatedMinutes: 15,
        priority: 95 - i,
        errorCount: e.vezes_errado,
        targetPath: "/mission-control",
      });
    });

    // 2. Overdue FSRS cards → critical review
    const overdueFsrs = fsrsCards.filter(c => new Date(c.due) < new Date()).slice(0, 3);
    overdueFsrs.forEach((c, i) => {
      tasks.push({
        id: `fsrs-crit-${c.id}`,
        title: `Revisão FSRS — ${c.card_type}`,
        specialty: "",
        category: "critical_review",
        reason: "Risco alto de esquecimento. Estabilidade baixa no FSRS.",
        impact: "Revisar agora estabiliza a memória de longo prazo.",
        estimatedMinutes: 12,
        priority: 92 - i,
        overdue: true,
        targetPath: "/mission-control",
      });
    });

    // 3. Engine recommendations
    (engineRecs || []).slice(0, 5).forEach((rec, i) => {
      let category: TaskCategory = "practice";
      if (rec.type === "review") category = "near_review";
      else if (rec.type === "error_review") category = "error_active";
      else if (rec.type === "new") category = "new_content";
      else if (rec.type === "simulado") category = "simulado";
      else if (rec.type === "clinical") category = "practice";

      tasks.push({
        id: rec.id,
        title: rec.topic,
        specialty: rec.specialty,
        subtopic: rec.subtopic,
        category,
        reason: rec.reason || "Recomendação do motor de estudo adaptativo.",
        impact: rec.type === "review" ? "Fixar conteúdo na memória de longo prazo."
          : rec.type === "error_review" ? "Corrigir ponto fraco antes da prova."
          : rec.type === "new" ? "Expandir cobertura de conteúdo."
          : "Consolidar conhecimento via prática.",
        estimatedMinutes: rec.estimatedMinutes,
        priority: rec.priority,
        targetPath: rec.targetPath,
      });
    });

    // 4. Overdue revisões (cronograma)
    revisoesAtrasadas.slice(0, 3).forEach((r, i) => {
      const tema = temas.find(t => t.id === r.tema_id);
      if (!tema) return;
      // Skip if already represented by FSRS
      if (tasks.some(t => t.title === tema.tema && t.category === "critical_review")) return;
      tasks.push({
        id: `rev-${r.id}`,
        title: tema.tema,
        specialty: tema.especialidade,
        subtopic: tema.subtopico,
        category: "critical_review",
        reason: `Revisão ${r.tipo_revisao} atrasada — risco de esquecimento aumentando.`,
        impact: "Revisar agora mantém a curva de retenção estável.",
        estimatedMinutes: 15,
        priority: 88 - i,
        overdue: true,
        targetPath: "/mission-control",
      });
    });

    // Sort by priority desc; aplicamos um pequeno bônus visual com priorityDelta do Radar (±1).
    // NÃO altera persistência, apenas ordem do array em memória.
    tasks.sort((a, b) => {
      const aHint = getRadarHint(a.title);
      const bHint = getRadarHint(b.title);
      const aBoost = aHint?.priorityDelta ?? 0;
      const bBoost = bHint?.priorityDelta ?? 0;
      return (b.priority + bBoost) - (a.priority + aBoost);
    });
    return tasks;
  };

  const strategicTasks = buildStrategicTasks();

  const handleGenerateDaily = async () => {
    if (!user) return;
    setReprocessing(true);
    const startTime = Date.now();
    try {
      const { data: session } = await supabase.auth.getSession();
      
      // Telemetry: start
      supabase.functions.invoke("unified-telemetry", {
        body: { userId: user.id, eventType: "daily_mission_generate_clicked", module: "planner" }
      }).then();

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-daily-plan`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${session?.session?.access_token}` 
        },
        body: JSON.stringify({ force: true }),
      });
      if (!resp.ok) throw new Error("Falha na Edge Function");
      
      const result = await resp.json();

      // Telemetry: success
      supabase.functions.invoke("unified-telemetry", {
        body: { 
          userId: user.id, 
          eventType: "daily_mission_generated", 
          module: "planner",
          data: { latency_ms: Date.now() - startTime, plan_id: result.planId }
        }
      }).then();

      toast({ title: "✅ Cronograma gerado!", description: "Sua missão do dia está pronta." });
      loadData();
    } catch (err: any) {
      // Telemetry: error
      supabase.functions.invoke("unified-telemetry", {
        body: { 
          userId: user.id, 
          eventType: "daily_mission_error", 
          module: "planner",
          data: { error: err.message }
        }
      }).then();
      toast({ title: "Erro", description: "Não foi possível gerar o cronograma.", variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  };


  // Handlers (preserved from original)
  const handleAddTema = async (
    tema: string, especialidade: string, subtopico: string, dataEstudo: string,
    fonte: string, dificuldade: string, observacoes: string,
    questoesFeitas: number, questoesErradas: number,
    files?: File[]
  ) => {
    if (!user) return;
    let anexos: { name: string; path: string }[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
          if (file.size > MAX_FILE_SIZE) {
            toast({
              title: "Arquivo muito grande",
              description: `O arquivo ${file.name} excede o limite de 20MB.`,
              variant: "destructive"
            });
            continue;
          }

          const timestamp = Date.now();
          const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `${user.id}/cronograma/${timestamp}-${cleanName}`;
          
          if (import.meta.env.DEV) console.log("[PLANNER_UPLOAD] Starting upload:", { fileName: file.name, size: file.size, type: file.type, storagePath: filePath });

          const { error: upErr } = await supabase.storage.from("user-uploads").upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
          
          if (upErr) {
            console.error("[PLANNER_UPLOAD] Storage upload error:", upErr);
            toast({ 
              title: "Erro no upload", 
              description: `Falha ao subir ${file.name}: ${upErr.message}`, 
              variant: "destructive" 
            });
            continue;
          }
          
          if (import.meta.env.DEV) console.log("[PLANNER_UPLOAD] Upload successful:", filePath);
          
          anexos.push({ name: file.name, path: filePath });

          // Se for PDF, DOCX, TXT ou Imagem, disparar processamento em background (Edge Function)
          const isProcessable = file.type === "application/pdf" || 
                               file.name.toLowerCase().endsWith(".pdf") ||
                               file.type === "text/plain" ||
                               file.name.toLowerCase().endsWith(".txt") ||
                               file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                               file.name.toLowerCase().endsWith(".docx") ||
                               file.type.startsWith("image/") ||
                               [".png", ".jpg", ".jpeg", ".webp"].some(ext => file.name.toLowerCase().endsWith(ext));

          if (isProcessable) {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 
                           (file.type.includes('/') ? file.type.split('/')[1] : 'pdf');
            
            console.log("[PLANNER_UPLOAD] Registering upload in DB:", { filename: file.name, type: fileExt });
            
            const { data: uploadRecord, error: dbError } = await supabase
              .from("uploads")
              .insert(({
                user_id: user.id,
                filename: file.name,
                file_type: fileExt,
                category: "material",
                storage_path: filePath,
                status: "uploaded",
                extracted_json: { 
                  file_size: file.size, 
                  mime_type: file.type,
                  original_name: file.name,
                  step: "uploaded"
                }
              } as any))
              .select()
              .single();

            if (dbError) {
              console.error("[PLANNER_UPLOAD] Database insert error:", dbError);
              throw dbError;
            }

            if (uploadRecord) {
              toast({
                title: "Analisando material...",
                description: `O ENAZIZI está extraindo o conteúdo de "${file.name}" para adaptar seu plano.`,
              });
              
              const { data: sessionData } = await supabase.auth.getSession();
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${sessionData?.session?.access_token}`,
                },
                body: JSON.stringify({ uploadId: uploadRecord.id }),
              }).then(async (resp) => {
                if (!resp.ok) {
                  const errorData = await resp.json().catch(() => ({}));
                  console.error("[PLANNER_UPLOAD] Edge Function error:", errorData);
                  toast({
                    title: "Alerta no processamento",
                    description: errorData.error || "Ocorreu um erro ao analisar o texto, mas o arquivo foi salvo.",
                    variant: "destructive"
                  });
                } else {
                  console.log("[PLANNER_UPLOAD] Edge Function triggered successfully");
                }
              }).catch(err => {
                console.error("[PLANNER_UPLOAD] Trigger process-upload error:", err);
              });
            }
          }
        } catch (err: any) {
          console.error("File processing error:", err);
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
    toast({ title: "✅ Tema registrado!", description: `${reviews.length} revisões agendadas.` });
    setActiveTab("conteudo");
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
        }
      }
    }
    if (nivelConfianca === "nao_sei") {
      const nextPending = revisoes.find(r => r.tema_id === revisao.tema_id && r.status === "pendente" && r.id !== revisao.id);
      if (nextPending) {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        await supabase.from("revisoes").update({ data_revisao: tomorrow.toISOString().split("T")[0], prioridade: 90 } as any).eq("id", nextPending.id);
      }
    }
    toast({ title: "✅ Revisão concluída!", description: `Acerto: ${taxa}%` });
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

  const startRevisao = (_revisao: Revisao) => { navigate("/dashboard/plano-dia"); };

  const reprocessCronograma = async () => {
    if (!user || !newExamDate) {
      toast({ title: "Selecione a nova data da prova", variant: "destructive" });
      return;
    }
    setReprocessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const existingSubjects = temas.map(t => t.tema);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ examDate: format(newExamDate, "yyyy-MM-dd"), hoursPerDay: 4, daysPerWeek: 5, existingSubjects }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro ao reprocessar");
      setShowReprocess(false);
      toast({ title: "✅ Cronograma recalculado!", description: "Revisões redistribuídas com a nova data." });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao reprocessar", description: err.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-24 pt-8 space-y-12 relative min-h-screen">
      <EnaflixBackgroundFX intensity="medium" />
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2 text-white/40 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
        <EnaflixSectionTitle
          kicker="INTELIGÊNCIA ADAPTATIVA"
          title={
            <>
              Planner <span className="gradient-text">Estratégico</span>
            </>
          }
          subtitle="Sua trajetória até a aprovação — fases, prioridades e revisões orquestradas em tempo real."
          action={
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={handleGenerateDaily} disabled={reprocessing} className="gap-2 shadow-lg shadow-primary/20">
                {reprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Gerar Missão do Dia
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowReprocess(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Recalcular Prova
              </Button>
            </div>
          }
        />
      </div>

      {/* Suggestions */}
      {showSuggestions && lastUpload && (
        <div className="px-4 sm:px-8 lg:px-14">
          <CronogramaSmartSuggestions 
            uploadId={lastUpload.id}
            filename={lastUpload.filename}
            topics={(lastUpload.extracted_json as any)?.suggested_topics || []}
            isEnriching={(lastUpload.extracted_json as any)?.enriching}
            enrichmentProgress={(lastUpload.extracted_json as any)?.progress}
            onAdd={handleBulkAddTopics}
            onDismiss={handleDismissSuggestions}
          />
        </div>
      )}


      {/* Reprocess Panel */}
      {showReprocess && (
        <Card className="border-2 border-primary/30">
          <CardContent className="p-4 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Recalcular com Nova Data
            </h2>
            <p className="text-sm text-muted-foreground">
              O cronograma será regenerado mantendo seus temas e integrando o conteúdo do seu material mais recente, caso tenha enviado um.
            </p>

            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>Nova data da prova</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !newExamDate && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {newExamDate ? format(newExamDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newExamDate} onSelect={setNewExamDate} disabled={(date) => date < new Date()} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={reprocessCronograma} disabled={reprocessing || !newExamDate}>
                {reprocessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {reprocessing ? "Reprocessando..." : "Recalcular"}
              </Button>
              <Button variant="ghost" onClick={() => setShowReprocess(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {showSuggestions && lastUpload && (
        <div className="px-4 sm:px-8 lg:px-14 mb-8">
          <CronogramaSmartSuggestions 
            uploadId={lastUpload.id}
            filename={lastUpload.filename}
            topics={(lastUpload.extracted_json as any)?.suggested_topics || []}
            isEnriching={(lastUpload.extracted_json as any)?.enriching}
            enrichmentProgress={(lastUpload.extracted_json as any)?.progress}
            onAdd={handleBulkAddTopics}
            onDismiss={handleDismissSuggestions}
          />
        </div>
      )}

      {/* Tabs — 4 seções */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("w-full h-auto", plannerV2 ? "grid grid-cols-4" : "grid grid-cols-3")}>
          {plannerV2 && (
            <TabsTrigger value="estrategia" className="text-xs py-2 flex flex-col gap-0.5 items-center">
              <Target className="h-4 w-4" />
              <span>Estratégia</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="conteudo" className="text-xs py-2 flex flex-col gap-0.5 items-center">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Conteúdo</span>
            <span className="sm:hidden">Temas</span>
          </TabsTrigger>
          <TabsTrigger value="calendario" className="text-xs py-2 flex flex-col gap-0.5 items-center">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Calendário</span>
            <span className="sm:hidden">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs py-2 flex flex-col gap-0.5 items-center">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden">Hist.</span>
          </TabsTrigger>
        </TabsList>

        {/* ── ESTRATÉGIA ── */}
        <TabsContent value="estrategia" className="space-y-4 mt-4">
          {/* Strategic Header */}
          <PlannerStrategicHeader
            examDate={examDate}
            targetExams={targetExams}
            approvalScore={approvalScore}
            chanceByExam={chanceByExam}
            pendingReviews={totalRevisoesPendentes}
            overdueReviews={revisoesAtrasadas.length}
            recoveryMode={recoveryMode || !!adaptive?.recoveryMode}
            heavyRecoveryPhase={heavyRecoveryPhase || (adaptive?.heavyRecovery?.active ? adaptive.heavyRecovery.phase : undefined)}
            weekNumber={weekNumber}
          />

          {/* FSRS Status */}
          <PlannerFSRSSection cards={fsrsCards} />

          {/* Error Zone */}
          <PlannerErrorZone errors={errorBank} />

          {/* Strategic Tasks */}
          {strategicTasks.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Tarefas Estratégicas
                <Badge variant="secondary" className="text-[10px]">{strategicTasks.length}</Badge>
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Ordenadas por impacto e urgência. O motor de estudo prioriza automaticamente.
              </p>
              {strategicTasks.map(task => (
                <PlannerTaskCard
                  key={task.id}
                  title={task.title}
                  specialty={task.specialty}
                  subtopic={task.subtopic}
                  category={task.category}
                  reason={task.reason}
                  impact={task.impact}
                  estimatedMinutes={task.estimatedMinutes}
                  priority={task.priority}
                  overdue={task.overdue}
                  errorCount={task.errorCount}
                  radarHint={getRadarHint(task.title)}
                  onAction={() => navigate(task.targetPath)}
                />
              ))}
            </div>
          )}

          {/* Study Plan Content */}
          <StudyPlanContent
            onSyncComplete={async () => { await loadData(); setActiveTab("conteudo"); }}
            onSubjectsGenerated={async (subjects: string[]) => {
              if (!user) return;
              const today2 = new Date().toISOString().split("T")[0];
              await supabase.from("desempenho_questoes").delete().eq("user_id", user.id);
              await supabase.from("revisoes").delete().eq("user_id", user.id);
              await supabase.from("temas_estudados").delete().eq("user_id", user.id);
              setTemas([]);
              if (subjects.length === 0) return { temasRegistrados: 0, flashcardsCriados: 0, questoesVinculadas: 0, revisoesAgendadas: 0 };
              // [planner-unification-final] Agora usamos o topicMap granular para separar os tópicos corretamente.
              const { data: latestPlanData } = await supabase.from("study_plans").select("id, plan_json").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
              const plan = latestPlanData?.plan_json as any;
              const topicMap: { topic: string; subtopics: string[]; priority_score?: number }[] = plan?.topicMap || [];
              
              const registeredTemas: { id: string; tema: string; especialidade: string }[] = [];
              let totalReviews = 0;

              // Se tivermos um topicMap detalhado, usamos ele para criar tópicos granulares
              if (topicMap.length > 0) {
                for (const entry of topicMap) {
                  const mainTopic = entry.topic;
                  const especialidade = (await import("@/lib/mapTopicToSpecialty")).mapTopicToSpecialty(mainTopic) || "Clínica Médica";
                  
                  // Se não houver subtemas, cria o tema principal
                  if (!entry.subtopics || entry.subtopics.length === 0) {
                    const { data, error } = await supabase.from("temas_estudados").insert({
                      user_id: user.id, 
                      tema: mainTopic, 
                      especialidade, 
                      data_estudo: today2, 
                      fonte: "plano_estudos", 
                      dificuldade: "medio", 
                      status: "ativo"
                    } as any).select().single();
                    
                    if (!error && data) {
                      const temaId = (data as any).id;
                      registeredTemas.push({ id: temaId, tema: mainTopic, especialidade });
                      const reviews = generateReviewsByError(today2, 0);
                      totalReviews += reviews.length;
                      await supabase.from("revisoes").insert(reviews.map(r => ({
                        user_id: user.id, tema_id: temaId, tipo_revisao: r.tipo, data_revisao: r.data, status: "pendente", prioridade: entry.priority_score || 50, risco_esquecimento: "baixo",
                      })) as any);
                    }
                  } else {
                    // Para cada subtema, cria uma entrada separada para o FSRS
                    for (const sub of entry.subtopics) {
                      const fullTema = `${mainTopic}: ${sub}`;
                      const { data, error } = await supabase.from("temas_estudados").insert({
                        user_id: user.id, 
                        tema: fullTema, 
                        especialidade, 
                        data_estudo: today2, 
                        fonte: "plano_estudos", 
                        dificuldade: "medio", 
                        subtopico: sub,
                        status: "ativo"
                      } as any).select().single();
                      
                      if (!error && data) {
                        const temaId = (data as any).id;
                        registeredTemas.push({ id: temaId, tema: fullTema, especialidade });
                        const reviews = generateReviewsByError(today2, 0);
                        totalReviews += reviews.length;
                        await supabase.from("revisoes").insert(reviews.map(r => ({
                          user_id: user.id, tema_id: temaId, tipo_revisao: r.tipo, data_revisao: r.data, status: "pendente", prioridade: entry.priority_score || 50, risco_esquecimento: "baixo",
                        })) as any);
                      }
                    }
                  }
                }
              } else {
                // Fallback para o comportamento anterior se não houver topicMap
                for (const subject of subjects) {
                  const especialidade = (await import("@/lib/mapTopicToSpecialty")).mapTopicToSpecialty(subject) || "Medicina Preventiva";
                  const { data, error } = await supabase.from("temas_estudados").insert({
                    user_id: user.id, tema: subject, especialidade, data_estudo: today2, fonte: "plano_estudos", dificuldade: "medio", status: "ativo",
                  } as any).select().single();
                  if (error || !data) continue;
                  const temaId = (data as any).id;
                  registeredTemas.push({ id: temaId, tema: subject, especialidade });
                  const reviews = generateReviewsByError(today2, 0);
                  totalReviews += reviews.length;
                  await supabase.from("revisoes").insert(reviews.map(r => ({
                    user_id: user.id, tema_id: temaId, tipo_revisao: r.tipo, data_revisao: r.data, status: "pendente", prioridade: 50, risco_esquecimento: "baixo",
                  })) as any);
                }
              }
              let flashcardsCriados = 0;
              let questoesVinculadas = 0;
              if (registeredTemas.length > 0) {
                try {
                  const syncResult = await syncTemasToModules(user.id, registeredTemas);
                  flashcardsCriados = syncResult.flashcardsCriados;
                  questoesVinculadas = syncResult.questoesVinculadas;
                } catch (err) { console.error("Sync error:", err); }

                // Create baseline approval score if none exists
                const { data: existingScore } = await supabase
                  .from("approval_scores")
                  .select("id")
                  .eq("user_id", user.id)
                  .limit(1)
                  .maybeSingle();
                if (!existingScore) {
                  await supabase.from("approval_scores").insert({
                    user_id: user.id,
                    score: 0,
                    accuracy: 0,
                    review_score: 0,
                    consistency_score: 0,
                    domain_score: 0,
                    error_penalty: 0,
                    simulation_score: 0,
                    phase: "base",
                  } as any);
                }

                await loadData();
              }
              return { temasRegistrados: registeredTemas.length, flashcardsCriados, questoesVinculadas, revisoesAgendadas: totalReviews };
            }}
          />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{taxaGeralAcerto}%</p>
                <p className="text-[9px] text-muted-foreground">Acerto ({totalQuestoes} Q)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{revisoesSemana}</p>
                <p className="text-[9px] text-muted-foreground">Revisões esta semana</p>
              </CardContent>
            </Card>
          </div>

          {/* Specialty Performance */}
          {specEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Desempenho por Especialidade</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {specEntries.sort((a, b) => a.taxa - b.taxa).map(s => (
                  <div key={s.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs truncate max-w-[60%]">{s.name}</span>
                      <span className="text-xs font-medium">{s.taxa}% ({s.feitas} Q)</span>
                    </div>
                    <Progress value={s.taxa} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CONTEÚDO ── */}
        <TabsContent value="conteudo" className="space-y-4 mt-4">
          <CronogramaNovoTema specialties={SPECIALTIES} onAdd={handleAddTema} />
          <CronogramaTemas
            temasComRisco={temasComputados} revisoes={revisoes} desempenhos={desempenhos}
            onDelete={handleDeleteTema} onStartRevisao={startRevisao}
          />
        </TabsContent>

        {/* ── CALENDÁRIO ── */}
        <TabsContent value="calendario" className="space-y-4 mt-4">
          <PlannerCalendarView revisoes={revisoes} temas={temas} />
        </TabsContent>

        {/* ── HISTÓRICO ── */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          <CronogramaHistorico temas={temas} revisoes={revisoes} desempenhos={desempenhos} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Macro calendar view
function PlannerCalendarView({ revisoes, temas }: { revisoes: Revisao[]; temas: TemaEstudado[] }) {
  const today = new Date();
  const days: { date: string; label: string; reviews: (Revisao & { temaNome: string })[] }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayReviews = revisoes
      .filter(r => r.data_revisao === dateStr && r.status === "pendente")
      .map(r => ({ ...r, temaNome: temas.find(t => t.id === r.tema_id)?.tema || "Tema" }));
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    days.push({
      date: dateStr,
      label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
      reviews: dayReviews,
    });
  }
  const visibleDays = days.filter((d, i) => i < 7 || d.reviews.length > 0);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        Visão macro — Próximos 30 dias
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Planejamento de revisões. Para executar, acesse o Dashboard ou Plano do Dia.
      </p>
      {visibleDays.map(day => (
        <Card key={day.date} className={`${day.reviews.length > 0 ? "border-primary/20" : "border-border/50"}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{day.label}</span>
              {day.reviews.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {day.reviews.length} {day.reviews.length === 1 ? "revisão" : "revisões"}
                </Badge>
              )}
            </div>
            {day.reviews.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Sem revisões agendadas</p>
            ) : (
              <div className="space-y-1">
                {day.reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="text-[11px] flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.risco_esquecimento === "alto" ? "bg-destructive" : r.risco_esquecimento === "medio" ? "bg-amber-500" : "bg-emerald-500"
                    }`} />
                    <span className="truncate">{r.temaNome}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{r.tipo_revisao}</span>
                  </div>
                ))}
                {day.reviews.length > 5 && <p className="text-[10px] text-muted-foreground">+{day.reviews.length - 5} mais</p>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default SmartPlanner;
