import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateMnemonic } from "@/services/mnemonics";
import type { MnemonicRequest, MnemonicApiResponse } from "@/types/mnemonics";
import { emitShadowEvent } from "@/lib/shadowAdaptive";

export function useGenerateMnemonic() {
  const queryClient = useQueryClient();

  return useMutation<MnemonicApiResponse, Error, MnemonicRequest>({
    mutationFn: generateMnemonic,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mnemonic-history"] });
      // Shadow Adaptive Layer (Fase 3A) — observacional.
      void emitShadowEvent({
        module: "mnemonic",
        event: "mnemonic_created",
        topic: (variables as any)?.topic ?? null,
      });
    },
  });
}
