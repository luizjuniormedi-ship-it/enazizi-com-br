import { callTutorV3 } from "@/lib/tutor/tutorClient";

const FRIENDLY_PROVIDER_ERROR = "O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.";

export const TutorV2Service = {
  async sendMessage(sessionId: string, message: string, pedagogicalInteraction?: string, newTopic?: string, retryCount = 0) {
    const payload = { 
      sessionId, 
      message, 
      pedagogicalInteraction, 
      newTopic,
      topic: null,
      fsrsContext: {},
      masteryState: "initial",
      history: []
    };
    
    try {
      const response = await callTutorV3(payload, { 
        functionName: "tutor-v3-premium",
        stream: false 
      });
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error("[TutorV2Service] sendMessage error:", err);
      
      // Estratégia de retry automático para erros transientes (máximo 2 retentativas)
      if (retryCount < 2 && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))) {
        console.warn(`[TUTOR_V2_RETRY] Attempt ${retryCount + 1}...`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.sendMessage(sessionId, message, pedagogicalInteraction, newTopic, retryCount + 1);
      }

      throw new Error(err.message || FRIENDLY_PROVIDER_ERROR);
    }
  },

  async generateLesson(sessionId: string) {
    try {
      const response = await callTutorV3({ sessionId }, { 
        functionName: "generate-tutor-v2-lesson",
        stream: false 
      });
      return await response.json();
    } catch (err: any) {
      console.error("[TutorV2Service] generateLesson error:", err);
      throw err;
    }
  },

  async createFlashcards(sessionId: string, topic: string, quantity = 10) {
    try {
      const response = await callTutorV3({ sessionId, topic, quantity }, { 
        functionName: "generate-flashcards",
        stream: false 
      });
      return await response.json();
    } catch (err: any) {
      console.error("[TutorV2Service] createFlashcards error:", err);
      throw err;
    }
  },

  async createMnemonic(sessionId: string, topic: string) {
    try {
      const response = await callTutorV3({ sessionId, tema: topic }, { 
        functionName: "generate-mnemonic",
        stream: false 
      });
      return await response.json();
    } catch (err: any) {
      console.error("[TutorV2Service] createMnemonic error:", err);
      throw err;
    }
  }
};
