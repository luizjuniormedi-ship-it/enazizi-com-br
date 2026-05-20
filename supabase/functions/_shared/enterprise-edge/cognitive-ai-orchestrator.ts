import { StructuredLogger } from "./structured-logger.ts";
import { AiRequest, callAi } from "./ai-router.ts";
import { CognitiveState, AiTaskType } from "./ai-routing-engine.ts";

/**
 * ENAZIZI — Cognitive AI Orchestrator
 * High-level system to coordinate AI agents based on pedagogical strategy.
 */
export class CognitiveAiOrchestrator {
  private logger: StructuredLogger;
  private supabaseAdmin: any;

  constructor(supabaseAdmin: any, logger: StructuredLogger) {
    this.supabaseAdmin = supabaseAdmin;
    this.logger = logger;
  }

  /**
   * Executes a pedagogical task with full cognitive context.
   */
  async executePedagogicalTask(params: {
    userId: string;
    taskType: AiTaskType;
    messages: any[];
    cognitiveState?: CognitiveState;
    complexity?: "baixa" | "média" | "alta";
  }) {
    const { userId, taskType, messages, cognitiveState, complexity } = params;

    this.logger.info("COGNITIVE_ORCHESTRATION_START", `Task: ${taskType}`, { userId, cognitiveState });

    // 1. Enrich messages with pedagogical context if needed
    const enhancedMessages = [...messages];
    
    if (cognitiveState === "RETENÇÃO_FRACA" || cognitiveState === "RECUPERAÇÃO") {
      enhancedMessages.unshift({
        role: "system",
        content: `PEDAGOGICAL DIRECTIVE: Student is in ${cognitiveState} phase. 
        Focus on foundational concepts, use simpler analogies, and prioritize clarity over technical density.`
      });
    } else if (cognitiveState === "DOMÍNIO") {
      enhancedMessages.unshift({
        role: "system",
        content: `PEDAGOGICAL DIRECTIVE: Student is in ${cognitiveState} phase. 
        Focus on edge cases, complex clinical reasoning, and high-density technical details.`
      });
    }

    // 2. Call AI via Governance Router
    return await callAi({
      userId,
      taskType,
      cognitiveState,
      complexity,
      messages: enhancedMessages,
    }, this.logger, this.supabaseAdmin);
  }

  /**
   * Resolves cognitive state for a user and topic.
   */
  async resolveCognitiveState(userId: string, topic: string): Promise<CognitiveState> {
    try {
      // Fetch from profile or performance engine
      const { data } = await this.supabaseAdmin
        .from("user_topic_profiles")
        .select("cognitive_state")
        .eq("user_id", userId)
        .eq("topic", topic)
        .single();
      
      return (data?.cognitive_state as CognitiveState) || "NOVATO";
    } catch {
      return "NOVATO";
    }
  }
}
