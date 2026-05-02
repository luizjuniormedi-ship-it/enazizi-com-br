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
 *
 * Quando criarmos as roles dedicadas (`pedagogical_admin`, `ops_admin`,
 * `devops_admin`), basta estender o mapeamento abaixo.
 */
import { useUserRoles } from "./useUserRoles";

export type AdminScope =
  | "super_admin"
  | "admin_pedagogico"
  | "admin_operacional"
  | "devops";

export interface AdminScopeResult {
  scopes: AdminScope[];
  isSuperAdmin: boolean;
  isPedagogico: boolean;
  isOperacional: boolean;
  isDevops: boolean;
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

  const scopes: AdminScope[] = [];
  if (isSuperAdmin) scopes.push("super_admin");
  if (isPedagogico) scopes.push("admin_pedagogico");
  if (isOperacional) scopes.push("admin_operacional");
  if (isDevops) scopes.push("devops");

  return {
    scopes,
    isSuperAdmin,
    isPedagogico,
    isOperacional,
    isDevops,
    hasAny: scopes.length > 0,
    loading,
  };
};
