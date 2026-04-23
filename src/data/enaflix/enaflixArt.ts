/**
 * Mapeia ids de módulos do ENAFLIX para suas ilustrações hero (3D Pixar/Disney).
 *
 * V2 — REDESIGN CINEMATOGRÁFICO:
 * Cada categoria conceitual tem identidade VISUAL ÚNICA (composição, paleta,
 * perspectiva e cenário próprios). Não usamos mais a mesma arte em 4 cards
 * diferentes. A redundância está distribuída só por equivalência REAL de conceito
 * (ex.: dashboard ↔ analytics ambos usam o cockpit; conquistas ↔ rankings
 * ambos usam o pódio porque conceitualmente são gamificação de ranking).
 *
 * Estilo unificado: Pixar/Disney 3D + iluminação volumétrica + dark streaming
 * (#0a0a12). Paletas variam por módulo seguindo a brief Disney+/Netflix.
 *
 * Módulos sem entrada caem no fallback de ícone Lucide com gradiente accent.
 */
import mascot from "@/assets/enaflix/mascot-enazizi.png";

// ─── V2 cinematic artworks (9 únicas) ───
import tutorIA from "@/assets/enaflix/v2-tutor-ia.jpg";
import flashcards from "@/assets/enaflix/v2-flashcards.jpg";
import simulados from "@/assets/enaflix/v2-simulados.jpg";
import aprovacao from "@/assets/enaflix/v2-aprovacao.jpg";
import mapaDominio from "@/assets/enaflix/v2-mapa-dominio.jpg";
import sessaoEstudo from "@/assets/enaflix/v2-sessao-estudo.jpg";
import apostilas from "@/assets/enaflix/v2-apostilas.jpg";
import plantao from "@/assets/enaflix/v2-plantao.jpg";
import classificador from "@/assets/enaflix/v2-classificador.jpg";

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
 * REGRA DE OURO: artes só são compartilhadas quando os MÓDULOS são CONCEITUALMENTE
 * EQUIVALENTES (ex.: tutor IA / agentes / sessão de estudo todos têm o mesmo
 * "personagem mentor IA"; conquistas / rankings ambos pódio).
 */
export const ENAFLIX_HERO_ART_MAP: Record<string, EnaflixArtEntry> = {
  // ─── 🧠 IA TUTOR FAMILY (mentor holográfico) ───
  chatgpt: { image: tutorIA, accent: "primary", animationProfile: "breathe" },
  agentes: { image: tutorIA, accent: "purple", animationProfile: "breathe" },

  // ─── 🎴 FLASHCARDS FAMILY (cartas mágicas com aurora) ───
  flashcards: { image: flashcards, accent: "warning", animationProfile: "orbit-slow" },
  "gerar-flashcards": { image: flashcards, accent: "purple", animationProfile: "orbit-slow" },
  mnemonico: { image: flashcards, accent: "pink", animationProfile: "breathe" },

  // ─── 🏟️ ARENA FAMILY (coliseu cinematográfico) ───
  simulados: { image: simulados, accent: "primary", animationProfile: "breathe" },
  diagnostico: { image: simulados, accent: "info", animationProfile: "float" },
  discursivas: { image: simulados, accent: "purple", animationProfile: "float" },
  questoes: { image: simulados, accent: "purple", animationProfile: "float" },
  missao: { image: simulados, accent: "destructive", animationProfile: "pulse-soft" },

  // ─── 📡 RADAR FAMILY (cockpit preditivo) ───
  predictor: { image: aprovacao, accent: "info", animationProfile: "breathe" },
  radar: { image: aprovacao, accent: "info", animationProfile: "orbit-slow" },
  proficiencia: { image: aprovacao, accent: "warning", animationProfile: "breathe" },

  // ─── 🌌 PLANETA CEREBRAL FAMILY (mapa neural cósmico) ───
  "mapa-dominio": { image: mapaDominio, accent: "success", animationProfile: "breathe" },
  "mapas-mentais": { image: mapaDominio, accent: "info", animationProfile: "breathe" },
  analytics: { image: mapaDominio, accent: "purple", animationProfile: "breathe" },

  // ─── 🛋️ SANTUÁRIO DE ESTUDO FAMILY (mesa âmbar premium) ───
  "sessao-estudo": { image: sessaoEstudo, accent: "primary", animationProfile: "breathe" },
  dashboard: { image: sessaoEstudo, accent: "primary", animationProfile: "breathe" },
  planner: { image: sessaoEstudo, accent: "info", animationProfile: "float" },
  perfil: { image: sessaoEstudo, accent: "primary", animationProfile: "breathe" },

  // ─── 📚 BIBLIOTECA MÁGICA FAMILY (livros holográficos) ───
  apostilas: { image: apostilas, accent: "warning", animationProfile: "float" },
  cronicas: { image: apostilas, accent: "warning", animationProfile: "breathe" },
  revisor: { image: apostilas, accent: "success", animationProfile: "breathe" },

  // ─── 🚨 ER CORRIDOR FAMILY (corredor hospitalar tenso) ───
  plantao: { image: plantao, accent: "destructive", animationProfile: "pulse-soft" },
  "prova-pratica": { image: plantao, accent: "destructive", animationProfile: "breathe" },
  anamnese: { image: plantao, accent: "primary", animationProfile: "breathe" },
  entrevista: { image: plantao, accent: "purple", animationProfile: "breathe" },
  "image-quiz": { image: plantao, accent: "info", animationProfile: "breathe" },
  "banco-erros": { image: plantao, accent: "destructive", animationProfile: "breathe" },

  // ─── 🟢 IA CORE FAMILY (núcleo classificador matrix) ───
  conquistas: { image: classificador, accent: "warning", animationProfile: "breathe" },
  rankings: { image: classificador, accent: "warning", animationProfile: "breathe" },
  professor: { image: classificador, accent: "primary", animationProfile: "breathe" },
  admin: { image: classificador, accent: "destructive", animationProfile: "pulse-soft" },
  "admin-monitoring": { image: classificador, accent: "info", animationProfile: "pulse-soft" },
  "admin-classifier": { image: classificador, accent: "success", animationProfile: "pulse-soft" },
  "admin-coverage": { image: classificador, accent: "purple", animationProfile: "pulse-soft" },
  "admin-ceo": { image: classificador, accent: "primary", animationProfile: "pulse-soft" },
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
