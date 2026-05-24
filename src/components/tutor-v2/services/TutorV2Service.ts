import { callTutorV3 } from "@/lib/tutor/tutorClient";

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
    const correlationId = crypto.randomUUID();
    const payload = { 
      sessionId, 
      message, 
      pedagogicalInteraction, 
      newTopic,
      requestId,
      topic: null,
      fsrsContext: {},
      masteryState: "initial",
      history: []
    };
    
    // [TUTOR_V3_01_SEND]
    console.log(`[TUTOR_V3_01_SEND] requestId=${requestId} text="${message.slice(0, 50)}..."`);
    
    // [TUTOR_V3_02_FUNCTION_NAME]
    console.log(`[TUTOR_V3_02_FUNCTION_NAME] calling: tutor-v3-premium`);

    // [TUTOR_V3_03_SUPABASE_URL]
    console.log(`[TUTOR_V3_03_SUPABASE_URL] endpoint: ${import.meta.env.VITE_SUPABASE_URL}`);

    // [TUTOR_V3_04_HAS_AUTH_SESSION]
    const { data: { session: authSession } } = await supabase.auth.getSession();
    console.log(`[TUTOR_V3_04_HAS_AUTH_SESSION] tokenPresent: ${!!authSession?.access_token} userId: ${authSession?.user?.id}`);

    // [TUTOR_V3_05_PAYLOAD]
    console.log(`[TUTOR_V3_05_PAYLOAD] requestId=${requestId}`, payload);

    // [TUTOR_V3_06_INVOKE_START]
    console.log(`[TUTOR_V3_06_INVOKE_START] requestId=${requestId}`);

    try {
      const { data, error } = await supabase.functions.invoke("tutor-v3-premium", {
        body: payload,
        headers: { "x-correlation-id": correlationId }
      });
      
      if (error) {
        // [TUTOR_V3_08_INVOKE_ERROR]
        console.log(`[TUTOR_V3_08_INVOKE_ERROR]`, error);
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
      // [TUTOR_V3_07_INVOKE_DATA]
      console.log(`[TUTOR_V3_07_INVOKE_DATA]`, data);
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

  async createFlashcards(sessionId: string, topic: string, quantity = 10) {
    const { data, error } = await supabase.functions.invoke("generate-flashcards", {
      body: { sessionId, topic, quantity }
    });
    if (error) throw error;
    return data;
  },

  async createMnemonic(sessionId: string, topic: string) {
    const { data, error } = await supabase.functions.invoke("generate-mnemonic", {
      body: { sessionId, tema: topic }
    });
    if (error) throw error;
    return data;
  }
};
