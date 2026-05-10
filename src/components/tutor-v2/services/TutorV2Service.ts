import { supabase } from "@/integrations/supabase/client";

export const TutorV2Service = {
  async sendMessage(sessionId: string, message: string) {
    console.log("[TUTOR_V2_EDGE_CALL] functionName: tutor-v2-chat", { sessionId, message });
    try {
      const { data, error } = await supabase.functions.invoke("tutor-v2-chat", {
        body: { sessionId, message }
      });
      
      console.log("[TUTOR_V2_EDGE_RESULT]", { data, error });
      
      if (error) {
        console.error("[TUTOR_V2_EDGE_ERROR] Details:", {
          message: error.message,
          name: error.name,
          context: error.context
        });
        throw error;
      }
      return data;
    } catch (err: any) {
      console.error("[TUTOR_V2_INVOKE_CRASH]", err);
      if (err.message?.includes("Failed to send a request")) {
        throw new Error("Não foi possível conectar ao servidor do Tutor IA. Verifique sua conexão ou se a função está ativa.");
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
