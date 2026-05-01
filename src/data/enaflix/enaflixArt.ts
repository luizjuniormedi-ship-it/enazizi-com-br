/**
 * Mapeia ids de módulos do ENAFLIX para suas ilustrações hero (3D Pixar/Disney).
 *
 * V3 — IDENTIDADE 1:1 POR MÓDULO:
 * Cada módulo agora tem sua PRÓPRIA arte cinematográfica única. Eliminada
 * qualquer reutilização entre módulos — o catálogo agora parece um streaming
 * com uma "franquia visual" diferente para cada item.
 *
 * Estilo unificado: Pixar/Disney 3D + iluminação volumétrica + dark streaming
 * (#0a0a12). Paletas variam por módulo seguindo a brief Disney+/Netflix.
 */
import mascot from "@/assets/enaflix/mascot-enazizi.png";

// ─── V2 cinematic artworks (artes hero originais) ───
import tutorIA from "@/assets/enaflix/v2-tutor-ia.jpg";
import videoaulas from "@/assets/enaflix/v2-sessao-estudo.jpg"; // Reutilizando arte de sessão por enquanto
import flashcards from "@/assets/enaflix/v2-flashcards.jpg";
import simulados from "@/assets/enaflix/v2-simulados.jpg";
import aprovacao from "@/assets/enaflix/v2-aprovacao.jpg";
import mapaDominio from "@/assets/enaflix/v2-mapa-dominio.jpg";
import sessaoEstudo from "@/assets/enaflix/v2-sessao-estudo.jpg";
import apostilas from "@/assets/enaflix/v2-apostilas.jpg";
import plantao from "@/assets/enaflix/v2-plantao.jpg";
import classificador from "@/assets/enaflix/v2-classificador.jpg";

// ─── V3 artes únicas (uma por módulo) ───
import agentes from "@/assets/enaflix/v2-agentes.jpg";
import mnemonico from "@/assets/enaflix/v2-mnemonico.jpg";
import mapasMentais from "@/assets/enaflix/v2-mapas-mentais.jpg";
import gerarFlashcards from "@/assets/enaflix/v2-gerar-flashcards.jpg";
import diagnostico from "@/assets/enaflix/v2-diagnostico.jpg";
import discursivas from "@/assets/enaflix/v2-discursivas.jpg";
import questoes from "@/assets/enaflix/v2-questoes.jpg";
import missao from "@/assets/enaflix/v2-missao.jpg";
import radar from "@/assets/enaflix/v2-radar.jpg";
import proficiencia from "@/assets/enaflix/v2-proficiencia.jpg";
import analytics from "@/assets/enaflix/v2-analytics.jpg";
import dashboard from "@/assets/enaflix/v2-dashboard.jpg";
import planner from "@/assets/enaflix/v2-planner.jpg";
import perfil from "@/assets/enaflix/v2-perfil.jpg";
import cronicas from "@/assets/enaflix/v2-cronicas.jpg";
import revisor from "@/assets/enaflix/v2-revisor.jpg";
import anamnese from "@/assets/enaflix/v2-anamnese.jpg";
import provaPratica from "@/assets/enaflix/v2-prova-pratica.jpg";
import entrevista from "@/assets/enaflix/v2-entrevista.jpg";
import imageQuiz from "@/assets/enaflix/v2-image-quiz.jpg";
import bancoErros from "@/assets/enaflix/v2-banco-erros.jpg";
import conquistas from "@/assets/enaflix/v2-conquistas.jpg";
import rankings from "@/assets/enaflix/v2-rankings.jpg";
import professor from "@/assets/enaflix/v2-professor.jpg";
import admin from "@/assets/enaflix/v2-admin.jpg";
import adminMonitoring from "@/assets/enaflix/v2-admin-monitoring.jpg";
import adminCoverage from "@/assets/enaflix/v2-admin-coverage.jpg";
import adminCeo from "@/assets/enaflix/v2-admin-ceo.jpg";

export const ENAFLIX_MASCOT = mascot;

/**
 * Perfis de animação por arte (idle).
 * - "breathe": glow pulsando + float vertical (padrão)
 * - "float": apenas float vertical (objetos compactos)
 * - "orbit-slow": rotação muito lenta + float (artes com elementos orbitais)
 * - "pulse-soft": opacity pulse (sem movimento — para arts já intensas)
 */
export type EnaflixAnimationProfile = "breathe" | "float" | "orbit-slow" | "pulse-soft";

interface EnaflixArtEntry {
  image: string;
  /** Acento de glow ambiente (override do accent do módulo, opcional) */
  accent?: "primary" | "destructive" | "warning" | "success" | "info" | "purple" | "pink";
  /** Perfil de animação idle aplicado ao card */
  animationProfile?: EnaflixAnimationProfile;
}

/**
 * Mapa central de arte por id de módulo. Os ids batem 1:1 com ENAFLIX_MODULES.
 *
 * REGRA V3: cada módulo tem sua PRÓPRIA arte. Sem compartilhamento.
 */
export const ENAFLIX_HERO_ART_MAP: Record<string, EnaflixArtEntry> = {
  // ─── 🧠 IA / TUTOR / AGENTES ───
  chatgpt: { image: tutorIA, accent: "primary", animationProfile: "breathe" },
  agentes: { image: agentes, accent: "purple", animationProfile: "breathe" },

  // ─── 🎴 FLASHCARDS / MEMÓRIA ───
  flashcards: { image: flashcards, accent: "warning", animationProfile: "orbit-slow" },
  "gerar-flashcards": { image: gerarFlashcards, accent: "purple", animationProfile: "breathe" },
  mnemonico: { image: mnemonico, accent: "pink", animationProfile: "breathe" },

  // ─── 🏟️ AVALIAÇÃO ───
  simulados: { image: simulados, accent: "primary", animationProfile: "breathe" },
  diagnostico: { image: diagnostico, accent: "info", animationProfile: "breathe" },
  discursivas: { image: discursivas, accent: "purple", animationProfile: "float" },
  questoes: { image: questoes, accent: "purple", animationProfile: "float" },
  missao: { image: missao, accent: "destructive", animationProfile: "pulse-soft" },

  // ─── 📡 RADAR / PREDIÇÃO ───
  predictor: { image: aprovacao, accent: "info", animationProfile: "breathe" },
  radar: { image: radar, accent: "warning", animationProfile: "orbit-slow" },
  proficiencia: { image: proficiencia, accent: "warning", animationProfile: "breathe" },

  // ─── 🌌 MAPAS / ANALYTICS ───
  "mapa-dominio": { image: mapaDominio, accent: "success", animationProfile: "breathe" },
  "mapas-mentais": { image: mapasMentais, accent: "info", animationProfile: "breathe" },
  analytics: { image: analytics, accent: "purple", animationProfile: "breathe" },

  // ─── 🛋️ ESTUDO / DASHBOARD / PLANNER ───
  "sessao-estudo": { image: sessaoEstudo, accent: "primary", animationProfile: "breathe" },
  dashboard: { image: dashboard, accent: "primary", animationProfile: "breathe" },
  planner: { image: planner, accent: "info", animationProfile: "float" },
  perfil: { image: perfil, accent: "primary", animationProfile: "breathe" },

  // ─── 📚 CONTEÚDO / NARRATIVA ───
  videoaulas: { image: videoaulas, accent: "primary", animationProfile: "breathe" },
  apostilas: { image: apostilas, accent: "warning", animationProfile: "float" },
  cronicas: { image: cronicas, accent: "warning", animationProfile: "breathe" },
  revisor: { image: revisor, accent: "success", animationProfile: "breathe" },

  // ─── 🚨 CLÍNICA / SIMULAÇÃO ───
  plantao: { image: plantao, accent: "destructive", animationProfile: "pulse-soft" },
  "prova-pratica": { image: provaPratica, accent: "destructive", animationProfile: "breathe" },
  anamnese: { image: anamnese, accent: "primary", animationProfile: "breathe" },
  entrevista: { image: entrevista, accent: "purple", animationProfile: "breathe" },
  "image-quiz": { image: imageQuiz, accent: "info", animationProfile: "breathe" },
  "banco-erros": { image: bancoErros, accent: "destructive", animationProfile: "breathe" },

  // ─── 🏆 GAMIFICAÇÃO ───
  conquistas: { image: conquistas, accent: "warning", animationProfile: "breathe" },
  rankings: { image: rankings, accent: "warning", animationProfile: "breathe" },

  // ─── 👨‍🏫 PROFESSOR ───
  professor: { image: professor, accent: "primary", animationProfile: "breathe" },

  // ─── 🛡️ ADMIN ───
  admin: { image: admin, accent: "destructive", animationProfile: "pulse-soft" },
  "admin-monitoring": { image: adminMonitoring, accent: "info", animationProfile: "pulse-soft" },
  "admin-classifier": { image: classificador, accent: "success", animationProfile: "pulse-soft" },
  "admin-coverage": { image: adminCoverage, accent: "purple", animationProfile: "pulse-soft" },
  "admin-ceo": { image: adminCeo, accent: "primary", animationProfile: "pulse-soft" },
};

/** Retorna apenas o caminho da imagem (compatível com versões anteriores). */
export function getHeroArt(moduleId: string): string | undefined {
  return ENAFLIX_HERO_ART_MAP[moduleId]?.image;
}

/** Retorna a entrada completa (imagem + accent + perfil de animação). */
export function getHeroArtEntry(moduleId: string): EnaflixArtEntry | undefined {
  return ENAFLIX_HERO_ART_MAP[moduleId];
}

/**
 * Mantido para retrocompatibilidade — alguns componentes ainda esperam
 * o objeto plano `Record<string, string>`.
 */
export const ENAFLIX_HERO_ART: Record<string, string> = Object.fromEntries(
  Object.entries(ENAFLIX_HERO_ART_MAP).map(([k, v]) => [k, v.image]),
);
