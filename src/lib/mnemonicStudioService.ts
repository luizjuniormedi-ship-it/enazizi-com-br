/**
 * Mnemonic Studio — API service layer.
 * Sends to the mnemonic-studio edge function and parses response.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  MnemonicStudioInput,
  MnemonicStudioResponse,
  MnemonicStudioData,
} from "./mnemonicStudioTypes";

export async function generateMnemonicStudio(
  input: MnemonicStudioInput
): Promise<MnemonicStudioResponse> {
  // Client-side validation
  if (!input.tema.trim()) {
    return { success: false, error: "Informe o tema." };
  }
  if (input.termos.length < 3) {
    return { success: false, error: "Informe ao menos 3 termos." };
  }
  if (input.termos.length > 7) {
    return { success: false, error: "Máximo de 7 termos." };
  }
  if (!input.estilo.trim()) {
    return { success: false, error: "Selecione um estilo." };
  }
  if (!input.publico.trim()) {
    return { success: false, error: "Selecione o público-alvo." };
  }

  try {
    const { data, error } = await supabase.functions.invoke("mnemonic-studio", {
      body: input,
    });

    if (error) {
      // Try to extract error from response context
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const payload = await ctx.json();
          return {
            success: false,
            error: payload?.error || "Erro ao gerar mnemônico.",
          };
        } catch {
          // fall through
        }
      }
      return { success: false, error: "Erro ao gerar mnemônico." };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "Resposta inválida do servidor." };
    }

    // The edge function returns the full contract
    const response = data as MnemonicStudioResponse;
    return response;
  } catch (err) {
    console.error("[MnemonicStudio] Service error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro inesperado.",
    };
  }
}
