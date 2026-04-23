import { ModulePageLoader } from "@/components/cinematic";

/**
 * PageSkeleton — wrapper legado.
 * Hoje delega para `ModulePageLoader`, que detecta a rota automaticamente
 * e renderiza a cena identitária do módulo ativo (Tutor neural, Simulado HUD,
 * Flashcard memory, etc.) sem resetar a atmosfera global.
 *
 * Mantido apenas para compatibilidade com chamadas existentes (Suspense
 * fallback espalhado pelo app).
 */
const PageSkeleton = () => <ModulePageLoader />;

export default PageSkeleton;
