/**
 * Mapeia ids de módulos do ENAFLIX para suas ilustrações hero (3D cartoon premium).
 *
 * Estilo unificado: Pixar/Disney 3D + glow médico + dark streaming (#0a0a12).
 * Cada arte foi gerada com paleta cyan/violeta para identidade consistente,
 * com acentos pontuais (vermelho ER, dourado conquista) onde apropriado.
 *
 * Módulos sem entrada caem no fallback de ícone Lucide com gradiente accent.
 */
import mascot from "@/assets/enaflix/mascot-enazizi.png";
import tutorIA from "@/assets/enaflix/hero-tutor-ia.png";
import simulados from "@/assets/enaflix/hero-simulados.png";
import bancoErros from "@/assets/enaflix/hero-banco-erros.png";
import plantao from "@/assets/enaflix/hero-plantao.png";
import mnemonico from "@/assets/enaflix/hero-mnemonico.png";
import anamnese from "@/assets/enaflix/hero-anamnese.png";
import flashcards from "@/assets/enaflix/hero-flashcards.png";
import conquistas from "@/assets/enaflix/hero-conquistas.png";
import mapaDominio from "@/assets/enaflix/hero-mapa-dominio.png";
import fsrs from "@/assets/enaflix/hero-fsrs.png";
import casosClinicos from "@/assets/enaflix/hero-casos-clinicos.png";
import radar from "@/assets/enaflix/hero-radar.png";
import dashboard from "@/assets/enaflix/hero-dashboard.png";
import aprovacao from "@/assets/enaflix/hero-aprovacao.png";
import professor from "@/assets/enaflix/hero-professor.png";
import admin from "@/assets/enaflix/hero-admin.png";
import planner from "@/assets/enaflix/hero-planner.png";
import osce from "@/assets/enaflix/hero-osce.png";

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
 * Vários módulos compartilham a mesma arte quando o conceito visual é equivalente
 * (ex.: dashboard ↔ analytics; conquistas ↔ rankings).
 */
export const ENAFLIX_HERO_ART_MAP: Record<string, EnaflixArtEntry> = {
  // ─── Conteúdo & IA ───
  chatgpt: { image: tutorIA, accent: "primary", animationProfile: "breathe" },
  agentes: { image: tutorIA, accent: "purple", animationProfile: "breathe" },

  // ─── Avaliação ───
  simulados: { image: simulados, accent: "primary", animationProfile: "breathe" },
  diagnostico: { image: simulados, accent: "info", animationProfile: "float" },
  discursivas: { image: simulados, accent: "purple", animationProfile: "float" },
  "prova-pratica": { image: osce, accent: "destructive", animationProfile: "breathe" },
  predictor: { image: aprovacao, accent: "info", animationProfile: "breathe" },

  // ─── Treino & Revisão ───
  "sessao-estudo": { image: tutorIA, accent: "primary", animationProfile: "breathe" },
  flashcards: { image: flashcards, accent: "warning", animationProfile: "orbit-slow" },
  "gerar-flashcards": { image: flashcards, accent: "purple", animationProfile: "orbit-slow" },
  "banco-erros": { image: bancoErros, accent: "destructive", animationProfile: "breathe" },
  mnemonico: { image: mnemonico, accent: "pink", animationProfile: "breathe" },
  "mapas-mentais": { image: fsrs, accent: "info", animationProfile: "breathe" },
  questoes: { image: simulados, accent: "purple", animationProfile: "float" },

  // ─── Clínica & Simulação ───
  anamnese: { image: anamnese, accent: "primary", animationProfile: "breathe" },
  plantao: { image: plantao, accent: "destructive", animationProfile: "pulse-soft" },
  cronicas: { image: casosClinicos, accent: "warning", animationProfile: "breathe" },
  "image-quiz": { image: casosClinicos, accent: "info", animationProfile: "breathe" },
  entrevista: { image: anamnese, accent: "purple", animationProfile: "breathe" },

  // ─── Conteúdo & Estudo ───
  apostilas: { image: dashboard, accent: "primary", animationProfile: "float" },
  revisor: { image: bancoErros, accent: "success", animationProfile: "breathe" },

  // ─── Progresso & Estratégia ───
  dashboard: { image: dashboard, accent: "primary", animationProfile: "breathe" },
  planner: { image: planner, accent: "info", animationProfile: "float" },
  analytics: { image: dashboard, accent: "purple", animationProfile: "breathe" },
  radar: { image: radar, accent: "info", animationProfile: "orbit-slow" },
  "mapa-dominio": { image: mapaDominio, accent: "success", animationProfile: "breathe" },
  proficiencia: { image: aprovacao, accent: "warning", animationProfile: "breathe" },

  // ─── Gamificação ───
  conquistas: { image: conquistas, accent: "warning", animationProfile: "breathe" },
  rankings: { image: conquistas, accent: "warning", animationProfile: "breathe" },
  missao: { image: aprovacao, accent: "destructive", animationProfile: "pulse-soft" },

  // ─── Ferramentas ───
  perfil: { image: dashboard, accent: "primary", animationProfile: "breathe" },

  // ─── Professor ───
  professor: { image: professor, accent: "primary", animationProfile: "breathe" },

  // ─── Administração ───
  admin: { image: admin, accent: "destructive", animationProfile: "pulse-soft" },
  "admin-monitoring": { image: admin, accent: "info", animationProfile: "pulse-soft" },
  "admin-classifier": { image: admin, accent: "success", animationProfile: "pulse-soft" },
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
