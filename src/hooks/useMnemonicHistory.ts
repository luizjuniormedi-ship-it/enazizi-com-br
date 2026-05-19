import { useQuery } from "@tanstack/react-query";
import { fetchMnemonicHistory, type HistoryFilters } from "@/services/mnemonics";
import { useAuth } from "@/hooks/useAuth";

export function useMnemonicHistory(filters: HistoryFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["mnemonic-history", filters, user?.id],
    queryFn: () => fetchMnemonicHistory(filters),
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60, // 60 min GC
  });
}
