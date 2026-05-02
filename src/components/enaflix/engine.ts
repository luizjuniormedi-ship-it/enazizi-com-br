/**
 * ENAFLIX Global Visual Engine — barrel export (Fase 5)
 * Importe daqui em qualquer tela:
 *
 *   import {
 *     Enaflix3DButton,
 *     EnaflixCinematicCard,
 *     EnaflixBackgroundFX,
 *     EnaflixTutorHUD,
 *     EnaflixPlayerOverlay,
 *     EnaflixModal,
 *     EnaflixLoader,
 *     EnaflixSectionTitle,
 *   } from "@/components/enaflix/engine";
 */

export { Enaflix3DButton } from "./Enaflix3DButton";
export type {
  Enaflix3DButtonProps,
  Enaflix3DButtonVariant,
  Enaflix3DButtonSize,
} from "./Enaflix3DButton";

export { EnaflixCinematicCard } from "./EnaflixCinematicCard";
export type {
  EnaflixCinematicCardProps,
  EnaflixCardVariant,
} from "./EnaflixCinematicCard";

export { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
export { EnaflixTutorHUD } from "./EnaflixTutorHUD";
export { EnaflixPlayerOverlay } from "./EnaflixPlayerOverlay";
export { EnaflixModal } from "./EnaflixModal";
export { EnaflixLoader } from "./EnaflixLoader";
export { EnaflixSectionTitle } from "./EnaflixSectionTitle";

// Reexport componentes existentes (já parte da engine):
export { EnaflixBadge } from "../EnaflixBadge";
export { EnaflixHero } from "../EnaflixHero";
export { EnaflixSection } from "../EnaflixSection";
export { EnaflixRow as EnaflixPosterRow } from "../EnaflixRow";
export { EnaflixAmbientParticles as EnaflixFloatingParticles } from "../EnaflixAmbientParticles";
