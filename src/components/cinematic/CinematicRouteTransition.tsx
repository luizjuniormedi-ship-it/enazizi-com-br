import * as React from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { routeToModule } from "./useModuleAtmosphere";
import type { CinematicModule } from "./CinematicCard";

/**
 * CinematicRouteTransition — câmera cinematográfica entre rotas.
 *
 * Princípios:
 *  1. Camera feel — fade + depth (scale + blur leve), não fade simples
 *  2. Module-aware — mudança de módulo tem feeling próprio (mergulho/tensão/calmo)
 *  3. Layered — a atmosfera (AmbientPersistenceLayer) NÃO desmonta. Esta camada
 *     anima apenas o conteúdo. O ambient continua vivo no z-0.
 *  4. Budget rígido — 320–480ms. Nunca lento. Nunca "site animado demais".
 *  5. Route memory — back-navigation tem easing mais sutil (não reseta).
 *  6. Reduced motion — respeitado: vira fade simples e rápido.
 *
 * Uso:
 *   <BrowserRouter>
 *     <AmbientPersistenceLayer />
 *     <CinematicRouteTransition>
 *       <Suspense fallback={<PageLoader />}>
 *         <Routes>...</Routes>
 *       </Suspense>
 *     </CinematicRouteTransition>
 *   </BrowserRouter>
 */

type CubicBezier = [number, number, number, number];

interface TransitionRecipe {
  /** Duração total. */
  duration: number;
  /** Curva de easing tipo câmera física. */
  ease: CubicBezier;
  /** Deslocamento Y inicial (px). */
  yOffset: number;
  /** Escala inicial (0.97 = leve mergulho). */
  scaleFrom: number;
  /** Blur inicial em px (0 desativa). */
  blurFrom: number;
  /** Animação de saída — mais curta e seca. */
  exitDuration: number;
  exitYOffset: number;
  exitScaleTo: number;
}

/**
 * Recipes por "feeling" de transição.
 * - dive   → Dashboard/Hub → Tutor (mergulho neural, profundidade)
 * - tension → → Simulado (entrada com leve tensão/HUD lock)
 * - calm   → Flashcards/Planner (respiração suave)
 * - reveal → → ENAFLIX (cortina cinematográfica)
 * - same   → mesma família (transição mínima)
 * - back   → navegação reversa (sutil, sem reset)
 */
const RECIPES: Record<string, TransitionRecipe> = {
  dive: {
    duration: 0.42,
    ease: [0.16, 1, 0.3, 1], // ease-out-expo
    yOffset: 14,
    scaleFrom: 0.985,
    blurFrom: 6,
    exitDuration: 0.22,
    exitYOffset: -8,
    exitScaleTo: 1.01,
  },
  tension: {
    duration: 0.38,
    ease: [0.65, 0, 0.35, 1], // ease-in-out-quart
    yOffset: 8,
    scaleFrom: 0.99,
    blurFrom: 4,
    exitDuration: 0.2,
    exitYOffset: -4,
    exitScaleTo: 1.005,
  },
  calm: {
    duration: 0.45,
    ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
    yOffset: 10,
    scaleFrom: 0.99,
    blurFrom: 3,
    exitDuration: 0.24,
    exitYOffset: -6,
    exitScaleTo: 1.005,
  },
  reveal: {
    duration: 0.48,
    ease: [0.16, 1, 0.3, 1],
    yOffset: 18,
    scaleFrom: 0.97,
    blurFrom: 8,
    exitDuration: 0.22,
    exitYOffset: -10,
    exitScaleTo: 1.015,
  },
  same: {
    duration: 0.32,
    ease: [0.4, 0, 0.2, 1],
    yOffset: 6,
    scaleFrom: 0.995,
    blurFrom: 2,
    exitDuration: 0.18,
    exitYOffset: -4,
    exitScaleTo: 1.003,
  },
  back: {
    duration: 0.34,
    ease: [0.25, 0.46, 0.45, 0.94],
    yOffset: -6,
    scaleFrom: 1.005,
    blurFrom: 2,
    exitDuration: 0.18,
    exitYOffset: 4,
    exitScaleTo: 0.998,
  },
};

/**
 * Decide qual recipe usar baseado em (módulo origem, módulo destino, direção).
 */
function pickRecipe(
  from: CinematicModule | null,
  to: CinematicModule,
  isBack: boolean,
): TransitionRecipe {
  if (isBack) return RECIPES.back;
  if (from === to) return RECIPES.same;

  // Mergulho cognitivo
  if (to === "tutor") return RECIPES.dive;
  // Tensão competitiva
  if (to === "simulado") return RECIPES.tension;
  // Cortina de vitrine
  if (to === "enaflix") return RECIPES.reveal;
  // Respiração
  if (to === "flashcard" || to === "planner") return RECIPES.calm;
  // Default
  return RECIPES.same;
}

/** Detecta navegação reversa via sessionStorage stack. */
function useNavigationDirection(pathname: string) {
  const stackRef = React.useRef<string[]>([]);
  const [isBack, setIsBack] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("__cinematic_route_stack");
      if (raw) stackRef.current = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    const stack = stackRef.current;
    const prevIdx = stack.lastIndexOf(pathname);
    if (prevIdx >= 0 && prevIdx < stack.length - 1) {
      // Voltou para uma rota já visitada → trim stack
      setIsBack(true);
      stackRef.current = stack.slice(0, prevIdx + 1);
    } else {
      setIsBack(false);
      // Limita stack a 20 entradas
      stackRef.current = [...stack.slice(-19), pathname];
    }
    try {
      sessionStorage.setItem(
        "__cinematic_route_stack",
        JSON.stringify(stackRef.current),
      );
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return isBack;
}

interface CinematicRouteTransitionProps {
  children: React.ReactNode;
}

export const CinematicRouteTransition: React.FC<CinematicRouteTransitionProps> = ({
  children,
}) => {
  const location = useLocation();
  const isBack = useNavigationDirection(location.pathname);
  const previousModuleRef = React.useRef<CinematicModule | null>(null);

  const currentModule = routeToModule(location.pathname);
  const recipe = pickRecipe(previousModuleRef.current, currentModule, isBack);

  React.useEffect(() => {
    previousModuleRef.current = currentModule;
  }, [currentModule]);

  // Respeita prefers-reduced-motion (motion lê do MQ automaticamente nas suas
  // animações; aqui também tornamos a recipe mais conservadora se necessário).
  const prefersReduced = usePrefersReducedMotion();

  const enterTransition: Transition = prefersReduced
    ? { duration: 0.18, ease: "linear" }
    : { duration: recipe.duration, ease: recipe.ease };

  const exitTransition: Transition = prefersReduced
    ? { duration: 0.12, ease: "linear" }
    : { duration: recipe.exitDuration, ease: recipe.ease };

  // Resiliência: se children for nulo, não quebra
  if (!children) return null;

  return (
    <div className="relative z-[1]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={
            prefersReduced
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: recipe.yOffset,
                  scale: recipe.scaleFrom,
                  filter: `blur(${recipe.blurFrom}px)`,
                }
          }
          animate={
            prefersReduced
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          }
          exit={
            prefersReduced
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: recipe.exitYOffset,
                  scale: recipe.exitScaleTo,
                  filter: `blur(${Math.max(2, recipe.blurFrom / 2)}px)`,
                }
          }
          transition={enterTransition}
          style={{ willChange: "transform, opacity, filter" }}
        >
          {/* 
            IMPORTANTE: Evitamos injetar refs diretamente nos children para evitar 
            erros de "Function components cannot be given refs".
            O motion.div acima já garante a transição visual no elemento wrapper.
          */}
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ---------- helpers ---------- */

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefers;
}
