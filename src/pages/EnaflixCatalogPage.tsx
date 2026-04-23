/**
 * EnaflixCatalogPage — catálogo completo do ENAFLIX (acessado via "Ver tudo").
 *
 * Filosofia: o hub principal (/enaflix) mostra apenas 4 fileiras curadas para
 * preservar foco. Quem quiser explorar TUDO vem para cá — grid completo,
 * agrupado por categoria, sem hero, sem motion pesado.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { ENAFLIX_MODULES, type EnaflixModule } from "@/data/enaflix/enaflixModules";
import { ENAFLIX_CATEGORIES } from "@/data/enaflix/enaflixCategories";
import { EnaflixModuleCard } from "@/components/enaflix/EnaflixModuleCard";
import { EnaflixSearchBar } from "@/components/enaflix/EnaflixSearchBar";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useEnaflixUsage } from "@/hooks/useEnaflixUsage";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function EnaflixCatalogPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { recordVisit } = useEnaflixUsage();

  useEffect(() => {
    const prev = document.title;
    document.title = "ENAFLIX — catálogo completo";
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

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return visibleModules;
    return visibleModules.filter((m) => {
      const haystack = [m.title, m.description, m.category, ...(m.keywords ?? [])]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [visibleModules, query]);

  const grouped = useMemo(() => {
    const staticCats = ENAFLIX_CATEGORIES.filter((c) => !c.dynamic);
    return staticCats
      .map((cat) => {
        if (cat.requires === "admin" && !isAdmin) return null;
        if (cat.requires === "professor" && !isProfessor && !isAdmin) return null;
        const items = filtered.filter((m) => m.category === cat.id);
        if (items.length === 0) return null;
        return { cat, items };
      })
      .filter(Boolean) as { cat: (typeof ENAFLIX_CATEGORIES)[number]; items: EnaflixModule[] }[];
  }, [filtered, isAdmin, isProfessor]);

  const handleNavigate = (m: EnaflixModule) => recordVisit(m.id);
  const handleBack = () => navigate("/enaflix");

  return (
    <div className="min-h-[100dvh] bg-[#0a0a12] text-white">
      {/* Topbar sóbria — sem cinematic */}
      <header className="sticky top-0 z-40 bg-[#0a0a12]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 sm:px-8 lg:px-14 h-14 flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors rounded-full px-2.5 py-1.5 hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao hub</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-semibold tracking-[0.18em] text-white/80">
            CATÁLOGO COMPLETO
          </h1>
        </div>
      </header>

      <main className="px-4 sm:px-8 lg:px-14 py-8 space-y-10">
        {/* Busca */}
        <EnaflixSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar em todos os módulos..."
        />

        {filtered.length === 0 && (
          <p className="text-center text-white/50 text-sm py-16">
            Nada encontrado para "{query}".
          </p>
        )}

        {/* Grupos */}
        {grouped.map(({ cat, items }) => (
          <section key={cat.id} className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{cat.title}</h2>
              {cat.subtitle && (
                <p className="text-xs text-white/50 mt-0.5">{cat.subtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-4">
              {items.map((m) => (
                <EnaflixModuleCard key={m.id} module={m} onNavigate={handleNavigate} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
