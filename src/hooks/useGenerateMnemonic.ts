import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateMnemonic } from "@/services/mnemonics";
import type { MnemonicRequest, MnemonicApiResponse } from "@/types/mnemonics";

export function useGenerateMnemonic() {
  const queryClient = useQueryClient();

  return useMutation<MnemonicApiResponse, Error, MnemonicRequest>({
    mutationFn: generateMnemonic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mnemonic-history"] });
    },
  });
}
