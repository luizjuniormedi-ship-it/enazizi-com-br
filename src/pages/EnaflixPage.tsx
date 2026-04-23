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
import { useNavigate } from "react-router-dom";

import { ENAFLIX_MODULES, type EnaflixModule } from "@/data/enaflix/enaflixModules";
import { ENAFLIX_CATEGORIES } from "@/data/enaflix/enaflixCategories";
import { EnaflixOverlayNav } from "@/components/enaflix/EnaflixOverlayNav";
import { EnaflixBillboard } from "@/components/enaflix/EnaflixBillboard";
import { EnaflixSectionRow } from "@/components/enaflix/EnaflixSectionRow";
import { EnaflixModuleCard } from "@/components/enaflix/EnaflixModuleCard";
import { EnaflixSearchBar } from "@/components/enaflix/EnaflixSearchBar";
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

  // Pick para o billboard: primeiro item recente OU primeiro recomendado OU sessão de estudo
  const billboardModule = useMemo<EnaflixModule | undefined>(() => {
    return (
      continueModules[0] ??
      recommendedModules[0] ??
      visibleModules.find((m) => m.id === "sessao-estudo") ??
      visibleModules[0]
    );
  }, [continueModules, recommendedModules, visibleModules]);

  const billboardEyebrow = useMemo(() => {
    if (continueModules[0]) return "Continuar de onde parou";
    if (recommendedModules[0]) return "Recomendado pela IA";
    return "Em destaque hoje";
  }, [continueModules, recommendedModules]);

  const handleNavigate = useCallback(
    (m: EnaflixModule) => {
      recordVisit(m.id);
    },
    [recordVisit],
  );

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
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
          {/* Hero billboard cinematográfico (full-bleed, começa em y=0) */}
          {billboardModule && (
            <EnaflixBillboard
              module={billboardModule}
              eyebrow={billboardEyebrow}
              onNavigate={handleNavigate}
            />
          )}

          {/* Fileiras emergindo do gradiente do billboard — MÁXIMO 4 */}
          <div className="relative z-10 -mt-20 sm:-mt-28 space-y-10 sm:space-y-12 pb-24">
            {(() => {
              // Curadoria: no máximo 4 fileiras visíveis para preservar foco.
              // Prioridade: Continuar → Recomendados IA → Mais usados → 1 categoria rotativa.
              const rows: React.ReactNode[] = [];

              if (continueModules.length > 0) {
                rows.push(
                  <EnaflixSectionRow
                    key="continue"
                    title="Continuar de onde parou"
                    subtitle="Retome sua jornada"
                    modules={continueModules}
                    onNavigate={handleNavigate}
                  />,
                );
              }

              if (recommendedModules.length > 0 && rows.length < 4) {
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

              if (popularModules.length > 1 && rows.length < 4) {
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

              // 1 categoria rotativa (rotaciona por dia da semana para variar a descoberta)
              if (rows.length < 4) {
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
            })()}

            {/* CTA "Ver tudo" — descobertas além das 4 fileiras curadas */}
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
