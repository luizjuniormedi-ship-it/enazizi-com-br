/**
 * EnaflixPage — Modo cinematográfico de descoberta inteligente.
 * 
 * Agora promovido a HOME principal do sistema.
 */
import { useEffect, useMemo, useState, useCallback, lazy, Suspense, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import { ENAFLIX_MODULES, type EnaflixModule } from "@/data/enaflix/enaflixModules";
import { ENAFLIX_CATEGORIES } from "@/data/enaflix/enaflixCategories";
import { EnaflixOverlayNav } from "@/components/enaflix/EnaflixOverlayNav";
import { EnaflixBillboardRotator } from "@/components/enaflix/EnaflixBillboardRotator";
import { EnaflixSectionRow } from "@/components/enaflix/EnaflixSectionRow";
import { EnaflixModuleCard } from "@/components/enaflix/EnaflixModuleCard";
import { EnaflixSectionRowVideo } from "@/components/enaflix/EnaflixSectionRowVideo";
import { EnaflixSearchBar } from "@/components/enaflix/EnaflixSearchBar";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixAmbientParticles } from "@/components/enaflix/EnaflixAmbientParticles";
import { EnaflixBillboardSkeleton } from "@/components/enaflix/EnaflixBillboardSkeleton";
import { EnaflixRowSkeleton } from "@/components/enaflix/EnaflixRowSkeleton";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useEnaflixUsage } from "@/hooks/useEnaflixUsage";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Brain, Target, TrendingUp, Award, Sparkles, ChevronRight, Play, Clock, AlertTriangle, ListChecks, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEnaflixPersonalizedRows } from "@/hooks/useEnaflixPersonalizedRows";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixDynamicCard } from "@/components/enaflix/EnaflixDynamicCard";
import { emitShadowEvent } from "@/lib/shadowAdaptive";
import { MascotAvatar } from "@/components/mascot/MascotAvatar";
import { MascotBubble } from "@/components/mascot/MascotBubble";
import { useMascotState } from "@/components/mascot/useMascotState";


const MedicalMasteryDashboard = lazy(() => import("@/components/MedicalMasteryDashboard").then(m => ({ default: m.MedicalMasteryDashboard })));
const ProgressOverview = lazy(() => import("@/components/dashboard/ProgressOverview"));


function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function EnaflixPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { state: mascotState, speech: mascotSpeech, triggerInteraction } = useMascotState();


  const { recordVisit, recentIds, popularIds } = useEnaflixUsage();
  const { data: studyNext, isLoading: missionLoading } = useStudyNext();
  const { data: dashData } = useDashboardData();
  const { data: personalizedRows, isLoading: isLoadingPersonalized } = useEnaflixPersonalizedRows();

  const { data: aiLessons, isLoading: isLoadingLessons } = useQuery({
    queryKey: ["enaflix-ai-lessons", user?.id],
    queryFn: async () => {
      try {
        const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user?.id).single();
        const orgId = profile?.organization_id || 'null';

        const { data, error } = await supabase
          .from("ai_video_lessons")
          .select("id, title, thumbnail_url, specialty, is_gold_content, duration_seconds, published_at, status, organization_id, is_global")
          .eq("status", "published")
          .or(`is_global.eq.true,organization_id.eq.${orgId}`)
          .order("published_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        const { data: memoryData, error: memoryError } = await supabase
          .from("tutor_lesson_memory")
          .select("id, title, thumbnail_url, subject, duration, published_at, status, hidden_from_student, organization_id, is_global")
          .eq("status", "published")
          .eq("hidden_from_student", false)
          .or(`is_global.eq.true,organization_id.eq.${orgId}`)
          .order("published_at", { ascending: false })
          .limit(10);

        if (memoryError) throw memoryError;

        const memoryLessons = (memoryData || []).map((l: any) => ({
          ...l,
          specialty: l.subject,
          duration_seconds: l.duration || 900,
        }));

        return [...(data || []), ...memoryLessons].sort(
          (a: any, b: any) =>
            new Date(b.published_at || b.created_at).getTime() -
            new Date(a.published_at || a.created_at).getTime()
        );
      } catch (err) {
        console.error("Error fetching Enaflix lessons:", err);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: usageLogs, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["enaflix-video-usage", user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const { data, error } = await supabase
          .from("video_lesson_usage_logs")
          .select("video_lesson_id, completion_rate")
          .eq("user_id", user.id);
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error("Error fetching video usage:", err);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const [forceReady, setForceReady] = useState(false);
  const isLoading = (isLoadingLessons || (isLoadingUsage && !!user) || adminLoading) && !forceReady;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {

    if (!isLoading && aiLessons) {
      triggerInteraction({
        state: 'idle',
        type: 'welcome',
        speech: "Bem-vindo ao ENAFLIX. Escolha um módulo para mergulhar no conhecimento médico."
      });
    }
  }, [isLoading, !!aiLessons]); // Simplified dependency to avoid loop if triggerInteraction changes


  useEffect(() => {
    // Aumentamos o timeout de segurança para 8s e forçamos o log se falhar
    const timer = setTimeout(() => {
      if (isLoading && !forceReady) {
        console.warn("[EnaflixPage] Loading timeout - forcing ready state for resilience.");
        setForceReady(true);
        void emitShadowEvent({ module: "enaflix", event: "watch_abandoned", topic: "loading_timeout_recovery" });
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [isLoading, forceReady]);

  const continueLessons = useMemo(() => {
    if (!aiLessons || !usageLogs) return [];
    const inProgressIds = usageLogs
      .filter(log => Number(log.completion_rate) > 0 && Number(log.completion_rate) < 95)
      .map(log => log.video_lesson_id);
    
    return aiLessons.filter(l => inProgressIds.includes(l.id));
  }, [aiLessons, usageLogs]);

  useEffect(() => {
    const prev = document.title;
    document.title = "ENAFLIX — streaming inteligente do ENAZIZI";
    // Body bg cinematográfico para garantir continuidade visual
    document.body.style.backgroundColor = "#050508";

    void emitShadowEvent({
      module: "enaflix",
      event: "watch_started",
      topic: "hub_opened",
      extra: { user_id: user?.id }
    });

    return () => {
      document.title = prev;
      document.body.style.backgroundColor = "";
    };
  }, [user?.id]);

  const visibleModules = useMemo<EnaflixModule[]>(() => {
    if (adminLoading) return []; // Wait for admin check to finish
    const items = ENAFLIX_MODULES.filter((m) => {
      if (m.enabled === false) return false;
      if (m.requires === "admin" && !isAdmin) return false;
      if (m.requires === "professor" && !isProfessor && !isAdmin) return false;
      
      // Feature flags check: If it's an educational module, always show for students
      // We explicitly exclude admin/telemetry/ingestion/governance from common users
      if (!isAdmin && !isProfessor) {
        const adminSpecific = ["admin", "telemetry", "incident-center", "ingestao", "governanca"];
        if (adminSpecific.some(keyword => m.id.includes(keyword) || m.category === "admin")) return false;
      }

      return true;
    });

    if (items.length === 0 && !adminLoading) {
       void emitShadowEvent({ module: "enaflix", event: "watch_abandoned", topic: "no_visible_modules" });
    }

    return items;
  }, [isAdmin, isProfessor, adminLoading]);

  const normalizedModules = useMemo(() => {
    return visibleModules.map(m => ({
      ...m,
      _searchHaystack: [m.title, m.description, m.category, ...(m.keywords ?? [])]
        .map(normalize)
        .join(" ")
    }));
  }, [visibleModules]);

  const filteredModules = useMemo(() => {
    const q = normalize(debouncedQuery.trim());
    if (!q) return visibleModules;
    return normalizedModules
      .filter((m) => m._searchHaystack.includes(q))
      .map(({ _searchHaystack, ...m }) => m);
  }, [normalizedModules, debouncedQuery]);


  const isSearching = query.trim().length > 0 || showAll;

  const moduleById = useMemo(() => {
    const map = new Map<string, EnaflixModule>();
    visibleModules.forEach((m) => map.set(m.id, m));
    return map;
  }, [visibleModules]);

  const continueModules = useMemo(
    () => {
      const items = recentIds.map((id) => moduleById.get(id)).filter(Boolean) as EnaflixModule[];
      if (items.length === 0 && !isLoading) {
        void emitShadowEvent({ module: "enaflix", event: "watch_abandoned", topic: "continue_row_empty" });
      }
      return items;
    },
    [recentIds, moduleById, isLoading],
  );

  const popularModules = useMemo(
    () => popularIds.map((id) => moduleById.get(id)).filter(Boolean) as EnaflixModule[],
    [popularIds, moduleById],
  );

  const recommendedModules = useMemo(() => {
    const visitedSet = new Set(popularIds.slice(0, 3));
    return visibleModules.filter((m) => m.featured && !visitedSet.has(m.id)).slice(0, 10);
  }, [visibleModules, popularIds]);

  // Vitrine rotativa: até 4 destaques cinematográficos com narrativa diferente.
  const billboardSlides = useMemo<Array<{ module: EnaflixModule; eyebrow: string; customTitle?: string; customDesc?: string }>>(() => {
    const slides: Array<{ module: EnaflixModule; eyebrow: string; customTitle?: string; customDesc?: string }> = [];
    const seen = new Set<string>();

    const push = (m: EnaflixModule | undefined, eyebrow: string, customTitle?: string, customDesc?: string) => {
      if (!m || (seen.has(m.id) && !customTitle)) return;
      seen.add(m.id);
      slides.push({ module: m, eyebrow, customTitle, customDesc });
    };

    // 1. MISSÃO DO DIA (A IA que guia o aluno) - Protagonista
    if (studyNext?.recommendation) {
      const rec = studyNext.recommendation;
      const targetModuleId = rec.type === 'review' ? 'sessao-estudo' : 
                           rec.type === 'mnemonic' ? 'mnemonico' :
                           rec.type === 'error_review' ? 'banco-erros' :
                           rec.type === 'image_quiz' ? 'image-quiz' : 
                           rec.type === 'daily_task' ? 'sessao-estudo' : 'sessao-estudo';
      
      const targetModule = ENAFLIX_MODULES.find(m => m.id === targetModuleId);
      if (targetModule) {
        push(
          targetModule, 
          "Próximo Passo Recomendado", 
          rec.title, 
          `${rec.description} • ~${rec.estimatedMinutes} min`
        );
      }
    }

    // 2. Erros Críticos (Urgente)
    if (studyNext?.adaptiveState?.weakTopicsCount && studyNext.adaptiveState.weakTopicsCount > 0) {
      const errorBank = ENAFLIX_MODULES.find(m => m.id === "banco-erros");
      if (errorBank) {
        push(errorBank, "Ação Corretiva Urgente", "Recuperar Erros Recentes", `Você tem ${studyNext.adaptiveState.weakTopicsCount} temas com queda de performance.`);
      }
    }

    // 3. Revisão Pendente (FSRS)
    if (studyNext?.adaptiveState?.pendingReviews && studyNext.adaptiveState.pendingReviews > 5) {
      const flashcards = ENAFLIX_MODULES.find(m => m.id === "flashcards");
      if (flashcards) {
        push(flashcards, "Manutenção de Memória", "Sessão de Revisão FSRS", `${studyNext.adaptiveState.pendingReviews} flashcards aguardam sua revisão hoje.`);
      }
    }
    
    // 4. Tutor IA (Sempre um destaque)
    push(
      visibleModules.find((m) => m.id === "mentor"),
      "Inteligência Pedagógica",
    );

    // Fallback: Continuar de onde parou
    if (slides.length < 4) {
      push(continueModules[0], "Continuar de onde parou");
    }

    return slides.slice(0, 4);
  }, [continueModules, recommendedModules, visibleModules, studyNext]);

  const handleNavigate = useCallback(
    (m: EnaflixModule, source: string = "category_row") => {
      recordVisit(m.id);
      void emitShadowEvent({
        module: "enaflix",
        event: "watch_started",
        topic: m.id,
        extra: {
          action: "card_click",
          source,
          destination: m.route
        }
      });
      if (!m.route) {
        console.warn(`[Enaflix] Card "${m.id}" sem rota definida — navegação ignorada`);
        return;
      }
      if (/^https?:\/\//i.test(m.route)) {
        window.open(m.route, "_blank", "noopener,noreferrer");
      } else {
        navigate(m.route);
      }
    },
    [recordVisit, navigate],
  );

  const handleClose = () => {
    // Para alunos, não faz sentido "voltar" para uma dashboard que eles não veem
    // Vamos manter eles no Enaflix ou perfil se tentarem fechar
    if (!isAdmin && !isProfessor) {
      navigate("/dashboard/perfil");
    } else {
      navigate("/dashboard");
    }
  };

  const handleSearchToggle = () => {
    setSearchOpen((v) => {
      const next = !v;
      if (!next) {
        setQuery("");
        setShowAll(false);
      }
      return next;
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleShowAllModules = () => {
    setSearchOpen(true);
    setQuery("");
    setShowAll(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#050508] text-white relative overflow-x-hidden">
      {/* Partículas ambientais — sobem do bottom (fixed para acompanhar o scroll) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <EnaflixAmbientParticles count={24} hue="mixed" />
      </div>

      {/* Topbar OVERLAY — flutua sobre tudo, conteúdo passa por baixo */}
      <EnaflixOverlayNav
        onClose={handleClose}
        onSearchClick={handleSearchToggle}
        searchActive={searchOpen}
      />

      {/* Drawer de busca cinematográfico (slide + blur) */}
      {searchOpen && (
        <div
          className="fixed top-16 inset-x-0 z-40 bg-[#050508]/95 backdrop-blur-xl border-b border-white/5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.85)] animate-drawer-in"
        >
          <div className="px-4 sm:px-8 lg:px-14 py-5 flex flex-col sm:flex-row gap-4 items-center">
            <EnaflixSearchBar
              value={query}
              onChange={setQuery}
              onEnter={() => {
                if (query.trim().length > 3) {
                  navigate(`/dashboard/mentor?topic=${encodeURIComponent(query)}`);
                }
              }}
              placeholder="Buscar simulados, flashcards, anamnese, ECG..."
              autoFocus
            />
            {query.trim().length > 3 && (
              <Enaflix3DButton
                size="sm"
                variant="violet"
                className="w-full sm:w-auto h-10 px-6 rounded-full text-xs font-black uppercase tracking-widest gap-2 group shrink-0"
                onClick={() => navigate(`/dashboard/mentor?topic=${encodeURIComponent(query)}`)}
              >
                <Sparkles className="h-3.5 w-3.5 group-hover:animate-pulse" />
                Estudar com Tutor IA
              </Enaflix3DButton>
            )}
          </div>
          <div className="px-4 sm:px-8 lg:px-14 pb-3">
            {query && (
              <p
                className="text-xs text-white/50 opacity-0 animate-text-reveal"
                style={{ animationDelay: "200ms" }}
              >
                {filteredModules.length === 0
                  ? "Nenhum módulo encontrado."
                  : `${filteredModules.length} ${
                      filteredModules.length === 1 ? "módulo" : "módulos"
                    }`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL — começa no topo (y=0), passando por trás da topbar */}
      {isSearching ? (
        <main className="pt-24 pb-20">
          <SearchResultsGrid modules={filteredModules} onNavigate={(m) => handleNavigate(m, "search_result")} />
        </main>
      ) : (
        <main>
          {/* Vitrine cinematográfica rotativa (até 4 destaques) */}
          {isLoading ? (
            <EnaflixBillboardSkeleton />
          ) : billboardSlides.length > 0 ? (
            <EnaflixBillboardRotator
              modules={billboardSlides}
              onNavigate={(m) => handleNavigate(m, "billboard")}
            />
          ) : null}

          {/* Fileiras emergindo do gradiente do billboard — DINÂMICAS & INTELIGENTES */}
          <div className="relative z-10 -mt-20 sm:-mt-28 space-y-12 sm:space-y-16 pb-24">
            {/* Hub Inteligente (Missão + Maestria) */}
            <div className="px-4 sm:px-8 lg:px-14">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card Missão do Dia */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="lg:col-span-1 p-6 rounded-[24px] bg-white/[0.03] border border-white/10 backdrop-blur-md relative overflow-hidden group touch-manipulation"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Sua Missão</h3>
                      </div>
                      {studyNext?.recommendation && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[9px] font-black text-primary">
                          <Sparkles className="h-3 w-3" />
                          <span>IA-READY</span>
                        </div>
                      )}
                    </div>
                    
                    {studyNext?.recommendation ? (
                      <div className="space-y-3">
                        <p className="text-xl font-black text-white leading-tight tracking-tight">
                          {studyNext.recommendation.title}
                        </p>
                        <p className="text-sm text-white/50 font-medium line-clamp-2">
                          {studyNext.recommendation.description}
                        </p>
                        <button 
                          onClick={() => {
                            const rec = studyNext.recommendation;
                            const route = rec.type === 'review' ? '/dashboard/sessao-estudo' : 
                                         rec.type === 'mnemonic' ? '/dashboard/mnemonic-studio' :
                                         rec.type === 'error_review' ? '/dashboard/banco-erros' :
                                         rec.type === 'image_quiz' ? '/dashboard/image-quiz' : '/dashboard/sessao-estudo';
                            
                            void emitShadowEvent({
                              module: "enaflix",
                              event: "watch_started",
                              topic: "mission_card",
                              extra: { action: "cta_click", title: rec.title, destination: route }
                            });
                            navigate(route);
                          }}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_-5px_rgba(var(--primary),0.4)]"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          <span>Retomar Estudo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                          <Brain className="h-6 w-6 text-white/20" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Sincronizando Cognição...</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Card Maestria Médica (Resumo) */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="lg:col-span-2 p-6 rounded-[24px] bg-white/[0.03] border border-white/10 backdrop-blur-md relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-white/90">Evolução Cognitiva</h3>
                      </div>
                      <button 
                        onClick={() => navigate("/dashboard/analytics")}
                        className="text-[10px] font-bold text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        VER DETALHES <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    <Suspense fallback={<div className="h-40 animate-pulse bg-white/5 rounded-xl" />}>
                      <div className="max-h-[160px] overflow-hidden">
                        <MedicalMasteryDashboard />
                      </div>
                    </Suspense>
                  </div>
                </motion.div>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-12">
                <EnaflixRowSkeleton />
                <EnaflixRowSkeleton />
              </div>
            ) : (
              (() => {
                if (isLoadingPersonalized && personalizedRows === undefined) {
                  return (
                    <div className="space-y-12">
                      <EnaflixRowSkeleton />
                      <EnaflixRowSkeleton />
                    </div>
                  );
                }
                const rows: React.ReactNode[] = [];

                // 1. PLANO DE HOJE (Alta Prioridade)
                if (personalizedRows?.dailyPlan) {
                  const dp = personalizedRows.dailyPlan;
                  rows.push(
                    <EnaflixRow key="daily-plan-row" title="Seu Plano de Hoje">
                      <EnaflixDynamicCard
                        title="Plano Diário ACE"
                        subtitle={dp.tasks.join(", ")}
                        description={`Próximo passo: ${dp.nextAction}`}
                        progress={dp.progressPercent}
                        badge="META DO DIA"
                        footerInfo={`${dp.estimatedMinutes} min estimados`}
                        ctaText="Continuar Plano"
                        accent="primary"
                        onClick={() => {
                          void emitShadowEvent({
                            module: "enaflix",
                            event: "watch_started",
                            topic: "daily_plan",
                            extra: { action: "cta_click", destination: "/dashboard/sessao-estudo" }
                          });
                          navigate("/dashboard/sessao-estudo");
                        }}
                      />
                      {/* Sub-cards para o plano se houver muitos temas */}
                      {dp.tasks.slice(0, 3).map((task, i) => (
                        <EnaflixDynamicCard
                          key={`task-${i}`}
                          title={task}
                          subtitle="Foco em subtema"
                          ctaText="Iniciar"
                          accent="info"
                          onClick={() => {
                            void emitShadowEvent({
                              module: "enaflix",
                              event: "watch_started",
                              topic: `daily_task_${i}`,
                              extra: { action: "task_click", title: task }
                            });
                            navigate("/dashboard/sessao-estudo");
                          }}
                        />
                      ))}
                    </EnaflixRow>
                  );
                }

                // 2. FLASHCARDS PENDENTES (Vencidos FSRS)
                if (personalizedRows?.flashcards) {
                  const fc = personalizedRows.flashcards;
                  rows.push(
                    <EnaflixRow key="flashcards-due-row" title="Flashcards Pendentes">
                      <EnaflixDynamicCard
                        title={`${fc.totalDue} Cards para revisar`}
                        subtitle={fc.mainTopic}
                        description="Repetição espaçada: o algoritmo detectou risco de esquecimento."
                        badge="URGENTE"
                        accent={fc.urgency === "alta" ? "destructive" : "warning"}
                        ctaText="Revisar Agora"
                        footerInfo="FSRS v5.0"
                        onClick={() => {
                          void emitShadowEvent({
                            module: "enaflix",
                            event: "watch_started",
                            topic: "flashcards_due",
                            extra: { action: "cta_click", count: fc.totalDue }
                          });
                          navigate("/dashboard/flashcards");
                        }}
                      />
                      {/* Sugerir mnemônicos como alternativa de reforço */}
                      <EnaflixDynamicCard
                        title="Reforço com Mnemônicos"
                        subtitle="Memorização Visual"
                        description="Crie associações visuais para temas difíceis."
                        ctaText="Explorar Studio"
                        accent="purple"
                        onClick={() => {
                          void emitShadowEvent({
                            module: "enaflix",
                            event: "watch_started",
                            topic: "mnemonic_studio_upsell",
                            extra: { action: "cta_click" }
                          });
                          navigate("/dashboard/mnemonic-studio");
                        }}
                      />
                    </EnaflixRow>
                  );
                }

                // 3. MISSÕES DO TUTOR IA (Guias Pedagógicos)
                if (personalizedRows?.tutorMissions && personalizedRows.tutorMissions.length > 0) {
                  rows.push(
                    <EnaflixRow key="tutor-missions-row" title="Missões do Tutor IA">
                      {personalizedRows.tutorMissions.map((mission) => (
                        <EnaflixDynamicCard
                          key={mission.missionId}
                          title={mission.missionTitle}
                          subtitle={mission.criticalTopic}
                          description={mission.justification}
                          badge="IA RECOMENDOU"
                          accent="purple"
                          ctaText="Começar Missão"
                          onClick={() => {
                            void emitShadowEvent({
                              module: "enaflix",
                              event: "watch_started",
                              topic: "tutor_mission",
                              extra: { action: "cta_click", title: mission.missionTitle }
                            });
                            navigate("/dashboard/mentor");
                          }}
                        />
                      ))}
                    </EnaflixRow>
                  );
                }

                // 4. QUESTÕES QUE MAIS CAEM (High Yield)
                if (personalizedRows?.highYieldTopics && personalizedRows.highYieldTopics.length > 0) {
                  rows.push(
                    <EnaflixRow key="high-yield-row" title="Questões que Mais Caem">
                      {personalizedRows.highYieldTopics.map((hy, i) => (
                        <EnaflixDynamicCard
                          key={`hy-${i}`}
                          title={hy.topic}
                          subtitle={`Frequência: ${Math.round(hy.frequencyScore)}% • ${hy.exam}`}
                          description={`Seu desempenho: ${Math.round(hy.userPerformance)}%`}
                          badge="HIGH YIELD"
                          accent={hy.userPerformance < 60 ? "destructive" : "info"}
                          ctaText="Treinar Questões"
                          footerInfo="CME Performance"
                          onClick={() => {
                            void emitShadowEvent({
                              module: "enaflix",
                              event: "watch_started",
                              topic: "high_yield_topic",
                              extra: { action: "cta_click", title: hy.topic }
                            });
                            navigate("/dashboard/simulados");
                          }}
                        />
                      ))}
                    </EnaflixRow>
                  );
                }

                // 5. CONTINUAR ESTUDANDO (Higiene de fluxo)
                if (continueModules.length > 0 || continueLessons.length > 0) {
                  rows.push(
                    <div key="continue-container" className="space-y-8">
                      {continueModules.length > 0 && (
                        <EnaflixSectionRow
                          key="continue"
                          title="Continuar de onde parou"
                          subtitle="Módulos e ferramentas que você estava usando recentemente"
                          modules={continueModules}
                          onNavigate={handleNavigate}
                        />
                      )}
                      {continueLessons.length > 0 && (
                        <EnaflixSectionRowVideo
                          key="continue-lessons"
                          title="Continuar Assistindo"
                          subtitle="Suas videoaulas IA em andamento"
                          lessons={continueLessons}
                        />
                      )}
                    </div>
                  );
                }

                // 6. MAIS COBRADOS NO ENARE (Estratégico)
                const enareModules = visibleModules.filter(m => 
                  m.keywords?.some(k => ["enare", "mais-cobrados", "usp"].includes(k)) || m.id === "simulados"
                );
                if (enareModules.length > 0) {
                  rows.push(
                    <EnaflixSectionRow
                      key="enare-high-yield"
                      title="Ranking Estratégico ENARE"
                      subtitle="Os temas que garantem sua aprovação nas grandes bancas"
                      modules={enareModules}
                      onNavigate={handleNavigate}
                    />
                  );
                }

                // 7. VIDEOAULAS IA (Conteúdo Principal)
                if (aiLessons && aiLessons.length > 0) {
                  rows.push(
                    <EnaflixSectionRowVideo
                      key="ai-videoaulas"
                      title="Videoaulas IA (CME)"
                      subtitle="Conteúdo médico cinematográfico personalizado para o seu nível"
                      lessons={aiLessons}
                    />
                  );
                }

                // 8. SIMULADOS RECOMENDADOS
                const simuladoModules = visibleModules.filter(m => 
                  ["simulados", "diagnostico", "predictor", "prova-pratica"].includes(m.id)
                );
                if (simuladoModules.length > 0) {
                  rows.push(
                    <EnaflixSectionRow
                      key="simulados-rec"
                      title="Simulados Recomendados"
                      subtitle="Avalie seu desempenho em ambiente real de prova"
                      modules={simuladoModules}
                      onNavigate={handleNavigate}
                    />
                  );
                }

                // 9. RECOMENDADOS PELA IA (Exploração)
                if (recommendedModules.length > 0 && rows.length < 12) {
                  rows.push(
                    <EnaflixSectionRow
                      key="recommended"
                      title="Recomendados para você"
                      subtitle="Sugestões inteligentes baseadas no seu perfil de estudo"
                      modules={recommendedModules}
                      onNavigate={handleNavigate}
                    />,
                  );
                }

                // 10. CATEGORIAS PADRÃO (Fallback)
                const rotatable = ENAFLIX_CATEGORIES.filter((c) => {
                  if (c.dynamic) return false;
                  if (c.requires === "admin" && !isAdmin) return false;
                  if (c.requires === "professor" && !isProfessor && !isAdmin) return false;
                  return true;
                });

                rotatable.forEach((cat) => {
                  const items = visibleModules.filter((m) => m.category === cat.id);
                  if (items.length > 0 && rows.length < 15) {
                    rows.push(
                      <EnaflixSectionRow
                        key={cat.id}
                        title={cat.title}
                        subtitle={cat.subtitle}
                        modules={items}
                        onNavigate={handleNavigate}
                      />,
                    );
                  }
                });

                return rows;
              })()
            )}

            {!isLoading && (
              <div className="px-4 sm:px-8 lg:px-14 pt-2">
                <button
                  type="button"
                  onClick={handleShowAllModules}
                  className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors rounded-full px-4 py-2 hover:bg-white/[0.06] border border-white/10 hover:border-white/20"
                >
                  <span>Ver todos os módulos</span>
                  <span aria-hidden>→</span>
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Mascot Integration */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-3 pointer-events-none scale-90 sm:scale-100 origin-bottom-right">
        <MascotBubble speech={mascotSpeech} />
        <div className="pointer-events-auto">
          <MascotAvatar state={mascotState} size="lg" />
        </div>
      </div>
    </div>
  );
}

function SearchResultsGrid({
  modules,
  onNavigate,
}: {
  modules: EnaflixModule[];
  onNavigate: (m: EnaflixModule) => void;
}) {
  if (!modules.length) {
    return (
      <div className="px-4 sm:px-8 lg:px-14 py-16 text-center">
        <p className="text-white/60 text-sm">
          Nada encontrado. Tente outro termo (ex: "flashcards", "anamnese", "ECG").
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 sm:px-8 lg:px-14">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-4">
        {modules.map((m) => (
          <EnaflixModuleCard key={m.id} module={m} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
