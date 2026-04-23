/**
 * Mapeia ids de módulos do ENAFLIX para suas ilustrações hero (3D cartoon).
 * Módulos sem entrada caem no fallback de ícone Lucide com gradiente.
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

export const ENAFLIX_MASCOT = mascot;

export const ENAFLIX_HERO_ART: Record<string, string> = {
  chatgpt: tutorIA,
  simulados,
  "banco-erros": bancoErros,
  plantao,
  mnemonico,
  anamnese,
  flashcards,
  conquistas,
  "mapa-dominio": mapaDominio,
};

export function getHeroArt(moduleId: string): string | undefined {
  return ENAFLIX_HERO_ART[moduleId];
}
