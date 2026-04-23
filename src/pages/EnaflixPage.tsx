/**
 * EnaflixPage — Hub visual fullscreen estilo Netflix do ENAZIZI.
 *
 * Acessível via /enaflix (rota protegida, fora do DashboardLayout para ocupar
 * a tela inteira sem sidebar/topbar).
 *
 * - Categoriza ENAFLIX_MODULES em fileiras horizontais
 * - Adiciona seções dinâmicas (Continuar, Mais usados, Recomendados)
 * - Filtra por busca em tempo real
 * - Respeita roles (admin/professor)
 * - Volta para /dashboard via botão "Voltar"
 */
import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { ENAFLIX_MODULES, type EnaflixModule } from "@/data/enaflix/enaflixModules";
import { ENAFLIX_CATEGORIES } from "@/data/enaflix/enaflixCategories";
import { EnaflixHero } from "@/components/enaflix/EnaflixHero";
import { EnaflixSectionRow } from "@/components/enaflix/EnaflixSectionRow";
import { EnaflixModuleCard } from "@/components/enaflix/EnaflixModuleCard";
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
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { recordVisit, recentIds, popularIds } = useEnaflixUsage();

  // Filtra módulos por role
  const visibleModules = useMemo<EnaflixModule[]>(() => {
    return ENAFLIX_MODULES.filter((m) => {
      if (m.enabled === false) return false;
      if (m.requires === "admin" && !isAdmin) return false;
      if (m.requires === "professor" && !isProfessor && !isAdmin) return false;
      return true;
    });
  }, [isAdmin, isProfessor]);

  // Aplica busca
  const filteredModules = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return visibleModules;
    return visibleModules.filter((m) => {
      const haystack = [
        m.title,
        m.description,
        m.category,
        ...(m.keywords ?? []),
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [visibleModules, query]);

  // Quando há busca, mostramos apenas o grid de resultados (sem fileiras)
  const isSearching = query.trim().length > 0;

  // Mapas auxiliares para seções dinâmicas
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
    // Heurística leve: featured + ainda não muito visitados
    const visitedSet = new Set(popularIds.slice(0, 3));
    return visibleModules.filter((m) => m.featured && !visitedSet.has(m.id)).slice(0, 10);
  }, [visibleModules, popularIds]);

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

  return (
    <div className="min-h-[100dvh] bg-[#0a0a12] text-white relative overflow-x-hidden">
      <Helmet>
        <title>ENAFLIX — Hub visual do ENAZIZI</title>
        <meta
          name="description"
          content="Catálogo visual de todos os módulos do ENAZIZI: simulados, flashcards, mnemônicos, IA, simulações clínicas e mais."
        />
      </Helmet>

      {/* Background ambient */}
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.15),_transparent_60%)] pointer-events-none"
      />
      <div
        aria-hidden
        className="fixed inset-0 bg-[linear-gradient(180deg,_transparent_0%,_#0a0a12_85%)] pointer-events-none"
      />

      {/* Top actions */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-[#0a0a12]/80 border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg px-2 py-1.5 hover:bg-white/5"
            aria-label="Voltar ao modo normal"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao modo normal</span>
            <span className="sm:hidden">Voltar</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Fechar Enaflix"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative z-10">
        <EnaflixHero
          query={query}
          onQueryChange={setQuery}
          resultCount={isSearching ? filteredModules.length : undefined}
        />

        <div className="space-y-8 sm:space-y-10 pb-20 pt-2">
          {isSearching ? (
            <SearchResultsGrid
              modules={filteredModules}
              onNavigate={handleNavigate}
            />
          ) : (
            <>
              {/* Seções dinâmicas */}
              {continueModules.length > 0 && (
                <EnaflixSectionRow
                  title="Continuar de onde parou"
                  subtitle="Retome sua jornada"
                  modules={continueModules}
                  onNavigate={handleNavigate}
                />
              )}
              {popularModules.length > 1 && (
                <EnaflixSectionRow
                  title="Mais usados"
                  subtitle="Os queridinhos do seu dia a dia"
                  modules={popularModules}
                  onNavigate={handleNavigate}
                />
              )}
              {recommendedModules.length > 0 && (
                <EnaflixSectionRow
                  title="Recomendados para você"
                  subtitle="Sugestões inteligentes do ENAZIZI"
                  modules={recommendedModules}
                  onNavigate={handleNavigate}
                />
              )}

              {/* Categorias estáticas */}
              {ENAFLIX_CATEGORIES.filter((c) => !c.dynamic).map((cat) => {
                if (cat.requires === "admin" && !isAdmin) return null;
                if (cat.requires === "professor" && !isProfessor && !isAdmin) return null;
                const items = visibleModules.filter((m) => m.category === cat.id);
                if (items.length < (cat.minItems ?? 1)) return null;
                return (
                  <EnaflixSectionRow
                    key={cat.id}
                    title={cat.title}
                    subtitle={cat.subtitle}
                    modules={items}
                    onNavigate={handleNavigate}
                  />
                );
              })}
            </>
          )}
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
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center">
        <p className="text-white/60 text-sm">
          Nada encontrado. Tente outro termo (ex: "flashcards", "anamnese", "ECG").
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 sm:px-6 lg:px-10">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-4">
        {modules.map((m) => (
          <EnaflixModuleCard key={m.id} module={m} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
