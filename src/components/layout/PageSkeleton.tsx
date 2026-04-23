import { CinematicPageLoader } from "@/components/cinematic";

/**
 * PageSkeleton — wrapper legado.
 * Hoje delega para CinematicPageLoader (loading premium global).
 * Mantido para compatibilidade com chamadas existentes.
 */
const PageSkeleton = () => <CinematicPageLoader module="dashboard" />;

export default PageSkeleton;
