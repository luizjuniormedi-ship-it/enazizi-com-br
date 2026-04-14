import { useMutation } from "@tanstack/react-query";
import { submitFeedback } from "@/services/mnemonics";
import type { FeedbackPayload } from "@/types/mnemonics";

export function useSubmitMnemonicFeedback() {
  return useMutation<void, Error, FeedbackPayload>({
    mutationFn: submitFeedback,
  });
}
