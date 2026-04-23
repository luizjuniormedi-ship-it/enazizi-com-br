import { EnaflixMascot } from "./EnaflixMascot";
import { EnaflixSearchBar } from "./EnaflixSearchBar";

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  resultCount?: number;
}

export function EnaflixHero({ query, onQueryChange, resultCount }: Props) {
  return (
    <div className="relative overflow-hidden">
      {/* Background cinematic */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-primary/20 via-violet-500/5 to-transparent"
      />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-[80%] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl pointer-events-none"
      />

      <div className="relative px-4 sm:px-6 lg:px-10 pt-8 pb-6 sm:pt-12 sm:pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <EnaflixMascot />
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-primary via-violet-400 to-pink-400 bg-clip-text text-transparent leading-none">
              ENAFLIX
            </h1>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              O streaming inteligente do seu estudo médico.
            </p>
          </div>
        </div>

        <EnaflixSearchBar
          value={query}
          onChange={onQueryChange}
          placeholder="Buscar simulados, flashcards, anamnese..."
          autoFocus
        />

        {query && (
          <p className="text-xs text-white/50 animate-fade-in">
            {resultCount === 0
              ? "Nenhum módulo encontrado."
              : `${resultCount} ${resultCount === 1 ? "módulo encontrado" : "módulos encontrados"}.`}
          </p>
        )}
      </div>
    </div>
  );
}
