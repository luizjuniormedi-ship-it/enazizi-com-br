import { useMutation, useQueryClient } from "@tanstack/react-query";
import { regenerateMnemonic } from "@/services/mnemonics";
import type { RegeneratePayload, MnemonicApiResponse } from "@/types/mnemonics";

export function useRegenerateMnemonic() {
  const queryClient = useQueryClient();

  return useMutation<MnemonicApiResponse, Error, RegeneratePayload>({
    mutationFn: regenerateMnemonic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mnemonic-history"] });
    },
  });
}
