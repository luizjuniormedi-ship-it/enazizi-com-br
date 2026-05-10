import { supabase } from "@/integrations/supabase/client";

export const TutorV2Service = {
  async sendMessage(sessionId: string, message: string) {
    const { data, error } = await supabase.functions.invoke("tutor-v2-chat", {
      body: { sessionId, message }
    });
    if (error) throw error;
    return data;
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
