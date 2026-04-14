/**
 * Mnemonic Studio — API service layer.
 * Calls the generate-medical-mnemonic edge function.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  MnemonicStudioInput,
  MnemonicStudioResponse,
} from "./mnemonicStudioTypes";

export async function generateMnemonicStudio(
  input: MnemonicStudioInput
): Promise<MnemonicStudioResponse> {
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
    const { data, error } = await supabase.functions.invoke("generate-medical-mnemonic", {
      body: input,
    });

    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const payload = await ctx.json();
          return {
            success: false,
            error: payload?.error || "Erro ao gerar mnemônico.",
            agent_logs: payload?.agent_logs,
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

    return data as MnemonicStudioResponse;
  } catch (err) {
    console.error("[MnemonicStudio] Service error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro inesperado.",
    };
  }
}
