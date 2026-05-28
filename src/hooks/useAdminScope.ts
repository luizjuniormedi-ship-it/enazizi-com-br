/**
 * useAdminScope — deriva escopos enterprise a partir das roles existentes em
 * `user_roles` (sem mexer no schema). Permite filtragem do AdminSidebarEnterprise
 * por área de responsabilidade.
 *
 * Mapeamento atual (pragmático, baseado nas roles existentes):
 *  - super_admin       → role 'admin'              (acesso total)
 *  - admin_pedagogico  → role 'professor' OU 'coordinator'
 *  - admin_operacional → role 'institutional_admin' OU 'admin'
 *  - devops            → role 'admin' (até criarmos role própria)
 *  - semantic_board    → role 'semantic_board'     (governança semântica)
 *  - platform_admin    → role 'platform_admin'     (gestão de plataforma)
 */
import { useUserRoles } from "./useUserRoles";

export type AdminScope =
  | "super_admin"
  | "admin_pedagogico"
  | "admin_operacional"
  | "devops"
  | "semantic_board"
  | "platform_admin";

export interface AdminScopeResult {
  scopes: AdminScope[];
  isSuperAdmin: boolean;
  isPedagogico: boolean;
  isOperacional: boolean;
  isDevops: boolean;
  isSemanticBoard: boolean;
  isPlatformAdmin: boolean;
  hasAny: boolean;
  loading: boolean;
}

export const useAdminScope = (): AdminScopeResult => {
  const { roles, loading } = useUserRoles();

  const isSuperAdmin = roles.includes("admin");
  const isPedagogico =
    isSuperAdmin || roles.includes("professor") || roles.includes("coordinator");
  const isOperacional =
    isSuperAdmin || roles.includes("institutional_admin");
  // Devops: hoje só admin completo. Futuramente: role 'devops_admin'.
  const isDevops = isSuperAdmin;
  const isSemanticBoard = isSuperAdmin || roles.includes("semantic_board");
  const isPlatformAdmin = isSuperAdmin || roles.includes("platform_admin");

  const scopes: AdminScope[] = [];
  if (isSuperAdmin) scopes.push("super_admin");
  if (isPedagogico) scopes.push("admin_pedagogico");
  if (isOperacional) scopes.push("admin_operacional");
  if (isDevops) scopes.push("devops");
  if (isSemanticBoard) scopes.push("semantic_board");
  if (isPlatformAdmin) scopes.push("platform_admin");

  return {
    scopes,
    isSuperAdmin,
    isPedagogico,
    isOperacional,
    isDevops,
    isSemanticBoard,
    isPlatformAdmin,
    hasAny: scopes.length > 0,
    loading,
  };
};
