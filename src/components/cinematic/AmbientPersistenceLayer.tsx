import * as React from "react";
import { useModuleAtmosphere } from "./useModuleAtmosphere";
import { AmbientAtmosphere } from "./AmbientAtmosphere";
import type { CinematicModule } from "./CinematicCard";

/**
 * AmbientPersistenceLayer — camada de atmosfera global persistente.
 *
 * Renderiza um background atmosférico contínuo que cobre toda a viewport,
 * abaixo de toda a UI (z-index 0). Quando o usuário muda de módulo,
 * a camada faz cross-dissolve do hue antigo para o novo (não há "reset" brusco).
 *
 * Como funciona:
 *  - escutamos a rota via useModuleAtmosphere()
 *  - mantemos `currentModule` e `previousModule`
 *  - durante TRANSITION_MS, ambos coexistem (o anterior some, o novo entra)
 *  - depois, só o novo permanece
 *
 * Importante: a UI da app deve ter `position: relative` e z-index >= 1 para ficar
 * acima dessa camada. Os layouts já usam containers padrão, então não há conflito.
 */
const TRANSITION_MS = 1200;

export const AmbientPersistenceLayer: React.FC = () => {
  const activeModule = useModuleAtmosphere();
  const [current, setCurrent] = React.useState<CinematicModule>(activeModule);
  const [previous, setPrevious] = React.useState<CinematicModule | null>(null);

  React.useEffect(() => {
    if (activeModule === current) return;
    setPrevious(current);
    setCurrent(activeModule);
    const t = window.setTimeout(() => setPrevious(null), TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [activeModule, current]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Camada anterior — desaparece suavemente */}
      {previous && (
        <div
          key={`prev-${previous}`}
          className="absolute inset-0 transition-opacity [transition-duration:1200ms] ease-out"
          style={{ opacity: 0 }}
          ref={(el) => {
            // Fade-out: começa em 1, vai para 0 no próximo frame
            if (el) {
              el.style.opacity = "1";
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  el.style.opacity = "0";
                });
              });
            }
          }}
        >
          <AmbientAtmosphere
            module={previous}
            coverage="full"
            intensity="soft"
          />
        </div>
      )}

      {/* Camada atual — entra suavemente */}
      <div
        key={`curr-${current}`}
        className="absolute inset-0 transition-opacity [transition-duration:1200ms] ease-out"
        style={{ opacity: 0 }}
        ref={(el) => {
          if (el) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.style.opacity = "1";
              });
            });
          }
        }}
      >
        <AmbientAtmosphere
          module={current}
          coverage="full"
          intensity="soft"
        />
      </div>
    </div>
  );
};
