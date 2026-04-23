import { useLocation } from "react-router-dom";
import type { CinematicModule } from "./CinematicCard";

/**
 * Mapeia rotas para o módulo cinematográfico ativo.
 * Usado pelo AmbientPersistenceLayer para escolher hue/atmosfera.
 */
export function routeToModule(pathname: string): CinematicModule {
  const p = pathname.toLowerCase();

  // Tutor / IA / Mentor / ChatGPT / Sessão de Estudo (centro pedagógico)
  if (
    p.includes("/tutor") ||
    p.includes("/mentor") ||
    p.includes("/chatgpt") ||
    p.includes("/sessao-estudo") ||
    p.includes("/study/tutor") ||
    p.includes("/coach") ||
    p.includes("/revisor") ||
    p.includes("/entrevista") ||
    p.includes("/anamnese") ||
    p.includes("/agentes")
  ) {
    return "tutor";
  }

  // ENAFLIX (streaming/catalog)
  if (p.includes("/enaflix")) return "enaflix";

  // Simulados / Prova / Mission / Diagnóstico / Discursivas / Plantão
  if (
    p.includes("/simulado") ||
    p.includes("/prova") ||
    p.includes("/mission") ||
    p.includes("/diagnostico") ||
    p.includes("/discursivas") ||
    p.includes("/plantao") ||
    p.includes("/simulacao-clinica") ||
    p.includes("/proficiencia") ||
    p.includes("/study/simulado") ||
    p.includes("/study/clinical") ||
    p.includes("/study/anamnese")
  ) {
    return "simulado";
  }

  // Flashcards / Mnemônico / Mapas / Image quiz / Cronicas
  if (
    p.includes("/flashcard") ||
    p.includes("/mnemonic") ||
    p.includes("/mnemonico") ||
    p.includes("/mapas-mentais") ||
    p.includes("/image-quiz") ||
    p.includes("/cronicas") ||
    p.includes("/study/flashcards")
  ) {
    return "flashcard";
  }

  // Analytics / Métricas / Predictor / Banco de erros / Mapa domínio / Radar
  if (
    p.includes("/analytics") ||
    p.includes("/metrics") ||
    p.includes("/predictor") ||
    p.includes("/banco-erros") ||
    p.includes("/mapa-dominio") ||
    p.includes("/radar")
  ) {
    return "analytics";
  }

  // Planner / Cronograma / Plano dia
  if (p.includes("/planner") || p.includes("/cronograma") || p.includes("/plano-dia")) {
    return "planner";
  }

  // Professor / Mentoria
  if (p.includes("/professor")) return "professor";

  // Admin / Institucional
  if (p.includes("/admin") || p.includes("/institucional")) return "admin";

  // Ranking / Conquistas
  if (p.includes("/ranking") || p.includes("/conquistas")) return "ranking";

  // Default — Dashboard / Perfil / Uploads / Index
  return "dashboard";
}

export function useModuleAtmosphere(): CinematicModule {
  const { pathname } = useLocation();
  return routeToModule(pathname);
}
