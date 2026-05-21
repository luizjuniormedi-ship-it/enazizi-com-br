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
  async sendMessage(sessionId: string, message: string, pedagogicalInteraction?: string, newTopic?: string, retryCount = 0) {
    const requestId = crypto.randomUUID();
    const payload = { 
      sessionId, 
      message, 
      pedagogicalInteraction, 
      newTopic,
      requestId,
      topic: null, // Deixe o backend decidir ou use null para não forçar
      fsrsContext: {},
      masteryState: "initial",
      history: [] // Opcional, o backend pode ler do DB
    };
    
    // [TUTOR_04_PAYLOAD_BUILT]
    console.log(`[TUTOR_04_PAYLOAD_BUILT] requestId=${requestId}`, payload);

    // [TUTOR_05_INVOKE_START]
    console.log(`[TUTOR_05_INVOKE_START] requestId=${requestId}`);

    // [TUTOR_06_FUNCTION_NAME]
    console.log(`[TUTOR_06_FUNCTION_NAME] function=tutor-v3-premium`);

    console.log("[TUTOR_V3_EDGE_CALL] functionName: tutor-v3-premium", payload);
    try {
      const { data, error } = await supabase.functions.invoke("tutor-v3-premium", {
        body: payload
      });
      
      if (error) {
        // [TUTOR_08_INVOKE_ERROR_RAW]
        console.log(`[TUTOR_08_INVOKE_ERROR_RAW]`, error);
        // Estratégia de retry automático para erros transientes (máximo 2 retentativas)
        if (retryCount < 2 && error.message?.includes("Failed to fetch")) {
          console.warn(`[TUTOR_V2_RETRY] Attempt ${retryCount + 1}...`);
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return this.sendMessage(sessionId, message, pedagogicalInteraction, newTopic, retryCount + 1);
        }

        const structured = await readFunctionError(error);
        const code = structured?.error || structured?.code;
        if (code === "AI_PROVIDER_NOT_CONFIGURED" || code === "AI_PROVIDER_UNAVAILABLE" || code === "AI_RATE_LIMITED" || code === "AI_QUOTA_EXHAUSTED") {
          throw new Error(structured?.message || FRIENDLY_PROVIDER_ERROR);
        }
        throw new Error(structured?.message || error.message || FRIENDLY_PROVIDER_ERROR);
      }
      // [TUTOR_07_INVOKE_RESPONSE_RAW]
      console.log(`[TUTOR_07_INVOKE_RESPONSE_RAW]`, data);
      return data;
    } catch (err: any) {
      if (retryCount < 2 && (err.message?.includes("NetworkError") || err.message?.includes("AbortError"))) {
        console.warn(`[TUTOR_V2_RETRY_CATCH] Attempt ${retryCount + 1}...`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.sendMessage(sessionId, message, retryCount + 1);
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
