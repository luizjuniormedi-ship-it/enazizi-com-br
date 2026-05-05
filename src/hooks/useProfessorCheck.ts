import { useUserRoles } from "./useUserRoles";

export const useProfessorCheck = () => {
  const { isProfessor, isAdmin, loading } = useUserRoles();
  return { isProfessor: isProfessor || isAdmin, loading };
};
