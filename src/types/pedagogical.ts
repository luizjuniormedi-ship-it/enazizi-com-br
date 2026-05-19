
export type TutorMode = 'recovery' | 'normal' | 'mastery';
export type CognitiveState = 'confused' | 'stable' | 'mastery' | 'fatigued';

export interface PedagogicalSession {
  id: string;
  userId: string;
  conversationId: string | null;
  topic: string;
  specialty: string | null;
  
  currentBlock: number;
  completedBlocks: number[];
  totalBlocks: number;
  
  tutorMode: TutorMode;
  cognitiveState: CognitiveState;
  comprehensionScore: number;
  difficultyLevel: number;
  
  metadata: {
    interaction_count: number;
    recovery_activations: number;
    mastery_activations: number;
    average_response_time_ms: number;
    preferred_explanation_style: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

export interface BlockGenerationParams {
  blockNumber: number;
  topic: string;
  sessionState: Partial<PedagogicalSession>;
  previousInteraction?: string;
}
