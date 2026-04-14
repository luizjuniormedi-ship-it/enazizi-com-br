import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleFavorite } from "@/services/mnemonics";

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: toggleFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mnemonic-history"] });
    },
  });
}
