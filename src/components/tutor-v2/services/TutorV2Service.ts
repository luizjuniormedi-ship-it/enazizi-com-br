import { supabase } from "@/integrations/supabase/client";

const FRIENDLY_PROVIDER_ERROR = "O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.";

async function readFunctionError(err: any) {
  const context = err?.context;
  if (context && typeof context.json === "function") {
    try {
      return await context.json();
    } catch {
      // fall through
    }
  }
  if (context && typeof context.text === "function") {
    try {
      const text = await context.text();
      return text ? { message: text } : null;
    } catch {
      // fall through
    }
  }
  return null;
}

export const TutorV2Service = {
  async sendMessage(sessionId: string, message: string) {
    console.log("[TUTOR_V2_EDGE_CALL] functionName: tutor-v2-chat", { sessionId, message });
    try {
      const { data, error } = await supabase.functions.invoke("tutor-v2-chat", {
        body: { sessionId, message }
      });
      
      console.log("[TUTOR_V2_EDGE_RESULT]", { data, error });
      
      if (error) {
        const structured = await readFunctionError(error);
        console.error("[TUTOR_V2_EDGE_ERROR] Details:", {
          message: error.message,
          name: error.name,
          structured,
        });

        const code = structured?.error || structured?.code;
        if (code === "AI_PROVIDER_NOT_CONFIGURED" || code === "AI_PROVIDER_UNAVAILABLE" || code === "AI_RATE_LIMITED" || code === "AI_QUOTA_EXHAUSTED") {
          throw new Error(structured?.message || FRIENDLY_PROVIDER_ERROR);
        }
        throw new Error(structured?.message || error.message || FRIENDLY_PROVIDER_ERROR);
      }
      return data;
    } catch (err: any) {
      console.error("[TUTOR_V2_INVOKE_CRASH]", err);
      if (err.message?.includes("Failed to send a request")) {
        throw new Error("Não foi possível conectar ao servidor do Tutor IA. Verifique sua conexão ou se a função está ativa.");
      }
      if (err.message?.includes("AI provider error")) {
        throw new Error(FRIENDLY_PROVIDER_ERROR);
      }
      throw err;
    }
  },

  async generateLesson(sessionId: string) {
    const { data, error } = await supabase.functions.invoke("generate-tutor-v2-lesson", {
      body: { sessionId }
    });
    if (error) throw error;
    return data;
  },

  async createFsrsCards(sessionId: string, topic: string) {
    const { data, error } = await supabase.functions.invoke("tutor-v2-create-fsrs", {
      body: { sessionId, topic }
    });
    if (error) throw error;
    return data;
  },

  async createMnemonic(sessionId: string, topic: string) {
    const { data, error } = await supabase.functions.invoke("tutor-v2-create-mnemonic", {
      body: { sessionId, topic }
    });
    if (error) throw error;
    return data;
  }
};
