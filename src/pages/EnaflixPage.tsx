/**
 * EnaflixPage — Modo cinematográfico de descoberta inteligente.
 *
 * Estrutura (Netflix/Apple TV style):
 * 1. Topbar OVERLAY flutuante (transparente no topo, sólida ao rolar)
 * 2. Billboard hero full-bleed dominante (recomendação IA)
 * 3. Fileiras horizontais emergindo do gradiente do hero
 * 4. Busca em modo "drawer" sobre tudo (não ocupa espaço fixo)
 *
 * Sem sidebar, sem header sólido, sem caixas administrativas.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

import { ENAFLIX_MODULES, type EnaflixModule } from "@/data/enaflix/enaflixModules";
import { ENAFLIX_CATEGORIES } from "@/data/enaflix/enaflixCategories";
import { EnaflixOverlayNav } from "@/components/enaflix/EnaflixOverlayNav";
import { EnaflixBillboardRotator } from "@/components/enaflix/EnaflixBillboardRotator";
import { EnaflixSectionRow } from "@/components/enaflix/EnaflixSectionRow";
import { EnaflixModuleCard } from "@/components/enaflix/EnaflixModuleCard";
import { EnaflixSectionRowVideo } from "@/components/enaflix/EnaflixSectionRowVideo";
import { EnaflixSearchBar } from "@/components/enaflix/EnaflixSearchBar";
import { EnaflixAmbientParticles } from "@/components/enaflix/EnaflixAmbientParticles";
import { EnaflixBillboardSkeleton } from "@/components/enaflix/EnaflixBillboardSkeleton";
import { EnaflixRowSkeleton } from "@/components/enaflix/EnaflixRowSkeleton";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useEnaflixUsage } from "@/hooks/useEnaflixUsage";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function EnaflixPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { recordVisit, recentIds, popularIds } = useEnaflixUsage();

  const { data: aiLessons, isLoading: isLoadingLessons } = useQuery({
    queryKey: ["enaflix-ai-lessons"],
    queryFn: async () => {
      // Query otimizada: selecionando apenas o necessário e evitando select("*")
      const { data } = await supabase
        .from("ai_video_lessons")
        .select("id, title, thumbnail_url, specialty, is_gold_content, duration_seconds, published_at, status")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(10);

      const { data: memoryData } = await supabase
        .from("tutor_lesson_memory")
        .select("id, title, thumbnail_url, subject, duration, published_at, status, hidden_from_student")
        .eq("status", "published")
        .eq("hidden_from_student", false)
        .order("published_at", { ascending: false })
        .limit(10);

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
    }
  });

  const { data: usageLogs, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["enaflix-video-usage"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("video_lesson_usage_logs")
        .select("video_lesson_id, completion_rate")
        .eq("user_id", user.id);
      return data || [];
    }
  });

  const isLoading = isLoadingLessons || isLoadingUsage;

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
    document.body.style.backgroundColor = "#0a0a12";
    return () => {
      document.title = prev;
      document.body.style.backgroundColor = "";
    };
  }, []);

  const visibleModules = useMemo<EnaflixModule[]>(() => {
    return ENAFLIX_MODULES.filter((m) => {
      if (m.enabled === false) return false;
      if (m.requires === "admin" && !isAdmin) return false;
      if (m.requires === "professor" && !isProfessor && !isAdmin) return false;
      return true;
    });
  }, [isAdmin, isProfessor]);

  const filteredModules = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return visibleModules;
    return visibleModules.filter((m) => {
      const haystack = [m.title, m.description, m.category, ...(m.keywords ?? [])]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [visibleModules, query]);

  const isSearching = query.trim().length > 0;

  const moduleById = useMemo(() => {
    const map = new Map<string, EnaflixModule>();
    visibleModules.forEach((m) => map.set(m.id, m));
    return map;
  }, [visibleModules]);

  const continueModules = useMemo(
    () => recentIds.map((id) => moduleById.get(id)).filter(Boolean) as EnaflixModule[],
    [recentIds, moduleById],
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
  const billboardSlides = useMemo<Array<{ module: EnaflixModule; eyebrow: string }>>(() => {
    const slides: Array<{ module: EnaflixModule; eyebrow: string }> = [];
    const seen = new Set<string>();

    const push = (m: EnaflixModule | undefined, eyebrow: string) => {
      if (!m || seen.has(m.id)) return;
      seen.add(m.id);
      slides.push({ module: m, eyebrow });
    };

    // 1. Continuar de onde parou (se existe)
    push(continueModules[0], "Continuar de onde parou");
    // 2. Recomendação IA
    push(recommendedModules[0], "Recomendado pela IA");
    // 3. Sessão de estudo (centro pedagógico)
    push(
      visibleModules.find((m) => m.id === "sessao-estudo"),
      "Centro pedagógico",
    );
    // 4. Destaque popular (se houver mais de um popular distinto)
    push(popularModules[0], "Mais usado por você");

    // Fallback: se nada acima rendeu nada, pega o primeiro visível
    if (slides.length === 0 && visibleModules[0]) {
      push(visibleModules[0], "Em destaque hoje");
    }

    return slides.slice(0, 4);
  }, [continueModules, recommendedModules, popularModules, visibleModules]);

  const handleNavigate = useCallback(
    (m: EnaflixModule) => {
      recordVisit(m.id);
    },
    [recordVisit],
  );

  const handleClose = () => {
    try {
      sessionStorage.removeItem("enaflix:origin");
      sessionStorage.removeItem("enaflix:lastModule");
    } catch {
      // ignore
    }
    navigate("/dashboard");
  };

  const handleSearchToggle = () => {
    setSearchOpen((v) => {
      const next = !v;
      if (!next) setQuery("");
      return next;
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a12] text-white relative overflow-x-hidden">
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
          className="fixed top-16 inset-x-0 z-40 bg-[#0a0a12]/95 backdrop-blur-xl border-b border-white/5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.85)] animate-drawer-in"
        >
          <div className="px-4 sm:px-8 lg:px-14 py-5">
            <EnaflixSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Buscar simulados, flashcards, anamnese, ECG..."
              autoFocus
            />
            {query && (
              <p
                className="text-xs text-white/50 mt-3 opacity-0 animate-text-reveal"
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
          <SearchResultsGrid modules={filteredModules} onNavigate={handleNavigate} />
        </main>
      ) : (
        <main>
          {/* Vitrine cinematográfica rotativa (até 4 destaques) */}
          {isLoading ? (
            <EnaflixBillboardSkeleton />
          ) : billboardSlides.length > 0 ? (
            <EnaflixBillboardRotator
              modules={billboardSlides}
              onNavigate={handleNavigate}
            />
          ) : null}

          {/* Fileiras emergindo do gradiente do billboard — MÁXIMO 5 */}
          <div className="relative z-10 -mt-20 sm:-mt-28 space-y-10 sm:space-y-12 pb-24">
            {isLoading ? (
              <div className="space-y-12">
                <EnaflixRowSkeleton />
                <EnaflixRowSkeleton />
              </div>
            ) : (
              (() => {
                const rows: React.ReactNode[] = [];

                if (continueModules.length > 0 || continueLessons.length > 0) {
                  rows.push(
                    <div key="continue-container" className="space-y-8">
                      {continueModules.length > 0 && (
                        <EnaflixSectionRow
                          key="continue"
                          title="Continuar de onde parou"
                          subtitle="Módulos e ferramentas que você estava usando"
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

                if (aiLessons && aiLessons.length > 0 && rows.length < 5) {
                  rows.push(
                    <EnaflixSectionRowVideo
                      key="ai-videoaulas"
                      title="Videoaulas IA (CME)"
                      subtitle="Conteúdo médico cinematográfico personalizado"
                      lessons={aiLessons}
                    />
                  );
                }

                if (recommendedModules.length > 0 && rows.length < 5) {
                  rows.push(
                    <EnaflixSectionRow
                      key="recommended"
                      title="Recomendados pela IA"
                      subtitle="Sugestões inteligentes do ENAZIZI"
                      modules={recommendedModules}
                      onNavigate={handleNavigate}
                    />,
                  );
                }

                if (popularModules.length > 1 && rows.length < 5) {
                  rows.push(
                    <EnaflixSectionRow
                      key="popular"
                      title="Mais usados"
                      subtitle="Os queridinhos do seu dia a dia"
                      modules={popularModules}
                      onNavigate={handleNavigate}
                    />,
                  );
                }

                if (rows.length < 5) {
                  const rotatable = ENAFLIX_CATEGORIES.filter((c) => {
                    if (c.dynamic) return false;
                    if (c.requires === "admin" && !isAdmin) return false;
                    if (c.requires === "professor" && !isProfessor && !isAdmin) return false;
                    const items = visibleModules.filter((m) => m.category === c.id);
                    return items.length >= (c.minItems ?? 2);
                  });
                  if (rotatable.length > 0) {
                    const idx = new Date().getDay() % rotatable.length;
                    const cat = rotatable[idx];
                    const items = visibleModules.filter((m) => m.category === cat.id);
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
                }

                return rows;
              })()
            )}

            {!isLoading && (
              <div className="px-4 sm:px-8 lg:px-14 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/enaflix/tudo")}
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
