import * as React from "react";
import { CinematicPageLoader } from "./CinematicPageLoader";
import type { CinematicModule } from "./CinematicCard";

interface CinematicSuspenseProps {
  /** Identidade do módulo para tonalidade do loader. */
  module?: CinematicModule;
  /** Variante de fallback. */
  variant?: "default" | "minimal" | "session";
  /** Texto opcional sob o loader. */
  hint?: string;
  /** Conteúdo a ser carregado preguiçosamente. */
  children: React.ReactNode;
  /** Override de fallback (opcional). */
  fallback?: React.ReactNode;
}

/**
 * CinematicSuspense — wrapper opcional para Suspense com loading premium.
 * Usa CinematicPageLoader como fallback padrão.
 *
 * Exemplo:
 *   <CinematicSuspense module="tutor" hint="Preparando o mentor…">
 *     <TutorPage />
 *   </CinematicSuspense>
 */
export const CinematicSuspense: React.FC<CinematicSuspenseProps> = ({
  module,
  variant,
  hint,
  fallback,
  children,
}) => {
  return (
    <React.Suspense
      fallback={
        fallback ?? <CinematicPageLoader module={module} variant={variant} hint={hint} />
      }
    >
      {children}
    </React.Suspense>
  );
};
